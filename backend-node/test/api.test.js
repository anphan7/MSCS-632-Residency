// backend-node/test/api.test.js
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rm } from "node:fs/promises";
import { createStore } from "../src/store.js";
import { createService } from "../src/service.js";
import { createApp } from "../src/app.js";

let server, base, dataFile;

before(async () => {
  dataFile = join(tmpdir(), `tasks-${Date.now()}.json`);
  const store = createStore(dataFile);
  await store.init();
  const app = createApp(createService(store));
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://localhost:${server.address().port}`;
});

after(async () => {
  server.close();
  await rm(dataFile, { force: true });
});

async function post(path, body) {
  return fetch(base + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("GET /users returns seeded users", async () => {
  const users = await (await fetch(base + "/users")).json();
  assert.equal(users.length, 2);
  assert.equal(users[0].name, "Alice");
});

test("POST /tasks creates a pending task", async () => {
  const res = await post("/tasks", { title: "Write report", assigneeId: "u1" });
  assert.equal(res.status, 201);
  const task = await res.json();
  assert.equal(task.title, "Write report");
  assert.equal(task.status, "pending");
  assert.ok(task.id);
});

test("POST /tasks without title is rejected 400", async () => {
  const res = await post("/tasks", { description: "no title" });
  assert.equal(res.status, 400);
});

test("PATCH status and filter by status", async () => {
  const created = await (await post("/tasks", { title: "toggle me" })).json();
  const patched = await fetch(`${base}/tasks/${created.id}/status`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status: "completed" }),
  });
  assert.equal(patched.status, 200);
  const done = await (await fetch(base + "/tasks?status=completed")).json();
  assert.ok(done.some((t) => t.id === created.id));
});

test("/simulate keeps the store consistent under concurrent writes", async () => {
  const created = await (await post("/tasks", { title: "race" })).json();
  const result = await (await post("/simulate", { taskId: created.id, count: 100 })).json();
  assert.equal(result.operations, 100);
  assert.ok(["pending", "completed"].includes(result.finalStatus));
  const all = await (await fetch(base + "/tasks")).json();
  // no duplication / corruption: exactly one task with that id
  assert.equal(all.filter((t) => t.id === created.id).length, 1);
});
