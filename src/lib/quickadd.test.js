import { describe, expect, it } from "vitest";
import { blankState } from "./model.js";
import {
  commitInlineAmount,
  defaultQuickAddAccount,
  defaultQuickAddCategory,
  lastUsedTargetId,
  quickAddPayload,
  repeatingDraft,
} from "./quickadd.js";

describe("quickAddPayload", () => {
  it("builds an expense payload from a valid draft", () => {
    const result = quickAddPayload({
      amountText: "12.50",
      kind: "expense",
      date: "2026-11-15",
      categoryId: "cat_1",
      accountId: null,
      note: "  Weekly shop ",
    });
    expect(result).toEqual({
      ok: true,
      payload: {
        kind: "expense",
        date: "2026-11-15",
        amountMinor: 1250,
        categoryId: "cat_1",
        accountId: null,
        note: "Weekly shop",
      },
    });
  });

  it("builds a saving payload with the account and no category", () => {
    const result = quickAddPayload({
      amountText: "£100",
      kind: "saving",
      date: "2026-11-15",
      categoryId: null,
      accountId: "acct_1",
      note: "",
    });
    expect(result.ok).toBe(true);
    expect(result.payload).toMatchObject({
      kind: "saving",
      amountMinor: 10000,
      categoryId: null,
      accountId: "acct_1",
    });
  });

  it("rejects a missing, zero or negative amount first", () => {
    for (const amountText of ["", "0", "-5", "abc"]) {
      const result = quickAddPayload({
        amountText,
        kind: "expense",
        date: "2026-11-15",
        categoryId: "cat_1",
        accountId: null,
        note: "",
      });
      expect(result.ok).toBe(false);
      expect(result.field).toBe("amount");
    }
  });

  it("rejects an invalid date", () => {
    const result = quickAddPayload({
      amountText: "10",
      kind: "expense",
      date: "2026-02-30",
      categoryId: "cat_1",
      accountId: null,
      note: "",
    });
    expect(result).toMatchObject({ ok: false, field: "date" });
  });

  it("requires a category for money in and out, an account for savings", () => {
    expect(
      quickAddPayload({
        amountText: "10",
        kind: "expense",
        date: "2026-11-15",
        categoryId: "",
        accountId: null,
        note: "",
      })
    ).toMatchObject({ ok: false, field: "category" });
    expect(
      quickAddPayload({
        amountText: "10",
        kind: "saving",
        date: "2026-11-15",
        categoryId: null,
        accountId: "",
        note: "",
      })
    ).toMatchObject({ ok: false, field: "account" });
  });

  it("rejects an unknown kind", () => {
    const result = quickAddPayload({
      amountText: "10",
      kind: "mystery",
      date: "2026-11-15",
      categoryId: "cat_1",
      accountId: null,
      note: "",
    });
    expect(result).toMatchObject({ ok: false, field: "kind" });
  });
});

describe("defaultQuickAddCategory / defaultQuickAddAccount", () => {
  const categories = [
    { id: "c1", name: "Rent", kind: "expense", archived: false },
    { id: "c2", name: "Groceries", kind: "expense", archived: false },
    { id: "c3", name: "Old", kind: "expense", archived: true },
    { id: "c4", name: "Salary", kind: "income", archived: false },
  ];

  it("prefers the last-used category when usable", () => {
    expect(defaultQuickAddCategory(categories, "expense", "c2")).toBe("c2");
  });

  it("falls back to the first usable category", () => {
    expect(defaultQuickAddCategory(categories, "expense", null)).toBe("c1");
    expect(defaultQuickAddCategory(categories, "expense", "c3")).toBe("c1"); // archived
    expect(defaultQuickAddCategory(categories, "expense", "c4")).toBe("c1"); // wrong kind
    expect(defaultQuickAddCategory(categories, "expense", "missing")).toBe("c1");
    expect(defaultQuickAddCategory(categories, "income", null)).toBe("c4");
  });

  it("returns null when no usable category exists", () => {
    expect(defaultQuickAddCategory([], "expense", null)).toBeNull();
    expect(
      defaultQuickAddCategory([{ id: "c3", kind: "expense", archived: true }], "expense", null)
    ).toBeNull();
  });

  it("defaults accounts the same way", () => {
    const accounts = [
      { id: "a1", archived: false },
      { id: "a2", archived: true },
    ];
    expect(defaultQuickAddAccount(accounts, "a2")).toBe("a1");
    expect(defaultQuickAddAccount(accounts, null)).toBe("a1");
    expect(defaultQuickAddAccount([], null)).toBeNull();
  });
});

describe("lastUsedTargetId", () => {
  it("returns the newest entry's category for the kind", () => {
    const state = blankState();
    state.categories = [
      { id: "c1", name: "Rent", kind: "expense", archived: false },
      { id: "c2", name: "Groceries", kind: "expense", archived: false },
    ];
    state.transactions = [
      { id: "t1", date: "2026-11-10", kind: "expense", amountMinor: 100, categoryId: "c1", accountId: null, createdAt: "2026-11-10T10:00:00.000Z" },
      { id: "t2", date: "2026-11-09", kind: "expense", amountMinor: 100, categoryId: "c2", accountId: null, createdAt: "2026-11-11T10:00:00.000Z" },
    ];
    // Newest by date wins over newest by creation order.
    expect(lastUsedTargetId(state, "expense")).toBe("c1");
    expect(lastUsedTargetId(state, "income")).toBeNull();
  });

  it("skips archived and deleted targets", () => {
    const state = blankState();
    state.categories = [{ id: "c1", name: "Old", kind: "expense", archived: true }];
    state.transactions = [
      { id: "t1", date: "2026-11-10", kind: "expense", amountMinor: 100, categoryId: "c1", accountId: null, createdAt: "" },
      { id: "t2", date: "2026-11-09", kind: "expense", amountMinor: 100, categoryId: "gone", accountId: null, createdAt: "" },
    ];
    expect(lastUsedTargetId(state, "expense")).toBeNull();
  });

  it("returns the newest saving entry's account", () => {
    const state = blankState();
    state.accounts = [{ id: "a1", name: "ISA", archived: false }];
    state.transactions = [
      { id: "t1", date: "2026-11-10", kind: "saving", amountMinor: 100, categoryId: null, accountId: "a1", createdAt: "" },
    ];
    expect(lastUsedTargetId(state, "saving")).toBe("a1");
  });
});

describe("commitInlineAmount", () => {
  it("accepts positive amounts for income and expense", () => {
    expect(commitInlineAmount("12.50", "expense")).toBe(1250);
    expect(commitInlineAmount("£1,200", "income")).toBe(120000);
  });

  it("rejects zero, negative and unparseable drafts for income and expense", () => {
    expect(commitInlineAmount("0", "expense")).toBeNull();
    expect(commitInlineAmount("-5", "expense")).toBeNull();
    expect(commitInlineAmount("", "income")).toBeNull();
    expect(commitInlineAmount("abc", "income")).toBeNull();
  });

  it("accepts negative amounts for savings (a withdrawal) but not zero", () => {
    expect(commitInlineAmount("-20", "saving")).toBe(-2000);
    expect(commitInlineAmount("20", "saving")).toBe(2000);
    expect(commitInlineAmount("0", "saving")).toBeNull();
  });
});

describe("repeatingDraft", () => {
  it("carries the whole quick-add draft over and asks for repeating", () => {
    expect(
      repeatingDraft({
        amountText: "12.50",
        kind: "expense",
        date: "2026-11-15",
        categoryId: "cat_1",
        accountId: null,
        note: "  Weekly shop ",
      })
    ).toEqual({
      kind: "expense",
      amountText: "12.50",
      date: "2026-11-15",
      categoryId: "cat_1",
      accountId: null,
      note: "Weekly shop",
      makeRecurring: true,
    });
  });

  it("carries a saving draft with its account and no category", () => {
    const draft = repeatingDraft({
      amountText: "100",
      kind: "saving",
      date: "2026-11-15",
      categoryId: null,
      accountId: "acct_1",
      note: "",
    });
    expect(draft.accountId).toBe("acct_1");
    expect(draft.categoryId).toBeNull();
    expect(draft.makeRecurring).toBe(true);
  });

  it("keeps raw amount text so the dialog validates it on submit", () => {
    expect(repeatingDraft({ amountText: "abc", kind: "income", date: "2026-11-15" }).amountText).toBe("abc");
    expect(repeatingDraft({ kind: "income", date: "2026-11-15" }).amountText).toBe("");
  });

  it("turns an invalid date into null so the dialog falls back to its default date", () => {
    expect(
      repeatingDraft({ amountText: "5", kind: "expense", date: "not-a-date" }).date
    ).toBeNull();
    expect(repeatingDraft({ amountText: "5", kind: "expense", date: "" }).date).toBeNull();
    expect(repeatingDraft({ amountText: "5", kind: "expense" }).date).toBeNull();
  });
});
