// Money handling. Amounts are integer minor units (pence/cents) everywhere
// in state. Floats only ever appear at the parse/format boundary, so totals
// can never drift by a penny.

export const CURRENCIES = {
  GBP: { code: "GBP", locale: "en-GB", symbol: "£", label: "British pound (£)" },
  USD: { code: "USD", locale: "en-US", symbol: "$", label: "US dollar ($)" },
  EUR: { code: "EUR", locale: "en-IE", symbol: "€", label: "Euro (€)" },
};

export function currencyOf(code) {
  return CURRENCIES[code] || CURRENCIES.GBP;
}

/** Format integer minor units as currency. Negative values show a minus sign. */
export function formatMoney(minor, currencyCode = "GBP") {
  const c = currencyOf(currencyCode);
  return new Intl.NumberFormat(c.locale, {
    style: "currency",
    currency: c.code,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

/** Format with no pence when the value is whole, e.g. £1,200. */
export function formatMoneyShort(minor, currencyCode = "GBP") {
  if (minor % 100 !== 0) return formatMoney(minor, currencyCode);
  const c = currencyOf(currencyCode);
  return new Intl.NumberFormat(c.locale, {
    style: "currency",
    currency: c.code,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(minor / 100);
}

/**
 * Parse free-form user input into integer minor units.
 * Accepts "12", "12.34", "£12.34", "1,200.50", "-5". Returns null when the
 * input has no usable number. Rounds half away from zero at the third
 * decimal place (so "10.005" becomes 1001, never a float artefact).
 */
export function parseMoney(input) {
  if (input === null || input === undefined) return null;
  const text = String(input).trim().replace(/[£$€,\s]/g, "");
  if (text === "" || text === "-" || text === "." || text === "-.") return null;
  if (!/^-?\d*\.?\d*$/.test(text)) return null;
  const negative = text.startsWith("-");
  const digits = negative ? text.slice(1) : text;
  const [wholePart = "0", fracPart = ""] = digits.split(".");
  const whole = wholePart === "" ? 0 : Number(wholePart);
  if (!Number.isFinite(whole)) return null;
  const frac = (fracPart + "000").slice(0, 3);
  let minor = whole * 100 + Number(frac.slice(0, 2));
  if (Number(frac[2]) >= 5) minor += 1;
  return negative ? -minor : minor;
}

/** Convert a legacy floating-point pound amount to integer pence. */
export function poundsToMinor(pounds) {
  if (typeof pounds !== "number" || !Number.isFinite(pounds)) return 0;
  return Math.round(pounds * 100);
}

/** Convert integer minor units back to a plain number of pounds. */
export function minorToPounds(minor) {
  return minor / 100;
}

/** Format a ratio as a whole-number percent, e.g. 0.723 -> "72%". */
export function formatPercent(ratio) {
  if (!Number.isFinite(ratio)) return "0%";
  return `${Math.round(ratio * 100)}%`;
}
