import { useEffect, useMemo, useRef, useState } from "react";
import { isValidISO, todayISO } from "../lib/dates.js";
import { parseMoney } from "../lib/money.js";
import { findAccount, findCategory } from "../lib/model.js";
import { Modal } from "./ui.jsx";

/**
 * Add / edit a transaction. Handles all three kinds, inline creation of a
 * new category or savings account, and turning an entry into a repeating
 * rule. Validation errors sit under their own field and are announced.
 *
 * Props:
 * - open, initial (transaction or null), defaultDate, state
 * - prefill (optional, new entries only): { kind, amountText, date|null,
 *   categoryId, accountId, note, makeRecurring } from the quick-add row's
 *   "Make it repeating" shortcut. Applied instead of the blank form when
 *   the dialog opens for a new entry; ignored when editing.
 * - onClose(), onSave(payload), onDelete(id) — onSave receives:
 *   { id?, kind, date, amountMinor, categoryId, accountId, note,
 *     makeRecurring, frequency, endDate }
 * - onCreateCategory(name, kind) -> id
 * - onCreateAccount(name) -> id
 */
export default function EntryDialog({
  open,
  initial,
  prefill,
  defaultDate,
  state,
  onClose,
  onSave,
  onDelete,
  onCreateCategory,
  onCreateAccount,
}) {
  const editing = initial !== null && initial !== undefined;
  const [kind, setKind] = useState("expense");
  const [date, setDate] = useState(defaultDate || todayISO());
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [note, setNote] = useState("");
  const [direction, setDirection] = useState("in");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newAccountName, setNewAccountName] = useState("");
  const [makeRecurring, setMakeRecurring] = useState(false);
  const [frequency, setFrequency] = useState("monthly");
  const [endDate, setEndDate] = useState("");
  const [errors, setErrors] = useState({});
  const formRef = useRef(null);

  const categories = useMemo(
    () =>
      state.categories
        .filter((c) => c.kind === (kind === "saving" ? "expense" : kind))
        .filter((c) => !c.archived || c.id === categoryId),
    [state.categories, kind, categoryId]
  );
  const accounts = useMemo(
    () => state.accounts.filter((a) => !a.archived || a.id === accountId),
    [state.accounts, accountId]
  );

  // Reset the form whenever the dialog opens for a different entry.
  useEffect(() => {
    if (!open) return;
    if (initial) {
      setKind(initial.kind);
      setDate(initial.date);
      setAmount(
        initial.kind === "saving"
          ? String(Math.abs(initial.amountMinor) / 100)
          : String(initial.amountMinor / 100)
      );
      setDirection(initial.kind === "saving" && initial.amountMinor < 0 ? "out" : "in");
      setCategoryId(initial.categoryId || "");
      setAccountId(initial.accountId || "");
      setNote(initial.note || "");
      setMakeRecurring(false);
      setFrequency("monthly");
      setEndDate("");
    } else if (prefill) {
      // "Make it repeating" from quick-add: carry the typed draft over
      // with repeating pre-ticked. An invalid draft date arrives as
      // null and falls back to the default date; the amount arrives as
      // raw text and is validated on submit, like a typed value.
      setKind(prefill.kind);
      setDate(prefill.date && isValidISO(prefill.date) ? prefill.date : defaultDate || todayISO());
      setAmount(prefill.amountText || "");
      setDirection("in");
      setCategoryId(prefill.categoryId || "");
      setAccountId(prefill.accountId || "");
      setNote(prefill.note || "");
      setMakeRecurring(prefill.makeRecurring === true);
      setFrequency(prefill.frequency || "monthly");
      setEndDate("");
    } else {
      setKind("expense");
      setDate(defaultDate || todayISO());
      setAmount("");
      setCategoryId("");
      setAccountId("");
      setNote("");
      setDirection("in");
      setMakeRecurring(false);
      setFrequency("monthly");
      setEndDate("");
    }
    setNewCategoryName("");
    setNewAccountName("");
    setErrors({});
  }, [open, initial, prefill, defaultDate]);

  // Default the category/account pickers when the kind changes. Skipped
  // for a prefilled open: the prefill carries an explicit selection, and
  // this effect would otherwise overwrite it with the first option on
  // the same commit the reset effect runs.
  useEffect(() => {
    if (!open || editing || prefill) return;
    if (kind !== "saving" && categories.length > 0 && !categoryId) {
      setCategoryId(categories[0].id);
    }
    if (kind === "saving" && accounts.length > 0 && !accountId) {
      setAccountId(accounts[0].id);
    }
  }, [open, editing, prefill, kind, categories, accounts, categoryId, accountId]);

  const creatingCategory = categoryId === "__new__";
  const creatingAccount = accountId === "__new__";

  function validate() {
    const next = {};
    const parsed = parseMoney(amount);
    if (parsed === null || parsed <= 0) {
      next.amount = "Enter an amount greater than zero.";
    }
    if (!isValidISO(date)) {
      next.date = "Enter a valid date.";
    }
    if (kind !== "saving") {
      if (creatingCategory) {
        if (newCategoryName.trim() === "") next.newCategory = "Name the new category.";
      } else if (!findCategory(state, categoryId)) {
        next.category = "Choose a category.";
      }
    } else {
      if (creatingAccount) {
        if (newAccountName.trim() === "") next.newAccount = "Name the new savings account.";
      } else if (!findAccount(state, accountId)) {
        next.account = "Choose a savings account.";
      }
    }
    if (makeRecurring && endDate !== "" && (!isValidISO(endDate) || endDate < date)) {
      next.endDate = "The end date must be a valid date on or after the first entry.";
    }
    setErrors(next);
    return { valid: Object.keys(next).length === 0, parsed };
  }

  function handleSubmit(event) {
    event.preventDefault();
    const { valid, parsed } = validate();
    if (!valid) {
      // Move focus to the first field that failed, once the error
      // attributes have rendered.
      requestAnimationFrame(() => {
        formRef.current?.querySelector('[aria-invalid="true"]')?.focus();
      });
      return;
    }

    let finalCategoryId = categoryId;
    if (kind !== "saving" && creatingCategory) {
      finalCategoryId = onCreateCategory(newCategoryName.trim(), kind);
    }
    let finalAccountId = accountId;
    if (kind === "saving" && creatingAccount) {
      finalAccountId = onCreateAccount(newAccountName.trim());
    }
    const amountMinor =
      kind === "saving" && direction === "out" ? -parsed : parsed;
    onSave({
      id: initial?.id,
      kind,
      date,
      amountMinor,
      categoryId: kind === "saving" ? null : finalCategoryId,
      accountId: kind === "saving" ? finalAccountId : null,
      note: note.trim(),
      makeRecurring: makeRecurring && !editing,
      frequency,
      endDate: endDate || null,
    });
  }

  const kindLabel = kind === "expense" ? "Money out" : kind === "income" ? "Money in" : "Savings";

  return (
    <Modal
      open={open}
      title={editing ? "Edit entry" : "Add an entry"}
      onClose={onClose}
    >
      <form ref={formRef} className="dialog-form" onSubmit={handleSubmit} noValidate>
        <fieldset>
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
                  name="entry-kind"
                  value={value}
                  checked={kind === value}
                  onChange={() => setKind(value)}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="dialog-form-row">
          <div className="field">
            <label htmlFor="entry-amount">Amount</label>
            <input
              id="entry-amount"
              className="input input-money"
              name="amount"
              autoComplete="off"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-invalid={errors.amount ? "true" : undefined}
              aria-describedby={errors.amount ? "entry-amount-error" : undefined}
              data-autofocus
            />
            {errors.amount && (
              <p className="field-error" id="entry-amount-error" role="alert">
                {errors.amount}
              </p>
            )}
          </div>
          <div className="field">
            <label htmlFor="entry-date">Date</label>
            <input
              id="entry-date"
              className="input"
              type="date"
              name="date"
              autoComplete="off"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-invalid={errors.date ? "true" : undefined}
              aria-describedby={errors.date ? "entry-date-error" : undefined}
            />
            {errors.date && (
              <p className="field-error" id="entry-date-error" role="alert">
                {errors.date}
              </p>
            )}
          </div>
        </div>

        {kind === "saving" ? (
          <>
            <fieldset>
              <legend className="field-label">Direction</legend>
              <div className="segmented">
                {[
                  ["in", "Put money in"],
                  ["out", "Take money out"],
                ].map(([value, label]) => (
                  <label key={value}>
                    <input
                      type="radio"
                      name="saving-direction"
                      value={value}
                      checked={direction === value}
                      onChange={() => setDirection(value)}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="field">
              <label htmlFor="entry-account">Savings account</label>
              <select
                id="entry-account"
                className="select"
                name="account"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                aria-invalid={errors.account ? "true" : undefined}
                aria-describedby={errors.account ? "entry-account-error" : undefined}
              >
                <option value="" disabled>
                  Choose an account…
                </option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
                <option value="__new__">New savings account…</option>
              </select>
              {errors.account && (
                <p className="field-error" id="entry-account-error" role="alert">
                  {errors.account}
                </p>
              )}
            </div>
            {creatingAccount && (
              <div className="field">
                <label htmlFor="entry-new-account">New account name</label>
                <input
                  id="entry-new-account"
                  className="input"
                  name="new-account"
                  autoComplete="off"
                  placeholder="e.g. Holiday fund…"
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  aria-invalid={errors.newAccount ? "true" : undefined}
                  aria-describedby={errors.newAccount ? "entry-new-account-error" : undefined}
                />
                {errors.newAccount && (
                  <p className="field-error" id="entry-new-account-error" role="alert">
                    {errors.newAccount}
                  </p>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="field">
              <label htmlFor="entry-category">Category</label>
              <select
                id="entry-category"
                className="select"
                name="category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                aria-invalid={errors.category ? "true" : undefined}
                aria-describedby={errors.category ? "entry-category-error" : undefined}
              >
                <option value="" disabled>
                  Choose a category…
                </option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
                <option value="__new__">New category…</option>
              </select>
              {errors.category && (
                <p className="field-error" id="entry-category-error" role="alert">
                  {errors.category}
                </p>
              )}
            </div>
            {creatingCategory && (
              <div className="field">
                <label htmlFor="entry-new-category">New category name</label>
                <input
                  id="entry-new-category"
                  className="input"
                  name="new-category"
                  autoComplete="off"
                  placeholder="e.g. Pet care…"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  aria-invalid={errors.newCategory ? "true" : undefined}
                  aria-describedby={errors.newCategory ? "entry-new-category-error" : undefined}
                />
                {errors.newCategory && (
                  <p className="field-error" id="entry-new-category-error" role="alert">
                    {errors.newCategory}
                  </p>
                )}
              </div>
            )}
          </>
        )}

        <div className="field">
          <label htmlFor="entry-note">Note <span className="label-optional">(optional)</span></label>
          <input
            id="entry-note"
            className="input"
            name="note"
            autoComplete="off"
            maxLength={120}
            placeholder="What was it? e.g. Weekly shop…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {!editing && (
          <div>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={makeRecurring}
                onChange={(e) => setMakeRecurring(e.target.checked)}
              />
              Repeat this {kindLabel.toLowerCase()} entry
            </label>
            {makeRecurring && (
              <div className="dialog-form-row mt-4">
                <div className="field">
                  <label htmlFor="entry-frequency">How often</label>
                  <select
                    id="entry-frequency"
                    className="select"
                    name="frequency"
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                  >
                    <option value="monthly">Every month</option>
                    <option value="weekly">Every week</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="entry-end-date">Ends <span className="label-optional">(optional)</span></label>
                  <input
                    id="entry-end-date"
                    className="input"
                    type="date"
                    name="end-date"
                    autoComplete="off"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    aria-invalid={errors.endDate ? "true" : undefined}
                    aria-describedby={errors.endDate ? "entry-end-date-error" : undefined}
                  />
                  {errors.endDate && (
                    <p className="field-error" id="entry-end-date-error" role="alert">
                      {errors.endDate}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {editing && initial?.ruleId && (
          <p className="muted text-sm">
            This entry comes from a repeating rule. Editing it changes only
            this one occurrence.
          </p>
        )}

        <div className="dialog-actions">
          {editing && (
            <button
              type="button"
              className="button button-danger push-left"
              onClick={() => onDelete(initial.id)}
            >
              Delete
            </button>
          )}
          <button type="button" className="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="button button-primary">
            {editing ? "Save changes" : `Add ${kindLabel.toLowerCase()}`}
          </button>
        </div>
      </form>
    </Modal>
  );
}
