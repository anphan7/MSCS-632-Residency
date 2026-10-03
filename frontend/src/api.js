// frontend/src/api.js
const BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";

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
  listUsers: () => http("/users"),
  listTasks: (q = {}) => {
    const p = new URLSearchParams(Object.entries(q).filter(([, v]) => v));
    return http(`/tasks?${p.toString()}`);
  },
  addTask: (task) => http("/tasks", { method: "POST", body: JSON.stringify(task) }),
  updateTask: (id, patch) => http(`/tasks/${id}`, { method: "PUT", body: JSON.stringify(patch) }),
  setStatus: (id, status) => http(`/tasks/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  deleteTask: (id) => http(`/tasks/${id}`, { method: "DELETE" }),
  simulate: (taskId, count) => http("/simulate", { method: "POST", body: JSON.stringify({ taskId, count }) }),
};
