// Pure helpers for the quick-add row on the Entries view: validation and
// smart defaults, kept unit-testable away from the component.
//
// The row only records positive amounts. Savings withdrawals, repeating
// entries and new categories/accounts stay in the full dialog — the row
// is for the common case, fast.

import { isValidISO } from "./dates.js";
import { parseMoney } from "./money.js";

/**
 * Validate a quick-add draft. Returns { ok: true, payload } or
 * { ok: false, field, message } naming the first field that failed, so
 * the form can focus it. The payload matches the shape App.saveEntry
 * accepts for a new transaction.
 */
export function quickAddPayload({ amountText, kind, date, categoryId, accountId, note }) {
  const parsed = parseMoney(amountText);
  if (parsed === null || parsed <= 0) {
    return { ok: false, field: "amount", message: "Enter an amount greater than zero." };
  }
  if (!isValidISO(date)) {
    return { ok: false, field: "date", message: "Enter a valid date." };
  }
  if (kind === "saving") {
    if (!accountId) {
      return { ok: false, field: "account", message: "Choose a savings account." };
    }
    return {
      ok: true,
      payload: {
        kind,
        date,
        amountMinor: parsed,
        categoryId: null,
        accountId,
        note: String(note || "").trim(),
      },
    };
  }
  if (kind !== "income" && kind !== "expense") {
    return { ok: false, field: "kind", message: "Choose money in, money out or savings." };
  }
  if (!categoryId) {
    return { ok: false, field: "category", message: "Choose a category." };
  }
  return {
    ok: true,
    payload: {
      kind,
      date,
      amountMinor: parsed,
      categoryId,
      accountId: null,
      note: String(note || "").trim(),
    },
  };
}

/**
 * The category a fresh quick-add row should offer: the last-used one when
 * it still exists, matches the kind and is not archived; otherwise the
 * first usable category of that kind; null when there is none.
 */
export function defaultQuickAddCategory(categories, kind, lastUsedId) {
  const usable = categories.filter((c) => c.kind === kind && !c.archived);
  if (lastUsedId && usable.some((c) => c.id === lastUsedId)) return lastUsedId;
  return usable.length > 0 ? usable[0].id : null;
}

/** Same defaulting for savings accounts. */
export function defaultQuickAddAccount(accounts, lastUsedId) {
  const usable = accounts.filter((a) => !a.archived);
  if (lastUsedId && usable.some((a) => a.id === lastUsedId)) return lastUsedId;
  return usable.length > 0 ? usable[0].id : null;
}

/**
 * The id of the category (or savings account) used by the most recent
 * entry of a kind, newest first by date then creation order. Null when
 * no usable target exists. This is what makes the row remember the
 * last-used category across reloads and dialog-added entries too.
 */
export function lastUsedTargetId(state, kind) {
  const sorted = [...state.transactions].sort((a, b) =>
    a.date !== b.date
      ? b.date.localeCompare(a.date)
      : (b.createdAt || "").localeCompare(a.createdAt || "")
  );
  for (const t of sorted) {
    if (t.kind !== kind) continue;
    if (kind === "saving") {
      const account = state.accounts.find((a) => a.id === t.accountId);
      if (account && !account.archived) return account.id;
    } else {
      const category = state.categories.find((c) => c.id === t.categoryId);
      if (category && !category.archived && category.kind === kind) return category.id;
    }
  }
  return null;
}

/**
 * Validate an inline amount edit on an existing row, following the
 * Budgets blur-commit rule: an invalid draft reverts to the saved value.
 * Returns the committed amount, or null when the draft is invalid.
 * Savings rows may be negative (a withdrawal); income/expense rows must
 * stay positive, matching normalizeState.
 */
export function commitInlineAmount(draftText, kind) {
  const parsed = parseMoney(draftText);
  if (parsed === null) return null;
  if (kind === "saving") return parsed === 0 ? null : parsed;
  return parsed > 0 ? parsed : null;
}
