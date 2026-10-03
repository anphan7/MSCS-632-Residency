// backend-node/src/service.js
import { randomUUID } from "node:crypto";

export class ValidationError extends Error {}

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
    const task = {
      id: randomUUID(),
      title: input.title,
      description: input.description ?? "",
      category: input.category ?? "Work",
      status: "pending",
      assigneeId: input.assigneeId ?? null,
      createdBy: input.createdBy ?? null,
      createdAt: now(),
      updatedAt: now(),
    };
    tasks().push(task);
    await store.persist();
    return task;
  }

  async function updateTask(id, patch = {}) {
    const task = findTask(id);
    if (!task) return null;
    for (const k of ["title", "description", "category", "assigneeId"]) {
      if (k in patch) task[k] = patch[k];
    }
    task.updatedAt = now();
    await store.persist();
    return task;
  }

  async function setStatus(id, status) {
    if (!["pending", "completed"].includes(status))
      throw new ValidationError("invalid status");
    const task = findTask(id);
    if (!task) return null;
    task.status = status;
    task.updatedAt = now();
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

  // Concurrency demo: fire N status toggles at once. Promise.all lets the event
  // loop interleave them; the serialized persist queue keeps the file consistent.
  async function simulate(taskId, count = 50) {
    if (!findTask(taskId)) throw new ValidationError("taskId not found");
    const ops = Array.from({ length: count }, (_, i) =>
      setStatus(taskId, i % 2 === 0 ? "completed" : "pending")
    );
    await Promise.all(ops);
    return { taskId, operations: count, finalStatus: findTask(taskId)?.status };
  }

  return {
    listUsers, listTasks, findTask,
    addTask, updateTask, setStatus, deleteTask, simulate,
  };
}
