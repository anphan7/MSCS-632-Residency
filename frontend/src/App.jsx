// frontend/src/App.jsx
import { useEffect, useState, useCallback } from "react";
import { api } from "./api";
import "./App.css";

const CATEGORIES = ["Work", "Personal", "Urgent"];
// Contract v2 statuses, exact strings in canonical order.
const STATUSES = ["Open", "In Progress", "Completed", "Deprecated", "Need Requirement"];
// CSS modifier suffix for each status pill/select (keeps class names ASCII-safe).
const STATUS_SLUG = {
  "Open": "open",
  "In Progress": "in-progress",
  "Completed": "completed",
  "Deprecated": "deprecated",
  "Need Requirement": "need-requirement",
};

export default function App() {
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState("");
  const [tasks, setTasks] = useState([]);
  const [filter, setFilter] = useState({ status: "", category: "", assignee: "" });
  const [form, setForm] = useState({ title: "", category: "Work", assigneeId: "" });
  const [error, setError] = useState("");
  const [simMsg, setSimMsg] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [commentDrafts, setCommentDrafts] = useState({});

  // Shared team board: show ALL tasks by default. The user switcher is identity
  // (who new tasks get assigned to), not a hard filter. Use the Assignee filter
  // below to narrow to one person's tasks.
  const refresh = useCallback(async () => {
    try {
      setTasks(await api.listTasks(filter));
    } catch (e) { setError(e.message); }
  }, [filter]);

  const userName = (id) => users.find((u) => u.id === id)?.name || "Unassigned";
  const fmtTime = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return isNaN(d) ? "—" : d.toLocaleString();
  };

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
    // Guard the mount window: until the user list has loaded and a user is
    // selected, don't create a task (it would get an empty/wrong assignee).
    if (!currentUser) {
      setError("Still loading users — try again in a moment.");
      return;
    }
    try {
      await api.addTask({
        title: form.title,
        category: form.category,
        status: "Open",
        assigneeId: form.assigneeId || currentUser,
        createdBy: currentUser,
      });
      setForm({ title: "", category: "Work", assigneeId: "" });
      refresh();
    } catch (e) { setError(e.message); }
  }

  async function changeStatus(t, status) {
    try {
      await api.setStatus(t.id, status);
      refresh();
    } catch (e) { setError(e.message); }
  }

  function startEdit(t) {
    setEditingId(t.id);
    setExpandedId(t.id);
    setEditForm({
      title: t.title || "",
      description: t.description || "",
      category: t.category || "Work",
      assigneeId: t.assigneeId || "",
      status: t.status || "Open",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(null);
  }

  async function saveEdit(id) {
    if (!editForm.title.trim()) {
      setError("Title can't be empty.");
      return;
    }
    try {
      await api.updateTask(id, {
        title: editForm.title,
        description: editForm.description,
        category: editForm.category,
        assigneeId: editForm.assigneeId || null,
        status: editForm.status,
      });
      cancelEdit();
      refresh();
    } catch (e) { setError(e.message); }
  }

  async function remove(id) {
    try {
      await api.deleteTask(id);
      if (expandedId === id) setExpandedId(null);
      if (editingId === id) cancelEdit();
      refresh();
    } catch (e) { setError(e.message); }
  }

  async function submitComment(id) {
    const text = (commentDrafts[id] || "").trim();
    if (!text) return;
    try {
      await api.addComment(id, { author: currentUser, text });
      setCommentDrafts((d) => ({ ...d, [id]: "" }));
      refresh();
    } catch (e) { setError(e.message); }
  }

  async function runSimulate(taskId) {
    setSimMsg("running 100 concurrent edits…");
    try {
      const r = await api.simulate(taskId, 100);
      setSimMsg(`Done: ${r.operations} concurrent edits, final status = ${r.finalStatus}`);
      refresh();
    } catch (e) {
      setSimMsg("");
      setError(e.message);
    }
  }

  const simRunning = simMsg.startsWith("running");
  const filtered = Boolean(filter.status || filter.category || filter.assignee);

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

      {error && (
        <div className="banner-error" role="alert">
          <span>⚠ {error}</span>
          <button className="banner-dismiss" onClick={() => setError("")} aria-label="Dismiss">×</button>
        </div>
      )}

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
        <select
          className="field-select"
          value={form.assigneeId || currentUser}
          onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}
          aria-label="Assign to"
        >
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.id === currentUser ? `${u.name} (me)` : u.name}
            </option>
          ))}
        </select>
        <button type="submit" className="btn btn-primary" disabled={!currentUser}>Add task</button>
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
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
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
        <select
          className="field-select"
          value={filter.assignee}
          onChange={(e) => setFilter({ ...filter, assignee: e.target.value })}
          aria-label="Filter by assignee"
        >
          <option value="">All assignees</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.id === currentUser ? `${u.name} (me)` : u.name}
            </option>
          ))}
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
            const done = t.status === "Completed";
            const isOpen = expandedId === t.id;
            const isEditing = editingId === t.id;
            const comments = t.comments || [];
            return (
              <li key={t.id} className={`task-row${done ? " is-done" : ""}`}>
                <div className="task-main">
                  <select
                    className={`status-select status-${STATUS_SLUG[t.status] || "open"}`}
                    value={t.status}
                    onChange={(e) => changeStatus(t, e.target.value)}
                    aria-label="Status"
                  >
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <div className="task-body">
                    <span className="task-title">{t.title}</span>
                    <span className="category-chip">{t.category}</span>
                    <span className="task-owner" title="Assigned to">@{userName(t.assigneeId)}</span>
                  </div>
                  <div className="task-actions">
                    <button
                      className={`btn btn-ghost${isOpen ? " is-active" : ""}`}
                      onClick={() => setExpandedId(isOpen ? null : t.id)}
                      aria-expanded={isOpen}
                    >
                      {isOpen ? "Hide" : "Details"}
                    </button>
                    <button className="btn btn-ghost" onClick={() => startEdit(t)}>Edit</button>
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
                </div>

                {isEditing && editForm && (
                  <div className="task-edit">
                    <label className="edit-field">
                      <span className="edit-label">Title</span>
                      <input
                        className="task-input"
                        value={editForm.title}
                        onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                      />
                    </label>
                    <label className="edit-field">
                      <span className="edit-label">Description</span>
                      <textarea
                        className="task-textarea"
                        rows={3}
                        value={editForm.description}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      />
                    </label>
                    <div className="edit-row">
                      <label className="edit-field">
                        <span className="edit-label">Category</span>
                        <select
                          className="field-select"
                          value={editForm.category}
                          onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                        >
                          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                        </select>
                      </label>
                      <label className="edit-field">
                        <span className="edit-label">Assignee</span>
                        <select
                          className="field-select"
                          value={editForm.assigneeId}
                          onChange={(e) => setEditForm({ ...editForm, assigneeId: e.target.value })}
                        >
                          <option value="">Unassigned</option>
                          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                      </label>
                      <label className="edit-field">
                        <span className="edit-label">Status</span>
                        <select
                          className="field-select"
                          value={editForm.status}
                          onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                        >
                          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </label>
                    </div>
                    <div className="edit-actions">
                      <button className="btn btn-primary" onClick={() => saveEdit(t.id)}>Save</button>
                      <button className="btn btn-ghost" onClick={cancelEdit}>Cancel</button>
                    </div>
                  </div>
                )}

                {isOpen && (
                  <div className="task-detail">
                    {t.description && <p className="detail-desc">{t.description}</p>}
                    <dl className="detail-meta">
                      <div><dt>Created by</dt><dd>{userName(t.createdBy)}</dd></div>
                      <div><dt>Assignee</dt><dd>{userName(t.assigneeId)}</dd></div>
                      <div><dt>Created</dt><dd>{fmtTime(t.createdAt)}</dd></div>
                      <div><dt>Updated</dt><dd>{fmtTime(t.updatedAt)}</dd></div>
                    </dl>

                    <div className="comments">
                      <h3 className="comments-head">Comments ({comments.length})</h3>
                      {comments.length === 0 ? (
                        <p className="comments-empty">No comments yet.</p>
                      ) : (
                        <ul className="comment-list">
                          {comments.map((c) => (
                            <li key={c.id} className="comment">
                              <div className="comment-meta">
                                <span className="comment-author">{userName(c.author)}</span>
                                <span className="comment-time">{fmtTime(c.createdAt)}</span>
                              </div>
                              <div className="comment-text">{c.text}</div>
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className="comment-form">
                        <input
                          className="task-input"
                          placeholder="Add a comment…"
                          value={commentDrafts[t.id] || ""}
                          onChange={(e) => setCommentDrafts((d) => ({ ...d, [t.id]: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === "Enter") submitComment(t.id); }}
                        />
                        <button
                          className="btn btn-primary"
                          onClick={() => submitComment(t.id)}
                          disabled={!currentUser || !(commentDrafts[t.id] || "").trim()}
                        >
                          Comment
                        </button>
                      </div>
                    </div>
                  </div>
                )}
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
