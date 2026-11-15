// Date helpers. Dates in state are ISO calendar dates ("YYYY-MM-DD") with no
// time component, so month arithmetic never trips over timezones.

export const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// Display formatting goes through Intl with an explicit UTC timezone, so a
// calendar date renders the same on every device. MONTH_ABBR stays for the
// CSV grid format, whose headers must be stable English abbreviations.
const monthLong = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const monthShort = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const dayFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function pad(n) {
  return String(n).padStart(2, "0");
}

export function toISO(year, month, day) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** "2026-11-15" -> { year: 2026, month: 11, day: 15 } (month is 1-based). */
export function parseISO(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

export function isValidISO(iso) {
  return parseISO(iso) !== null;
}

export function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** "2026-11" for a date, or for (year, month). */
export function monthKeyOf(isoOrYear, month) {
  if (typeof isoOrYear === "string") return isoOrYear.slice(0, 7);
  return `${isoOrYear}-${pad(month)}`;
}

export function monthKeyParts(key) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(key || ""));
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]) };
}

/** Shift a "YYYY-MM" key by n months. */
export function shiftMonth(key, n) {
  const parts = monthKeyParts(key);
  if (!parts) return key;
  const d = new Date(Date.UTC(parts.year, parts.month - 1 + n, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

export function monthLabel(key, style = "long") {
  const parts = monthKeyParts(key);
  if (!parts) return key;
  const date = new Date(Date.UTC(parts.year, parts.month - 1, 1));
  return (style === "short" ? monthShort : monthLong).format(date);
}

/** Today's date as ISO, in the device's local timezone. */
export function todayISO(now = new Date()) {
  return toISO(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function currentMonthKey(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
}

/** Clamp a day-of-month into a real date within the given month. */
export function clampDay(year, month, day) {
  return toISO(year, month, Math.min(Math.max(1, day), daysInMonth(year, month)));
}

/** "2026-11-15" -> "15 Nov 2026". Falls back to the raw string. */
export function formatDate(iso) {
  const p = parseISO(iso);
  if (!p) return String(iso || "");
  return dayFormat.format(new Date(Date.UTC(p.year, p.month - 1, p.day)));
}

/** Fraction of the month elapsed (0..1) for a "today" inside it. */
export function monthProgress(key, today = todayISO()) {
  const parts = monthKeyParts(key);
  if (!parts) return 0;
  const todayKey = monthKeyOf(today);
  if (todayKey < key) return 0;
  if (todayKey > key) return 1;
  const day = parseISO(today).day;
  return Math.min(1, day / daysInMonth(parts.year, parts.month));
}

// ---------- Weeks ----------
// Weeks run Monday–Sunday and are numbered per ISO 8601: week 1 is the
// week containing the first Thursday of the year, so a week key's year
// can differ from the calendar year of its dates (e.g. 29 Dec 2025 is
// in week "2026-W01"). All arithmetic stays in UTC, like the month
// helpers above, so no timezone can shift a boundary.

const DAY_MS = 24 * 60 * 60 * 1000;

const dayOnly = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  timeZone: "UTC",
});
const dayMonth = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function utcDate(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day));
}

function isoOfDate(d) {
  return toISO(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** The Monday of the week containing `date` (a UTC Date). */
function mondayOf(date) {
  const dow = (date.getUTCDay() + 6) % 7; // 0 = Monday .. 6 = Sunday
  return new Date(date.getTime() - dow * DAY_MS);
}

/** The Monday of ISO week 1 of `weekYear` (the week containing 4 January). */
function mondayOfISOWeek1(weekYear) {
  return mondayOf(utcDate(weekYear, 1, 4));
}

/** Shift an ISO date by n days. Returns the input unchanged when invalid. */
export function addDays(iso, n) {
  const p = parseISO(iso);
  if (!p) return iso;
  return isoOfDate(new Date(utcDate(p.year, p.month, p.day).getTime() + n * DAY_MS));
}

/** "2026-W46" for a date. Returns null for an invalid date. */
export function weekKeyOf(iso) {
  const p = parseISO(iso);
  if (!p) return null;
  const date = utcDate(p.year, p.month, p.day);
  // The Thursday of this week decides the ISO week-year.
  const dow = (date.getUTCDay() + 6) % 7;
  const thursday = new Date(date.getTime() + (3 - dow) * DAY_MS);
  const weekYear = thursday.getUTCFullYear();
  const monday = mondayOf(date);
  const weekNo = Math.round((monday - mondayOfISOWeek1(weekYear)) / (7 * DAY_MS)) + 1;
  return `${weekYear}-W${String(weekNo).padStart(2, "0")}`;
}

export function weekKeyParts(key) {
  const m = /^(\d{4})-W(\d{2})$/.exec(String(key || ""));
  if (!m) return null;
  const year = Number(m[1]);
  const week = Number(m[2]);
  if (week < 1 || week > 53) return null;
  return { year, week };
}

/** { start, end } ISO dates (Monday, Sunday) for a week key, or null. */
export function weekRange(key) {
  const parts = weekKeyParts(key);
  if (!parts) return null;
  const monday = new Date(
    mondayOfISOWeek1(parts.year).getTime() + (parts.week - 1) * 7 * DAY_MS
  );
  const start = isoOfDate(monday);
  // A W53 in a 52-week year spills into the next year's W01; reject it.
  if (weekKeyOf(start) !== key) return null;
  return { start, end: addDays(start, 6) };
}

/** Shift a week key by n weeks. Returns the input unchanged when invalid. */
export function shiftWeek(key, n) {
  const range = weekRange(key);
  if (!range) return key;
  return weekKeyOf(addDays(range.start, n * 7));
}

/** "9–15 Nov 2026", "29 Dec – 4 Jan 2026", "29 Dec 2025 – 4 Jan 2026". */
export function weekLabel(key) {
  const range = weekRange(key);
  if (!range) return key;
  const start = parseISO(range.start);
  const end = parseISO(range.end);
  const startDate = utcDate(start.year, start.month, start.day);
  const endDate = utcDate(end.year, end.month, end.day);
  if (start.year === end.year && start.month === end.month) {
    return `${dayOnly.format(startDate)}–${dayFormat.format(endDate)}`;
  }
  if (start.year === end.year) {
    return `${dayMonth.format(startDate)} – ${dayFormat.format(endDate)}`;
  }
  return `${dayFormat.format(startDate)} – ${dayFormat.format(endDate)}`;
}

/** Short label for chart axes: the week's Monday, e.g. "9 Nov". */
export function weekShortLabel(key) {
  const range = weekRange(key);
  if (!range) return key;
  const start = parseISO(range.start);
  return dayMonth.format(utcDate(start.year, start.month, start.day));
}

export function currentWeekKey(now = new Date()) {
  return weekKeyOf(todayISO(now));
}

/** Fraction of the week elapsed (0..1) for a "today" inside it. */
export function weekProgress(key, today = todayISO()) {
  const range = weekRange(key);
  if (!range) return 0;
  if (today < range.start) return 0;
  if (today > range.end) return 1;
  const start = parseISO(range.start);
  const now = parseISO(today);
  const elapsed =
    Math.round((utcDate(now.year, now.month, now.day) - utcDate(start.year, start.month, start.day)) / DAY_MS) + 1;
  return Math.min(1, elapsed / 7);
}
