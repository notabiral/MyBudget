import {
  currentMonthKey,
  daysInMonth,
  formatDate,
  monthKeyParts,
  monthLabel,
  monthProgress,
  parseISO,
  todayISO,
} from "../lib/dates.js";
import { formatMoney, formatMoneyShort, formatPercent } from "../lib/money.js";
import { accountBalance, categorySpend, monthSummary, totalSaved, trend } from "../lib/stats.js";
import { Bar, CatDot, EmptyState } from "./ui.jsx";

function verdictFor(summary, overCount, monthKey) {
  const { income, expenses, left } = summary;
  if (income === 0 && expenses === 0) {
    return "Nothing recorded yet. Add your first entry and the month takes shape.";
  }
  if (income === 0) {
    return `${formatMoney(expenses, summary.currency)} out, nothing in yet. Add your income to see the full picture.`;
  }
  if (left < 0) {
    return `Over by ${formatMoney(-left, summary.currency)}. The month needs a plan B — or a smaller week.`;
  }
  const parts = [`${formatPercent(summary.spendRatio)} of your income spent`];
  if (overCount > 0) {
    parts.push(`${overCount} ${overCount === 1 ? "category" : "categories"} over budget`);
  }
  const key = monthKeyParts(monthKey);
  const now = parseISO(todayISO());
  if (key && now && key.year === now.year && key.month === now.month) {
    const remaining = daysInMonth(key.year, key.month) - now.day;
    parts.push(remaining === 0 ? "last day of the month" : `${remaining} days to go`);
  }
  return `${formatMoney(left, summary.currency)} left. ${parts.join(". ")}.`;
}

function TrendChart({ data, currency }) {
  const W = 560;
  const H = 190;
  const PAD_L = 8;
  const PAD_B = 26;
  const PAD_T = 10;
  const max = Math.max(1, ...data.map((d) => Math.max(d.income, d.expenses)));
  const chartH = H - PAD_T - PAD_B;
  const groupW = (W - PAD_L * 2) / data.length;
  const barW = Math.min(22, (groupW - 18) / 2);
  const gridValues = [0, 0.5, 1];

  return (
    <div>
      <svg
        className="trend-chart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Bar chart of money in and money out for the last ${data.length} months`}
      >
        {gridValues.map((f) => {
          const y = PAD_T + chartH * (1 - f);
          return (
            <g key={f}>
              <line x1={PAD_L} x2={W - PAD_L} y1={y} y2={y} stroke="var(--line)" strokeWidth="1" />
              <text x={W - PAD_L} y={y - 4} textAnchor="end" fontSize="10" fill="var(--text-3)" fontFamily="IBM Plex Mono, monospace">
                {formatMoneyShort(Math.round(max * f), currency)}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const gx = PAD_L + i * groupW + (groupW - (barW * 2 + 6)) / 2;
          const incomeH = (d.income / max) * chartH;
          const expenseH = (d.expenses / max) * chartH;
          const label = monthLabel(d.key, "short").split(" ")[0];
          return (
            <g key={d.key}>
              <rect
                x={gx}
                y={PAD_T + chartH - incomeH}
                width={barW}
                height={Math.max(incomeH, d.income > 0 ? 2 : 0)}
                rx="3"
                style={{ fill: "var(--good)" }}
              >
                <title>{`${monthLabel(d.key)}: ${formatMoney(d.income, currency)} in`}</title>
              </rect>
              <rect
                x={gx + barW + 6}
                y={PAD_T + chartH - expenseH}
                width={barW}
                height={Math.max(expenseH, d.expenses > 0 ? 2 : 0)}
                rx="3"
                style={{ fill: "var(--text)" }}
              >
                <title>{`${monthLabel(d.key)}: ${formatMoney(d.expenses, currency)} out`}</title>
              </rect>
              <text x={PAD_L + i * groupW + groupW / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--text-2)" fontFamily="IBM Plex Mono, monospace">
                {label}
              </text>
            </g>
          );
        })}
      </svg>
      <table className="visually-hidden">
        <caption>Money in and out, last {data.length} months</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Money in</th>
            <th scope="col">Money out</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.key}>
              <th scope="row">{monthLabel(d.key)}</th>
              <td>{formatMoney(d.income, currency)}</td>
              <td>{formatMoney(d.expenses, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="trend-legend" aria-hidden="true">
        <span className="trend-legend-item">
          <span className="trend-swatch" style={{ backgroundColor: "var(--good)" }} /> Money in
        </span>
        <span className="trend-legend-item">
          <span className="trend-swatch" style={{ backgroundColor: "var(--text)" }} /> Money out
        </span>
      </div>
    </div>
  );
}

export default function Overview({ state, monthKey, onNavigate, onAddEntry, onEditTxn }) {
  const currency = state.currency;
  const summary = { ...monthSummary(state, monthKey), currency };
  const rows = categorySpend(state, monthKey);
  const overCount = rows.filter((r) => r.over).length;
  const trendData = trend(state, monthKey, 6);
  const isCurrentMonth = monthKey === currentMonthKey();
  const progress = monthProgress(monthKey);
  const keyParts = monthKeyParts(monthKey);
  const daysLeft =
    keyParts && isCurrentMonth
      ? daysInMonth(keyParts.year, keyParts.month) - parseISO(todayISO()).day
      : null;

  const recent = state.transactions
    .filter((t) => t.date.slice(0, 7) === monthKey)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6);

  const categoryById = new Map(state.categories.map((c) => [c.id, c]));
  const accountById = new Map(state.accounts.map((a) => [a.id, a]));
  const savingsAccounts = state.accounts
    .filter((a) => !a.archived)
    .map((a) => ({ account: a, balance: accountBalance(state, a.id) }))
    .sort((x, y) => y.balance - x.balance)
    .slice(0, 3);

  const hasAnything = state.transactions.length > 0;
  const figureText = formatMoney(summary.left, currency);
  const figureNegative = summary.left < 0;

  return (
    <>
      <section className="hero" aria-label={`Overview for ${monthLabel(monthKey)}`}>
        <div className="wrap hero-inner">
          <h1 className="eyebrow hero-eyebrow">
            {monthLabel(monthKey)} — Left to spend
          </h1>
          <p className={figureNegative ? "hero-figure is-negative" : "hero-figure"}>
            {figureNegative ? (
              <>
                <span className="hero-figure-sign">−</span>
                {formatMoney(-summary.left, currency)}
              </>
            ) : (
              figureText
            )}
          </p>
          <p className="hero-verdict">{verdictFor(summary, overCount, monthKey)}</p>
          <dl className="hero-facts">
            <div className="hero-fact">
              <dt className="hero-fact-label">Money in</dt>
              <dd className="hero-fact-value is-good">{formatMoney(summary.income, currency)}</dd>
            </div>
            <div className="hero-fact">
              <dt className="hero-fact-label">Money out</dt>
              <dd className="hero-fact-value">{formatMoney(summary.expenses, currency)}</dd>
            </div>
            <div className="hero-fact">
              <dt className="hero-fact-label">Saved</dt>
              <dd className="hero-fact-value">{formatMoney(summary.savings, currency)}</dd>
            </div>
            <div className="hero-fact">
              <dt className="hero-fact-label">Carried</dt>
              <dd className={summary.carried < 0 ? "hero-fact-value is-bad" : "hero-fact-value"}>
                {formatMoney(summary.carried, currency)}
              </dd>
            </div>
            <div className="hero-fact">
              <dt className="hero-fact-label">Spent</dt>
              <dd className="hero-fact-value">{formatPercent(summary.spendRatio)}</dd>
            </div>
          </dl>
          {isCurrentMonth && (
            <div className="hero-progress">
              <div className="hero-progress-label">
                <span>Month elapsed</span>
                <span>
                  {daysLeft === 0 ? "Last day" : `${daysLeft} ${daysLeft === 1 ? "day" : "days"} left`}
                </span>
              </div>
              <div className="hero-progress-track" aria-hidden="true">
                <div
                  className="hero-progress-fill"
                  style={{ transform: `scaleX(${progress})` }}
                />
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="wrap">
        <div className="dashboard-grid">
          <section className="panel panel-wide" aria-labelledby="where-it-went">
            <div className="section-head">
              <h2 className="section-title" id="where-it-went">Where it went</h2>
              <button type="button" className="section-link" onClick={() => onNavigate("budgets")}>
                Budgets
              </button>
            </div>
            {rows.length === 0 || rows.every((r) => r.spent === 0) ? (
              <EmptyState title="No spending yet">
                <p>Nothing recorded for {monthLabel(monthKey)} so far. Add your first expense and this fills in.</p>
              </EmptyState>
            ) : (
              <ul>
                {rows
                  .filter((r) => r.spent > 0)
                  .slice(0, 6)
                  .map((r) => {
                    const max = Math.max(...rows.map((x) => x.spent), 1);
                    return (
                      <li className="cat-row" key={r.category ? r.category.id : "uncategorised"}>
                        <div className="cat-row-top">
                          <span className="cat-row-name">
                            <CatDot color={r.category?.color} />
                            {r.category ? r.category.name : "Uncategorised"}
                          </span>
                          <span className="cat-row-amount">{formatMoney(r.spent, currency)}</span>
                        </div>
                        <div className="cat-row-meta">
                          <span>
                            {r.budget !== null
                              ? `of ${formatMoney(r.budget, currency)} budget`
                              : "no budget set"}
                          </span>
                          {r.budget !== null && (
                            <span className={r.over ? "is-over" : undefined}>
                              {r.over
                                ? `${formatMoney(-r.remaining, currency)} over`
                                : `${formatMoney(r.remaining, currency)} left`}
                            </span>
                          )}
                        </div>
                        <Bar
                          ratio={r.budget ? r.spent / r.budget : r.spent / max}
                          color={r.category?.color}
                          over={r.over}
                          label={`${r.category ? r.category.name : "Uncategorised"}: ${formatMoney(r.spent, currency)} spent${r.budget !== null ? ` of ${formatMoney(r.budget, currency)} budget` : ""}`}
                        />
                      </li>
                    );
                  })}
              </ul>
            )}
          </section>

          <section className="panel panel-narrow" aria-labelledby="trend-title">
            <div className="section-head">
              <h2 className="section-title" id="trend-title">The last 6 months</h2>
            </div>
            {trendData.every((d) => d.income === 0 && d.expenses === 0) ? (
              <EmptyState title="No history yet">
                <p>Once two or more months have entries, the trend shows up here.</p>
              </EmptyState>
            ) : (
              <TrendChart data={trendData} currency={currency} />
            )}
          </section>

          <section className="panel panel-wide" aria-labelledby="recent-title">
            <div className="section-head">
              <h2 className="section-title" id="recent-title">Recent activity</h2>
              <button type="button" className="section-link" onClick={() => onNavigate("transactions")}>
                All entries
              </button>
            </div>
            {recent.length === 0 ? (
              <EmptyState title="Quiet month">
                <p>No entries in {monthLabel(monthKey)} yet.</p>
              </EmptyState>
            ) : (
              <ul>
                {recent.map((t) => {
                  const cat = categoryById.get(t.categoryId);
                  const acct = accountById.get(t.accountId);
                  const title = t.note || cat?.name || acct?.name || "Entry";
                  return (
                    <li key={t.id} className="cat-row">
                      <button
                        type="button"
                        onClick={() => onEditTxn(t)}
                        className="row-button"
                        aria-label={`Edit ${title}, ${formatMoney(t.amountMinor, currency)}, ${formatDate(t.date)}`}
                      >
                        <span className="cat-row-top">
                          <span className="cat-row-name">
                            <CatDot color={cat?.color || acct?.color} />
                            {title}
                          </span>
                          <span
                            className="cat-row-amount"
                            style={t.kind === "income" ? { color: "var(--good)" } : undefined}
                          >
                            {t.kind === "income" ? "+" : t.kind === "expense" ? "−" : ""}
                            {formatMoney(Math.abs(t.amountMinor), currency)}
                          </span>
                        </span>
                        <span className="cat-row-meta">
                          <span>{formatDate(t.date)}</span>
                          <span>{cat?.name || acct?.name || ""}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="panel panel-narrow" aria-labelledby="savings-title">
            <div className="section-head">
              <h2 className="section-title" id="savings-title">Savings</h2>
              <button type="button" className="section-link" onClick={() => onNavigate("savings")}>
                All savings
              </button>
            </div>
            {savingsAccounts.length === 0 ? (
              <EmptyState title="No savings accounts">
                <p>Add an account to start putting money aside with a target to aim at.</p>
              </EmptyState>
            ) : (
              <>
                <p className="muted text-md">
                  Total saved:{" "}
                  <strong>
                    {formatMoney(totalSaved(state), currency)}
                  </strong>
                </p>
                <ul className="mt-8">
                  {savingsAccounts.map(({ account, balance }) => (
                    <li className="cat-row" key={account.id}>
                      <div className="cat-row-top">
                        <span className="cat-row-name">
                          <CatDot color={account.color} />
                          {account.name}
                        </span>
                        <span className="cat-row-amount">{formatMoney(balance, currency)}</span>
                      </div>
                      {account.targetMinor ? (
                        <>
                          <div className="cat-row-meta">
                            <span>Target {formatMoney(account.targetMinor, currency)}</span>
                            <span>{formatPercent(balance / account.targetMinor)}</span>
                          </div>
                          <Bar
                            ratio={balance / account.targetMinor}
                            color={account.color}
                            label={`${account.name}: ${formatMoney(balance, currency)} of ${formatMoney(account.targetMinor, currency)} target`}
                          />
                        </>
                      ) : (
                        <div className="cat-row-meta">
                          <span>No target set</span>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </div>

        {!hasAnything && (
          <div className="mt-24">
            <EmptyState
              title="A fresh start"
              action={
                <button type="button" className="button button-primary" onClick={onAddEntry}>
                  Add your first entry
                </button>
              }
            >
              <p>No entries anywhere yet. Add income, spending and savings — the dashboard builds itself from there.</p>
            </EmptyState>
          </div>
        )}
      </div>
    </>
  );
}
