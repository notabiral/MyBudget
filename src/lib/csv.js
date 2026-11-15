// CSV import and export.
//
// Two formats are supported:
//
// 1. The legacy year grid — the same shape the original app exported, so
//    old exports still open the same way:
//      Category,Jan,Feb,...,Dec
//      <one row per expense category>
//      Total,...
//      <one row per income category>
//      Extra,...          (money in minus expenses)
//      Auto Savings,...   (extra carried forward within the year)
//      Manual Savings,... (net savings per month)
//    Values are now consistently written with two decimals; the old app
//    wrote raw numbers. The filename stays budget_<year>.csv.
//
// 2. A transactions ledger: Date,Type,Category,Account,Note,Amount —
//    one row per entry, signed amounts for savings.

import { MONTH_ABBR, clampDay, monthKeyOf, parseLooseDate, toISO } from "./dates.js";
import { minorToPounds, poundsToMinor } from "./money.js";
import { monthlyCategoryTotals, yearSeries } from "./stats.js";
import { newId } from "./ids.js";

function csvCell(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function pounds(minor) {
  return minorToPounds(minor).toFixed(2);
}

export function exportGridCSV(state, year) {
  const rows = [["Category", ...MONTH_ABBR]];
  const totals = monthlyCategoryTotals(state, year);
  for (const category of state.categories) {
    if (category.kind !== "expense") continue;
    const row = totals.get(category.id);
    const hasValues = row.some((v) => v !== 0);
    if (category.archived && !hasValues) continue;
    rows.push([category.name, ...row.map(pounds)]);
  }
  const series = yearSeries(state, year);
  rows.push(["Total", ...series.map((m) => pounds(m.expenses))]);
  // One row per income category, so the grid stays truthful when there is
  // more than one income source. In the migrated single-Salary case this
  // is exactly the old "Salary" row.
  for (const category of state.categories) {
    if (category.kind !== "income") continue;
    const monthly = new Array(12).fill(0);
    for (const t of state.transactions) {
      if (t.kind !== "income" || t.categoryId !== category.id) continue;
      if (!t.date.startsWith(`${year}-`)) continue;
      monthly[Number(t.date.slice(5, 7)) - 1] += t.amountMinor;
    }
    const hasValues = monthly.some((v) => v !== 0);
    if (category.archived && !hasValues) continue;
    rows.push([category.name, ...monthly.map(pounds)]);
  }
  rows.push(["Extra", ...series.map((m) => pounds(m.extra))]);
  rows.push(["Auto Savings", ...series.map((m) => pounds(m.carriedExtra))]);
  rows.push(["Manual Savings", ...series.map((m) => pounds(m.savings))]);
  return rows.map((r) => r.map(csvCell).join(",")).join("\n") + "\n";
}

export function exportTransactionsCSV(state, year) {
  const rows = [["Date", "Type", "Category", "Account", "Note", "Amount"]];
  const categoryById = new Map(state.categories.map((c) => [c.id, c.name]));
  const accountById = new Map(state.accounts.map((a) => [a.id, a.name]));
  const txns = state.transactions
    .filter((t) => t.date.startsWith(`${year}-`))
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));
  for (const t of txns) {
    rows.push([
      t.date,
      t.kind === "income" ? "Income" : t.kind === "expense" ? "Expense" : "Saving",
      categoryById.get(t.categoryId) || "",
      accountById.get(t.accountId) || "",
      t.note || "",
      pounds(t.amountMinor),
    ]);
  }
  return rows.map((r) => r.map(csvCell).join(",")).join("\n") + "\n";
}

/** Minimal RFC-4180-ish parser: quotes, escaped quotes, CRLF. */
export function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const src = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const GRID_SUMMARY_ROWS = new Set([
  "total",
  "extra",
  "auto savings",
  "manual savings",
  "accounts",
]);

function detectFormat(rows) {
  if (rows.length === 0) return "empty";
  const header = rows[0].map((c) => c.trim().toLowerCase());
  if (
    header[0] === "category" &&
    MONTH_ABBR.some((m) => header.includes(m.toLowerCase()))
  ) {
    return "grid";
  }
  if (header.includes("date") && header.includes("amount")) return "ledger";
  return "unknown";
}

/**
 * Parse CSV text into importable transactions.
 * `year` is used for grid imports (the grid has no year column).
 * `memberId` is stamped on every imported transaction.
 * Returns { format, transactions, newCategoryNames, newAccountNames,
 * skipped, skippedRows, errors }. `skippedRows` names every skipped row
 * ({ row, reason }) using the file's row numbers, header row included,
 * so the report matches what the user sees in their spreadsheet.
 * Transactions carry categoryName/accountName (not ids) — the caller
 * resolves them against state, creating categories as needed.
 */
export function parseImportCSV(text, { year, memberId, now = new Date().toISOString() } = {}) {
  const rows = parseCSV(text);
  const format = detectFormat(rows);
  const result = {
    format,
    transactions: [],
    newCategoryNames: [],
    newAccountNames: [],
    skipped: 0,
    skippedRows: [],
    errors: [],
  };
  const skip = (row, reason) => {
    result.skipped += 1;
    result.skippedRows.push({ row, reason });
  };
  if (format === "empty") {
    result.errors.push("The file is empty.");
    return result;
  }
  if (format === "unknown") {
    result.errors.push(
      "Unrecognised format. Expected a MyBudget year grid (Category, Jan, Feb…) or a transactions ledger (Date, Type, Category, Account, Note, Amount)."
    );
    return result;
  }

  const seenCategories = new Set();
  const seenAccounts = new Set();
  const rememberCategory = (name) => {
    if (name && !seenCategories.has(name)) {
      seenCategories.add(name);
      result.newCategoryNames.push(name);
    }
  };
  const rememberAccount = (name) => {
    if (name && !seenAccounts.has(name)) {
      seenAccounts.add(name);
      result.newAccountNames.push(name);
    }
  };

  if (format === "grid") {
    const header = rows[0].map((c) => c.trim().toLowerCase());
    const monthCols = MONTH_ABBR.map((m) => header.indexOf(m.toLowerCase()));
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 1;
      const label = (row[0] || "").trim();
      if (!label) continue;
      if (GRID_SUMMARY_ROWS.has(label.toLowerCase())) continue;
      const isIncome = label.toLowerCase() === "salary";
      for (let m = 0; m < 12; m++) {
        const col = monthCols[m];
        if (col < 0) continue;
        const raw = (row[col] || "").trim();
        if (raw === "") continue;
        const value = Number(raw);
        if (!Number.isFinite(value)) {
          skip(rowNumber, `${MONTH_ABBR[m]} amount "${raw}" is not a number`);
          continue;
        }
        if (value === 0) {
          skip(rowNumber, `${MONTH_ABBR[m]} amount is 0`);
          continue;
        }
        if (value < 0) {
          skip(rowNumber, `${MONTH_ABBR[m]} amount is negative`);
          continue;
        }
        rememberCategory(label);
        result.transactions.push({
          id: newId("txn"),
          date: toISO(year, m + 1, 1),
          kind: isIncome ? "income" : "expense",
          amountMinor: poundsToMinor(value),
          categoryName: label,
          accountName: "",
          memberId,
          note: "Imported from CSV",
          ruleId: null,
          periodKey: null,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
    return result;
  }

  // Ledger format.
  const header = rows[0].map((c) => c.trim().toLowerCase());
  const col = (name) => header.indexOf(name);
  const dateCol = col("date");
  const typeCol = col("type");
  const catCol = col("category");
  const acctCol = col("account");
  const noteCol = col("note");
  const amountCol = col("amount");
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 1;
    const rawDate = (row[dateCol] || "").trim();
    const date = parseLooseDate(rawDate);
    const rawAmount = (row[amountCol] || "").trim();
    const amount = Number(rawAmount.replace(/[£$€,]/g, ""));
    if (!date) {
      skip(rowNumber, rawDate === "" ? "no date" : `date "${rawDate}" is not a real date`);
      continue;
    }
    if (rawAmount === "") {
      skip(rowNumber, "no amount");
      continue;
    }
    if (!Number.isFinite(amount)) {
      skip(rowNumber, `amount "${rawAmount}" is not a number`);
      continue;
    }
    if (amount === 0) {
      skip(rowNumber, "amount is 0");
      continue;
    }
    const typeText = (row[typeCol] || "").trim().toLowerCase();
    let kind = "expense";
    if (typeText.startsWith("inc")) kind = "income";
    else if (typeText.startsWith("sav")) kind = "saving";
    else if (typeText.startsWith("exp")) kind = "expense";
    else if (amount < 0) kind = "expense";
    const categoryName = catCol >= 0 ? (row[catCol] || "").trim() : "";
    const accountName = acctCol >= 0 ? (row[acctCol] || "").trim() : "";
    if (kind !== "saving" && amount < 0) {
      skip(rowNumber, "amount is negative");
      continue;
    }
    rememberCategory(categoryName);
    if (kind === "saving") rememberAccount(accountName);
    result.transactions.push({
      id: newId("txn"),
      date,
      kind,
      amountMinor: poundsToMinor(Math.abs(amount)) * (kind === "saving" && amount < 0 ? -1 : 1),
      categoryName,
      accountName,
      memberId,
      note: noteCol >= 0 ? (row[noteCol] || "").trim() : "",
      ruleId: null,
      periodKey: null,
      createdAt: now,
      updatedAt: now,
    });
  }
  return result;
}

/** Exact-duplicate key for import dedupe. */
export function dedupeKey(t, categoryName, accountName) {
  return [t.date, t.kind, t.amountMinor, categoryName || "", accountName || "", t.note || ""].join("|");
}

export { clampDay, monthKeyOf };
