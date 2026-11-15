import { useEffect, useRef, useState } from "react";
import { todayISO } from "../lib/dates.js";
import { formatMoney } from "../lib/money.js";
import {
  defaultQuickAddAccount,
  defaultQuickAddCategory,
  lastUsedTargetId,
  quickAddPayload,
  repeatingDraft,
} from "../lib/quickadd.js";

/**
 * The quick-add row: Budgets-style fast data entry for the Entries view.
 * Amount, type, category, note and date in one row; Enter saves and
 * clears for the next entry, keeping the category, type and date.
 * The category picker remembers the last-used category (from any entry,
 * including ones added in the full dialog). Savings entries here are
 * deposits only; withdrawals and repeating entries stay in the dialog.
 * Every entry added here is a one-off — the caption says so, and
 * "Make it repeating" opens the full dialog with repeating turned on
 * and the typed draft carried over.
 *
 * Props: state, defaultDate, onQuickAdd(payload) — the payload matches
 * the shape App.saveEntry accepts for a new transaction — and
 * onMakeRepeating(draft) for the repeating shortcut.
 */
export default function QuickAdd({ state, defaultDate, onQuickAdd, onMakeRepeating }) {
  const currency = state.currency;
  const [kind, setKind] = useState("expense");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(defaultDate || todayISO());
  const [note, setNote] = useState("");
  const [categoryId, setCategoryId] = useState(() =>
    defaultQuickAddCategory(state.categories, "expense", lastUsedTargetId(state, "expense"))
  );
  const [accountId, setAccountId] = useState(() =>
    defaultQuickAddAccount(state.accounts, lastUsedTargetId(state, "saving"))
  );
  const [errors, setErrors] = useState({});
  const [announcement, setAnnouncement] = useState("");
  const formRef = useRef(null);
  const amountRef = useRef(null);

  // The row always defaults to the viewed period; stepping to another
  // period re-defaults the date (a hand-picked date survives saves, but
  // not a period change — the same rule the full dialog follows).
  useEffect(() => {
    setDate(defaultDate || todayISO());
  }, [defaultDate]);

  const categories = state.categories.filter((c) => c.kind === kind && !c.archived);
  const accounts = state.accounts.filter((a) => !a.archived);

  function changeKind(next) {
    setKind(next);
    setErrors({});
    // Re-derive the picker from the last-used entry of the new kind, so
    // switching kinds never strands the row on a stale selection.
    if (next === "saving") {
      setAccountId(defaultQuickAddAccount(state.accounts, lastUsedTargetId(state, "saving")));
    } else {
      setCategoryId(defaultQuickAddCategory(state.categories, next, lastUsedTargetId(state, next)));
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    const result = quickAddPayload({ amountText: amount, kind, date, categoryId, accountId, note });
    if (!result.ok) {
      setErrors({ [result.field]: result.message });
      setAnnouncement("");
      requestAnimationFrame(() => {
        formRef.current?.querySelector('[aria-invalid="true"]')?.focus();
      });
      return;
    }
    onQuickAdd(result.payload);
    const targetName =
      kind === "saving"
        ? state.accounts.find((a) => a.id === accountId)?.name
        : state.categories.find((c) => c.id === categoryId)?.name;
    setAnnouncement(
      `Added ${formatMoney(result.payload.amountMinor, currency)}${targetName ? ` to ${targetName}` : ""}.`
    );
    setErrors({});
    // Clear for the next entry, keeping kind, category/account and date.
    setAmount("");
    setNote("");
    amountRef.current?.focus();
  }

  const noTarget = kind === "saving" ? accounts.length === 0 : categories.length === 0;

  function handleMakeRepeating() {
    // No validation here: whatever is typed carries over raw, and the
    // dialog validates on submit. The dialog can also create a new
    // category/account inline, so this stays enabled with no target.
    onMakeRepeating(
      repeatingDraft({ amountText: amount, kind, date, categoryId, accountId, note })
    );
  }

  return (
    <section className="panel quick-add-panel" aria-labelledby="quick-add-title">
      <div className="section-head">
        <h2 className="section-title" id="quick-add-title">Quick add</h2>
        <p className="text-sm muted">One-off entries only. Enter saves, ready for the next one.</p>
      </div>
      <form ref={formRef} className="quick-add" onSubmit={handleSubmit} noValidate>
        <fieldset className="quick-add-kind">
          <legend className="field-label">Type</legend>
          <div className="segmented">
            {[
              ["expense", "Money out"],
              ["income", "Money in"],
              ["saving", "Savings"],
            ].map(([value, label]) => (
              <label key={value}>
                <input
                  type="radio"
                  name="quick-add-kind"
                  value={value}
                  checked={kind === value}
                  onChange={() => changeKind(value)}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="field quick-add-amount">
          <label htmlFor="quick-add-amount">Amount</label>
          <input
            ref={amountRef}
            id="quick-add-amount"
            className="input input-money"
            name="amount"
            autoComplete="off"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-invalid={errors.amount ? "true" : undefined}
            aria-describedby={errors.amount ? "quick-add-amount-error" : undefined}
          />
          {errors.amount && (
            <p className="field-error" id="quick-add-amount-error" role="alert">
              {errors.amount}
            </p>
          )}
        </div>

        <div className="field quick-add-date">
          <label htmlFor="quick-add-date">Date</label>
          <input
            id="quick-add-date"
            className="input"
            type="date"
            name="date"
            autoComplete="off"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-invalid={errors.date ? "true" : undefined}
            aria-describedby={errors.date ? "quick-add-date-error" : undefined}
          />
          {errors.date && (
            <p className="field-error" id="quick-add-date-error" role="alert">
              {errors.date}
            </p>
          )}
        </div>

        {kind === "saving" ? (
          <div className="field quick-add-target">
            <label htmlFor="quick-add-account">Savings account</label>
            <select
              id="quick-add-account"
              className="select"
              name="account"
              value={accountId || ""}
              onChange={(e) => setAccountId(e.target.value)}
              aria-invalid={errors.account ? "true" : undefined}
              aria-describedby={errors.account ? "quick-add-account-error" : undefined}
            >
              {accounts.length === 0 && (
                <option value="" disabled>
                  No savings accounts yet…
                </option>
              )}
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            {errors.account && (
              <p className="field-error" id="quick-add-account-error" role="alert">
                {errors.account}
              </p>
            )}
          </div>
        ) : (
          <div className="field quick-add-target">
            <label htmlFor="quick-add-category">Category</label>
            <select
              id="quick-add-category"
              className="select"
              name="category"
              value={categoryId || ""}
              onChange={(e) => setCategoryId(e.target.value)}
              aria-invalid={errors.category ? "true" : undefined}
              aria-describedby={errors.category ? "quick-add-category-error" : undefined}
            >
              {categories.length === 0 && (
                <option value="" disabled>
                  No categories yet…
                </option>
              )}
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {errors.category && (
              <p className="field-error" id="quick-add-category-error" role="alert">
                {errors.category}
              </p>
            )}
          </div>
        )}

        <div className="field quick-add-note">
          <label htmlFor="quick-add-note">Note <span className="label-optional">(optional)</span></label>
          <input
            id="quick-add-note"
            className="input"
            name="note"
            autoComplete="off"
            maxLength={120}
            placeholder="What was it? e.g. Weekly shop…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <div className="field quick-add-submit-field">
          {/* Spacer label keeps the buttons aligned with the inputs. */}
          <span className="field-label" aria-hidden="true">&nbsp;</span>
          <button
            type="submit"
            className="button button-primary"
            disabled={noTarget}
            title={noTarget ? (kind === "saving" ? "Add a savings account from the Savings tab first" : "Add a category from the Budgets tab first") : undefined}
          >
            Add entry
          </button>
          <button
            type="button"
            className="button"
            onClick={handleMakeRepeating}
            aria-label="Make it repeating: open the full form with repeating turned on, carrying over what you typed here"
          >
            Make it repeating
          </button>
        </div>
      </form>
      {noTarget && (
        <p className="quick-add-hint muted text-sm">
          {kind === "saving"
            ? "Add a savings account from the Savings tab to record savings here."
            : "Add a category from the Budgets tab to record entries here."}
        </p>
      )}
      {announcement && (
        <p className="quick-add-status" role="status">
          {announcement}
        </p>
      )}
    </section>
  );
}
