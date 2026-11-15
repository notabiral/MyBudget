import {
  currentMonthKey,
  currentWeekKey,
  daysInMonth,
  formatDate,
  monthKeyParts,
  monthLabel,
  monthProgress,
  parseISO,
  todayISO,
  weekKeyOf,
  weekLabel,
  weekProgress,
  weekRange,
  weekShortLabel,
} from "../lib/dates.js";
import { formatMoney, formatMoneyShort, formatPercent } from "../lib/money.js";
import { axisMax, axisTicks } from "../lib/chart.js";
import {
  accountBalance,
  categorySpend,
  monthSummary,
  totalSaved,
  trend,
  weekSummary,
  weekTrend,
} from "../lib/stats.js";
import { Bar, CatDot, EmptyState } from "./ui.jsx";

function verdictFor(summary, overCount, { periodNoun, daysLeft }) {
  const { income, expenses, opening, leftToSpend } = summary;
  if (income === 0 && expenses === 0) {
    if (opening > 0) {
      return `${formatMoney(opening, summary.currency)} brought forward. Nothing recorded yet this ${periodNoun}.`;
    }
    if (opening < 0) {
      return `${formatMoney(-opening, summary.currency)} overdrawn from earlier ${periodNoun}s. Add income to get back above water.`;
    }
    return `Nothing recorded yet. Add your first entry and the ${periodNoun} takes shape.`;
  }
  if (leftToSpend < 0) {
    return periodNoun === "week"
      ? `Over by ${formatMoney(-leftToSpend, summary.currency)}. The week needs a plan B.`
      : `Over by ${formatMoney(-leftToSpend, summary.currency)}. The month needs a plan B — or a smaller week.`;
  }
  if (income === 0) {
    if (opening > 0) {
      return `${formatMoney(expenses, summary.currency)} out, nothing in yet — covered by what you brought forward.`;
    }
    return `${formatMoney(expenses, summary.currency)} out, nothing in yet. Add your income to see the full picture.`;
  }
  const parts = [`${formatPercent(summary.spendRatio)} of your income spent`];
  if (overCount > 0) {
    parts.push(`${overCount} ${overCount === 1 ? "category" : "categories"} over budget`);
  }
  if (daysLeft !== null) {
    parts.push(
      daysLeft === 0
        ? `last day of the ${periodNoun}`
        : `${daysLeft} ${daysLeft === 1 ? "day" : "days"} to go`
    );
  }
  return `${formatMoney(leftToSpend, summary.currency)} left. ${parts.join(". ")}.`;
}

function TrendChart({ data, currency, periodMode }) {
  const isWeek = periodMode === "week";
  const periodNoun = isWeek ? "week" : "month";
  const labelFor = (d) => (isWeek ? weekShortLabel(d.key) : monthLabel(d.key, "short").split(" ")[0]);
  const fullLabelFor = (d) => (isWeek ? weekLabel(d.key) : monthLabel(d.key));
  const W = 560;
  const H = 190;
  // Axis labels live in their own left gutter, right-aligned clear of the
  // plot, so no label can ever hide behind a bar.
  const PAD_L = 64;
  const PAD_R = 8;
  const PAD_B = 26;
  const PAD_T = 10;
  const rawMax = Math.max(0, ...data.map((d) => Math.max(d.income, d.expenses)));
  const max = axisMax(rawMax);
  const ticks = axisTicks(rawMax);
  const chartH = H - PAD_T - PAD_B;
  const plotW = W - PAD_L - PAD_R;
  const groupW = plotW / data.length;
  const barW = Math.min(22, (groupW - 18) / 2);

  return (
    <div>
      <svg
        className="trend-chart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Bar chart of money in and money out for the last ${data.length} ${periodNoun}s`}
      >
        {ticks.map((value) => {
          const y = PAD_T + chartH * (1 - value / max);
          return (
            <g key={value}>
              <line x1={PAD_L} x2={W - PAD_R} y1={y} y2={y} stroke="var(--line)" strokeWidth="1" />
              <text x={PAD_L - 8} y={y + 3} textAnchor="end" fontSize="10" fill="var(--text-3)" fontFamily="IBM Plex Mono, monospace">
                {formatMoneyShort(value, currency)}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const gx = PAD_L + i * groupW + (groupW - (barW * 2 + 6)) / 2;
          const incomeH = (d.income / max) * chartH;
          const expenseH = (d.expenses / max) * chartH;
          const label = labelFor(d);
          const fullLabel = fullLabelFor(d);
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
                <title>{`${fullLabel}: ${formatMoney(d.income, currency)} in`}</title>
              </rect>
              <rect
                x={gx + barW + 6}
                y={PAD_T + chartH - expenseH}
                width={barW}
                height={Math.max(expenseH, d.expenses > 0 ? 2 : 0)}
                rx="3"
                style={{ fill: "var(--text)" }}
              >
                <title>{`${fullLabel}: ${formatMoney(d.expenses, currency)} out`}</title>
              </rect>
              <text x={PAD_L + i * groupW + groupW / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--text-2)" fontFamily="IBM Plex Mono, monospace">
                {label}
              </text>
            </g>
          );
        })}
      </svg>
      <table className="visually-hidden">
        <caption>Money in and out, last {data.length} {periodNoun}s</caption>
        <thead>
          <tr>
            <th scope="col">{isWeek ? "Week" : "Month"}</th>
            <th scope="col">Money in</th>
            <th scope="col">Money out</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.key}>
              <th scope="row">{fullLabelFor(d)}</th>
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

export default function Overview({ state, periodMode, weekKey, monthKey, onNavigate, onAddEntry, onEditTxn }) {
  const currency = state.currency;
  const isWeek = periodMode === "week";
  const periodNoun = isWeek ? "week" : "month";
  const periodKey = isWeek ? weekKey : monthKey;
  const periodLabel = isWeek ? weekLabel(weekKey) : monthLabel(monthKey);
  const summary = {
    ...(isWeek ? weekSummary(state, weekKey) : monthSummary(state, monthKey)),
    currency,
  };
  const rows = categorySpend(state, periodKey, { mode: periodMode });
  const overCount = rows.filter((r) => r.over).length;
  const trendData = isWeek ? weekTrend(state, weekKey, 8) : trend(state, monthKey, 6);
  const isCurrentPeriod = isWeek ? weekKey === currentWeekKey() : monthKey === currentMonthKey();
  const progress = isWeek ? weekProgress(weekKey) : monthProgress(monthKey);
  const daysLeft = (() => {
    if (!isCurrentPeriod) return null;
    const today = todayISO();
    if (isWeek) {
      const range = weekRange(weekKey);
      if (!range) return null;
      const end = parseISO(range.end);
      const now = parseISO(today);
      const DAY_MS = 24 * 60 * 60 * 1000;
      return Math.round(
        (Date.UTC(end.year, end.month - 1, end.day) - Date.UTC(now.year, now.month - 1, now.day)) / DAY_MS
      );
    }
    const keyParts = monthKeyParts(monthKey);
    if (!keyParts) return null;
    return daysInMonth(keyParts.year, keyParts.month) - parseISO(today).day;
  })();

  const recent = state.transactions
    .filter((t) => (isWeek ? weekKeyOf(t.date) === weekKey : t.date.slice(0, 7) === monthKey))
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
  const figureText = formatMoney(summary.leftToSpend, currency);
  const figureNegative = summary.leftToSpend < 0;

  return (
    <>
      <section className="hero" aria-label={`Overview for ${periodLabel}`}>
        <div className="wrap hero-inner">
          <h1 className="eyebrow hero-eyebrow">
            {periodLabel} — Left to spend
          </h1>
          <p className={figureNegative ? "hero-figure is-negative" : "hero-figure"}>
            {figureNegative ? (
              <>
                <span className="hero-figure-sign">−</span>
                {formatMoney(-summary.leftToSpend, currency)}
              </>
            ) : (
              figureText
            )}
          </p>
          <p className="hero-verdict">{verdictFor(summary, overCount, { periodNoun, daysLeft })}</p>
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
              <dt className="hero-fact-label">Brought forward</dt>
              <dd className={summary.opening < 0 ? "hero-fact-value is-bad" : "hero-fact-value"}>
                {formatMoney(summary.opening, currency)}
              </dd>
            </div>
            <div className="hero-fact">
              <dt className="hero-fact-label">Spent</dt>
              <dd className="hero-fact-value">{formatPercent(summary.spendRatio)}</dd>
            </div>
          </dl>
          {isCurrentPeriod && (
            <div className="hero-progress">
              <div className="hero-progress-label">
                <span>{isWeek ? "Week elapsed" : "Month elapsed"}</span>
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
                <p>Nothing recorded for {periodLabel} so far. Add your first expense and this fills in.</p>
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
              <h2 className="section-title" id="trend-title">
                {isWeek ? "The last 8 weeks" : "The last 6 months"}
              </h2>
            </div>
            {trendData.every((d) => d.income === 0 && d.expenses === 0) ? (
              <EmptyState title="No history yet">
                <p>Once two or more {periodNoun}s have entries, the trend shows up here.</p>
              </EmptyState>
            ) : (
              <TrendChart data={trendData} currency={currency} periodMode={periodMode} />
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
              <EmptyState title={isWeek ? "Quiet week" : "Quiet month"}>
                <p>No entries in {periodLabel} yet.</p>
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
