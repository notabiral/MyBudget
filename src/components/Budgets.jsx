import { useRef, useState } from "react";
import { monthLabel, weekLabel } from "../lib/dates.js";
import { currencyOf, formatMoney, parseMoney } from "../lib/money.js";
import { categorySpend } from "../lib/stats.js";
import { Bar, CatDot, EmptyState } from "./ui.jsx";

export default function Budgets({
  state,
  periodMode,
  weekKey,
  monthKey,
  onSetBudget,
  onRenameCategory,
  onArchiveCategory,
  onDeleteCategory,
  onAddCategory,
}) {
  const currency = state.currency;
  const symbol = currencyOf(currency).symbol;
  const isWeek = periodMode === "week";
  const periodKey = isWeek ? weekKey : monthKey;
  const periodLabel = isWeek ? weekLabel(weekKey) : monthLabel(monthKey);
  // Weekly and monthly budgets are separate amounts. In week mode the
  // inputs edit weekly amounts; in month mode they edit monthly amounts.
  // A category with only a weekly budget still shows an effective monthly
  // figure (weekly × days in month / 7), labelled as derived.
  const budgetField = isWeek ? "weeklyBudgetMinor" : "monthlyBudgetMinor";
  const budgetNoun = isWeek ? "Weekly" : "Monthly";
  const rows = categorySpend(state, periodKey, { mode: periodMode });
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState("expense");
  const [drafts, setDrafts] = useState({});
  const [showArchived, setShowArchived] = useState(false);

  const incomeCategories = state.categories.filter((c) => c.kind === "income");
  const archived = state.categories.filter((c) => c.archived);
  const listRef = useRef(null);

  function focusFirstBudgetInput() {
    listRef.current
      ?.querySelector(`input[name="${isWeek ? "weekly-budget" : "monthly-budget"}"]`)
      ?.focus();
  }

  function commitBudget(categoryId, raw) {
    const text = String(raw ?? "").trim();
    if (text === "") {
      onSetBudget(categoryId, budgetField, null);
      return;
    }
    const parsed = parseMoney(text);
    if (parsed !== null && parsed >= 0) onSetBudget(categoryId, budgetField, parsed);
  }

  function commitRename(category) {
    const name = editName.trim();
    if (name !== "" && name !== category.name) onRenameCategory(category.id, name);
    setEditingId(null);
  }

  function addCategory(event) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    onAddCategory(name, newKind);
    setNewName("");
  }

  const totalBudget = rows.reduce((s, r) => s + (r.budget || 0), 0);
  const totalSpent = rows.reduce((s, r) => s + r.spent, 0);
  const hasAnyBudget = totalBudget > 0;

  return (
    <div className="wrap view">
      <div className="view-head">
        <div>
          <h1 className="view-title">Budgets</h1>
          <p className="view-sub">
            {isWeek ? (
              <>
                A weekly budget per category, against what the week of {periodLabel} actually
                cost. Budgets repeat every week until you change them.
              </>
            ) : (
              <>
                A monthly budget per category, against what {periodLabel} actually cost.
                Budgets repeat every month until you change them. A category with only a
                weekly budget shows a monthly figure worked out from it.
              </>
            )}
          </p>
        </div>
      </div>

      <section className="panel mt-24" aria-labelledby="spending-budgets">
        <div className="section-head">
          <h2 className="section-title" id="spending-budgets">Spending budgets</h2>
          <p className="text-sm muted">
            {hasAnyBudget
              ? `${formatMoney(totalSpent, currency)} of ${formatMoney(totalBudget, currency)} budgeted`
              : "No budgets set yet"}
          </p>
        </div>

        {rows.length > 0 && !hasAnyBudget && (
          <div className="budgets-hint">
            <p>
              Budgets repeat every {isWeek ? "week" : "month"} until you change them. Your
              spending is already tracked below — set a {isWeek ? "weekly" : "monthly"} amount
              per category to see how each one is doing.
            </p>
            <button type="button" className="button" onClick={focusFirstBudgetInput}>
              Set your first budget
            </button>
          </div>
        )}

        {rows.length === 0 ? (
          <EmptyState title="No spending categories">
            <p>Add a category below to start budgeting it.</p>
          </EmptyState>
        ) : (
          <ul ref={listRef}>
            {rows.map((r) => {
              const category = r.category;
              if (!category) return null;
              const draft = drafts[category.id];
              const explicit = category[budgetField] ?? null;
              const shown =
                draft !== undefined
                  ? draft
                  : explicit === null
                    ? ""
                    : String(explicit / 100);
              const isEditing = editingId === category.id;
              return (
                <li className="budget-row" key={category.id}>
                  <div className="budget-row-name">
                    <CatDot color={category.color} />
                    {isEditing ? (
                      <input
                        className="input input-tall"
                        name="category-name"
                        autoComplete="off"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={() => commitRename(category)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitRename(category);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        aria-label="Category name"
                        data-autofocus
                        autoFocus
                      />
                    ) : (
                      <span>{category.name}</span>
                    )}
                  </div>
                  <div className="budget-input-wrap">
                    <span className="budget-currency" aria-hidden="true">{symbol}</span>
                    <input
                      className="input"
                      name={isWeek ? "weekly-budget" : "monthly-budget"}
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder={r.budgetDerived ? "No monthly budget" : "No budget"}
                      value={shown}
                      onChange={(e) =>
                        setDrafts((d) => ({ ...d, [category.id]: e.target.value }))
                      }
                      onBlur={(e) => {
                        commitBudget(category.id, e.target.value);
                        setDrafts((d) => {
                          const next = { ...d };
                          delete next[category.id];
                          return next;
                        });
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                      }}
                      aria-label={`${budgetNoun} budget for ${category.name}`}
                    />
                  </div>
                  <div className="budget-row-figures">
                    <div className="budget-row-figures-top">
                      <span>
                        <strong>{formatMoney(r.spent, currency)}</strong> spent
                      </span>
                      {r.budget !== null ? (
                        <span className={r.over ? "budget-remaining is-over" : "budget-remaining"}>
                          {r.over
                            ? `${formatMoney(-r.remaining, currency)} over`
                            : `${formatMoney(r.remaining, currency)} left`}
                        </span>
                      ) : (
                        <span className="muted">no budget</span>
                      )}
                    </div>
                    {r.budgetDerived && category.weeklyBudgetMinor != null && (
                      <p className="budget-derived-note">
                        Monthly figure from {formatMoney(category.weeklyBudgetMinor, currency)} a
                        week — set a monthly amount above to override it.
                      </p>
                    )}
                    {r.budget !== null && (
                      <Bar
                        ratio={r.ratio}
                        color={category.color}
                        over={r.over}
                        label={`${category.name}: ${formatMoney(r.spent, currency)} of ${formatMoney(r.budget, currency)}`}
                      />
                    )}
                  </div>
                  <div className="budget-row-actions">
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => {
                        setEditingId(category.id);
                        setEditName(category.name);
                      }}
                      aria-label={`Rename ${category.name}`}
                      title={`Rename ${category.name}`}
                    >
                      <span aria-hidden="true">✎</span>
                    </button>
                    <button
                      type="button"
                      className="button button-sm"
                      onClick={() => onArchiveCategory(category.id)}
                    >
                      Archive
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => onDeleteCategory(category.id)}
                      aria-label={`Delete ${category.name}`}
                      title={`Delete ${category.name}`}
                    >
                      <span aria-hidden="true">×</span>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <form className="add-row" onSubmit={addCategory}>
          <div className="field">
            <label htmlFor="new-category-name">New category</label>
            <input
              id="new-category-name"
              className="input"
              name="new-category"
              autoComplete="off"
              maxLength={60}
              placeholder="e.g. Pet care…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
          <div className="field field-narrow">
            <label htmlFor="new-category-kind">Type</label>
            <select
              id="new-category-kind"
              className="select"
              name="new-category-kind"
              value={newKind}
              onChange={(e) => setNewKind(e.target.value)}
            >
              <option value="expense">Spending</option>
              <option value="income">Income</option>
            </select>
          </div>
          <button type="submit" className="button" disabled={newName.trim() === ""}>
            Add category
          </button>
        </form>
      </section>

      <section className="panel mt-16" aria-labelledby="income-categories">
        <div className="section-head">
          <h2 className="section-title" id="income-categories">Income categories</h2>
        </div>
        {incomeCategories.length === 0 ? (
          <p className="muted">No income categories. Add one above.</p>
        ) : (
          <ul>
            {incomeCategories.map((c) => (
              <li key={c.id} className="cat-row">
                <div className="cat-row-top">
                  <span className="cat-row-name">
                    <CatDot color={c.color} />
                    {c.name}
                    {c.archived && <span className="txn-badge">Archived</span>}
                  </span>
                  <span className="inline-actions-tight">
                    <button
                      type="button"
                      className="button button-sm"
                      onClick={() => onArchiveCategory(c.id)}
                    >
                      {c.archived ? "Restore" : "Archive"}
                    </button>
                    <button
                      type="button"
                      className="button button-sm button-danger"
                      onClick={() => onDeleteCategory(c.id)}
                      aria-label={`Delete ${c.name}`}
                    >
                      Delete
                    </button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {archived.length > 0 && (
        <section className="panel mt-16" aria-labelledby="archived-title">
          <div className="section-head">
            <h2 className="section-title" id="archived-title">
              Archived ({archived.length})
            </h2>
            <button
              type="button"
              className="button button-sm"
              onClick={() => setShowArchived((v) => !v)}
              aria-expanded={showArchived}
            >
              {showArchived ? "Hide" : "Show"}
            </button>
          </div>
          {showArchived && (
            <>
              <p className="muted text-sm">
                Archived categories stay in your history but stop appearing in pickers.
              </p>
              <ul className="mt-8">
                {archived.map((c) => (
                  <li key={c.id} className="cat-row">
                    <div className="cat-row-top">
                      <span className="cat-row-name">
                        <CatDot color={c.color} />
                        {c.name}
                      </span>
                      <button
                        type="button"
                        className="button button-sm"
                        onClick={() => onArchiveCategory(c.id)}
                      >
                        Restore
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
    </div>
  );
}
