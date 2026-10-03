# MSCS 632 – Collaborative To-Do

A multi-user to-do / ticket app built **twice** — once with a **Java (Javalin)** backend and once with a **JavaScript (Node + Express)** backend — behind a single shared **React** frontend. Both backends implement the **same REST API**, so the one frontend can point at either and behave identically. The project's purpose is to compare how each language solves the same problem, especially **concurrency**.

> Team: An Phan, Vatsalkumar Mukeshkumar Dholakiya · Repository: https://github.com/anphan7/MSCS-632-Residency

---

## Overview

```
                 ┌──────────────────────────┐
                 │   React frontend (Vite)   │   one UI, points at either backend
                 └────────────┬─────────────┘
                              │  same REST API (HTTP / JSON)
          ┌───────────────────┴───────────────────┐
          ▼                                        ▼
┌───────────────────────┐             ┌────────────────────────┐
│ Java backend (Javalin) │            │ Node backend (Express)  │
│  threads + lock         │           │  async / event loop      │
│  port 4001              │           │  port 4000               │
└───────────┬────────────┘           └───────────┬────────────┘
            ▼                                      ▼
     tasks.json (Java)                      tasks.json (Node)
```

**Features**

- Multiple users; a "Working as" switcher (add new teammates from the dropdown).
- Tickets with **title, description, tag, status, assignee**, and **comments**.
- Five statuses: `Open`, `In Progress`, `Completed`, `Deprecated`, `Need Requirement`.
- Shared team board with filters by status, tag, and assignee.
- Create tickets in a modal; edit tickets **in-place** (click a row to expand).
- Timestamps come from the browser clock, shown in local time.
- A header badge shows **which backend is currently serving** (Node vs. Java).
- Each backend persists to its own `tasks.json` file.

---

## Install requirements

See **[REQUIREMENTS.md](REQUIREMENTS.md)** for the full list. In short:

- **Node.js 18+** (tested on 24) and npm
- **JDK 17+** (tested on 26) — Gradle itself is **not** needed (a wrapper is included)

Install everything in one step from the project root:

```bash
./setup.sh
```

(Or install each part manually — see the next section.)

---

## How to build / run locally

Run **one backend** plus the **frontend**. (Both backends can run at once if you want to switch between them — they use different ports.)

### 1. Node backend — port 4000

```bash
cd backend-node
npm install        # if you didn't run ./setup.sh
npm start          # → "Node backend on http://localhost:4000"
```

### 2. Java backend — port 4001

```bash
cd backend-java
./gradlew run      # → "Java backend on http://localhost:4001"
```

(`./gradlew run` stays "75% EXECUTING" while the server runs — that's normal. Stop it with `Ctrl-C`. If Gradle can't start, see the JDK note in REQUIREMENTS.md.)

### 3. Frontend — port 5173

```bash
cd frontend
npm install        # if you didn't run ./setup.sh
npm run dev        # → http://localhost:5173
```

### Choosing which backend the frontend talks to

Edit **`frontend/.env`** (copy `frontend/.env.example` if it's missing):

```
# Node backend
VITE_API_URL=http://localhost:4000
# Java backend
# VITE_API_URL=http://localhost:4001
```

Change the value and **restart `npm run dev`** (Vite reads env vars only at startup). The header badge confirms which backend answered.

### Run the tests (optional)

```bash
cd backend-node && npm test        # Node integration tests (node:test)
cd backend-java && ./gradlew test  # Java tests (JUnit 5)
```

---

## Code functionality: Java vs. JavaScript

Both backends expose the **same endpoints** and the same JSON shapes, so the frontend can't tell them apart by its API calls:

| Method | Route | Purpose |
|---|---|---|
| GET | `/meta` | which backend this is (for the header badge) |
| GET | `/users` · POST `/users` | list users · add a teammate |
| GET | `/tasks` (filter by `assignee`/`status`/`category`) | list tickets (incl. comments) |
| POST | `/tasks` · PUT `/tasks/:id` · DELETE `/tasks/:id` | create · edit · delete |
| PATCH | `/tasks/:id/status` | change status |
| POST | `/tasks/:id/comments` | add a comment |

What differs is **how each language implements it** — the point of the comparison:

### Java backend (`backend-java/`) — OOP + threads

- **Object-oriented:** real classes — `Task`, `User`, `Comment` (models), `TaskRepository` (storage), `TaskService` (business rules), `Main` (Javalin routes).
- **Concurrency via threads + a lock:** Javalin serves each request on its own thread (true parallelism). The shared task store is a map guarded by a `ReentrantReadWriteLock` — many reads can run together, but a write takes the lock exclusively and persists to disk *inside* the lock, so a read-modify-write-save cycle is atomic and two simultaneous edits can't corrupt the file.
- **Data:** typed Java objects serialized to `tasks.json` with the **Jackson** library.
- **Build/run:** Gradle (`./gradlew run`), JDK 17+.

### JavaScript backend (`backend-node/`) — async + event loop

- **Module/function style:** small modules — `store.js` (in-memory state + persistence), `service.js` (business rules), `app.js` (Express routes), `server.js` (entry) — composed with factory functions.
- **Concurrency via the event loop:** Node runs on a **single thread**. Each in-memory mutation is atomic because nothing else runs until the function `await`s. Disk writes are funneled through a **serialized promise queue** so overlapping saves can't clobber `tasks.json` — achieving the same safety as Java's lock, but without threads.
- **Data:** native **JSON** read/written with `fs.promises`.
- **Build/run:** npm (`npm start`), Node 18+.

### The concurrency contrast in one line

> Java keeps the shared data safe with **threads + a read/write lock**; Node keeps it safe with a **single-threaded event loop + an async write queue**. Same problem, opposite strategies — each dictated by the language's model.

> Note: field edits are **last-write-wins** (the lock/queue prevents *corruption*, not a *lost update*); **comments are append-only**, so concurrent comments never overwrite each other.
