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
  // Team + data: known users, who I'm acting as, the task list, and the active filters.
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState("");
  const [tasks, setTasks] = useState([]);
  const [filter, setFilter] = useState({ status: "", category: "", assignee: "" });
  const [error, setError] = useState("");
  // Row UI: which ticket is expanded, and which is being edited in place.
  const [expandedId, setExpandedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [commentDrafts, setCommentDrafts] = useState({}); // per-task comment input, keyed by task id
  // Create-ticket modal state.
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(null);
  const [saving, setSaving] = useState(false);
  // "Add teammate" inline input in the Working As dropdown.
  const [addingUser, setAddingUser] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [backend, setBackend] = useState(""); // which backend is serving us (shown as a badge)

  // Shared team board: show ALL tasks by default. The user switcher is identity
  // (who new tasks get assigned to), not a hard filter. Use the Assignee filter
  // below to narrow to one person's tasks.
  const refresh = useCallback(async () => {
    try {
      setTasks(await api.listTasks(filter));
    } catch (e) { setError(e.message); }
  }, [filter]);

  // Map a user id to a display name (falls back to "Unassigned").
  const userName = (id) => users.find((u) => u.id === id)?.name || "Unassigned";
  // Format an ISO timestamp for display; show an em dash when missing/invalid.
  const fmtTime = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return isNaN(d) ? "—" : d.toLocaleString();
  };
  // Known tags = the defaults plus any already used on a task (so new tags stick).
  const categories = Array.from(
    new Set([...CATEGORIES, ...tasks.map((t) => t.category)].filter(Boolean))
  );

  // On mount: load users and default "working as" to the first one.
  useEffect(() => {
    api.listUsers().then((u) => {
      setUsers(u);
      setCurrentUser(u[0]?.id || "");
    }).catch((e) => setError(e.message));
  }, []);

  // Re-fetch tasks whenever refresh changes (i.e. whenever the filter changes).
  useEffect(() => { refresh(); }, [refresh]);

  // On mount: fetch which backend is serving us for the header badge.
  useEffect(() => {
    api.getMeta().then((m) => setBackend(m.backend)).catch(() => setBackend(""));
  }, []);

  // Open the create modal, pre-filling the assignee with the current user.
  function openCreate() {
    if (!currentUser) {
      setError("Still loading users — try again in a moment.");
      return;
    }
    setCreateForm({
      title: "",
      description: "",
      category: "Work",
      assigneeId: currentUser,
    });
    setShowCreate(true);
  }

  // Create a new user, reload the list, and switch to acting as them.
  async function addTeammate() {
    const name = newUserName.trim();
    if (!name) return;
    try {
      const u = await api.createUser(name);
      setUsers(await api.listUsers());
      setCurrentUser(u.id);
      setNewUserName("");
      setAddingUser(false);
    } catch (e) { setError(e.message); }
  }

  function cancelAddUser() {
    setNewUserName("");
    setAddingUser(false);
  }

  function closeCreate() {
    setShowCreate(false);
    setCreateForm(null);
  }

  // Validate and POST the new ticket, then close the modal and refresh the list.
  async function submitCreate(e) {
    e.preventDefault();
    if (!createForm.title.trim()) {
      setError("Title is required.");
      return;
    }
    setSaving(true);
    try {
      await api.addTask({
        title: createForm.title.trim(),
        description: createForm.description.trim(),
        category: (createForm.category || "").trim() || "Work",
        status: "Open",
        assigneeId: createForm.assigneeId || currentUser,
        createdBy: currentUser,
      });
      closeCreate();
      refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  // Update just a ticket's status (from the inline status dropdown).
  async function changeStatus(t, status) {
    try {
      await api.setStatus(t.id, status);
      refresh();
    } catch (e) { setError(e.message); }
  }

  // Enter in-place edit mode for a ticket, seeding the form from its values.
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

  // Validate and PUT the edited fields, then exit edit mode and refresh.
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

  // Delete a ticket and clear any expanded/editing state pointing at it.
  async function remove(id) {
    try {
      await api.deleteTask(id);
      if (expandedId === id) setExpandedId(null);
      if (editingId === id) cancelEdit();
      refresh();
    } catch (e) { setError(e.message); }
  }

  // Post the drafted comment (authored by the current user), clear its draft, refresh.
  async function submitComment(id) {
    const text = (commentDrafts[id] || "").trim();
    if (!text) return;
    try {
      await api.addComment(id, { author: currentUser, text });
      setCommentDrafts((d) => ({ ...d, [id]: "" }));
      refresh();
    } catch (e) { setError(e.message); }
  }

  // True when any filter is active — used to pick the right empty-state message.
  const filtered = Boolean(filter.status || filter.category || filter.assignee);

  return (
    <div className="app">
      {/* shared tag suggestions for every tag input (create modal + in-place edit) */}
      <datalist id="category-options">
        {categories.map((c) => <option key={c} value={c} />)}
      </datalist>

      {/* Header: brand, backend badge, "Working as" switcher, and Add task button */}
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">✓</span>
          <div>
            <h1>MSCS 632 - Collaborative To-Do</h1>
            {backend && (
              <span className="backend-badge" title="Backend currently serving the app">
                <span className="backend-dot" aria-hidden="true" />
                {backend}
              </span>
            )}
          </div>
        </div>

        <div className="header-actions">
          <label className="user-switcher">
            Working as
            {/* Toggle: inline "add teammate" input, or the user dropdown */}
            {addingUser ? (
              <div className="switcher-row">
                <input
                  className="task-input switcher-input"
                  autoFocus
                  placeholder="New teammate name"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addTeammate();
                    if (e.key === "Escape") cancelAddUser();
                  }}
                />
                <button className="btn btn-ghost" onClick={addTeammate}>Add</button>
                <button className="icon-btn" onClick={cancelAddUser} aria-label="Cancel">✕</button>
              </div>
            ) : (
              <select
                className="field-select"
                value={currentUser}
                onChange={(e) => {
                  // The sentinel "__add" option opens the inline add-teammate input.
                  if (e.target.value === "__add") setAddingUser(true);
                  else setCurrentUser(e.target.value);
                }}
              >
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                <option value="__add">＋ Add teammate…</option>
              </select>
            )}
          </label>
          <button className="btn btn-primary" onClick={openCreate}>Add task</button>
        </div>
      </header>

      {error && (
        <div className="banner-error" role="alert">
          <span>⚠ {error}</span>
          <button className="banner-dismiss" onClick={() => setError("")} aria-label="Dismiss">×</button>
        </div>
      )}

      {/* Filter bar: narrow the board by status, category, or assignee */}
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
        /* Ticket table: one row per task, each expandable into a detail panel */
        <div className="ticket-table">
        <div className="ticket-head" aria-hidden="true">
          <span>Ticket</span>
          <span>Status</span>
          <span>Tag</span>
          <span>Assignee</span>
          <span className="col-actions-head">Actions</span>
        </div>
        <ul className="task-list">
          {tasks.map((t) => {
            // Per-row derived flags and an expand/collapse toggle.
            const done = t.status === "Completed";
            const isOpen = expandedId === t.id;
            const isEditing = editingId === t.id;
            const comments = t.comments || [];
            const toggle = () => setExpandedId(isOpen ? null : t.id);
            return (
              <li key={t.id} className={`task-row${done ? " is-done" : ""}${isOpen ? " is-open" : ""}`}>
                <div
                  className="task-main"
                  role="button"
                  tabIndex={0}
                  aria-expanded={isOpen}
                  onClick={toggle}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
                  }}
                >
                  <div className="col-ticket">
                    <span className="disclosure" aria-hidden="true">{isOpen ? "▾" : "▸"}</span>
                    <span className="task-title">{t.title}</span>
                  </div>
                  {/* stopPropagation so using the control doesn't also toggle the row */}
                  <div className="col-status" onClick={(e) => e.stopPropagation()}>
                    <select
                      className={`status-select status-${STATUS_SLUG[t.status] || "open"}`}
                      value={t.status}
                      onChange={(e) => changeStatus(t, e.target.value)}
                      aria-label="Status"
                    >
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="col-tag">
                    <span className="category-chip">{t.category}</span>
                  </div>
                  <div className="col-assignee">
                    <span className="task-owner" title="Assigned to">@{userName(t.assigneeId)}</span>
                  </div>
                  <div className="col-actions" onClick={(e) => e.stopPropagation()}>
                    <button className="icon-btn icon-danger" onClick={() => remove(t.id)} aria-label="Delete ticket" title="Delete">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                  </div>
                </div>

                {/* Expanded detail: description (view or inline-edit) + comments, meta on the side */}
                {isOpen && (
                  <div className="task-detail">
                    <div className="detail-main">
                      <div className="detail-section">
                        <div className="section-head-row">
                          <h3 className="section-head">Description</h3>
                          {!isEditing && (
                            <button
                              className="icon-btn"
                              onClick={() => startEdit(t)}
                              aria-label="Edit ticket"
                              title="Edit"
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                            </button>
                          )}
                        </div>
                        {isEditing && editForm ? (
                          <div className="inline-edit">
                            <input
                              className="task-input edit-title"
                              value={editForm.title}
                              onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                              placeholder="Title"
                            />
                            <textarea
                              className="task-textarea"
                              rows={3}
                              value={editForm.description}
                              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                              placeholder="Add a description…"
                            />
                            <div className="edit-actions">
                              <button className="btn btn-primary" onClick={() => saveEdit(t.id)}>Save</button>
                              <button className="btn btn-ghost" onClick={cancelEdit}>Cancel</button>
                            </div>
                          </div>
                        ) : t.description ? (
                          <p className="detail-desc">{t.description}</p>
                        ) : (
                          <button className="detail-desc-empty" onClick={() => startEdit(t)}>
                            Add description
                          </button>
                        )}
                      </div>

                      <div className="comments">
                        <h3 className="section-head">Comments ({comments.length})</h3>
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

                    {/* Side panel: edit tag/assignee/status when editing, else read-only meta */}
                    <aside className="detail-side">
                      {isEditing && editForm ? (
                        <div className="detail-edit-meta">
                          <label className="edit-field">
                            <span className="edit-label">Tag</span>
                            <input
                              className="task-input"
                              list="category-options"
                              value={editForm.category}
                              onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                            />
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
                      ) : (
                        <dl className="detail-meta">
                          <div><dt>Created by</dt><dd>{userName(t.createdBy)}</dd></div>
                          <div><dt>Assignee</dt><dd>{userName(t.assigneeId)}</dd></div>
                          <div><dt>Created</dt><dd>{fmtTime(t.createdAt)}</dd></div>
                          <div><dt>Updated</dt><dd>{fmtTime(t.updatedAt)}</dd></div>
                        </dl>
                      )}
                    </aside>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        </div>
      )}

      {/* Create modal: new-ticket form; overlay click closes, inner click is stopped */}
      {showCreate && createForm && (
        <div className="modal-overlay" onClick={closeCreate}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <h2 id="create-title">New ticket</h2>
              <button className="icon-btn" onClick={closeCreate} aria-label="Close">✕</button>
            </div>
            <form className="modal-body" onSubmit={submitCreate}>
              <label className="edit-field">
                <span className="edit-label">Title</span>
                <input
                  className="task-input"
                  autoFocus
                  placeholder="What needs doing?"
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                />
              </label>
              <label className="edit-field">
                <span className="edit-label">Description</span>
                <textarea
                  className="task-textarea"
                  rows={3}
                  placeholder="Add more detail (optional)…"
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                />
              </label>
              <div className="edit-row">
                <label className="edit-field">
                  <span className="edit-label">Tag</span>
                  <input
                    className="task-input"
                    list="category-options"
                    placeholder="Pick or type a new tag"
                    value={createForm.category}
                    onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })}
                  />
                </label>
                <label className="edit-field">
                  <span className="edit-label">Assign to</span>
                  <select
                    className="field-select"
                    value={createForm.assigneeId}
                    onChange={(e) => setCreateForm({ ...createForm, assigneeId: e.target.value })}
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.id === currentUser ? `${u.name} (me)` : u.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={closeCreate}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Adding…" : "Add ticket"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
