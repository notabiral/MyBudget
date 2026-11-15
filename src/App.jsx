import { useEffect, useRef, useState } from "react";
import Budgets from "./components/Budgets.jsx";
import DataView from "./components/DataView.jsx";
import EntryDialog from "./components/EntryDialog.jsx";
import Onboarding from "./components/Onboarding.jsx";
import Overview from "./components/Overview.jsx";
import Savings from "./components/Savings.jsx";
import Transactions from "./components/Transactions.jsx";
import { Logo } from "./components/ui.jsx";
import {
  currentMonthKey,
  currentWeekKey,
  monthKeyOf,
  monthLabel,
  parseISO,
  shiftMonth,
  shiftWeek,
  todayISO,
  weekKeyOf,
  weekLabel,
  weekRange,
} from "./lib/dates.js";
import { buildDemoState, stripDemoData } from "./lib/demo.js";
import { newId } from "./lib/ids.js";
import { exportGridCSV, exportTransactionsCSV, parseImportCSV } from "./lib/csv.js";
import {
  blankAccount,
  blankCategory,
  blankState,
  colorForIndex,
  normalizeState,
} from "./lib/model.js";
import { materializeRules, periodKeyFor } from "./lib/recurring.js";
import { downloadTextFile, exportStateJSON, loadInitial, saveState } from "./lib/storage.js";

const VIEWS = [
  ["overview", "Overview"],
  ["transactions", "Entries"],
  ["budgets", "Budgets"],
  ["savings", "Savings"],
  ["data", "Your data"],
];

function weekdayOfISO(iso) {
  const p = parseISO(iso);
  return new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
}

export default function App() {
  const [boot] = useState(() => loadInitial());
  const [state, setState] = useState(boot.state);
  const [view, setView] = useState("overview");
  const [monthKey, setMonthKey] = useState(currentMonthKey());
  const [weekKey, setWeekKey] = useState(currentWeekKey());
  // The period mode lives in prefs so it survives reloads, like the
  // currency setting. Month is the default; weekly-paid users opt in.
  const periodMode = state.prefs.periodMode === "week" ? "week" : "month";
  const [dialog, setDialog] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [showOnboarding, setShowOnboarding] = useState(
    boot.status === "fresh" && boot.state.transactions.length === 0
  );
  const [noticeDismissed, setNoticeDismissed] = useState(false);

  // A ref mirror of state so rapid-fire commits always snapshot the latest
  // state, even before React has re-rendered.
  const stateRef = useRef(state);
  stateRef.current = state;
  const toastTimers = useRef(new Map());

  // Persist on every change — including the first render, which writes the
  // migrated state straight away so the migration never runs twice.
  useEffect(() => {
    saveState(state);
  }, [state]);

  // Materialise repeating rules. Idempotent via periodKey, so this is safe
  // to run whenever the rules change.
  useEffect(() => {
    setState((prev) => {
      const generated = materializeRules(prev, todayISO());
      if (generated.length === 0) return prev;
      return { ...prev, transactions: [...prev.transactions, ...generated] };
    });
  }, [state.rules]);

  useEffect(
    () => () => {
      for (const timer of toastTimers.current.values()) clearTimeout(timer);
    },
    []
  );

  function pushToast(label, snapshot) {
    const id = newId("toast");
    setToasts((ts) => {
      const next = [...ts, { id, label, snapshot }];
      if (next.length > 3) {
        const dropped = next[0];
        clearTimeout(toastTimers.current.get(dropped.id));
        toastTimers.current.delete(dropped.id);
        return next.slice(1);
      }
      return next;
    });
    toastTimers.current.set(
      id,
      setTimeout(() => dismissToast(id), 10000)
    );
  }

  function dismissToast(id) {
    clearTimeout(toastTimers.current.get(id));
    toastTimers.current.delete(id);
    setToasts((ts) => ts.filter((t) => t.id !== id));
  }

  function undoToast(id) {
    const toast = toasts.find((t) => t.id === id);
    if (!toast) return;
    stateRef.current = toast.snapshot;
    setState(toast.snapshot);
    dismissToast(id);
  }

  /** Apply a new state with an undoable toast. For destructive actions. */
  function commit(next, label) {
    const prev = stateRef.current;
    const resolved = typeof next === "function" ? next(prev) : next;
    stateRef.current = resolved;
    setState(resolved);
    pushToast(label, prev);
  }

  /** Apply a new state without a toast. For ordinary edits. */
  function update(next) {
    const prev = stateRef.current;
    const resolved = typeof next === "function" ? next(prev) : next;
    stateRef.current = resolved;
    setState(resolved);
  }

  // ---------- Entries ----------

  /** The day the selected period points at: today when viewing the
   * current period, otherwise the period's first day. */
  function defaultDateForPeriod() {
    if (periodMode === "week") {
      if (weekKey === currentWeekKey()) return todayISO();
      return weekRange(weekKey)?.start || todayISO();
    }
    return monthKey === currentMonthKey() ? todayISO() : `${monthKey}-01`;
  }

  function setPeriodMode(mode) {
    if (mode === periodMode) return;
    // Keep the user's place: switching modes selects the period that
    // contains the day the current period points at.
    if (mode === "week") {
      setWeekKey(weekKeyOf(defaultDateForPeriod()));
    } else {
      setMonthKey(monthKeyOf(weekRange(weekKey)?.start || todayISO()));
    }
    update((prev) => ({ ...prev, prefs: { ...prev.prefs, periodMode: mode } }));
  }

  function openAddEntry() {
    setDialog({ mode: "add", txn: null, defaultDate: defaultDateForPeriod() });
  }

  // "Make it repeating" from the quick-add row: the full dialog opens
  // with repeating pre-ticked and the typed draft carried over.
  function openRepeatingEntry(draft) {
    setDialog({ mode: "add", txn: null, defaultDate: defaultDateForPeriod(), prefill: draft });
  }

  function openEditEntry(txn) {
    setDialog({ mode: "edit", txn, defaultDate: txn.date });
  }

  function saveEntry(payload) {
    const now = new Date().toISOString();
    const memberId = stateRef.current.members[0].id;
    if (payload.id) {
      update((prev) => ({
        ...prev,
        transactions: prev.transactions.map((t) =>
          t.id === payload.id
            ? {
                ...t,
                kind: payload.kind,
                date: payload.date,
                amountMinor: payload.amountMinor,
                categoryId: payload.categoryId,
                accountId: payload.accountId,
                note: payload.note,
                updatedAt: now,
              }
            : t
        ),
      }));
    } else {
      const txn = {
        id: newId("txn"),
        date: payload.date,
        kind: payload.kind,
        amountMinor: payload.amountMinor,
        categoryId: payload.categoryId,
        accountId: payload.accountId,
        memberId,
        note: payload.note,
        ruleId: null,
        periodKey: null,
        createdAt: now,
        updatedAt: now,
      };
      update((prev) => {
        let next = { ...prev, transactions: [...prev.transactions, txn] };
        if (payload.makeRecurring) {
          const parsed = parseISO(payload.date);
          const rule = {
            id: newId("rule"),
            kind: payload.kind,
            amountMinor: payload.amountMinor,
            categoryId: payload.categoryId,
            accountId: payload.accountId,
            memberId,
            note: payload.note,
            frequency: payload.frequency,
            startDate: payload.date,
            endDate: payload.endDate,
            dayOfMonth: payload.frequency === "monthly" ? parsed.day : null,
            weekday: payload.frequency === "weekly" ? weekdayOfISO(payload.date) : null,
            active: true,
            createdAt: now,
          };
          txn.ruleId = rule.id;
          txn.periodKey = periodKeyFor(rule, txn.date);
          next = { ...next, rules: [...next.rules, rule] };
        }
        return next;
      });
    }
    setDialog(null);
  }

  function deleteEntry(id) {
    const txn = stateRef.current.transactions.find((t) => t.id === id);
    const label = txn?.note || "Entry";
    commit(
      (prev) => ({ ...prev, transactions: prev.transactions.filter((t) => t.id !== id) }),
      `Deleted ${label}.`
    );
    setDialog(null);
  }

  // Inline amount edit from the Entries rows: an ordinary edit, like the
  // Budgets inputs — persisted, no toast, no undo.
  function updateTxnAmount(id, amountMinor) {
    update((prev) => ({
      ...prev,
      transactions: prev.transactions.map((t) => (t.id === id ? { ...t, amountMinor } : t)),
    }));
  }

  // ---------- Categories ----------

  function createCategory(name, kind) {
    const category = {
      ...blankCategory(name, kind, stateRef.current.categories.length),
    };
    update((prev) => ({ ...prev, categories: [...prev.categories, category] }));
    return category.id;
  }

  function renameCategory(id, name) {
    update((prev) => ({
      ...prev,
      categories: prev.categories.map((c) => (c.id === id ? { ...c, name } : c)),
    }));
  }

  function setBudget(id, field, value) {
    if (field !== "monthlyBudgetMinor" && field !== "weeklyBudgetMinor") return;
    update((prev) => ({
      ...prev,
      categories: prev.categories.map((c) =>
        c.id === id ? { ...c, [field]: value } : c
      ),
    }));
  }

  function archiveCategory(id) {
    update((prev) => ({
      ...prev,
      categories: prev.categories.map((c) =>
        c.id === id ? { ...c, archived: !c.archived } : c
      ),
    }));
  }

  function deleteCategory(id) {
    const category = stateRef.current.categories.find((c) => c.id === id);
    commit(
      (prev) => ({
        ...prev,
        categories: prev.categories.filter((c) => c.id !== id),
        // Entries keep their amounts; they become uncategorised rather
        // than vanishing with the category.
        transactions: prev.transactions.map((t) =>
          t.categoryId === id ? { ...t, categoryId: null } : t
        ),
      }),
      `Deleted ${category?.name || "category"}. Its entries are now uncategorised.`
    );
  }

  // ---------- Accounts ----------

  function createAccount(name) {
    const account = {
      ...blankAccount(name, stateRef.current.accounts.length),
    };
    update((prev) => ({ ...prev, accounts: [...prev.accounts, account] }));
    return account.id;
  }

  function saveAccount({ id, name, targetMinor }) {
    if (id) {
      update((prev) => ({
        ...prev,
        accounts: prev.accounts.map((a) =>
          a.id === id ? { ...a, name, targetMinor } : a
        ),
      }));
    } else {
      const account = {
        ...blankAccount(name, stateRef.current.accounts.length),
        targetMinor,
      };
      update((prev) => ({ ...prev, accounts: [...prev.accounts, account] }));
    }
  }

  function deleteAccount(id) {
    const account = stateRef.current.accounts.find((a) => a.id === id);
    commit(
      (prev) => ({
        ...prev,
        accounts: prev.accounts.filter((a) => a.id !== id),
        transactions: prev.transactions.map((t) =>
          t.accountId === id ? { ...t, accountId: null } : t
        ),
      }),
      `Deleted ${account?.name || "account"}. Its transfers stay in your history.`
    );
  }

  function moveMoney({ accountId, amountMinor, date, note }) {
    const now = new Date().toISOString();
    update((prev) => ({
      ...prev,
      transactions: [
        ...prev.transactions,
        {
          id: newId("txn"),
          date,
          kind: "saving",
          amountMinor,
          categoryId: null,
          accountId,
          memberId: prev.members[0].id,
          note,
          ruleId: null,
          periodKey: null,
          createdAt: now,
          updatedAt: now,
        },
      ],
    }));
  }

  // ---------- Rules ----------

  function toggleRule(id) {
    update((prev) => ({
      ...prev,
      rules: prev.rules.map((r) => (r.id === id ? { ...r, active: !r.active } : r)),
    }));
  }

  function deleteRule(id) {
    const rule = stateRef.current.rules.find((r) => r.id === id);
    commit(
      (prev) => ({ ...prev, rules: prev.rules.filter((r) => r.id !== id) }),
      `Deleted repeating entry${rule?.note ? ` (${rule.note})` : ""}. Past entries stay put.`
    );
  }

  // ---------- Data: import, export, demo, erase ----------

  function exportJSON() {
    const stamp = todayISO();
    downloadTextFile(`mybudget-backup-${stamp}.json`, exportStateJSON(stateRef.current), "application/json");
  }

  function importJSON(text) {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { ok: false, message: "That file is not valid JSON. Nothing was imported." };
    }
    const looksLikeBackup =
      parsed &&
      typeof parsed === "object" &&
      (Array.isArray(parsed.transactions) ||
        Array.isArray(parsed.categories) ||
        Array.isArray(parsed.accounts) ||
        Array.isArray(parsed.rules));
    if (!looksLikeBackup) {
      return { ok: false, message: "That file does not look like a MyBudget backup. Nothing was imported." };
    }
    const imported = normalizeState(parsed);
    commit(imported, "Imported a backup.");
    return {
      ok: true,
      message: `Imported ${imported.transactions.length} entries, ${imported.categories.length} categories and ${imported.accounts.length} savings accounts. The previous data can be restored with Undo.`,
    };
  }

  function importCSV(text, year) {
    const memberId = stateRef.current.members[0].id;
    const result = parseImportCSV(text, { year, memberId });
    if (result.format === "unknown" || result.format === "empty") {
      return { ok: false, message: result.errors[0] || "Could not read the file." };
    }
    const prev = stateRef.current;
    const categoryByKey = new Map(
      prev.categories.map((c) => [`${c.kind}:${c.name.toLowerCase()}`, c])
    );
    const accountByName = new Map(
      prev.accounts.map((a) => [a.name.toLowerCase(), a])
    );
    const newCategories = [];
    const newAccounts = [];
    const existingKeys = new Set(
      prev.transactions.map((t) => {
        const cat = prev.categories.find((c) => c.id === t.categoryId);
        const acct = prev.accounts.find((a) => a.id === t.accountId);
        return [t.date, t.kind, t.amountMinor, cat?.name || "", acct?.name || "", t.note || ""].join("|");
      })
    );
    let added = 0;
    let duplicates = 0;
    const transactions = [];
    for (const t of result.transactions) {
      let categoryId = null;
      if (t.categoryName) {
        const key = `${t.kind === "income" ? "income" : "expense"}:${t.categoryName.toLowerCase()}`;
        let category = categoryByKey.get(key);
        if (!category) {
          category = {
            ...blankCategory(t.categoryName, t.kind === "income" ? "income" : "expense", prev.categories.length + newCategories.length),
          };
          categoryByKey.set(key, category);
          newCategories.push(category);
        }
        categoryId = category.id;
      }
      let accountId = null;
      if (t.accountName) {
        let account = accountByName.get(t.accountName.toLowerCase());
        if (!account) {
          account = {
            ...blankAccount(t.accountName, prev.accounts.length + newAccounts.length),
          };
          accountByName.set(t.accountName.toLowerCase(), account);
          newAccounts.push(account);
        }
        accountId = account.id;
      }
      const key = [t.date, t.kind, t.amountMinor, t.categoryName || "", t.accountName || "", t.note || ""].join("|");
      if (existingKeys.has(key)) {
        duplicates += 1;
        continue;
      }
      existingKeys.add(key);
      const { categoryName, accountName, ...rest } = t;
      transactions.push({ ...rest, categoryId, accountId });
      added += 1;
    }
    if (added === 0 && newCategories.length === 0 && newAccounts.length === 0) {
      return {
        ok: true,
        message: `Nothing new to import — ${duplicates} ${duplicates === 1 ? "row was" : "rows were"} already here and ${result.skipped} ${result.skipped === 1 ? "row was" : "rows were"} skipped.`,
        skippedRows: result.skippedRows,
      };
    }
    commit(
      {
        ...prev,
        categories: [...prev.categories, ...newCategories],
        accounts: [...prev.accounts, ...newAccounts],
        transactions: [...prev.transactions, ...transactions],
      },
      `Imported ${added} entries from CSV.`
    );
    return {
      ok: true,
      message: `Imported ${added} ${added === 1 ? "entry" : "entries"}${newCategories.length ? `, created ${newCategories.length} ${newCategories.length === 1 ? "category" : "categories"}` : ""}${newAccounts.length ? ` and ${newAccounts.length} ${newAccounts.length === 1 ? "account" : "accounts"}` : ""}. ${duplicates} duplicate ${duplicates === 1 ? "row" : "rows"} skipped, ${result.skipped} invalid ${result.skipped === 1 ? "row" : "rows"} skipped.`,
      skippedRows: result.skippedRows,
    };
  }

  function exportGrid(year) {
    downloadTextFile(`budget_${year}.csv`, exportGridCSV(stateRef.current, year), "text/csv");
  }

  function exportLedger(year) {
    downloadTextFile(
      `mybudget_transactions_${year}.csv`,
      exportTransactionsCSV(stateRef.current, year),
      "text/csv"
    );
  }

  function loadDemo() {
    const demo = buildDemoState(currentMonthKey());
    const prev = stateRef.current;
    const categoryByKey = new Map(
      prev.categories.map((c) => [`${c.kind}:${c.name.toLowerCase()}`, c])
    );
    const accountByName = new Map(prev.accounts.map((a) => [a.name.toLowerCase(), a]));
    const newCategories = [];
    const newAccounts = [];
    const remapCategory = (demoCat) => {
      const key = `${demoCat.kind}:${demoCat.name.toLowerCase()}`;
      const existing = categoryByKey.get(key);
      if (existing) return existing.id;
      const created = { ...demoCat, id: newId("cat") };
      categoryByKey.set(key, created);
      newCategories.push(created);
      return created.id;
    };
    const remapAccount = (demoAcct) => {
      const existing = accountByName.get(demoAcct.name.toLowerCase());
      if (existing) return existing.id;
      const created = { ...demoAcct, id: newId("acct") };
      accountByName.set(demoAcct.name.toLowerCase(), created);
      newAccounts.push(created);
      return created.id;
    };
    const demoCategoryById = new Map(demo.categories.map((c) => [c.id, c]));
    const demoAccountById = new Map(demo.accounts.map((a) => [a.id, a]));
    const transactions = demo.transactions.map((t) => ({
      ...t,
      id: newId("txn"),
      categoryId: t.categoryId ? remapCategory(demoCategoryById.get(t.categoryId)) : null,
      accountId: t.accountId ? remapAccount(demoAccountById.get(t.accountId)) : null,
      memberId: prev.members[0].id,
    }));
    commit(
      {
        ...prev,
        categories: [...prev.categories, ...newCategories],
        accounts: [...prev.accounts, ...newAccounts],
        transactions: [...prev.transactions, ...transactions],
        prefs: { ...prev.prefs, demo: true },
      },
      "Demo data loaded."
    );
  }

  function deleteDemo() {
    commit(
      (prev) => stripDemoData(prev),
      "Demo data deleted. Your real entries were not touched."
    );
  }

  function eraseAll() {
    const fresh = blankState();
    stateRef.current = fresh;
    setState(fresh);
    setToasts([]);
    setView("overview");
    setMonthKey(currentMonthKey());
    setWeekKey(currentWeekKey());
    setShowOnboarding(true);
  }

  // ---------- Render ----------

  if (showOnboarding) {
    return (
      <Onboarding
        onStartFresh={() => setShowOnboarding(false)}
        onStartDemo={() => {
          loadDemo();
          setShowOnboarding(false);
        }}
        onGoToData={() => {
          setShowOnboarding(false);
          setView("data");
        }}
      />
    );
  }

  const defaultDate = defaultDateForPeriod();
  const isCurrentPeriod =
    periodMode === "week" ? weekKey === currentWeekKey() : monthKey === currentMonthKey();
  const periodLabel = periodMode === "week" ? weekLabel(weekKey) : monthLabel(monthKey);
  const prevPeriodLabel =
    periodMode === "week" ? weekLabel(shiftWeek(weekKey, -1)) : monthLabel(shiftMonth(monthKey, -1));
  const nextPeriodLabel =
    periodMode === "week" ? weekLabel(shiftWeek(weekKey, 1)) : monthLabel(shiftMonth(monthKey, 1));
  const currentPeriodLabel =
    periodMode === "week" ? weekLabel(currentWeekKey()) : monthLabel(currentMonthKey());

  const notices = (
    <>
      {boot.status === "migrated" && boot.report && !noticeDismissed && (
        <div className="notice" role="status">
          <p>
            <strong>Welcome back.</strong> Your previous budget moved over:{" "}
            {boot.report.transactions} entries, {boot.report.categories} categories and{" "}
            {boot.report.accounts} savings accounts. Your old data is kept untouched in this
            browser as a backup.
          </p>
          <div className="notice-actions">
            <button type="button" className="button button-sm" onClick={() => setNoticeDismissed(true)}>
              Got it
            </button>
          </div>
        </div>
      )}
      {boot.status === "recovered" && !noticeDismissed && (
        <div className="notice" role="alert">
          <p>
            <strong>Your saved data could not be read</strong>, so MyBudget started fresh. The
            unreadable copy was kept aside in this browser — export a backup once you have
            re-entered anything important.
          </p>
          <div className="notice-actions">
            <button type="button" className="button button-sm" onClick={() => setNoticeDismissed(true)}>
              Got it
            </button>
          </div>
        </div>
      )}
      {state.prefs.demo && (
        <div className="notice notice-demo" role="status">
          <p>
            <strong>Demo data is on.</strong> The figures on this page are illustrative examples,
            labelled where they appear. Delete them in one tap whenever you like — your real
            entries are never touched.
          </p>
          <div className="notice-actions">
            <button type="button" className="button button-sm" onClick={deleteDemo}>
              Delete demo data
            </button>
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to main content
      </a>

      <header className="site-header">
        <div className="wrap site-header-inner">
          <button
            type="button"
            className="wordmark"
            onClick={() => setView("overview")}
            aria-label="MyBudget — go to overview"
          >
            <Logo size={34} />
            <span className="wordmark-name" translate="no">
              My<em>Budget</em>
            </span>
          </button>
          <div className="header-spacer" />
          <div className="period-nav">
            <fieldset className="period-toggle">
              <legend className="visually-hidden">View by week or month</legend>
              <div className="segmented">
                {[
                  ["week", "Week"],
                  ["month", "Month"],
                ].map(([value, label]) => (
                  <label key={value}>
                    <input
                      type="radio"
                      name="period-mode"
                      value={value}
                      checked={periodMode === value}
                      onChange={() => setPeriodMode(value)}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <nav className="month-nav" aria-label={periodMode === "week" ? "Week" : "Month"}>
              <button
                type="button"
                className="month-nav-arrow"
                onClick={() =>
                  periodMode === "week"
                    ? setWeekKey((k) => shiftWeek(k, -1))
                    : setMonthKey((k) => shiftMonth(k, -1))
                }
                aria-label={`Previous ${periodMode}, ${prevPeriodLabel}`}
                title={`Previous ${periodMode}, ${prevPeriodLabel}`}
              >
                <span aria-hidden="true">←</span>
              </button>
              <button
                type="button"
                className="month-nav-current"
                onClick={() =>
                  periodMode === "week"
                    ? setWeekKey(currentWeekKey())
                    : setMonthKey(currentMonthKey())
                }
                aria-label={`Jump to current ${periodMode}, ${currentPeriodLabel}`}
                title={isCurrentPeriod ? `This ${periodMode}` : `Jump to this ${periodMode}`}
              >
                {periodLabel}
              </button>
              <button
                type="button"
                className="month-nav-arrow"
                onClick={() =>
                  periodMode === "week"
                    ? setWeekKey((k) => shiftWeek(k, 1))
                    : setMonthKey((k) => shiftMonth(k, 1))
                }
                aria-label={`Next ${periodMode}, ${nextPeriodLabel}`}
                title={`Next ${periodMode}, ${nextPeriodLabel}`}
              >
                <span aria-hidden="true">→</span>
              </button>
            </nav>
          </div>
          <button
            type="button"
            className="button button-primary header-add-button"
            onClick={openAddEntry}
          >
            Add entry
          </button>
        </div>
      </header>

      <nav className="view-tabs" aria-label="Views">
        <div className="wrap view-tabs-list">
          {VIEWS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              className="view-tab"
              aria-current={view === id ? "page" : undefined}
              onClick={() => setView(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>

      <main id="main" className="app-main" tabIndex={-1}>
        {(boot.status === "migrated" || boot.status === "recovered" || state.prefs.demo) && (
          <div className="wrap">{notices}</div>
        )}
        {view === "overview" && (
          <Overview
            state={state}
            periodMode={periodMode}
            weekKey={weekKey}
            monthKey={monthKey}
            onNavigate={setView}
            onAddEntry={openAddEntry}
            onEditTxn={openEditEntry}
          />
        )}
        {view === "transactions" && (
          <Transactions
            state={state}
            periodMode={periodMode}
            weekKey={weekKey}
            monthKey={monthKey}
            defaultDate={defaultDate}
            onAddEntry={openAddEntry}
            onQuickAdd={saveEntry}
            onMakeRepeating={openRepeatingEntry}
            onEditTxn={openEditEntry}
            onUpdateTxnAmount={updateTxnAmount}
            onDeleteTxn={deleteEntry}
            onToggleRule={toggleRule}
            onDeleteRule={deleteRule}
          />
        )}
        {view === "budgets" && (
          <Budgets
            state={state}
            periodMode={periodMode}
            weekKey={weekKey}
            monthKey={monthKey}
            onSetBudget={setBudget}
            onRenameCategory={renameCategory}
            onArchiveCategory={archiveCategory}
            onDeleteCategory={deleteCategory}
            onAddCategory={createCategory}
          />
        )}
        {view === "savings" && (
          <Savings
            state={state}
            onSaveAccount={saveAccount}
            onDeleteAccount={deleteAccount}
            onMoveMoney={moveMoney}
          />
        )}
        {view === "data" && (
          <DataView
            state={state}
            migrationInfo={
              state.meta.migratedFrom
                ? { migratedFrom: state.meta.migratedFrom, migratedAt: state.meta.migratedAt }
                : null
            }
            onExportJSON={exportJSON}
            onImportJSON={importJSON}
            onExportGrid={exportGrid}
            onExportLedger={exportLedger}
            onImportCSV={importCSV}
            onLoadDemo={loadDemo}
            onDeleteDemo={deleteDemo}
            onSetCurrency={(code) =>
              update((prev) => ({ ...prev, currency: code }))
            }
            onEraseAll={eraseAll}
          />
        )}
      </main>

      <footer className="site-footer">
        <div className="wrap site-footer-inner">
          <p>All data is stored in your browser&rsquo;s localStorage. Nothing is uploaded anywhere.</p>
          <p>MyBudget 2.0 — your money, in plain sight.</p>
        </div>
      </footer>

      <EntryDialog
        open={dialog !== null}
        initial={dialog?.txn || null}
        prefill={dialog?.prefill || null}
        defaultDate={dialog?.defaultDate || defaultDate}
        state={state}
        onClose={() => setDialog(null)}
        onSave={saveEntry}
        onDelete={deleteEntry}
        onCreateCategory={createCategory}
        onCreateAccount={createAccount}
      />

      <div className="toast-region" aria-live="polite" aria-label="Notifications">
        {toasts.map((toast) => (
          <div className="toast" key={toast.id} role="status">
            <p>{toast.label}</p>
            <button type="button" className="button" onClick={() => undoToast(toast.id)}>
              Undo
            </button>
            <button
              type="button"
              className="icon-button toast-dismiss"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss notification"
              title="Dismiss notification"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
