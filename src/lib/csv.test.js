import { describe, expect, it } from "vitest";
import { blankState } from "./model.js";
import { exportGridCSV, exportTransactionsCSV, parseCSV, parseImportCSV } from "./csv.js";

function sampleState() {
  const state = blankState();
  const rent = state.categories.find((c) => c.name === "Rent");
  const groceries = state.categories.find((c) => c.name === "Groceries");
  const salary = state.categories.find((c) => c.name === "Salary");
  const memberId = state.members[0].id;
  state.transactions = [
    { id: "t1", date: "2026-01-01", kind: "income", amountMinor: 300000, categoryId: salary.id, accountId: null, memberId, note: "", ruleId: null, periodKey: null, createdAt: "", updatedAt: "" },
    { id: "t2", date: "2026-01-01", kind: "expense", amountMinor: 102500, categoryId: rent.id, accountId: null, memberId, note: "", ruleId: null, periodKey: null, createdAt: "", updatedAt: "" },
    { id: "t3", date: "2026-01-05", kind: "expense", amountMinor: 24075, categoryId: groceries.id, accountId: null, memberId, note: "", ruleId: null, periodKey: null, createdAt: "", updatedAt: "" },
    { id: "t4", date: "2026-02-01", kind: "income", amountMinor: 300000, categoryId: salary.id, accountId: null, memberId, note: "", ruleId: null, periodKey: null, createdAt: "", updatedAt: "" },
    { id: "t5", date: "2026-02-01", kind: "expense", amountMinor: 102500, categoryId: rent.id, accountId: null, memberId, note: "", ruleId: null, periodKey: null, createdAt: "", updatedAt: "" },
  ];
  return state;
}

describe("exportGridCSV", () => {
  it("keeps the legacy shape: header, category rows, Total, Salary, Extra, Auto Savings, Manual Savings", () => {
    const csv = exportGridCSV(sampleState(), 2026);
    const rows = parseCSV(csv);
    expect(rows[0]).toEqual(["Category", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]);
    const labels = rows.map((r) => r[0]);
    expect(labels).toContain("Rent");
    expect(labels).toContain("Total");
    expect(labels).toContain("Salary");
    expect(labels).toContain("Extra");
    expect(labels).toContain("Auto Savings");
    expect(labels).toContain("Manual Savings");
    const rent = rows.find((r) => r[0] === "Rent");
    expect(rent[1]).toBe("1025.00");
    expect(rent[2]).toBe("1025.00");
    expect(rent[3]).toBe("0.00");
    const total = rows.find((r) => r[0] === "Total");
    expect(total[1]).toBe("1265.75");
    const extra = rows.find((r) => r[0] === "Extra");
    expect(extra[1]).toBe("1734.25");
    const auto = rows.find((r) => r[0] === "Auto Savings");
    expect(auto[1]).toBe("1734.25");
    expect(auto[2]).toBe("3709.25");
  });
});

describe("exportTransactionsCSV", () => {
  it("writes one row per transaction in date order", () => {
    const rows = parseCSV(exportTransactionsCSV(sampleState(), 2026));
    expect(rows[0]).toEqual(["Date", "Type", "Category", "Account", "Note", "Amount"]);
    expect(rows).toHaveLength(6);
    expect(rows[1][0]).toBe("2026-01-01");
    expect(rows[1][1]).toBe("Income");
    expect(rows[1][5]).toBe("3000.00");
  });
});

describe("parseCSV", () => {
  it("handles quotes, commas and CRLF", () => {
    const rows = parseCSV('a,"b,c","d""e"\r\n1,2,3\r\n');
    expect(rows).toEqual([
      ["a", "b,c", 'd"e'],
      ["1", "2", "3"],
    ]);
  });
});

describe("parseImportCSV", () => {
  it("imports a legacy grid, skipping summary rows and zeros", () => {
    const text = [
      "Category,Jan,Feb,Mar",
      "Rent,1025.00,1025.00,0",
      "Grocery,210.50,188.20,",
      "Total,1235.50,1213.20,0",
      "Salary,3600.00,3600.00,3600.00",
      "Extra,2364.50,2386.80,3600.00",
    ].join("\n");
    const result = parseImportCSV(text, { year: 2026, memberId: "m1" });
    expect(result.format).toBe("grid");
    // 2 rent + 2 grocery + 3 salary = 7
    expect(result.transactions).toHaveLength(7);
    expect(result.transactions.filter((t) => t.kind === "income")).toHaveLength(3);
    expect(result.transactions[0].date).toBe("2026-01-01");
    expect(result.newCategoryNames).toEqual(["Rent", "Grocery", "Salary"]);
    expect(result.errors).toEqual([]);
  });

  it("imports a transactions ledger, keeping saving signs", () => {
    const text = [
      "Date,Type,Category,Account,Note,Amount",
      "2026-01-05,Expense,Groceries,,Weekly shop,64.20",
      "2026-01-07,Saving,,ISA,Payday transfer,200.00",
      "2026-01-20,Saving,,ISA,Withdrew for car,-50.00",
      "2026-01-01,Income,Salary,,Pay,2900.00",
    ].join("\n");
    const result = parseImportCSV(text, { year: 2026, memberId: "m1" });
    expect(result.format).toBe("ledger");
    expect(result.transactions).toHaveLength(4);
    const saving = result.transactions.find((t) => t.note === "Payday transfer");
    expect(saving.amountMinor).toBe(20000);
    const withdrawal = result.transactions.find((t) => t.note === "Withdrew for car");
    expect(withdrawal.amountMinor).toBe(-5000);
    expect(result.newAccountNames).toEqual(["ISA"]);
  });

  it("rejects unknown formats and counts bad rows as skipped", () => {
    const unknown = parseImportCSV("hello,world\n1,2\n", { year: 2026, memberId: "m1" });
    expect(unknown.format).toBe("unknown");
    expect(unknown.errors.length).toBe(1);
    const bad = parseImportCSV(
      "Date,Type,Category,Account,Note,Amount\nnot-a-date,Expense,Food,,x,10.00\n2026-01-05,Expense,Food,,x,0\n",
      { year: 2026, memberId: "m1" }
    );
    expect(bad.format).toBe("ledger");
    expect(bad.transactions).toHaveLength(0);
    expect(bad.skipped).toBe(2);
  });

  it("accepts DD/MM/YYYY ledger dates alongside ISO dates", () => {
    const text = [
      "Date,Type,Category,Account,Note,Amount",
      "15/11/2026,Expense,Groceries,,Weekly shop,64.20",
      "5/1/2026,Income,Salary,,Pay,2900.00",
      "2026-01-05,Expense,Groceries,,ISO row,10.00",
    ].join("\n");
    const result = parseImportCSV(text, { year: 2026, memberId: "m1" });
    expect(result.format).toBe("ledger");
    expect(result.transactions).toHaveLength(3);
    expect(result.transactions.map((t) => t.date)).toEqual([
      "2026-11-15",
      "2026-01-05",
      "2026-01-05",
    ]);
    expect(result.skipped).toBe(0);
    expect(result.skippedRows).toEqual([]);
  });

  it("names each skipped ledger row and its reason, using file row numbers", () => {
    const text = [
      "Date,Type,Category,Account,Note,Amount",
      "31/02/2026,Expense,Food,,impossible date,10.00",
      "2026-01-05,Expense,Food,,not a number,abc",
      "2026-01-06,Expense,Food,,zero amount,0",
      "2026-01-07,Expense,Food,,negative amount,-5.00",
      ",Expense,Food,,no date,10.00",
      "2026-01-08,Expense,Food,,no amount,",
      "2026-01-09,Expense,Food,,good row,10.00",
    ].join("\n");
    const result = parseImportCSV(text, { year: 2026, memberId: "m1" });
    expect(result.transactions).toHaveLength(1);
    expect(result.skipped).toBe(6);
    expect(result.skippedRows).toEqual([
      { row: 2, reason: 'date "31/02/2026" is not a real date' },
      { row: 3, reason: 'amount "abc" is not a number' },
      { row: 4, reason: "amount is 0" },
      { row: 5, reason: "amount is negative" },
      { row: 6, reason: "no date" },
      { row: 7, reason: "no amount" },
    ]);
  });

  it("names skipped grid cells with row number and month", () => {
    const text = [
      "Category,Jan,Feb,Mar",
      "Rent,1025.00,abc,0",
      "Grocery,-10,20.00,30.00",
    ].join("\n");
    const result = parseImportCSV(text, { year: 2026, memberId: "m1" });
    expect(result.format).toBe("grid");
    expect(result.transactions).toHaveLength(3);
    expect(result.skipped).toBe(3);
    expect(result.skippedRows).toEqual([
      { row: 2, reason: 'Feb amount "abc" is not a number' },
      { row: 2, reason: "Mar amount is 0" },
      { row: 3, reason: "Jan amount is negative" },
    ]);
  });

  it("detects the Monthly template shape as grid, the Weekly template shape as week-grid, and ledger exports as ledger", () => {
    const monthly = parseImportCSV("Category,Jan,Feb\nRent,1025.00,1025.00\n", {
      year: 2026,
      memberId: "m1",
    });
    expect(monthly.format).toBe("grid");
    const weekly = parseImportCSV(
      "Week starting,Salary,Loan,ISA\n2026-11-09,750.00,125.00,50.00\n",
      { year: 2026, memberId: "m1" }
    );
    expect(weekly.format).toBe("week-grid");
    expect(weekly.transactions).toHaveLength(3);
    const ledger = parseImportCSV(
      "Date,Type,Category,Account,Note,Amount\n15/11/2026,Expense,Groceries,,Weekly shop,64.20\n",
      { year: 2026, memberId: "m1" }
    );
    expect(ledger.format).toBe("ledger");
    expect(ledger.transactions).toHaveLength(1);
  });

  it("matches the week-grid header case-insensitively but needs a further column", () => {
    const mixed = parseImportCSV("week starting,salary,rent\n2026-11-09,750.00,200.00\n", {
      year: 2026,
      memberId: "m1",
    });
    expect(mixed.format).toBe("week-grid");
    expect(mixed.transactions[0].kind).toBe("income");
    const lone = parseImportCSV("Week starting\n2026-11-09\n", { year: 2026, memberId: "m1" });
    expect(lone.format).toBe("unknown");
  });
});

describe("parseImportCSV week grid", () => {
  const header =
    "Week starting,Salary,Loan,Loan P,SIM,Apple Music,Rent,Grocery,Flex P,Credit Card,Subscriptions,ISA,Revolut,Monzo 1P";

  it("maps Salary to income, savings columns to savings and the rest to expenses, all dated the Monday", () => {
    const text = [
      header,
      "2026-11-09,750.00,125.00,,,,256.25,50.00,,,,100.00,,25.00",
    ].join("\n");
    const result = parseImportCSV(text, { year: 2026, memberId: "m1" });
    expect(result.format).toBe("week-grid");
    expect(result.transactions).toHaveLength(6);
    expect(result.skipped).toBe(0);
    expect(result.transactions.every((t) => t.date === "2026-11-09")).toBe(true);
    const income = result.transactions.find((t) => t.kind === "income");
    expect(income).toMatchObject({ amountMinor: 75000, categoryName: "Salary" });
    const savings = result.transactions.filter((t) => t.kind === "saving");
    expect(savings.map((t) => t.accountName).sort()).toEqual(["ISA", "Monzo 1P"]);
    expect(result.newAccountNames).toEqual(["ISA", "Monzo 1P"]);
    const expenses = result.transactions.filter((t) => t.kind === "expense");
    expect(expenses.map((t) => t.categoryName).sort()).toEqual(["Grocery", "Loan", "Rent"]);
    expect(result.newCategoryNames).toEqual(["Salary", "Loan", "Rent", "Grocery"]);
  });

  it("matches savings columns against the state's account names, falling back to ISA, Revolut and Monzo 1P", () => {
    const text = ["Week starting,Holiday Fund,Rent", "2026-11-09,40.00,200.00"].join("\n");
    const withAccount = parseImportCSV(text, {
      year: 2026,
      memberId: "m1",
      accountNames: ["Holiday Fund"],
    });
    expect(withAccount.transactions.find((t) => t.accountName === "Holiday Fund").kind).toBe(
      "saving"
    );
    const withoutAccount = parseImportCSV(text, { year: 2026, memberId: "m1" });
    expect(
      withoutAccount.transactions.find((t) => t.categoryName === "Holiday Fund").kind
    ).toBe("expense");
    const fallback = parseImportCSV("Week starting,ISA,Revolut\n2026-11-09,40.00,20.00\n", {
      year: 2026,
      memberId: "m1",
    });
    expect(fallback.transactions.every((t) => t.kind === "saving")).toBe(true);
  });

  it("accepts DD/MM/YYYY week dates and keeps savings signs", () => {
    const text = ["Week starting,Salary,ISA", "09/11/2026,750.00,-50.00"].join("\n");
    const result = parseImportCSV(text, { year: 2026, memberId: "m1" });
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0].date).toBe("2026-11-09");
    expect(result.transactions.find((t) => t.kind === "saving").amountMinor).toBe(-5000);
  });

  it("skips rows with bad dates and negative income/expense amounts, naming each", () => {
    const text = [
      "Week starting,Salary,Rent,ISA",
      "not-a-date,750.00,200.00,50.00",
      "2026-11-09,-750.00,200.00,50.00",
      "2026-11-16,750.00,-200.00,50.00",
      ",750.00,200.00,50.00",
      "2026-11-23,750.00,200.00,50.00",
    ].join("\n");
    const result = parseImportCSV(text, { year: 2026, memberId: "m1" });
    expect(result.transactions).toHaveLength(7);
    expect(result.skipped).toBe(4);
    expect(result.skippedRows).toEqual([
      { row: 2, reason: 'week starting date "not-a-date" is not a real date' },
      { row: 3, reason: "Salary amount is negative" },
      { row: 4, reason: "Rent amount is negative" },
      { row: 5, reason: "no week starting date" },
    ]);
  });

  it("reports non-numeric and zero cells, and stays silent on blank cells", () => {
    const text = [
      "Week starting,Salary,Rent",
      "2026-11-09,750.00,abc",
      "2026-11-16,750.00,0",
      "2026-11-23,750.00,",
      "2026-11-30,,200.00",
    ].join("\n");
    const result = parseImportCSV(text, { year: 2026, memberId: "m1" });
    expect(result.transactions).toHaveLength(4);
    expect(result.skipped).toBe(2);
    expect(result.skippedRows).toEqual([
      { row: 2, reason: 'Rent amount "abc" is not a number' },
      { row: 3, reason: "Rent amount is 0" },
    ]);
  });
});
