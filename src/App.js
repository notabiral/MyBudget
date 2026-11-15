import React, { useState, useEffect } from "react";
import "./App.css";

const months = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec"
];

const defaultExpenses = [
  "Loan","Loan P","SIM","Apple Music","Rent",
  "Grocery","Flex P","Credit Card","Subscriptions"
];

const savingsCategories = ["ISA","Revolut","Monzo 1P"];

export default function App() {
  const [year, setYear] = useState("2026");
  const [data, setData] = useState({});
  const [newCategory, setNewCategory] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("Jan");

  useEffect(() => {
    const saved = localStorage.getItem("budget_final");
    if (saved) setData(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem("budget_final", JSON.stringify(data));
  }, [data]);

  const current = data[year] || {
    expenses: {},
    salary: {},
    savings: {},
    categories: defaultExpenses
  };

  const categories = current.categories || defaultExpenses;

  // -------- UPDATE --------
  const updateExpense = (cat, month, value) => {
    setData(prev => ({
      ...prev,
      [year]: {
        ...current,
        expenses: {
          ...current.expenses,
          [cat]: {
            ...current.expenses?.[cat],
            [month]: Number(value)
          }
        }
      }
    }));
  };

  const updateSalary = (month, value) => {
    setData(prev => ({
      ...prev,
      [year]: {
        ...current,
        salary: {
          ...current.salary,
          [month]: Number(value)
        }
      }
    }));
  };

  const updateSavings = (cat, month, value) => {
    setData(prev => ({
      ...prev,
      [year]: {
        ...current,
        savings: {
          ...current.savings,
          [cat]: {
            ...current.savings?.[cat],
            [month]: Number(value)
          }
        }
      }
    }));
  };

  // -------- CATEGORY MANAGEMENT --------
  const addCategory = () => {
    if (!newCategory) return;
    setData(prev => ({
      ...prev,
      [year]: {
        ...current,
        categories: [...categories, newCategory]
      }
    }));
    setNewCategory("");
  };

  const deleteCategory = cat => {
    const updatedCategories = categories.filter(c => c !== cat);
    const updatedExpenses = { ...current.expenses };
    delete updatedExpenses[cat];

    setData(prev => ({
      ...prev,
      [year]: {
        ...current,
        categories: updatedCategories,
        expenses: updatedExpenses
      }
    }));
  };

  const renameCategory = (oldName, newName) => {
    if (!newName) return;

    const updatedCategories = categories.map(c =>
      c === oldName ? newName : c
    );

    const updatedExpenses = { ...current.expenses };
    updatedExpenses[newName] = updatedExpenses[oldName] || {};
    delete updatedExpenses[oldName];

    setData(prev => ({
      ...prev,
      [year]: {
        ...current,
        categories: updatedCategories,
        expenses: updatedExpenses
      }
    }));
  };

  // -------- CALCULATIONS --------
  const getTotalExpenses = month =>
    categories.reduce(
      (sum, cat) => sum + (current.expenses[cat]?.[month] || 0),
      0
    );

  const getExtraMoney = month =>
    (current.salary[month] || 0) - getTotalExpenses(month);

  // AUTO-CARRY SAVINGS
  const getCarriedSavings = index => {
    let total = 0;
    for (let i = 0; i <= index; i++) {
      total += getExtraMoney(months[i]);
    }
    return total;
  };

  const getManualSavings = month =>
    savingsCategories.reduce(
      (sum, cat) => sum + (current.savings[cat]?.[month] || 0),
      0
    );

  const getSpendPercent = month => {
    const income = current.salary[month] || 0;
    if (!income) return 0;
    return (getTotalExpenses(month) / income) * 100;
  };

  // -------- SUMMARY --------
  const total = getTotalExpenses(selectedMonth);
  const income = current.salary[selectedMonth] || 0;
  const extra = getExtraMoney(selectedMonth);
  const percent = getSpendPercent(selectedMonth);
  const manualSavings = getManualSavings(selectedMonth);

  // -------- CSV --------
  const downloadCSV = () => {
    let rows = [];
    rows.push(["Category", ...months]);

    categories.forEach(cat => {
      rows.push([
        cat,
        ...months.map(m => current.expenses[cat]?.[m] || 0)
      ]);
    });

    rows.push(["Total", ...months.map(getTotalExpenses)]);
    rows.push(["Salary", ...months.map(m => current.salary[m] || 0)]);
    rows.push(["Extra", ...months.map(getExtraMoney)]);
    rows.push(["Auto Savings", ...months.map((_, i) => getCarriedSavings(i))]);
    rows.push(["Manual Savings", ...months.map(getManualSavings)]);

    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `budget_${year}.csv`;
    a.click();
  };

  return (
    <div className="ledger">
      <a className="skip-link" href="#main">Skip to main content</a>

      <header className="masthead">
        <div>
          <p className="masthead-eyebrow" translate="no">MyBudget</p>
          <h1>Budget App</h1>
        </div>
        <div className="controls">
          <div className="field">
            <label htmlFor="ledger-year">Year</label>
            <input id="ledger-year" className="control-input" name="year" autoComplete="off" inputMode="numeric" spellCheck={false} value={year} onChange={e => setYear(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="ledger-month">Month</label>
            <select id="ledger-month" className="control-input" name="month" autoComplete="off" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
              {months.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <button type="button" className="button button-primary" onClick={downloadCSV}>Download CSV</button>
        </div>
      </header>

      <main id="main">
        {/* SUMMARY */}
        <section className="summary" aria-label={`Summary for ${selectedMonth} ${year}`}>
          <Card label="Income" value={income} />
          <Card label="Expenses" value={total} />
          <Card label="Left" value={extra} tone={extra < 0 ? "negative" : "positive"} />
          <Card label="Auto Savings" value={getCarriedSavings(months.indexOf(selectedMonth))} />
          <Card label="Accounts" value={manualSavings} />
          <Card label="Spent %" value={`${percent.toFixed(0)}%`} />
        </section>

        {/* Add Category */}
        <div className="add-category">
          <label className="visually-hidden" htmlFor="new-category">New category</label>
          <input
            id="new-category"
            className="control-input"
            name="new-category"
            autoComplete="off"
            placeholder="New category…"
            value={newCategory}
            onChange={e => setNewCategory(e.target.value)}
          />
          <button type="button" className="button" onClick={addCategory}>Add</button>
        </div>

        {/* TABLE */}
        <div className="table-wrap">
          <table className="ledger-table">
            <caption className="visually-hidden">Budget for {year}</caption>
            <thead>
              <tr>
                <th scope="col">Category</th>
                {months.map(m => <th key={m} scope="col">{m}</th>)}
              </tr>
            </thead>

            <tbody>
              {categories.map(cat => (
                <tr key={cat}>
                  <th scope="row">
                    <div className="row-label-inner">
                      <input
                        className="rename-input"
                        name={`rename-${cat}`}
                        autoComplete="off"
                        spellCheck={false}
                        value={cat}
                        onChange={e => renameCategory(cat, e.target.value)}
                        aria-label={`Rename category ${cat}`}
                      />
                      <button type="button" className="delete-button" onClick={() => deleteCategory(cat)} aria-label={`Delete ${cat}`}>
                        <span aria-hidden="true">×</span>
                      </button>
                    </div>
                  </th>

                  {months.map(m => (
                    <td key={m}>
                      <input
                        type="number"
                        className="cell-input"
                        name={`expense-${cat}-${m}`}
                        autoComplete="off"
                        value={current.expenses[cat]?.[m] || ""}
                        onChange={e => updateExpense(cat, m, e.target.value)}
                        aria-label={`${cat}, ${m}`}
                      />
                    </td>
                  ))}
                </tr>
              ))}

              {/* TOTAL */}
              <tr className="row-total">
                <th scope="row">Total</th>
                {months.map(m => (
                  <td key={m} className="figure">{getTotalExpenses(m).toFixed(2)}</td>
                ))}
              </tr>

              {/* SALARY */}
              <tr className="row-band">
                <th scope="row">Salary</th>
                {months.map(m => (
                  <td key={m}>
                    <input
                      type="number"
                      className="cell-input"
                      name={`salary-${m}`}
                      autoComplete="off"
                      value={current.salary[m] || ""}
                      onChange={e => updateSalary(m, e.target.value)}
                      aria-label={`Salary, ${m}`}
                    />
                  </td>
                ))}
              </tr>

              {/* EXTRA */}
              <tr>
                <th scope="row">Extra</th>
                {months.map(m => {
                  const val = getExtraMoney(m);
                  return (
                    <td key={m} className={val < 0 ? "figure negative" : "figure positive"}>
                      {val.toFixed(2)}
                    </td>
                  );
                })}
              </tr>

              {/* AUTO SAVINGS */}
              <tr className="row-band">
                <th scope="row">Auto Savings</th>
                {months.map((_, i) => (
                  <td key={i} className="figure">
                    {getCarriedSavings(i).toFixed(2)}
                  </td>
                ))}
              </tr>

              {/* MANUAL SAVINGS */}
              <tr className="row-band">
                <th scope="row">Accounts</th>
                {months.map(m => (
                  <td key={m} className="figure">
                    {getManualSavings(m).toFixed(2)}
                  </td>
                ))}
              </tr>

              {savingsCategories.map(cat => (
                <tr key={cat}>
                  <th scope="row" className="row-label-sub">{cat}</th>
                  {months.map(m => (
                    <td key={m}>
                      <input
                        type="number"
                        className="cell-input"
                        name={`savings-${cat}-${m}`}
                        autoComplete="off"
                        value={current.savings?.[cat]?.[m] || ""}
                        onChange={e => updateSavings(cat, m, e.target.value)}
                        aria-label={`${cat}, ${m}`}
                      />
                    </td>
                  ))}
                </tr>
              ))}

              {/* PROGRESS */}
              <tr>
                <th scope="row">Spent %</th>
                {months.map(m => {
                  const p = getSpendPercent(m);
                  return (
                    <td key={m}>
                      <div className="spend-bar" aria-hidden="true">
                        <div
                          className={p > 100 ? "spend-fill over" : "spend-fill"}
                          style={{ width: `${Math.min(p, 100)}%` }}
                        />
                      </div>
                      <small className="spend-label">{p.toFixed(0)}%</small>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </main>

      <footer className="ledger-footer">
        <p>All data is stored in your browser's localStorage. Nothing is uploaded anywhere.</p>
      </footer>
    </div>
  );
}

// Card
const Card = ({ label, value, tone }) => (
  <div className={tone ? `summary-card tone-${tone}` : "summary-card"}>
    <div className="summary-label">{label}</div>
    <div className="summary-value">{value}</div>
  </div>
);
