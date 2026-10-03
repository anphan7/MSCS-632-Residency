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

test("POST /tasks creates an Open task with empty comments", async () => {
  const res = await post("/tasks", { title: "Write report", assigneeId: "u1" });
  assert.equal(res.status, 201);
  const task = await res.json();
  assert.equal(task.title, "Write report");
  assert.equal(task.status, "Open");
  assert.deepEqual(task.comments, []);
  assert.ok(task.id);
});

test("POST /tasks without title is rejected 400", async () => {
  const res = await post("/tasks", { description: "no title" });
  assert.equal(res.status, 400);
});

test("POST /tasks with an invalid status is rejected 400", async () => {
  const res = await post("/tasks", { title: "bad status", status: "nope" });
  assert.equal(res.status, 400);
});

test("PATCH status and filter by status", async () => {
  const created = await (await post("/tasks", { title: "toggle me" })).json();
  const patched = await fetch(`${base}/tasks/${created.id}/status`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status: "Completed" }),
  });
  assert.equal(patched.status, 200);
  const done = await (await fetch(base + "/tasks?status=Completed")).json();
  assert.ok(done.some((t) => t.id === created.id));
});

test("PATCH status rejects a status not in STATUSES with 400", async () => {
  const created = await (await post("/tasks", { title: "bad patch" })).json();
  const patched = await fetch(`${base}/tasks/${created.id}/status`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status: "finished" }),
  });
  assert.equal(patched.status, 400);
});

test("POST /tasks/:id/comments appends a comment and returns the task", async () => {
  const created = await (await post("/tasks", { title: "discuss me" })).json();
  const res = await post(`/tasks/${created.id}/comments`, {
    author: "u1",
    text: "first comment",
  });
  assert.equal(res.status, 201);
  const task = await res.json();
  assert.equal(task.id, created.id);
  assert.equal(task.comments.length, 1);
  assert.equal(task.comments[0].author, "u1");
  assert.equal(task.comments[0].text, "first comment");
  assert.ok(task.comments[0].id);
  assert.ok(task.comments[0].createdAt);
});

test("POST /tasks/:id/comments with blank text is rejected 400", async () => {
  const created = await (await post("/tasks", { title: "no blank comments" })).json();
  const res = await post(`/tasks/${created.id}/comments`, { author: "u1", text: "   " });
  assert.equal(res.status, 400);
});
