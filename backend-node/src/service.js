// backend-node/src/service.js
import { randomUUID } from "node:crypto";

export class ValidationError extends Error {}

// Ordered list of valid task statuses (Contract v2). Exported for reuse.
export const STATUSES = [
  "Open",
  "In Progress",
  "Completed",
  "Deprecated",
  "Need Requirement",
];

export function createService(store) {
  const now = () => new Date().toISOString();
  const tasks = () => store.getState().tasks;

  function listUsers() {
    return store.getState().users;
  }

  function listTasks({ assignee, status, category } = {}) {
    return tasks().filter(
      (t) =>
        (!assignee || t.assigneeId === assignee) &&
        (!status || t.status === status) &&
        (!category || t.category === category)
    );
  }

  function findTask(id) {
    return tasks().find((t) => t.id === id);
  }

  async function addTask(input = {}) {
    if (!input.title) throw new ValidationError("title is required");
    const status = input.status ?? "Open";
    if (!STATUSES.includes(status))
      throw new ValidationError("invalid status");
    const task = {
      id: randomUUID(),
      title: input.title,
      description: input.description ?? "",
      category: input.category ?? "Work",
      status,
      assigneeId: input.assigneeId ?? null,
      createdBy: input.createdBy ?? null,
      createdAt: input.createdAt ?? now(),
      updatedAt: input.createdAt ?? now(),
      comments: [],
    };
    tasks().push(task);
    await store.persist();
    return task;
  }

  async function updateTask(id, patch = {}) {
    const task = findTask(id);
    if (!task) return null;
    if ("status" in patch && !STATUSES.includes(patch.status))
      throw new ValidationError("invalid status");
    for (const k of ["title", "description", "category", "assigneeId", "status"]) {
      if (k in patch) task[k] = patch[k];
    }
    task.updatedAt = patch.updatedAt ?? now();
    await store.persist();
    return task;
  }

  async function setStatus(id, status, updatedAt) {
    if (!STATUSES.includes(status))
      throw new ValidationError("invalid status");
    const task = findTask(id);
    if (!task) return null;
    task.status = status;
    task.updatedAt = updatedAt ?? now();
    await store.persist();
    return task;
  }

  async function addComment(taskId, { author, text, createdAt } = {}) {
    if (!text || !String(text).trim())
      throw new ValidationError("text is required");
    const task = findTask(taskId);
    if (!task) return null;
    const comment = {
      id: randomUUID(),
      author: author ?? null,
      text,
      createdAt: createdAt ?? now(),
    };
    task.comments.push(comment);
    await store.persist();
    return task;
  }

  async function deleteTask(id) {
    const list = tasks();
    const idx = list.findIndex((t) => t.id === id);
    if (idx === -1) return false;
    list.splice(idx, 1);
    await store.persist();
    return true;
  }

  return {
    listUsers, listTasks, findTask,
    addTask, updateTask, setStatus, addComment, deleteTask,
  };
}
