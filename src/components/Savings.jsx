import { useEffect, useState } from "react";
import { todayISO } from "../lib/dates.js";
import { formatMoney, formatPercent, parseMoney } from "../lib/money.js";
import { accountBalance, totalSaved } from "../lib/stats.js";
import { Bar, CatDot, EmptyState, Modal } from "./ui.jsx";

function AccountDialog({ open, account, onClose, onSave }) {
  const [name, setName] = useState(account?.name || "");
  const [target, setTarget] = useState(
    account?.targetMinor ? String(account.targetMinor / 100) : ""
  );
  const [error, setError] = useState("");
  const [errorField, setErrorField] = useState(null);

  // Reset the form whenever the dialog opens for a different account.
  useEffect(() => {
    if (!open) return;
    setName(account?.name || "");
    setTarget(account?.targetMinor ? String(account.targetMinor / 100) : "");
    setError("");
    setErrorField(null);
  }, [open, account]);

  function submit(event) {
    event.preventDefault();
    if (name.trim() === "") {
      setError("Give the account a name.");
      setErrorField("name");
      return;
    }
    let targetMinor = null;
    if (target.trim() !== "") {
      const parsed = parseMoney(target);
      if (parsed === null || parsed <= 0) {
        setError("The target must be an amount greater than zero, or left blank.");
        setErrorField("target");
        return;
      }
      targetMinor = parsed;
    }
    onSave({ id: account?.id, name: name.trim(), targetMinor });
  }

  return (
    <Modal open={open} title={account ? "Edit savings account" : "New savings account"} onClose={onClose}>
      <form className="dialog-form" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="account-name">Account name</label>
          <input
            id="account-name"
            className="input"
            name="account-name"
            autoComplete="off"
            maxLength={60}
            placeholder="e.g. Holiday fund…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={errorField === "name" ? "true" : undefined}
            aria-describedby={errorField === "name" ? "account-form-error" : undefined}
            data-autofocus
          />
        </div>
        <div className="field">
          <label htmlFor="account-target">Target <span className="label-optional">(optional)</span></label>
          <input
            id="account-target"
            className="input input-money"
            name="account-target"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            aria-invalid={errorField === "target" ? "true" : undefined}
            aria-describedby={errorField === "target" ? "account-form-error" : undefined}
          />
        </div>
        {error && (
          <p className="field-error" id="account-form-error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" className="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="button button-primary">
            {account ? "Save changes" : "Add account"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function MoveDialog({ open, account, direction, onClose, onSave, currency }) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  // Reset the form whenever the dialog opens.
  useEffect(() => {
    if (!open) return;
    setAmount("");
    setDate(todayISO());
    setNote("");
    setError("");
  }, [open ]);

  function submit(event) {
    event.preventDefault();
    const parsed = parseMoney(amount);
    if (parsed === null || parsed <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    onSave({
      accountId: account.id,
      amountMinor: direction === "out" ? -parsed : parsed,
      date,
      note: note.trim(),
    });
  }

  return (
    <Modal
      open={open}
      title={direction === "out" ? `Take money out of ${account?.name || "this account"}` : `Put money into ${account?.name || "this account"}`}
      onClose={onClose}
    >
      <form className="dialog-form" onSubmit={submit} noValidate>
        <div className="dialog-form-row">
          <div className="field">
            <label htmlFor="move-amount">Amount</label>
            <input
              id="move-amount"
              className="input input-money"
              name="move-amount"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-invalid={error ? "true" : undefined}
              aria-describedby={error ? "move-form-error" : undefined}
              data-autofocus
            />
          </div>
          <div className="field">
            <label htmlFor="move-date">Date</label>
            <input
              id="move-date"
              className="input"
              name="move-date"
              type="date"
              autoComplete="off"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="move-note">Note <span className="label-optional">(optional)</span></label>
          <input
            id="move-note"
            className="input"
            name="move-note"
            autoComplete="off"
            maxLength={120}
            placeholder="e.g. Payday transfer…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        {error && (
          <p className="field-error" id="move-form-error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" className="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="button button-primary">
            {direction === "out" ? "Take money out" : "Put money in"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function Savings({
  state,
  onSaveAccount,
  onDeleteAccount,
  onMoveMoney,
}) {
  const currency = state.currency;
  const [accountDialog, setAccountDialog] = useState({ open: false, account: null });
  const [moveDialog, setMoveDialog] = useState({ open: false, account: null, direction: "in" });

  const accounts = state.accounts
    .filter((a) => !a.archived)
    .map((a) => ({ account: a, balance: accountBalance(state, a.id) }))
    .sort((x, y) => y.balance - x.balance);

  return (
    <div className="wrap view">
      <div className="view-head">
        <div>
          <h1 className="view-title">Savings</h1>
          <p className="view-sub">
            Money set aside, with targets to aim at. Total saved:{" "}
            <strong>{formatMoney(totalSaved(state), currency)}</strong>
          </p>
        </div>
        <button
          type="button"
          className="button button-primary"
          onClick={() => setAccountDialog({ open: true, account: null })}
        >
          New account
        </button>
      </div>

      {accounts.length === 0 ? (
        <div className="panel mt-24">
          <EmptyState
            title="No savings accounts yet"
            action={
              <button
                type="button"
                className="button button-primary"
                onClick={() => setAccountDialog({ open: true, account: null })}
              >
                Add your first account
              </button>
            }
          >
            <p>Accounts hold the money you put aside — an ISA, a holiday fund, whatever the goal is. Give one a target and watch the bar fill.</p>
          </EmptyState>
        </div>
      ) : (
        <div className="savings-grid">
          {accounts.map(({ account, balance }) => {
            const ratio = account.targetMinor ? balance / account.targetMinor : 0;
            return (
              <article className="savings-card" key={account.id}>
                <div className="savings-card-head">
                  <h2 className="savings-card-name">
                    <CatDot color={account.color} />
                    {account.name}
                  </h2>
                  <div className="inline-actions-tight">
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => setAccountDialog({ open: true, account })}
                      aria-label={`Edit ${account.name}`}
                      title={`Edit ${account.name}`}
                    >
                      <span aria-hidden="true">✎</span>
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => onDeleteAccount(account.id)}
                      aria-label={`Delete ${account.name}`}
                      title={`Delete ${account.name}`}
                    >
                      <span aria-hidden="true">×</span>
                    </button>
                  </div>
                </div>
                <p className="savings-balance">{formatMoney(balance, currency)}</p>
                {account.targetMinor ? (
                  <>
                    <Bar
                      ratio={ratio}
                      color={account.color}
                      label={`${account.name}: ${formatMoney(balance, currency)} of ${formatMoney(account.targetMinor, currency)} target`}
                    />
                    <div className="savings-target-line">
                      <span>Target {formatMoney(account.targetMinor, currency)}</span>
                      <span>{formatPercent(ratio)}</span>
                    </div>
                  </>
                ) : (
                  <p className="savings-target-line">
                    <span>No target set — edit the account to add one.</span>
                  </p>
                )}
                <div className="savings-card-actions">
                  <button
                    type="button"
                    className="button button-sm"
                    onClick={() => setMoveDialog({ open: true, account, direction: "in" })}
                  >
                    Put money in
                  </button>
                  <button
                    type="button"
                    className="button button-sm"
                    onClick={() => setMoveDialog({ open: true, account, direction: "out" })}
                  >
                    Take money out
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <AccountDialog
        open={accountDialog.open}
        account={accountDialog.account}
        onClose={() => setAccountDialog({ open: false, account: null })}
        onSave={(data) => {
          onSaveAccount(data);
          setAccountDialog({ open: false, account: null });
        }}
      />
      <MoveDialog
        open={moveDialog.open}
        account={moveDialog.account}
        direction={moveDialog.direction}
        currency={currency}
        onClose={() => setMoveDialog({ open: false, account: null, direction: "in" })}
        onSave={(data) => {
          onMoveMoney(data);
          setMoveDialog({ open: false, account: null, direction: "in" });
        }}
      />
    </div>
  );
}
