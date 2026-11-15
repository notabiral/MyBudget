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
