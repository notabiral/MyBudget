import { useMemo, useState } from "react";
import { formatDate, monthLabel, weekLabel } from "../lib/dates.js";
import { formatMoney } from "../lib/money.js";
import { commitInlineAmount } from "../lib/quickadd.js";
import { filterTransactions } from "../lib/stats.js";
import { describeRule } from "../lib/recurring.js";
import QuickAdd from "./QuickAdd.jsx";
import { CatDot, EmptyState } from "./ui.jsx";

function groupByDate(txns) {
  const groups = [];
  for (const t of txns) {
    const last = groups[groups.length - 1];
    if (last && last.date === t.date) last.items.push(t);
    else groups.push({ date: t.date, items: [t] });
  }
  return groups;
}

export default function Transactions({
  state,
  periodMode,
  weekKey,
  monthKey,
  defaultDate,
  onAddEntry,
  onQuickAdd,
  onMakeRepeating,
  onEditTxn,
  onUpdateTxnAmount,
  onDeleteTxn,
  onToggleRule,
  onDeleteRule,
}) {
  const currency = state.currency;
  const isWeek = periodMode === "week";
  const periodLabel = isWeek ? weekLabel(weekKey) : monthLabel(monthKey);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [categoryId, setCategoryId] = useState("all");
  const [showAll, setShowAll] = useState(false);
  // Inline amount editing, following the Budgets blur-commit pattern:
  // tap an amount, edit, blur or Enter commits, Escape reverts.
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState("");

  function startAmountEdit(txn) {
    setEditingId(txn.id);
    setDraft(String(txn.amountMinor / 100));
  }

  function commitAmountEdit(txn) {
    const committed = commitInlineAmount(draft, txn.kind);
    if (committed !== null && committed !== txn.amountMinor) {
      onUpdateTxnAmount(txn.id, committed);
    }
    setEditingId(null);
  }

  const categoryById = new Map(state.categories.map((c) => [c.id, c]));
  const accountById = new Map(state.accounts.map((a) => [a.id, a]));

  const filtered = useMemo(
    () =>
      filterTransactions(state, {
        query,
        kind,
        categoryId,
        monthKey: showAll || isWeek ? null : monthKey,
        weekKey: showAll || !isWeek ? null : weekKey,
      }),
    [state, query, kind, categoryId, monthKey, weekKey, isWeek, showAll]
  );
  const groups = useMemo(() => groupByDate(filtered), [filtered]);

  const totalIn = filtered.filter((t) => t.kind === "income").reduce((s, t) => s + t.amountMinor, 0);
  const totalOut = filtered.filter((t) => t.kind === "expense").reduce((s, t) => s + t.amountMinor, 0);

  return (
    <div className="wrap view">
      <div className="view-head">
        <div>
          <h1 className="view-title">Entries</h1>
          <p className="view-sub">
            {showAll
              ? "Every entry, newest first."
              : isWeek
                ? `Entries for the week of ${periodLabel}. Switch weeks in the header to time-travel.`
                : `Entries for ${periodLabel}. Switch months in the header to time-travel.`}
          </p>
        </div>
        <button type="button" className="button button-primary" onClick={onAddEntry}>
          Add entry
        </button>
      </div>

      <QuickAdd state={state} defaultDate={defaultDate} onQuickAdd={onQuickAdd} onMakeRepeating={onMakeRepeating} />

      {state.rules.length > 0 && (
        <section className="panel mt-24" aria-labelledby="repeating-title">
          <div className="section-head">
            <h2 className="section-title" id="repeating-title">Repeating</h2>
          </div>
          <ul>
            {state.rules.map((rule) => {
              const ruleTitle =
                rule.note ||
                categoryById.get(rule.categoryId)?.name ||
                accountById.get(rule.accountId)?.name ||
                "Repeating entry";
              return (
              <li key={rule.id} className={rule.active ? "cat-row" : "cat-row is-inactive"}>
                <div className="cat-row-top">
                  <span className="cat-row-name">
                    <CatDot color={categoryById.get(rule.categoryId)?.color || accountById.get(rule.accountId)?.color} />
                    {ruleTitle}
                  </span>
                  <span className="cat-row-amount">
                    {rule.kind === "income" ? "+" : rule.kind === "expense" ? "−" : ""}
                    {formatMoney(Math.abs(rule.amountMinor), currency)}
                  </span>
                </div>
                <div className="cat-row-meta">
                  <span>
                    {describeRule(rule, {
                      categoryName: categoryById.get(rule.categoryId)?.name,
                      accountName: accountById.get(rule.accountId)?.name,
                    })}
                    {!rule.active && " · paused"}
                  </span>
                  <span className="inline-actions">
                    <button
                      type="button"
                      className="button button-sm"
                      onClick={() => onToggleRule(rule.id)}
                      aria-label={`${rule.active ? "Pause" : "Resume"} repeating entry: ${ruleTitle}`}
                    >
                      {rule.active ? "Pause" : "Resume"}
                    </button>
                    <button
                      type="button"
                      className="button button-sm button-danger"
                      onClick={() => onDeleteRule(rule.id)}
                      aria-label={`Delete repeating entry: ${ruleTitle}`}
                    >
                      Delete
                    </button>
                  </span>
                </div>
              </li>
              );
            })}
          </ul>
          <p className="mt-12 text-xs muted">
            Deleting a rule stops future entries. Entries already created stay put.
          </p>
        </section>
      )}

      <div className="toolbar" role="search" aria-label="Filter entries">
        <div className="field toolbar-search">
          <label htmlFor="txn-search">Search</label>
          <input
            id="txn-search"
            className="input"
            type="search"
            name="search"
            autoComplete="off"
            placeholder="Search notes, categories, dates…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="field toolbar-select">
          <label htmlFor="txn-kind">Type</label>
          <select
            id="txn-kind"
            className="select"
            name="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="all">All types</option>
            <option value="income">Money in</option>
            <option value="expense">Money out</option>
            <option value="saving">Savings</option>
          </select>
        </div>
        <div className="field toolbar-select">
          <label htmlFor="txn-category">Category</label>
          <select
            id="txn-category"
            className="select"
            name="category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="all">All categories</option>
            {state.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(e) => setShowAll(e.target.checked)}
          />
          {isWeek ? "All weeks" : "All months"}
        </label>
      </div>

      {filtered.length > 0 && (
        <p className="mb-12 muted text-sm" aria-live="polite">
          {filtered.length} {filtered.length === 1 ? "entry" : "entries"} ·{" "}
          {formatMoney(totalIn, currency)} in · {formatMoney(totalOut, currency)} out
        </p>
      )}

      {filtered.length === 0 ? (
        <div className="txn-list">
          <EmptyState
            title={state.transactions.length === 0 ? "No entries yet" : "Nothing matches"}
            action={
              <button type="button" className="button button-primary" onClick={onAddEntry}>
                Add entry
              </button>
            }
          >
            {state.transactions.length === 0 ? (
              <p>Add your first entry — income, spending or savings — and it lands here.</p>
            ) : (
              <p>Try a different search or filter, or widen the month range.</p>
            )}
          </EmptyState>
        </div>
      ) : (
        <div className="txn-list">
          {groups.map((group) => (
            <section key={group.date}>
              <h2 className="txn-group-label">{formatDate(group.date)}</h2>
              <ul>
                {group.items.map((t) => {
                  const cat = categoryById.get(t.categoryId);
                  const acct = accountById.get(t.accountId);
                  const title = t.note || cat?.name || acct?.name || "Entry";
                  const sub = [cat?.name, acct?.name].filter(Boolean).join(" · ");
                  const amountClass =
                    t.kind === "income"
                      ? "txn-amount is-income"
                      : t.kind === "saving"
                        ? "txn-amount is-saving"
                        : "txn-amount";
                  const sign =
                    t.kind === "income" ? "+" : t.kind === "expense" ? "−" : t.amountMinor < 0 ? "−" : "+";
                  return (
                    <li className="txn-row" key={t.id}>
                      <div className="txn-row-main">
                        <CatDot color={cat?.color || acct?.color} />
                        <div className="txn-row-label">
                          <p className="txn-row-title">
                            {title}
                            {t.ruleId && <span className="txn-badge">Repeating</span>}
                            {t.demo && <span className="txn-badge">Demo</span>}
                          </p>
                          {sub && <p className="txn-row-sub">{sub}</p>}
                        </div>
                      </div>
                      {editingId === t.id ? (
                        <input
                          className="input txn-amount-input"
                          name="entry-amount"
                          autoComplete="off"
                          inputMode="decimal"
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onBlur={() => commitAmountEdit(t)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") e.currentTarget.blur();
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          aria-label={`Amount for ${title}`}
                          data-autofocus
                          autoFocus
                        />
                      ) : (
                        <button
                          type="button"
                          className={`${amountClass} txn-amount-button`}
                          onClick={() => startAmountEdit(t)}
                          aria-label={`Edit amount for ${title}`}
                          title="Edit amount"
                        >
                          {sign}
                          {formatMoney(Math.abs(t.amountMinor), currency)}
                        </button>
                      )}
                      <div className="txn-row-actions">
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => onEditTxn(t)}
                          aria-label={`Edit ${title}`}
                          title={`Edit ${title}`}
                        >
                          <span aria-hidden="true">✎</span>
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => onDeleteTxn(t.id)}
                          aria-label={`Delete ${title}`}
                          title={`Delete ${title}`}
                        >
                          <span aria-hidden="true">×</span>
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
