import { useRef, useState } from "react";
import { currentMonthKey } from "../lib/dates.js";
import { CURRENCIES } from "../lib/money.js";
import { yearRange } from "../lib/stats.js";
import { ConfirmDialog } from "./ui.jsx";

// Read-only Google Sheet template (anyone with the link can view it).
// People make their own copy, fill it in, download it as CSV and import
// the file here. Three tabs: "How to use", "Monthly" and "Weekly".
const TEMPLATE_URL =
  "https://docs.google.com/spreadsheets/d/1sHUaxe8KgCGft1APzje5LoIbJnOE0UFtHPNAQ7w5xCg/edit?usp=sharing";

// How many skipped rows to list after an import before summarising the rest.
const MAX_SHOWN_SKIPPED = 10;

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsText(file);
  });
}

export default function DataView({
  state,
  migrationInfo,
  onExportJSON,
  onImportJSON,
  onExportGrid,
  onExportLedger,
  onImportCSV,
  onLoadDemo,
  onDeleteDemo,
  onSetCurrency,
  onEraseAll,
}) {
  const currentYear = Number(currentMonthKey().slice(0, 4));
  const [minYear, maxYear] = yearRange(state, currentYear);
  const [exportYear, setExportYear] = useState(currentYear);
  const [importYear, setImportYear] = useState(currentYear);
  const [importResult, setImportResult] = useState(null);
  const [eraseOpen, setEraseOpen] = useState(false);
  const jsonInputRef = useRef(null);
  const csvInputRef = useRef(null);

  const years = [];
  for (let y = maxYear; y >= minYear; y--) years.push(y);
  if (!years.includes(currentYear)) years.unshift(currentYear);

  async function handleJSONFile(file) {
    setImportResult(null);
    try {
      const text = await readFile(file);
      const result = onImportJSON(text);
      setImportResult(result);
    } catch (err) {
      setImportResult({ ok: false, message: err.message || "Could not read the file." });
    }
  }

  async function handleCSVFile(file) {
    setImportResult(null);
    try {
      const text = await readFile(file);
      const result = onImportCSV(text, importYear);
      setImportResult(result);
    } catch (err) {
      setImportResult({ ok: false, message: err.message || "Could not read the file." });
    }
  }

  const hasTransactions = state.transactions.length > 0;

  return (
    <div className="wrap view">
      <div className="view-head">
        <div>
          <h1 className="view-title">Your data</h1>
          <p className="view-sub">
            Everything lives in this browser. Back it up, move it around, or wipe it — your call,
            nothing leaves the device unless you export it.
          </p>
        </div>
      </div>

      <div className="data-stack">
        <section className="panel" aria-labelledby="backup-title">
          <h2 id="backup-title">Backup</h2>
          <p>
            A full backup as JSON: every entry, category, account, budget and repeating rule.
            Import it on any device running MyBudget to pick up where you left off.
          </p>
          <div className="data-actions">
            <button type="button" className="button" onClick={onExportJSON}>
              Download backup
            </button>
            <button type="button" className="button" onClick={() => jsonInputRef.current?.click()}>
              Import backup
            </button>
            <input
              ref={jsonInputRef}
              type="file"
              name="backup-file"
              accept=".json,application/json"
              className="visually-hidden"
              aria-label="Choose a MyBudget backup file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleJSONFile(file);
                e.target.value = "";
              }}
            />
          </div>
        </section>

        <section className="panel" aria-labelledby="csv-title">
          <h2 id="csv-title">Spreadsheets</h2>
          <p>
            If your budget lives in a spreadsheet, start from the template below. It is
            already set up the way MyBudget reads it, so you never have to guess the
            layout.
          </p>
          <ol className="import-steps">
            <li>
              Open the{" "}
              <a href={TEMPLATE_URL} target="_blank" rel="noopener">
                MyBudget import template
              </a>{" "}
              (opens in a new tab).
            </li>
            <li>Make your own copy: in Google Sheets, choose File, then Make a copy.</li>
            <li>
              Pick a tab: Monthly if you budget by month, Weekly if you budget by week.
            </li>
            <li>Fill it in with your own figures.</li>
            <li>
              Download your copy: choose File, then Download, then &ldquo;Comma-separated
              values (.csv)&rdquo;. CSV is just the file type MyBudget can read.
            </li>
            <li>
              Come back here, choose Import CSV below, and pick the file you just
              downloaded.
            </li>
          </ol>
          <details className="format-spec">
            <summary>What the file needs to look like</summary>
            <p>
              <strong>Monthly file</strong> (from the Monthly tab): the first column is
              the category, then one column per month, Jan to Dec — one row per
              category. The row called Salary counts as money in; every other row
              counts as spending. The year is the one you pick below.
            </p>
            <p>
              <strong>Weekly file</strong> (from the Weekly tab): weeks down the side,
              categories across the top. The first column is the week starting date, a
              Monday, and every other column is a category or a savings account — one
              row per week, filled in with what each week cost. The Salary column
              counts as money in; the ISA, Revolut and Monzo 1P columns count as
              savings; every other column counts as spending. Dates as 2026-11-15 or
              15/11/2026. Amounts are plain numbers with no £ signs or commas, for
              example 64.20. Saving amounts can be negative for money taken out.
            </p>
            <p>
              <strong>Ledger file</strong> (from a ledger export): one row per entry,
              with these columns in order: Date, Type, Category, Account, Note,
              Amount. Dates as 2026-11-15 or 15/11/2026. Type is Income, Expense or
              Saving. Amounts are plain numbers with no £ signs or commas, for example
              64.20. Saving amounts can be negative for money taken out.
            </p>
          </details>
          <div className="data-actions">
            <div className="field">
              <label htmlFor="import-year">Year for grid imports</label>
              <select
                id="import-year"
                className="select"
                name="import-year"
                value={importYear}
                onChange={(e) => setImportYear(Number(e.target.value))}
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" className="button" onClick={() => csvInputRef.current?.click()}>
              Import CSV
            </button>
            <input
              ref={csvInputRef}
              type="file"
              name="csv-file"
              accept=".csv,text/csv"
              className="visually-hidden"
              aria-label="Choose a CSV file to import"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleCSVFile(file);
                e.target.value = "";
              }}
            />
          </div>
          <p className="mt-12 text-sm muted">
            Monthly grid files have no year column, so imported months land in the year
            you pick. Exact duplicates are skipped.
          </p>
          {importResult && (
            <p
              className={importResult.ok ? "import-result" : "import-result is-error"}
              role={importResult.ok ? "status" : "alert"}
            >
              {importResult.message}
            </p>
          )}
          {importResult && importResult.skippedRows && importResult.skippedRows.length > 0 && (
            <div className="skipped-rows">
              <p>
                <strong>Rows that were skipped</strong> — fix these in your copy of the
                template and import again:
              </p>
              <ul>
                {importResult.skippedRows.slice(0, MAX_SHOWN_SKIPPED).map((s, i) => (
                  <li key={`${s.row}-${i}`}>
                    Row {s.row} — {s.reason}
                  </li>
                ))}
              </ul>
              {importResult.skippedRows.length > MAX_SHOWN_SKIPPED && (
                <p className="mt-8 text-sm muted">
                  …and {importResult.skippedRows.length - MAX_SHOWN_SKIPPED} more{" "}
                  {importResult.skippedRows.length - MAX_SHOWN_SKIPPED === 1 ? "row" : "rows"}{" "}
                  skipped.
                </p>
              )}
            </div>
          )}
          <p className="mt-12 text-sm muted">
            To take your data out again, download either shape below: the year grid keeps
            categories down the side and months across the top, and the ledger lists
            every entry, one per row.
          </p>
          <div className="data-actions">
            <div className="field">
              <label htmlFor="export-year">Year</label>
              <select
                id="export-year"
                className="select"
                name="export-year"
                value={exportYear}
                onChange={(e) => setExportYear(Number(e.target.value))}
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" className="button" onClick={() => onExportGrid(exportYear)}>
              Year grid CSV
            </button>
            <button type="button" className="button" onClick={() => onExportLedger(exportYear)}>
              Ledger CSV
            </button>
          </div>
        </section>

        <section className="panel" aria-labelledby="demo-title">
          <h2 id="demo-title">Demo data</h2>
          {state.prefs.demo ? (
            <>
              <p>
                Demo data is on. The figures are illustrative, every demo entry is labelled, and
                removing it never touches your real entries.
              </p>
              <div className="data-actions">
                <button type="button" className="button button-danger" onClick={onDeleteDemo}>
                  Delete demo data
                </button>
              </div>
            </>
          ) : (
            <>
              <p>
                Load three months of clearly-labelled example entries to see the dashboard,
                budgets and savings views filled in. Delete it in one tap whenever you like.
              </p>
              <div className="data-actions">
                <button type="button" className="button" onClick={onLoadDemo}>
                  Load demo data
                </button>
              </div>
            </>
          )}
        </section>

        <section className="panel" aria-labelledby="currency-title">
          <h2 id="currency-title">Currency</h2>
          <p>Changes how amounts are displayed. Your figures stay exactly as entered.</p>
          <div className="data-actions">
            <div className="field field-currency">
              <label htmlFor="currency-select">Display currency</label>
              <select
                id="currency-select"
                className="select"
                name="currency"
                value={state.currency}
                onChange={(e) => onSetCurrency(e.target.value)}
              >
                {Object.values(CURRENCIES).map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="panel" aria-labelledby="about-title">
          <h2 id="about-title">About this data</h2>
          <p>
            {state.transactions.length} {state.transactions.length === 1 ? "entry" : "entries"} ·{" "}
            {state.categories.length} categories · {state.accounts.length} savings{" "}
            {state.accounts.length === 1 ? "account" : "accounts"} · {state.rules.length} repeating{" "}
            {state.rules.length === 1 ? "rule" : "rules"}.
          </p>
          {migrationInfo && (
            <p className="mt-8">
              Your previous budget was moved over on{" "}
              {new Date(migrationInfo.migratedAt).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
              . The original data is still stored in this browser under its old key as a backup —
              erasing everything here does not touch it.
            </p>
          )}
          <p className="mt-8">
            Clearing this browser&rsquo;s site data wipes MyBudget too. Download a backup first
            if anything here matters.
          </p>
        </section>

        <section className="panel danger-panel" aria-labelledby="danger-title">
          <h2 id="danger-title">Start over</h2>
          <p>
            Erase every entry, category, account, budget and rule in MyBudget, and return to the
            welcome screen. This cannot be undone — download a backup first if you might want
            the data back.
          </p>
          <div className="data-actions">
            <button
              type="button"
              className="button button-danger"
              onClick={() => setEraseOpen(true)}
              disabled={!hasTransactions && state.categories.length === 0}
            >
              Erase everything
            </button>
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={eraseOpen}
        title="Erase everything?"
        body="Every entry, category, account, budget and repeating rule will be deleted from this browser. This cannot be undone."
        confirmLabel="Yes, erase it all"
        danger
        onCancel={() => setEraseOpen(false)}
        onConfirm={() => {
          setEraseOpen(false);
          onEraseAll();
        }}
      />
    </div>
  );
}
