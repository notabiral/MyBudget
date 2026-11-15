// The v1 data model. Everything is plain JSON so the whole state can be
// exported, imported and inspected. Amounts are integer minor units.
//
// The model is household-ready on purpose: every transaction and rule
// carries a memberId, and the state has a members list. The UI ships with
// one member ("Me") and no fake multi-user features; a household view can
// be built on this shape later without a migration.

import { newId } from "./ids.js";
import { isValidISO } from "./dates.js";

export const SCHEMA_VERSION = 1;
export const STORAGE_KEY = "mybudget.v1";
export const LEGACY_STORAGE_KEY = "budget_final";

// Category palette. Deliberately no violet/lavender (design rule).
export const CATEGORY_COLORS = [
  "#0e9384", // teal
  "#175cd3", // blue
  "#c11574", // pink
  "#067647", // green
  "#b54708", // amber
  "#ec4a0a", // orange
  "#475467", // slate
  "#b42318", // red
];

export function colorForIndex(index) {
  return CATEGORY_COLORS[index % CATEGORY_COLORS.length];
}

export const DEFAULT_EXPENSE_CATEGORIES = [
  "Rent",
  "Groceries",
  "Eating out",
  "Transport",
  "Bills",
  "Subscriptions",
  "Shopping",
  "Health",
];

export const DEFAULT_INCOME_CATEGORIES = ["Salary", "Other income"];

export function blankMember(name = "Me") {
  return { id: newId("member"), name };
}

export function blankCategory(name, kind, index = 0, extra = {}) {
  return {
    id: newId("cat"),
    name,
    kind, // 'expense' | 'income'
    color: colorForIndex(index),
    monthlyBudgetMinor: null,
    weeklyBudgetMinor: null,
    archived: false,
    ...extra,
  };
}

export function blankAccount(name, index = 0, extra = {}) {
  return {
    id: newId("acct"),
    name,
    kind: "savings",
    targetMinor: null,
    openingMinor: 0,
    color: colorForIndex(index),
    archived: false,
    ...extra,
  };
}

/**
 * A fresh state for a first-time user: sensible default categories, no
 * accounts, no transactions. Nothing fake, nothing invented.
 */
export function blankState({ memberName = "Me", currency = "GBP" } = {}) {
  const member = blankMember(memberName);
  const now = new Date().toISOString();
  return {
    version: SCHEMA_VERSION,
    currency,
    members: [member],
    categories: [
      ...DEFAULT_EXPENSE_CATEGORIES.map((name, i) =>
        blankCategory(name, "expense", i)
      ),
      ...DEFAULT_INCOME_CATEGORIES.map((name, i) =>
        blankCategory(name, "income", DEFAULT_EXPENSE_CATEGORIES.length + i)
      ),
    ],
    accounts: [],
    transactions: [],
    rules: [],
    prefs: { demo: false, periodMode: "month" },
    meta: { createdAt: now, migratedFrom: null, migratedAt: null },
  };
}

/**
 * Validate and normalise an unknown object into a v1 state. Unknown or
 * malformed pieces are dropped rather than trusted; the function never
 * throws. Used for JSON import and for defensive loading.
 */
export function normalizeState(input) {
  const base = blankState();
  if (!input || typeof input !== "object") return base;

  const out = { ...base };
  if (typeof input.currency === "string") out.currency = input.currency;

  if (Array.isArray(input.members) && input.members.length > 0) {
    out.members = input.members
      .filter((m) => m && typeof m.id === "string" && typeof m.name === "string")
      .map((m) => ({ id: m.id, name: m.name }));
  }
  const memberIds = new Set(out.members.map((m) => m.id));
  const defaultMemberId = out.members[0].id;

  if (Array.isArray(input.categories)) {
    out.categories = input.categories
      .filter(
        (c) =>
          c &&
          typeof c.id === "string" &&
          typeof c.name === "string" &&
          (c.kind === "expense" || c.kind === "income")
      )
      .map((c, i) => ({
        id: c.id,
        name: c.name,
        kind: c.kind,
        color: typeof c.color === "string" ? c.color : colorForIndex(i),
        monthlyBudgetMinor:
          Number.isInteger(c.monthlyBudgetMinor) && c.monthlyBudgetMinor >= 0
            ? c.monthlyBudgetMinor
            : null,
        // Added later than monthly budgets; old saved states simply lack
        // it and normalise to null — no migration of user data.
        weeklyBudgetMinor:
          Number.isInteger(c.weeklyBudgetMinor) && c.weeklyBudgetMinor >= 0
            ? c.weeklyBudgetMinor
            : null,
        archived: c.archived === true,
      }));
  }
  const categoryIds = new Set(out.categories.map((c) => c.id));

  if (Array.isArray(input.accounts)) {
    out.accounts = input.accounts
      .filter((a) => a && typeof a.id === "string" && typeof a.name === "string")
      .map((a, i) => ({
        id: a.id,
        name: a.name,
        kind: "savings",
        targetMinor:
          Number.isInteger(a.targetMinor) && a.targetMinor > 0 ? a.targetMinor : null,
        openingMinor: Number.isInteger(a.openingMinor) ? a.openingMinor : 0,
        color: typeof a.color === "string" ? a.color : colorForIndex(i),
        archived: a.archived === true,
        ...(a.demo === true ? { demo: true } : {}),
      }));
  }
  const accountIds = new Set(out.accounts.map((a) => a.id));

  if (Array.isArray(input.transactions)) {
    out.transactions = input.transactions
      .filter(
        (t) =>
          t &&
          typeof t.id === "string" &&
          isValidISO(t.date) &&
          Number.isInteger(t.amountMinor) &&
          (t.kind === "expense" || t.kind === "income" || t.kind === "saving") &&
          (t.kind === "saving" || t.amountMinor > 0)
      )
      .map((t) => ({
        id: t.id,
        date: t.date,
        kind: t.kind,
        amountMinor: t.amountMinor,
        categoryId:
          typeof t.categoryId === "string" && categoryIds.has(t.categoryId)
            ? t.categoryId
            : null,
        accountId:
          typeof t.accountId === "string" && accountIds.has(t.accountId)
            ? t.accountId
            : null,
        memberId: memberIds.has(t.memberId) ? t.memberId : defaultMemberId,
        note: typeof t.note === "string" ? t.note : "",
        ruleId: typeof t.ruleId === "string" ? t.ruleId : null,
        periodKey: typeof t.periodKey === "string" ? t.periodKey : null,
        createdAt: typeof t.createdAt === "string" ? t.createdAt : "",
        updatedAt: typeof t.updatedAt === "string" ? t.updatedAt : "",
        ...(t.demo === true ? { demo: true } : {}),
      }));
  }

  if (Array.isArray(input.rules)) {
    out.rules = input.rules
      .filter(
        (r) =>
          r &&
          typeof r.id === "string" &&
          Number.isInteger(r.amountMinor) &&
          r.amountMinor !== 0 &&
          (r.kind === "expense" || r.kind === "income" || r.kind === "saving") &&
          (r.frequency === "weekly" || r.frequency === "monthly") &&
          isValidISO(r.startDate)
      )
      .map((r) => ({
        id: r.id,
        kind: r.kind,
        amountMinor: r.amountMinor,
        categoryId:
          typeof r.categoryId === "string" && categoryIds.has(r.categoryId)
            ? r.categoryId
            : null,
        accountId:
          typeof r.accountId === "string" && accountIds.has(r.accountId)
            ? r.accountId
            : null,
        memberId: memberIds.has(r.memberId) ? r.memberId : defaultMemberId,
        note: typeof r.note === "string" ? r.note : "",
        frequency: r.frequency,
        startDate: r.startDate,
        endDate: isValidISO(r.endDate) ? r.endDate : null,
        dayOfMonth:
          Number.isInteger(r.dayOfMonth) && r.dayOfMonth >= 1 && r.dayOfMonth <= 31
            ? r.dayOfMonth
            : null,
        weekday:
          Number.isInteger(r.weekday) && r.weekday >= 0 && r.weekday <= 6
            ? r.weekday
            : null,
        active: r.active !== false,
        createdAt: typeof r.createdAt === "string" ? r.createdAt : "",
      }));
  }

  if (input.prefs && typeof input.prefs === "object") {
    out.prefs = {
      demo: input.prefs.demo === true,
      // Month is the default: monthly-paid users see no change.
      periodMode: input.prefs.periodMode === "week" ? "week" : "month",
    };
  }
  if (input.meta && typeof input.meta === "object") {
    out.meta = {
      createdAt: typeof input.meta.createdAt === "string" ? input.meta.createdAt : base.meta.createdAt,
      migratedFrom: typeof input.meta.migratedFrom === "string" ? input.meta.migratedFrom : null,
      migratedAt: typeof input.meta.migratedAt === "string" ? input.meta.migratedAt : null,
    };
  }
  return out;
}

export function findCategory(state, id) {
  return state.categories.find((c) => c.id === id) || null;
}

export function findAccount(state, id) {
  return state.accounts.find((a) => a.id === id) || null;
}
