// Recurring entries. A rule describes a repeating transaction; this module
// turns rules into concrete transactions up to a given date. Generation is
// deterministic and idempotent: every generated transaction carries a
// periodKey, and anything whose periodKey already exists is never
// generated twice.

import { clampDay, daysInMonth, monthKeyOf, parseISO, shiftMonth, toISO } from "./dates.js";
import { newId } from "./ids.js";

const MAX_MONTHLY_PERIODS = 120; // 10 years
const MAX_WEEKLY_PERIODS = 520; // 10 years

function weekdayOf(iso) {
  const p = parseISO(iso);
  return new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
}

function addDays(iso, n) {
  const p = parseISO(iso);
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day + n));
  return toISO(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Occurrence dates for one rule up to and including `throughISO`. */
export function occurrencesForRule(rule, throughISO) {
  if (!rule || rule.active === false) return [];
  if (!parseISO(rule.startDate) || !parseISO(throughISO)) return [];
  if (rule.startDate > throughISO) return [];
  const end = rule.endDate && rule.endDate < throughISO ? rule.endDate : throughISO;
  if (rule.endDate && rule.endDate < rule.startDate) return [];

  if (rule.frequency === "monthly") {
    const start = parseISO(rule.startDate);
    const day = rule.dayOfMonth || start.day;
    const out = [];
    let key = monthKeyOf(rule.startDate);
    for (let i = 0; i < MAX_MONTHLY_PERIODS; i++) {
      const [y, m] = key.split("-").map(Number);
      const date = clampDay(y, m, day);
      if (date > end) break;
      if (date >= rule.startDate) out.push(date);
      if (key >= monthKeyOf(end)) break;
      key = shiftMonth(key, 1);
    }
    return out;
  }

  if (rule.frequency === "weekly") {
    const target = rule.weekday ?? weekdayOf(rule.startDate);
    let date = rule.startDate;
    const startWeekday = weekdayOf(date);
    const delta = (target - startWeekday + 7) % 7;
    date = addDays(date, delta);
    const out = [];
    for (let i = 0; i < MAX_WEEKLY_PERIODS; i++) {
      if (date > end) break;
      out.push(date);
      date = addDays(date, 7);
    }
    return out;
  }

  return [];
}

export function periodKeyFor(rule, date) {
  if (rule.frequency === "monthly") return `${rule.id}:${monthKeyOf(date)}`;
  return `${rule.id}:${date}`;
}

/**
 * Generate the transactions that active rules owe, up to `throughISO`
 * (normally today). Transactions whose periodKey already exists in state
 * are skipped, so calling this on every load is safe.
 */
export function materializeRules(state, throughISO, { now = new Date().toISOString() } = {}) {
  const existing = new Set(
    state.transactions.map((t) => t.periodKey).filter(Boolean)
  );
  const generated = [];
  for (const rule of state.rules) {
    for (const date of occurrencesForRule(rule, throughISO)) {
      const periodKey = periodKeyFor(rule, date);
      if (existing.has(periodKey)) continue;
      existing.add(periodKey);
      generated.push({
        id: newId("txn"),
        date,
        kind: rule.kind,
        amountMinor: rule.amountMinor,
        categoryId: rule.categoryId,
        accountId: rule.accountId,
        memberId: rule.memberId,
        note: rule.note || "",
        ruleId: rule.id,
        periodKey,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
  return generated;
}

export function describeRule(rule, { categoryName = null, accountName = null } = {}) {
  const target = rule.kind === "saving" ? accountName : categoryName;
  const every = rule.frequency === "weekly" ? "Every week" : "Every month";
  const until = rule.endDate ? ` until ${rule.endDate}` : "";
  return `${every} · ${target || "Uncategorised"}${until}`;
}

export { daysInMonth };
