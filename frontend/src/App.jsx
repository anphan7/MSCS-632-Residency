// frontend/src/App.jsx
import { useEffect, useState, useCallback } from "react";
import { api } from "./api";

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

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 16 }}>
      <h1>Collaborative To-Do</h1>
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <label>
        User:{" "}
        <select value={currentUser} onChange={(e) => setCurrentUser(e.target.value)}>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </label>

      <form onSubmit={addTask} style={{ margin: "12px 0" }}>
        <input
          placeholder="New task…"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
        <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <button type="submit">Add</button>
      </form>

      <div style={{ margin: "8px 0" }}>
        Filter:{" "}
        <select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}>
          <option value="">all status</option>
          <option value="pending">pending</option>
          <option value="completed">completed</option>
        </select>{" "}
        <select value={filter.category} onChange={(e) => setFilter({ ...filter, category: e.target.value })}>
          <option value="">all categories</option>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>

      <ul style={{ listStyle: "none", padding: 0 }}>
        {tasks.map((t) => (
          <li key={t.id} style={{ borderBottom: "1px solid #ddd", padding: "6px 0" }}>
            <input type="checkbox" checked={t.status === "completed"} onChange={() => toggle(t)} />{" "}
            <span style={{ textDecoration: t.status === "completed" ? "line-through" : "none" }}>
              {t.title} <small>[{t.category}]</small>
            </span>{" "}
            <button onClick={() => remove(t.id)}>delete</button>{" "}
            <button onClick={() => runSimulate(t.id)}>simulate</button>
          </li>
        ))}
      </ul>

      {simMsg && <p>{simMsg}</p>}
    </main>
  );
}
