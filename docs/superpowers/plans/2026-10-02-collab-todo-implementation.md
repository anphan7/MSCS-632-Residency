# Collaborative To-Do List — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one React frontend plus two interchangeable backends (Java/Javalin and Node/Express) that implement the same REST contract for a multi-user to-do list, demonstrating Java's thread+lock concurrency against JavaScript's async event-loop concurrency.

**Architecture:** React SPA (control variable) talks to one backend at a time via `VITE_API_URL`. Each backend keeps tasks in memory and persists to its own `tasks.json`. Java serializes concurrent edits with a `ReentrantReadWriteLock`; Node serializes async persistence with a promise queue and relies on single-threaded atomic mutation. A `/simulate` endpoint fires N simultaneous edits to prove each model is consistent.

**Tech Stack:** Java 17+, Javalin 6, Jackson, Gradle, JUnit 5 · Node 18+, Express 4, built-in `node:test` runner · React 18 + Vite.

**Shared data shapes (identical on both backends):**
- **Task:** `id` (uuid string), `title`, `description`, `category`, `status` (`"pending"`|`"completed"`), `assigneeId`, `createdBy`, `createdAt` (ISO), `updatedAt` (ISO)
- **User:** `id`, `name`
- **Seed users:** `{id:"u1",name:"Alice"}`, `{id:"u2",name:"Bob"}`
- **Ports:** Node `4000`, Java `4001`, React dev `5173`

---

## File Structure

```
collab-todo/ (repo root = Residency/)
├── backend-node/
│   ├── package.json
│   ├── server.js                 # entry: wire store+service+app, listen
│   ├── src/
│   │   ├── store.js              # in-memory state + serialized async persistence
│   │   ├── service.js           # task operations + simulate + ValidationError
│   │   └── app.js               # Express app + routes
│   └── test/
│       └── api.test.js          # node:test integration + concurrency tests
├── backend-java/
│   ├── build.gradle
│   ├── settings.gradle
│   └── src/
│       ├── main/java/com/todo/
│       │   ├── Main.java         # entry + Javalin app builder
│       │   ├── model/Task.java
│       │   ├── model/User.java
│       │   ├── store/TaskRepository.java   # map + ReentrantReadWriteLock + Jackson
│       │   └── service/TaskService.java    # operations + simulate (threads)
│       └── test/java/com/todo/
│           ├── TaskServiceConcurrencyTest.java
│           └── ApiTest.java
├── frontend/
│   ├── .env                      # VITE_API_URL
│   └── src/
│       ├── api.js
│       ├── App.jsx
│       └── components/*.jsx
└── docs/ , slides/               # already exist
```

---

# PHASE 0 — Scaffolding (Saturday, ~30 min)

### Task 0.1: Create folder skeleton

**Files:** Create directories only.

- [ ] **Step 1: Make the folders**

Run from repo root (`Residency/`):
```bash
mkdir -p backend-node/src backend-node/test \
         backend-java/src/main/java/com/todo/{model,store,service} \
         backend-java/src/test/java/com/todo \
         frontend
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "chore: scaffold backend/frontend folders"
```

---

# PHASE 1 — Node (Express) backend (Saturday)

This is built first because it is the simplest reference implementation of the contract.

### Task 1.1: Initialize the Node project

**Files:** Create `backend-node/package.json`

- [ ] **Step 1: Init and install**

```bash
cd backend-node
npm init -y
npm install express cors
npm pkg set type="module"
npm pkg set scripts.start="node server.js"
npm pkg set scripts.test="node --test"
cd ..
```

- [ ] **Step 2: Verify**

Run: `cat backend-node/package.json`
Expected: `"type": "module"`, express + cors in dependencies, `start` and `test` scripts present.

- [ ] **Step 3: Commit**

```bash
git add backend-node/package.json backend-node/package-lock.json && git commit -m "chore(node): init express project"
```

---

### Task 1.2: Data store — in-memory state + serialized async persistence

**Files:** Create `backend-node/src/store.js`

- [ ] **Step 1: Write the store**

```js
// backend-node/src/store.js
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const DEFAULT_USERS = [
  { id: "u1", name: "Alice" },
  { id: "u2", name: "Bob" },
];

// The store holds the single source of truth in memory. Because Node runs on
// ONE thread, any synchronous mutation of `state` is atomic. The only async
// part is writing to disk, which we funnel through `persistQueue` so two writes
// can never interleave and clobber the file.
export function createStore(filePath) {
  let state = { users: [...DEFAULT_USERS], tasks: [] };
  let persistQueue = Promise.resolve();

  async function init() {
    if (existsSync(filePath)) {
      state = JSON.parse(await readFile(filePath, "utf8"));
      if (!state.users) state.users = [...DEFAULT_USERS];
      if (!state.tasks) state.tasks = [];
    } else {
      await persist();
    }
  }

  function persist() {
    persistQueue = persistQueue.then(() =>
      writeFile(filePath, JSON.stringify(state, null, 2))
    );
    return persistQueue;
  }

  return {
    init,
    getState: () => state,
    persist,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add backend-node/src/store.js && git commit -m "feat(node): in-memory store with serialized persistence"
```

---

### Task 1.3: Service layer — task operations + simulate

**Files:** Create `backend-node/src/service.js`

- [ ] **Step 1: Write the service**

```js
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
```

- [ ] **Step 2: Commit**

```bash
git add backend-node/src/service.js && git commit -m "feat(node): task service + simulate"
```

---

### Task 1.4: Express app + routes

**Files:** Create `backend-node/src/app.js`

- [ ] **Step 1: Write the app**

```js
// backend-node/src/app.js
import express from "express";
import cors from "cors";
import { ValidationError } from "./service.js";

export function createApp(service) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/users", (req, res) => res.json(service.listUsers()));

  app.get("/tasks", (req, res) => {
    const { assignee, status, category } = req.query;
    res.json(service.listTasks({ assignee, status, category }));
  });

  app.post("/tasks", async (req, res, next) => {
    try {
      res.status(201).json(await service.addTask(req.body));
    } catch (e) { next(e); }
  });

  app.put("/tasks/:id", async (req, res, next) => {
    try {
      const t = await service.updateTask(req.params.id, req.body);
      if (!t) return res.status(404).json({ error: "not found" });
      res.json(t);
    } catch (e) { next(e); }
  });

  app.patch("/tasks/:id/status", async (req, res, next) => {
    try {
      const t = await service.setStatus(req.params.id, req.body.status);
      if (!t) return res.status(404).json({ error: "not found" });
      res.json(t);
    } catch (e) { next(e); }
  });

  app.delete("/tasks/:id", async (req, res, next) => {
    try {
      const ok = await service.deleteTask(req.params.id);
      res.status(ok ? 204 : 404).end();
    } catch (e) { next(e); }
  });

  app.post("/simulate", async (req, res, next) => {
    try {
      const { taskId, count } = req.body;
      res.json(await service.simulate(taskId, count ?? 50));
    } catch (e) { next(e); }
  });

  // central error handler
  app.use((err, req, res, next) => {
    const code = err instanceof ValidationError ? 400 : 500;
    res.status(code).json({ error: err.message });
  });

  return app;
}
```

- [ ] **Step 2: Commit**

```bash
git add backend-node/src/app.js && git commit -m "feat(node): express routes"
```

---

### Task 1.5: Entry point

**Files:** Create `backend-node/server.js`

- [ ] **Step 1: Write the entry**

```js
// backend-node/server.js
import { createStore } from "./src/store.js";
import { createService } from "./src/service.js";
import { createApp } from "./src/app.js";

const PORT = process.env.PORT || 4000;
const DATA_FILE = process.env.DATA_FILE || "./tasks.json";

const store = createStore(DATA_FILE);
await store.init();
const app = createApp(createService(store));
app.listen(PORT, () => console.log(`Node backend on http://localhost:${PORT}`));
```

- [ ] **Step 2: Smoke-test it manually**

Run: `cd backend-node && node server.js`
Expected: prints `Node backend on http://localhost:4000`. In another terminal:
```bash
curl -s localhost:4000/users
curl -s -X POST localhost:4000/tasks -H 'content-type: application/json' -d '{"title":"first","assigneeId":"u1"}'
curl -s localhost:4000/tasks
```
Expected: users array; created task JSON with a uuid `id` and `status:"pending"`; tasks array containing it. Stop with Ctrl-C. Confirm `backend-node/tasks.json` now exists.

- [ ] **Step 3: Commit**

```bash
git add backend-node/server.js && git commit -m "feat(node): server entry point"
```

---

### Task 1.6: Node tests (integration + concurrency)

**Files:** Create `backend-node/test/api.test.js`

- [ ] **Step 1: Write the failing tests**

```js
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
```

- [ ] **Step 2: Run and verify**

Run: `cd backend-node && npm test`
Expected: all 5 tests pass (`# pass 5`). If any fail, fix the referenced source file before continuing.

- [ ] **Step 3: Commit**

```bash
git add backend-node/test/api.test.js && git commit -m "test(node): integration + concurrency tests"
```

---

# PHASE 2 — Java (Javalin) backend (Saturday)

Implements the identical contract with OOP classes and real threads.

### Task 2.1: Gradle project setup

**Files:** Create `backend-java/settings.gradle`, `backend-java/build.gradle`

- [ ] **Step 1: settings.gradle**

```groovy
// backend-java/settings.gradle
rootProject.name = 'backend-java'
```

- [ ] **Step 2: build.gradle**

```groovy
// backend-java/build.gradle
plugins {
    id 'application'
}

repositories { mavenCentral() }

dependencies {
    implementation 'io.javalin:javalin:6.3.0'
    implementation 'com.fasterxml.jackson.core:jackson-databind:2.17.2'
    implementation 'org.slf4j:slf4j-simple:2.0.13'

    testImplementation 'org.junit.jupiter:junit-jupiter:5.10.2'
    testImplementation 'io.javalin:javalin-testtools:6.3.0'
    testRuntimeOnly 'org.junit.platform:junit-platform-launcher:1.10.2'
}

application {
    mainClass = 'com.todo.Main'
}

test { useJUnitPlatform() }

java { toolchain { languageVersion = JavaLanguageVersion.of(17) } }
```

- [ ] **Step 3: Generate the Gradle wrapper**

Run: `cd backend-java && gradle wrapper && cd ..`
Expected: creates `gradlew`, `gradlew.bat`, `gradle/wrapper/`. (If `gradle` isn't installed, install via `brew install gradle` first.)

- [ ] **Step 4: Commit**

```bash
git add backend-java/settings.gradle backend-java/build.gradle backend-java/gradlew* backend-java/gradle && git commit -m "chore(java): gradle + javalin setup"
```

---

### Task 2.2: Model classes

**Files:** Create `backend-java/src/main/java/com/todo/model/Task.java` and `User.java`

- [ ] **Step 1: Task.java**

```java
// backend-java/src/main/java/com/todo/model/Task.java
package com.todo.model;

public class Task {
    public String id;
    public String title;
    public String description = "";
    public String category = "Work";
    public String status = "pending"; // "pending" | "completed"
    public String assigneeId;
    public String createdBy;
    public String createdAt;
    public String updatedAt;

    public Task() {} // required by Jackson
}
```

- [ ] **Step 2: User.java**

```java
// backend-java/src/main/java/com/todo/model/User.java
package com.todo.model;

public class User {
    public String id;
    public String name;

    public User() {}
    public User(String id, String name) { this.id = id; this.name = name; }
}
```

- [ ] **Step 3: Commit**

```bash
git add backend-java/src/main/java/com/todo/model && git commit -m "feat(java): Task and User models"
```

---

### Task 2.3: TaskRepository — map guarded by ReentrantReadWriteLock + Jackson

**Files:** Create `backend-java/src/main/java/com/todo/store/TaskRepository.java`

- [ ] **Step 1: Write the repository**

```java
// backend-java/src/main/java/com/todo/store/TaskRepository.java
package com.todo.store;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.todo.model.Task;
import com.todo.model.User;

import java.io.File;
import java.io.IOException;
import java.util.*;
import java.util.concurrent.locks.ReentrantReadWriteLock;
import java.util.function.Consumer;

// Tasks live in a LinkedHashMap guarded by an explicit ReentrantReadWriteLock.
// Reads take the read lock (many can run at once); writes take the write lock
// (exclusive) and persist to disk inside it, so a read-modify-write-persist
// cycle is atomic even when many threads hit the same task. This is the direct
// counterpart to the Node store's single-thread + async queue approach.
public class TaskRepository {
    private final File file;
    private final ObjectMapper mapper = new ObjectMapper();
    private final ReentrantReadWriteLock lock = new ReentrantReadWriteLock();

    private final LinkedHashMap<String, Task> tasks = new LinkedHashMap<>();
    private final List<User> users = new ArrayList<>(List.of(
            new User("u1", "Alice"), new User("u2", "Bob")));

    public TaskRepository(String path) {
        this.file = new File(path);
        load();
    }

    // on-disk shape mirrors the Node file: { users: [...], tasks: [...] }
    static class Snapshot {
        public List<User> users;
        public List<Task> tasks;
    }

    private void load() {
        lock.writeLock().lock();
        try {
            if (file.exists()) {
                Snapshot s = mapper.readValue(file, Snapshot.class);
                if (s.users != null) { users.clear(); users.addAll(s.users); }
                if (s.tasks != null) for (Task t : s.tasks) tasks.put(t.id, t);
            } else {
                persistUnlocked();
            }
        } catch (IOException e) {
            throw new RuntimeException("Failed to load tasks", e);
        } finally {
            lock.writeLock().unlock();
        }
    }

    private void persistUnlocked() {
        try {
            Snapshot s = new Snapshot();
            s.users = users;
            s.tasks = new ArrayList<>(tasks.values());
            mapper.writerWithDefaultPrettyPrinter().writeValue(file, s);
        } catch (IOException e) {
            throw new RuntimeException("Failed to persist tasks", e);
        }
    }

    public List<User> listUsers() {
        lock.readLock().lock();
        try { return new ArrayList<>(users); }
        finally { lock.readLock().unlock(); }
    }

    public List<Task> listTasks(String assignee, String status, String category) {
        lock.readLock().lock();
        try {
            List<Task> out = new ArrayList<>();
            for (Task t : tasks.values()) {
                if (assignee != null && !assignee.equals(t.assigneeId)) continue;
                if (status != null && !status.equals(t.status)) continue;
                if (category != null && !category.equals(t.category)) continue;
                out.add(t);
            }
            return out;
        } finally { lock.readLock().unlock(); }
    }

    public Task get(String id) {
        lock.readLock().lock();
        try { return tasks.get(id); }
        finally { lock.readLock().unlock(); }
    }

    public Task add(Task t) {
        lock.writeLock().lock();
        try { tasks.put(t.id, t); persistUnlocked(); return t; }
        finally { lock.writeLock().unlock(); }
    }

    public Task update(String id, Consumer<Task> mutator) {
        lock.writeLock().lock();
        try {
            Task t = tasks.get(id);
            if (t == null) return null;
            mutator.accept(t);
            persistUnlocked();
            return t;
        } finally { lock.writeLock().unlock(); }
    }

    public boolean delete(String id) {
        lock.writeLock().lock();
        try {
            boolean removed = tasks.remove(id) != null;
            if (removed) persistUnlocked();
            return removed;
        } finally { lock.writeLock().unlock(); }
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend-java/src/main/java/com/todo/store && git commit -m "feat(java): thread-safe TaskRepository"
```

---

### Task 2.4: TaskService — operations + threaded simulate

**Files:** Create `backend-java/src/main/java/com/todo/service/TaskService.java`

- [ ] **Step 1: Write the service**

```java
// backend-java/src/main/java/com/todo/service/TaskService.java
package com.todo.service;

import com.todo.model.Task;
import com.todo.model.User;
import com.todo.store.TaskRepository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.*;

public class TaskService {
    private final TaskRepository repo;

    public TaskService(TaskRepository repo) { this.repo = repo; }

    public List<User> listUsers() { return repo.listUsers(); }

    public List<Task> listTasks(String assignee, String status, String category) {
        return repo.listTasks(assignee, status, category);
    }

    public Task addTask(Task input) {
        if (input.title == null || input.title.isBlank())
            throw new IllegalArgumentException("title is required");
        Task t = new Task();
        t.id = UUID.randomUUID().toString();
        t.title = input.title;
        t.description = input.description == null ? "" : input.description;
        t.category = input.category == null ? "Work" : input.category;
        t.status = "pending";
        t.assigneeId = input.assigneeId;
        t.createdBy = input.createdBy;
        t.createdAt = Instant.now().toString();
        t.updatedAt = t.createdAt;
        return repo.add(t);
    }

    public Task updateTask(String id, Task patch) {
        return repo.update(id, t -> {
            if (patch.title != null) t.title = patch.title;
            if (patch.description != null) t.description = patch.description;
            if (patch.category != null) t.category = patch.category;
            if (patch.assigneeId != null) t.assigneeId = patch.assigneeId;
            t.updatedAt = Instant.now().toString();
        });
    }

    public Task setStatus(String id, String status) {
        if (!"pending".equals(status) && !"completed".equals(status))
            throw new IllegalArgumentException("invalid status");
        return repo.update(id, t -> {
            t.status = status;
            t.updatedAt = Instant.now().toString();
        });
    }

    public boolean deleteTask(String id) { return repo.delete(id); }

    // Concurrency demo: N real threads toggle the same task at once. The
    // repository's write lock serializes them, so the store stays consistent.
    public SimResult simulate(String taskId, int count) throws InterruptedException {
        if (repo.get(taskId) == null)
            throw new IllegalArgumentException("taskId not found");
        ExecutorService pool = Executors.newFixedThreadPool(8);
        CountDownLatch latch = new CountDownLatch(count);
        for (int i = 0; i < count; i++) {
            final String status = (i % 2 == 0) ? "completed" : "pending";
            pool.submit(() -> {
                try { setStatus(taskId, status); }
                finally { latch.countDown(); }
            });
        }
        latch.await();
        pool.shutdown();
        Task t = repo.get(taskId);
        SimResult r = new SimResult();
        r.taskId = taskId;
        r.operations = count;
        r.finalStatus = (t == null ? null : t.status);
        return r;
    }

    public static class SimResult {
        public String taskId;
        public int operations;
        public String finalStatus;
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend-java/src/main/java/com/todo/service && git commit -m "feat(java): TaskService + threaded simulate"
```

---

### Task 2.5: Main + Javalin routes

**Files:** Create `backend-java/src/main/java/com/todo/Main.java`

- [ ] **Step 1: Write Main**

```java
// backend-java/src/main/java/com/todo/Main.java
package com.todo;

import com.todo.model.Task;
import com.todo.service.TaskService;
import com.todo.store.TaskRepository;
import io.javalin.Javalin;

import java.util.Map;

public class Main {
    public static void main(String[] args) {
        int port = Integer.parseInt(System.getenv().getOrDefault("PORT", "4001"));
        String dataFile = System.getenv().getOrDefault("DATA_FILE", "tasks.json");

        TaskService service = new TaskService(new TaskRepository(dataFile));
        Javalin app = buildApp(service);
        app.start(port);
        System.out.println("Java backend on http://localhost:" + port);
    }

    public static Javalin buildApp(TaskService service) {
        Javalin app = Javalin.create(cfg ->
            cfg.bundledPlugins.enableCors(cors -> cors.addRule(it -> it.anyHost()))
        );

        app.get("/users", ctx -> ctx.json(service.listUsers()));

        app.get("/tasks", ctx -> ctx.json(service.listTasks(
                ctx.queryParam("assignee"),
                ctx.queryParam("status"),
                ctx.queryParam("category"))));

        app.post("/tasks", ctx -> {
            Task body = ctx.bodyAsClass(Task.class);
            ctx.status(201).json(service.addTask(body));
        });

        app.put("/tasks/{id}", ctx -> {
            Task patch = ctx.bodyAsClass(Task.class);
            Task t = service.updateTask(ctx.pathParam("id"), patch);
            if (t == null) ctx.status(404).json(err("not found"));
            else ctx.json(t);
        });

        app.patch("/tasks/{id}/status", ctx -> {
            StatusBody b = ctx.bodyAsClass(StatusBody.class);
            Task t = service.setStatus(ctx.pathParam("id"), b.status);
            if (t == null) ctx.status(404).json(err("not found"));
            else ctx.json(t);
        });

        app.delete("/tasks/{id}", ctx -> {
            boolean ok = service.deleteTask(ctx.pathParam("id"));
            ctx.status(ok ? 204 : 404);
        });

        app.post("/simulate", ctx -> {
            SimBody b = ctx.bodyAsClass(SimBody.class);
            ctx.json(service.simulate(b.taskId, b.count == 0 ? 50 : b.count));
        });

        app.exception(IllegalArgumentException.class, (e, ctx) ->
            ctx.status(400).json(err(e.getMessage())));

        return app;
    }

    static Map<String, String> err(String m) { return Map.of("error", m); }

    public static class StatusBody { public String status; }
    public static class SimBody { public String taskId; public int count; }
}
```

- [ ] **Step 2: Smoke-test manually**

Run: `cd backend-java && ./gradlew run`
Expected: `Java backend on http://localhost:4001`. In another terminal:
```bash
curl -s localhost:4001/users
curl -s -X POST localhost:4001/tasks -H 'content-type: application/json' -d '{"title":"first","assigneeId":"u1"}'
curl -s localhost:4001/tasks
```
Expected: identical JSON shapes to the Node backend. Stop with Ctrl-C.

- [ ] **Step 3: Commit**

```bash
git add backend-java/src/main/java/com/todo/Main.java && git commit -m "feat(java): Javalin routes + entry"
```

---

### Task 2.6: Java tests (concurrency + API)

**Files:** Create `backend-java/src/test/java/com/todo/TaskServiceConcurrencyTest.java` and `ApiTest.java`

- [ ] **Step 1: Concurrency test**

```java
// backend-java/src/test/java/com/todo/TaskServiceConcurrencyTest.java
package com.todo;

import com.todo.model.Task;
import com.todo.service.TaskService;
import com.todo.store.TaskRepository;
import org.junit.jupiter.api.*;

import java.nio.file.*;

import static org.junit.jupiter.api.Assertions.*;

class TaskServiceConcurrencyTest {
    Path dataFile;
    TaskService service;

    @BeforeEach
    void setup() throws Exception {
        dataFile = Files.createTempFile("tasks", ".json");
        Files.deleteIfExists(dataFile); // start empty so the repo seeds fresh
        service = new TaskService(new TaskRepository(dataFile.toString()));
    }

    @AfterEach
    void cleanup() throws Exception { Files.deleteIfExists(dataFile); }

    @Test
    void simulateKeepsStoreConsistent() throws Exception {
        Task input = new Task();
        input.title = "race";
        Task created = service.addTask(input);

        TaskService.SimResult result = service.simulate(created.id, 200);

        assertEquals(200, result.operations);
        assertEquals(1, service.listTasks(null, null, null).size());
        assertTrue(result.finalStatus.equals("pending")
                || result.finalStatus.equals("completed"));
    }
}
```

- [ ] **Step 2: API test**

```java
// backend-java/src/test/java/com/todo/ApiTest.java
package com.todo;

import com.todo.service.TaskService;
import com.todo.store.TaskRepository;
import io.javalin.testtools.JavalinTest;
import org.junit.jupiter.api.Test;

import java.nio.file.*;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class ApiTest {
    @Test
    void createAndListTask() throws Exception {
        Path f = Files.createTempFile("tasks", ".json");
        Files.deleteIfExists(f);
        var app = Main.buildApp(new TaskService(new TaskRepository(f.toString())));

        JavalinTest.test(app, (server, client) -> {
            var create = client.post("/tasks", Map.of("title", "Write report", "assigneeId", "u1"));
            assertEquals(201, create.code());

            var list = client.get("/tasks");
            assertEquals(200, list.code());
            assertTrue(list.body().string().contains("Write report"));
        });

        Files.deleteIfExists(f);
    }
}
```

- [ ] **Step 3: Run and verify**

Run: `cd backend-java && ./gradlew test`
Expected: `BUILD SUCCESSFUL`, both tests pass. Fix referenced source files if anything fails.

- [ ] **Step 4: Commit**

```bash
git add backend-java/src/test && git commit -m "test(java): concurrency + API tests"
```

---

# PHASE 3 — React frontend (Saturday → Sunday)

The UI is backend-agnostic. Styling uses the vendored `frontend-design` skill.

### Task 3.1: Scaffold Vite + React

**Files:** Create the `frontend/` Vite app

- [ ] **Step 1: Scaffold and install**

```bash
cd frontend
npm create vite@latest . -- --template react
npm install
cd ..
```
(If prompted about a non-empty dir, choose "Ignore files and continue".)

- [ ] **Step 2: Add the API base env file**

Create `frontend/.env`:
```
VITE_API_URL=http://localhost:4000
```
(Change to `http://localhost:4001` and restart Vite to point at the Java backend.)

- [ ] **Step 3: Verify dev server runs**

Run: `cd frontend && npm run dev`
Expected: Vite serves on `http://localhost:5173`. Stop with Ctrl-C.

- [ ] **Step 4: Commit**

```bash
git add frontend/ && git commit -m "chore(frontend): scaffold vite react + env"
```

---

### Task 3.2: API client

**Files:** Create `frontend/src/api.js`

- [ ] **Step 1: Write the client**

```js
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
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/api.js && git commit -m "feat(frontend): api client"
```

---

### Task 3.3: App shell + state (functional, unstyled)

**Files:** Replace `frontend/src/App.jsx`

- [ ] **Step 1: Write App.jsx**

```jsx
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
```

- [ ] **Step 2: Manual verification against Node backend**

Start Node (`cd backend-node && node server.js`), then Vite (`cd frontend && npm run dev`). In the browser at `http://localhost:5173`:
- Add a task → it appears.
- Toggle the checkbox → strikethrough; filter by `completed` shows it.
- Switch user → task list filters to that assignee.
- Click `simulate` → message shows 100 edits done.
- Delete → it disappears.
Expected: all work with no console errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.jsx && git commit -m "feat(frontend): task UI wired to API"
```

---

### Task 3.4: Apply visual design

**Files:** Modify `frontend/src/App.jsx`, `frontend/src/index.css`

- [ ] **Step 1: Invoke the design skill**

Invoke `frontend-design` and apply a deliberate palette, type scale, and layout to the existing components (do not change behavior or the API calls). Replace the inline styles with CSS classes in `index.css`.

- [ ] **Step 2: Re-verify** the same manual checklist from Task 3.3 Step 2 still passes.

- [ ] **Step 3: Commit**

```bash
git add frontend/src && git commit -m "style(frontend): apply visual design"
```

---

# PHASE 4 — Cross-backend verification (Saturday EOD)

### Task 4.1: Prove both backends are interchangeable

- [ ] **Step 1: Run the full flow against Java**

Stop Node. Start Java (`cd backend-java && ./gradlew run`). Edit `frontend/.env` → `VITE_API_URL=http://localhost:4001`, restart Vite. Re-run the Task 3.3 manual checklist.
Expected: identical behavior to Node — same UI, same results. This is the core demo.

- [ ] **Step 2: Capture concurrency results from both**

With each backend running, create a task then:
```bash
curl -s -X POST localhost:4000/simulate -H 'content-type: application/json' -d '{"taskId":"<id>","count":200}'   # Node
curl -s -X POST localhost:4001/simulate -H 'content-type: application/json' -d '{"taskId":"<id>","count":200}'   # Java
```
Expected: both return `operations:200` and a valid `finalStatus`; `tasks.json` stays valid JSON (no corruption) in both.

- [ ] **Step 3: Reset env to default** (`VITE_API_URL=http://localhost:4000`) and commit if `.env` changed.

---

# PHASE 5 — Saturday deliverable wrap-up

### Task 5.1: README

**Files:** Create `README.md` at repo root

- [ ] **Step 1: Write the README** covering: project overview, architecture diagram, prerequisites (Node 18+, JDK 17+), and exact run instructions for each of `backend-node` (`npm install && npm start`), `backend-java` (`./gradlew run`), and `frontend` (`npm install && npm run dev`), plus how to switch backends via `VITE_API_URL`, and how to run tests (`npm test` / `./gradlew test`).

- [ ] **Step 2: Commit**

```bash
git add README.md && git commit -m "docs: project README with build/run instructions"
```

### Task 5.2: Screenshots + Deliverable 2 report

- [ ] **Step 1:** Capture screenshots of the running app (task list, simulate result, filtered view) into `docs/screenshots/`.
- [ ] **Step 2:** Write the brief Deliverable 2 report (screenshots + repo link + what works) — reuse the docx build approach from Deliverable 1.
- [ ] **Step 3:** Commit.

---

# PHASE 6 — Sunday: finalize, report, present

### Task 6.1: Polish & bug sweep
- [ ] Run both test suites (`npm test`, `./gradlew test`) — all green. Fix any gaps. Commit.

### Task 6.2: APA comparison report (2–3 pages, APA 7)
- [ ] Write `docs/Comparison-Report.docx` covering paradigm, concurrency model (threads+lock vs. event-loop+queue), error handling, data handling, tooling, and overall experience — with code snippets from both backends and screenshots. Follow APA 7 (title page, headings, references). Use the docx build approach.

### Task 6.3: Slides
- [ ] Build a 15–20 min deck: problem, architecture, live demo (same UI, swap backend), the concurrency contrast slide, language-difference highlights, and who-did-what. Both members present.

### Task 6.4: Rehearse the demo
- [ ] Dry-run: start a backend + frontend, walk the feature tour, run `/simulate` live, swap backends. Time it to 15–20 min.

---

## Self-Review (completed)

- **Spec coverage:** data storage ✔ (stores + files), categories/status ✔ (model + filters), per-user views ✔ (assignee filter + switcher), concurrency ✔ (lock vs. queue + `/simulate`), Java OOP+threads ✔ (Phase 2), JS async+JSON ✔ (Phase 1), React frontend ✔ (Phase 3), shared contract ✔ (identical routes), repo/README ✔ (Phase 5), APA report + presentation ✔ (Phase 6).
- **Placeholder scan:** code steps contain complete code; doc-writing tasks (README, reports, slides) specify exact required contents rather than code.
- **Type consistency:** Task/User field names, `status` values, route paths, and `simulate` request/response shapes are identical across Node, Java, and the React client.
