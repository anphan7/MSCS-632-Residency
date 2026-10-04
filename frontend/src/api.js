// frontend/src/api.js
const BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";

// Thin fetch wrapper: sets JSON headers, throws on non-OK, returns null for 204.
async function http(path, options) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "content-type": "application/json" },
    ...options,
  });
  if (!res.ok && res.status !== 204) {
    const msg = await res.json().catch(() => ({}));
    throw new Error(msg.error || `HTTP ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

export const api = {
  getMeta: () => http("/meta"),
  // --- User calls ---
  listUsers: () => http("/users"),
  createUser: (name) =>
    http("/users", { method: "POST", body: JSON.stringify({ name }) }),
  // --- Task calls ---
  listTasks: (q = {}) => {
    // Drop empty filter values so we only send active filters as query params.
    const p = new URLSearchParams(Object.entries(q).filter(([, v]) => v));
    return http(`/tasks?${p.toString()}`);
  },
  // Browser-clock timestamps per Contract v2: the frontend stamps createdAt on
  // create and updatedAt on every mutation; backends fall back to their own
  // clock only if we omit them.
  addTask: (task) =>
    http("/tasks", {
      method: "POST",
      body: JSON.stringify({ createdAt: new Date().toISOString(), ...task }),
    }),
  updateTask: (id, patch) =>
    http(`/tasks/${id}`, {
      method: "PUT",
      body: JSON.stringify({ ...patch, updatedAt: new Date().toISOString() }),
    }),
  setStatus: (id, status) =>
    http(`/tasks/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, updatedAt: new Date().toISOString() }),
    }),
  deleteTask: (id) => http(`/tasks/${id}`, { method: "DELETE" }),
  // --- Comment calls ---
  addComment: (taskId, { author, text, createdAt }) =>
    http(`/tasks/${taskId}/comments`, {
      method: "POST",
      body: JSON.stringify({
        author,
        text,
        createdAt: createdAt ?? new Date().toISOString(),
      }),
    }),
};
