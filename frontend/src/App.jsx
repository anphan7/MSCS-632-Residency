// frontend/src/App.jsx
import { useEffect, useState, useCallback } from "react";
import { api } from "./api";
import "./App.css";

const CATEGORIES = ["Work", "Personal", "Urgent"];

export default function App() {
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState("");
  const [tasks, setTasks] = useState([]);
  const [filter, setFilter] = useState({ status: "", category: "" });
  const [form, setForm] = useState({ title: "", category: "Work" });
  const [error, setError] = useState("");
  const [simMsg, setSimMsg] = useState("");

  const refresh = useCallback(async () => {
    try {
      const q = { ...filter, assignee: currentUser };
      setTasks(await api.listTasks(q));
    } catch (e) { setError(e.message); }
  }, [filter, currentUser]);

  useEffect(() => {
    api.listUsers().then((u) => {
      setUsers(u);
      setCurrentUser(u[0]?.id || "");
    }).catch((e) => setError(e.message));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  async function addTask(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    try {
      await api.addTask({ ...form, assigneeId: currentUser, createdBy: currentUser });
      setForm({ title: "", category: "Work" });
      refresh();
    } catch (e) { setError(e.message); }
  }

  async function toggle(t) {
    await api.setStatus(t.id, t.status === "pending" ? "completed" : "pending");
    refresh();
  }

  async function remove(id) { await api.deleteTask(id); refresh(); }

  async function runSimulate(taskId) {
    setSimMsg("running 100 concurrent edits…");
    const r = await api.simulate(taskId, 100);
    setSimMsg(`Done: ${r.operations} concurrent edits, final status = ${r.finalStatus}`);
    refresh();
  }

  const simRunning = simMsg.startsWith("running");
  const filtered = Boolean(filter.status || filter.category);

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">✓</span>
          <div>
            <h1>Collaborative To-Do</h1>
            <span className="tagline">shared · concurrent · live</span>
          </div>
        </div>

        <label className="user-switcher">
          Working as
          <select
            className="field-select"
            value={currentUser}
            onChange={(e) => setCurrentUser(e.target.value)}
          >
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </label>
      </header>

      {error && <div className="banner-error" role="alert">⚠ {error}</div>}

      <form onSubmit={addTask} className="task-form">
        <input
          className="task-input"
          placeholder="Add a task for your team…"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
        <select
          className="field-select"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          aria-label="Category"
        >
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <button type="submit" className="btn btn-primary">Add task</button>
      </form>

      <div className="filter-bar">
        <span className="filter-label">Filter</span>
        <select
          className="field-select"
          value={filter.status}
          onChange={(e) => setFilter({ ...filter, status: e.target.value })}
          aria-label="Filter by status"
        >
          <option value="">All status</option>
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
        </select>
        <select
          className="field-select"
          value={filter.category}
          onChange={(e) => setFilter({ ...filter, category: e.target.value })}
          aria-label="Filter by category"
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>

      {tasks.length === 0 ? (
        <p className="empty-state">
          {filtered
            ? "No tasks match these filters. Try clearing a filter above."
            : "No tasks yet. Add one above to get your team started."}
        </p>
      ) : (
        <ul className="task-list">
          {tasks.map((t) => {
            const done = t.status === "completed";
            return (
              <li key={t.id} className={`task-row${done ? " is-done" : ""}`}>
                <input
                  type="checkbox"
                  className="task-check"
                  checked={done}
                  onChange={() => toggle(t)}
                  aria-label={done ? "Mark pending" : "Mark completed"}
                />
                <div className="task-body">
                  <span className="task-title">{t.title}</span>
                  <span className="category-chip">{t.category}</span>
                </div>
                <span className={`status-pill ${t.status}`}>{t.status}</span>
                <div className="task-actions">
                  <button
                    className="btn btn-ghost btn-sim"
                    onClick={() => runSimulate(t.id)}
                  >
                    simulate
                  </button>
                  <button
                    className="btn btn-ghost btn-danger"
                    onClick={() => remove(t.id)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <section className={`sim-readout${simRunning ? " is-running" : ""}`} aria-live="polite">
        <div className="sim-readout-head">
          <span className="sim-dot" aria-hidden="true"></span>
          concurrency monitor
        </div>
        <div className="sim-readout-body">
          <span className="sim-prompt">&gt; </span>
          {simMsg || "idle — run simulate on any task to stress-test concurrent edits"}
        </div>
      </section>
    </div>
  );
}
