# Collaborative To-Do List — Design & Day-1 Plan

**Course:** MSCS-632 Residency
**Date:** 2026-10-02 (Friday, Day 1)
**Team:** An Phan, [Partner Name]
**Repository:** _(add GitHub URL once created)_

> This document is both the system design and the **Deliverable 1** planning report
> (application design, task assignment, timeline, and documentation of anticipated
> language-specific challenges).

---

## 1. Goal

Build the **same** collaborative to-do list application twice — once with a **Java**
backend and once with a **JavaScript (Node)** backend — behind one shared **React**
frontend. The real deliverable is the **comparison**: how two languages solve an
identical problem, especially concurrency (Java threads + locks vs. JS async event
loop).

### Core requirements (from the assignment)
- Data storage for tasks and user-specific views of tasks.
- Task categorization and status tracking (pending / completed).
- Support for concurrency so multiple users can edit tasks "at once".
- Java: classes, OOP principles, concurrency via threads.
- JavaScript: async/await + promises, JSON for data storage.

---

## 2. Architecture

One React single-page app (the **control variable**) talks to **two interchangeable
backends** that implement the **same REST contract**. Only one backend runs at a time;
React points at it via an env var. Same UI, same API, different language engine.

```
                 ┌─────────────────────────┐
                 │   React SPA (frontend)   │   ← constant / control variable
                 │  task UI, user switcher, │
                 │  category & status views │
                 └───────────┬──────────────┘
                             │  same REST contract (HTTP / JSON)
          ┌──────────────────┴──────────────────┐
          ▼                                      ▼
┌────────────────────────┐           ┌────────────────────────┐
│ Java backend (Javalin)  │          │ Node backend (Express)  │
│  • OOP: User, Task      │          │  • async/await, Promises│
│  • threads + locks      │          │  • event-loop concurrency│
│  • file persistence     │          │  • JSON file persistence │
└───────────┬─────────────┘          └───────────┬─────────────┘
            ▼                                     ▼
     tasks.json (Java copy)               tasks.json (Node copy)
```

**Why this shape:** the frontend and the REST contract are held constant, so any
difference the audience sees in behavior, structure, or performance is attributable to
the **language/runtime**, not the UI. That is exactly what the comparison report and
presentation need.

### Decisions locked in
- **Frontend:** one shared, swappable React app (Vite). `VITE_API_URL` selects backend.
- **Java stack:** Javalin (lightweight) so thread handling and OOP stay visible.
- **Node stack:** Express.
- **Concurrency:** simulated within a single process per backend (no distributed system).
- **Persistence:** file-based, each backend owns its own `tasks.json`.
- **Auth:** none. A simple "who am I" user switcher. Real authentication is out of scope.

---

## 3. Shared REST API contract

Both backends implement these identically. Identical request/response JSON is what makes
the comparison fair.

| Method | Route | Purpose |
|---|---|---|
| GET    | `/users`                                        | list users |
| GET    | `/tasks?assignee=&status=&category=`            | list / filter tasks (per-user views) |
| POST   | `/tasks`                                         | add task |
| PUT    | `/tasks/:id`                                     | edit / reassign / recategorize |
| PATCH  | `/tasks/:id/status`                              | mark complete / pending |
| DELETE | `/tasks/:id`                                     | remove task |
| POST   | `/simulate`                                      | concurrency demo: fire N simultaneous edits |

---

## 4. Data model (shared)

**Task**
- `id` (string/uuid)
- `title` (string)
- `description` (string)
- `category` (string; defaults: Work, Personal, Urgent)
- `status` (`pending` | `completed`)
- `assigneeId` (string → User.id)
- `createdBy` (string → User.id)
- `createdAt`, `updatedAt` (ISO timestamps)

**User**
- `id` (string)
- `name` (string)

**Category:** free-form string, with a few seeded defaults.

---

## 5. Java backend design (shows OOP + threads)

- **Classes:** `Task`, `User`, `TaskRepository` (in-memory `ConcurrentHashMap` + file
  sync), `TaskService` (business logic), Javalin route handlers.
- **Concurrency:** Javalin's thread pool handles requests concurrently. The shared task
  store is guarded with a `ReentrantReadWriteLock` (or `synchronized`) so concurrent
  edits cannot corrupt state. `/simulate` launches multiple threads hitting the same
  task to demonstrate lock-based thread safety.
- **Persistence:** serialize the task map to `tasks.json` via Jackson on each change;
  load on startup.
- **Build:** Gradle (or Maven).

---

## 6. Node backend design (shows async + JSON)

- **Modules:** `taskStore.js` (async JSON read/write), route modules, `server.js`.
- **Concurrency:** all I/O is `async/await` over Promises; the single-threaded event
  loop interleaves requests. `/simulate` fires `Promise.all([...])` of many edits to
  show non-blocking concurrency. Because there are no OS threads/locks, writes are
  funneled through a **serialized write queue** to avoid lost updates — a direct
  contrast to Java's locks.
- **Persistence:** `fs.promises` read/write of `tasks.json`.
- **Build:** npm.

---

## 7. React frontend design

- **Stack:** Vite + React.
- **Components:** `UserSwitcher`, `TaskList`, `TaskForm`, `CategoryFilter`,
  `StatusToggle`, `SimulateButton`.
- Talks only to the REST contract → fully backend-agnostic.

---

## 8. Concurrency demonstration (presentation centerpiece)

The `/simulate` endpoint plus a UI button fire many simultaneous task edits:
- **Java:** demonstrates true multi-threading with lock-based synchronization.
- **Node:** demonstrates single-threaded event-loop concurrency with an async write
  queue.

This is the clearest side-by-side answer to "how does each language handle the same
problem?"

---

## 9. Repository structure (one GitHub monorepo)

```
collab-todo/
├── README.md            # functionality + build/compile/run instructions
├── frontend/            # React (Vite)
├── backend-java/        # Javalin + Gradle/Maven
├── backend-node/        # Express
├── docs/                # design report, APA comparison report, screenshots
└── slides/              # presentation deck
```

---

## 10. Task assignment (reported as an equal split)

| Member | Owns |
|---|---|
| **An Phan** | Java backend (Javalin + threads), React frontend, repo/CI setup, shared REST contract, concurrency demo (`/simulate`). |
| **[Partner Name]** | Node/Express backend, README authoring, testing checklist & bug log, screenshots, APA comparison-report drafting, slide deck, half of presentation delivery. |

Each member owns one backend, which reads as a balanced technical division of labor.

---

## 11. Timeline & milestones

| Day | Deliverable | Milestones |
|---|---|---|
| **Fri (D1)** | Deliverable 1: Planning & Design | This design doc; GitHub repo created; skeleton folders; roles; timeline. |
| **Sat (D2)** | Deliverable 2: Core Functionality | Both backends + React reach full CRUD, categories, status, per-user views, basic concurrency; README + screenshots; brief report. |
| **Sun (D3)** | Deliverable 3: Final + Report + Presentation | Polish; `/simulate` concurrency demo; 2–3 page APA comparison report; slides; rehearse; present. |

---

## 12. Anticipated language-specific challenges (seeds for the APA report)

- **Paradigm:** Java is statically typed and class-centric; JS is dynamically typed and
  multi-paradigm.
- **Concurrency model:** Java uses real OS threads with locks; Node uses a single-threaded
  event loop with async queues — different correctness strategies for the same race.
- **Error handling:** Java checked exceptions vs. JS try/catch + rejected promises.
- **Data handling:** Java POJOs serialized via Jackson vs. JS native JSON (zero
  friction).
- **Tooling/build:** Gradle/JVM vs. npm/Node; startup time, dependency models.
- **Verbosity & dev speed:** Java boilerplate vs. JS brevity, and the trade-offs in
  readability and safety.

---

## 13. Out of scope (YAGNI)

- Real authentication / passwords.
- Networked/distributed multi-machine concurrency.
- A shared database or a store shared between the two backends.
- Two separate frontends.
