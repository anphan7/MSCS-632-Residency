# Collaborative To-Do List — Java vs. JavaScript

A multi-user to-do list built **twice** — once with a **Java (Javalin)** backend and once with a **JavaScript (Node/Express)** backend — behind a single shared **React** frontend. The two backends implement the **same REST contract**, so the one React app can point at either. The purpose of the project is to compare how each language solves the same problem, with a focus on **concurrency**: Java uses real threads with locks; Node uses a single-threaded async event loop.

> MSCS-632 Residency project. Team: An Phan, Vatsalkumar Mukeshkumar Dholakiya.

## Architecture

```
                 ┌─────────────────────────┐
                 │   React SPA (frontend)   │   one UI, points at either backend
                 └───────────┬──────────────┘
                             │  same REST contract (HTTP / JSON)
          ┌──────────────────┴──────────────────┐
          ▼                                      ▼
┌────────────────────────┐           ┌────────────────────────┐
│ Java backend (Javalin)  │          │ Node backend (Express)  │
│  OOP + threads + lock    │         │  async/await + Promises │
│  :4001                   │         │  :4000                  │
└───────────┬─────────────┘          └───────────┬─────────────┘
            ▼                                      ▼
     tasks.json (Java)                     tasks.json (Node)
```

The React app is the control variable; only the backend language/runtime changes. `VITE_API_URL` selects which backend the frontend talks to.

## Features

- Multiple users with a user switcher (no login; pick who you are).
- Add, edit, delete tasks.
- Categorize tasks (Work / Personal / Urgent) and track status (pending / completed).
- Per-user and per-category/status filtered views.
- Concurrency demo (`/simulate`): fire N simultaneous edits at one task and confirm the store stays consistent — Java via threads + a read/write lock, Node via the event loop + a serialized write queue.
- File-based persistence: each backend writes its own `tasks.json`.

## Shared REST contract

| Method | Route | Purpose |
|---|---|---|
| GET | `/users` | list users |
| GET | `/tasks?assignee=&status=&category=` | list / filter tasks |
| POST | `/tasks` | add task |
| PUT | `/tasks/:id` | edit / reassign / recategorize |
| PATCH | `/tasks/:id/status` | mark complete / pending |
| DELETE | `/tasks/:id` | remove task |
| POST | `/simulate` | concurrency demo (`{taskId, count}` → `{taskId, operations, finalStatus}`) |

## Repository structure

```
.
├── frontend/        # React (Vite)
├── backend-node/    # Express backend
├── backend-java/    # Javalin backend (Gradle)
├── docs/            # design report, comparison report, screenshots
└── slides/          # presentation
```

## Prerequisites

- **Node.js 18+** and npm (tested on Node 24).
- **JDK 17 or newer** (tested on JDK 26). Gradle 9 requires JDK 17+ to run.

## Run it

Open three terminals (one backend at a time is enough; run both only if you want to compare side by side).

### 1. Node backend (port 4000)
```bash
cd backend-node
npm install
npm start          # → Node backend on http://localhost:4000
```

### 2. Java backend (port 4001)
```bash
cd backend-java
./gradlew run      # → Java backend on http://localhost:4001
```

> **JDK note:** if your default `JAVA_HOME` points at an old JDK (e.g. macOS's legacy Java 8), Gradle won't start. Either export a modern JDK —
> `export JAVA_HOME=$(/usr/libexec/java_home -v 17)` (macOS) — or copy `backend-java/gradle.properties.example` to `backend-java/gradle.properties` and set `org.gradle.java.home` to a JDK 17+ path. `gradle.properties` is gitignored because the path is machine-specific.

### 3. Frontend (port 5173)
```bash
cd frontend
npm install
npm run dev        # → http://localhost:5173
```

### Switching which backend the frontend uses
The frontend reads `VITE_API_URL` from `frontend/.env` (see `frontend/.env.example`):
- Node backend: `VITE_API_URL=http://localhost:4000`
- Java backend: `VITE_API_URL=http://localhost:4001`

Change the value and restart `npm run dev` (Vite reads env vars at startup).

## Tests

```bash
cd backend-node && npm test      # node:test — integration + concurrency
cd backend-java && ./gradlew test  # JUnit 5 — concurrency + API
```

## How concurrency differs (the point of the project)

- **Java** runs on many threads. The task store is a map guarded by a `ReentrantReadWriteLock`; reads share the lock, writes take it exclusively and persist to disk inside it, so a read-modify-write-persist cycle is atomic. `/simulate` runs N edits on a real thread pool.
- **Node** runs on one thread with an event loop. Each in-memory mutation is atomic because nothing else runs until the function yields at an `await`; disk writes are funneled through a serialized promise queue so they can't clobber the file. `/simulate` fires N edits with `Promise.all`.

Both keep the store consistent under concurrent edits — using opposite strategies dictated by each language's model.

## Known limitations (intentional, kept at parity across both backends)

- No authentication; users are selected, not logged in.
- Reads return references to live task objects (fine for this single-process demo).
- File persistence is a direct overwrite (no atomic temp-file rename), so a crash mid-write could corrupt the data file. Acceptable for a demo; identical in both backends.
