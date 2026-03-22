import React, { useState, useEffect } from "react";

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
    <div style={{ padding: 20, fontFamily: "Arial" }}>
      <h2>Budget App</h2>

      {/* Controls */}
      <div style={{ marginBottom: 10 }}>
        <input value={year} onChange={e => setYear(e.target.value)} />
        <select
          value={selectedMonth}
          onChange={e => setSelectedMonth(e.target.value)}
        >
          {months.map(m => <option key={m}>{m}</option>)}
        </select>
        <button onClick={downloadCSV}>Download CSV</button>
      </div>

      {/* SUMMARY */}
      <div style={{ display: "flex", gap: 10, marginBottom: 15 }}>
        <Card label="Income" value={income} color="#90dbf4" />
        <Card label="Expenses" value={total} color="#f4a261" />
        <Card label="Left" value={extra} color={extra < 0 ? "#ff6b6b" : "#80ed99"} />
        <Card label="Auto Savings" value={getCarriedSavings(months.indexOf(selectedMonth))} color="#00f5d4" />
        <Card label="Accounts" value={manualSavings} color="#bdb2ff" />
        <Card label="Spent %" value={`${percent.toFixed(0)}%`} color="#2a9d8f" />
      </div>

      {/* Add Category */}
      <div style={{ marginBottom: 10 }}>
        <input
          placeholder="New category"
          value={newCategory}
          onChange={e => setNewCategory(e.target.value)}
        />
        <button onClick={addCategory}>Add</button>
      </div>

      {/* TABLE */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", minWidth: "1100px" }}>
          <thead style={{ background: "#2a9d8f", color: "white" }}>
            <tr>
              <th style={th}>Category</th>
              {months.map(m => <th key={m} style={th}>{m}</th>)}
            </tr>
          </thead>

          <tbody>
            {categories.map(cat => (
              <tr key={cat}>
                <td style={catTd}>
                  <input
                    value={cat}
                    onChange={e => renameCategory(cat, e.target.value)}
                    style={{ width: 120 }}
                  />
                  <button onClick={() => deleteCategory(cat)}>❌</button>
                </td>

                {months.map(m => (
                  <td key={m} style={td}>
                    <input
                      type="number"
                      value={current.expenses[cat]?.[m] || ""}
                      onChange={e => updateExpense(cat, m, e.target.value)}
                      style={input}
                    />
                  </td>
                ))}
              </tr>
            ))}

            {/* TOTAL */}
            <tr style={{ background: "#f4a261" }}>
              <td style={catTd}><b>Total</b></td>
              {months.map(m => (
                <td key={m} style={td}>{getTotalExpenses(m).toFixed(2)}</td>
              ))}
            </tr>

            {/* SALARY */}
            <tr style={{ background: "#90dbf4" }}>
              <td style={catTd}><b>Salary</b></td>
              {months.map(m => (
                <td key={m} style={td}>
                  <input
                    type="number"
                    value={current.salary[m] || ""}
                    onChange={e => updateSalary(m, e.target.value)}
                    style={input}
                  />
                </td>
              ))}
            </tr>

            {/* EXTRA */}
            <tr>
              <td style={catTd}><b>Extra</b></td>
              {months.map(m => {
                const val = getExtraMoney(m);
                return (
                  <td key={m} style={{ ...td, color: val < 0 ? "red" : "green" }}>
                    {val.toFixed(2)}
                  </td>
                );
              })}
            </tr>

            {/* AUTO SAVINGS */}
            <tr style={{ background: "#00f5d4" }}>
              <td style={catTd}><b>Auto Savings</b></td>
              {months.map((_, i) => (
                <td key={i} style={td}>
                  {getCarriedSavings(i).toFixed(2)}
                </td>
              ))}
            </tr>

            {/* MANUAL SAVINGS */}
            <tr style={{ background: "#bdb2ff" }}>
              <td style={catTd}><b>Accounts</b></td>
              {months.map(m => (
                <td key={m} style={td}>
                  {getManualSavings(m).toFixed(2)}
                </td>
              ))}
            </tr>

            {savingsCategories.map(cat => (
              <tr key={cat}>
                <td style={catTd}>{cat}</td>
                {months.map(m => (
                  <td key={m} style={td}>
                    <input
                      type="number"
                      value={current.savings?.[cat]?.[m] || ""}
                      onChange={e => updateSavings(cat, m, e.target.value)}
                      style={input}
                    />
                  </td>
                ))}
              </tr>
            ))}

            {/* PROGRESS */}
            <tr>
              <td style={catTd}><b>Spent %</b></td>
              {months.map(m => {
                const p = getSpendPercent(m);
                return (
                  <td key={m} style={td}>
                    <div style={{ background: "#eee", height: 8 }}>
                      <div
                        style={{
                          width: `${Math.min(p, 100)}%`,
                          height: "100%",
                          background: p > 100 ? "red" : "#2a9d8f"
                        }}
                      />
                    </div>
                    <small>{p.toFixed(0)}%</small>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Card
const Card = ({ label, value, color }) => (
  <div style={{ background: color, padding: 10, borderRadius: 8, minWidth: 120 }}>
    <div>{label}</div>
    <b>{value}</b>
  </div>
);

// styles
const th = { padding: 10, border: "1px solid #ddd" };
const td = { padding: 8, border: "1px solid #ddd", textAlign: "center" };
const catTd = { ...td, fontWeight: "bold", background: "#f8f9fa" };
const input = { width: 70 };