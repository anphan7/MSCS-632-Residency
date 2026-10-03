# Shared Contract v2 — feature expansion

Both backends (Node + Java) MUST implement this identically; the React client depends on exact shapes.

## Task (updated)
```jsonc
{
  "id": "uuid",
  "title": "string",
  "description": "string",            // editable
  "category": "string",               // Work | Personal | Urgent (free-form)
  "status": "Open",                   // one of STATUSES, default "Open"
  "assigneeId": "u1|u2|null",         // who it's assigned to (any user)
  "createdBy": "u1|u2|null",          // who created it
  "createdAt": "ISO string",
  "updatedAt": "ISO string",
  "comments": [                       // append-only discussion
    { "id": "uuid", "author": "u1", "text": "string", "createdAt": "ISO string" }
  ]
}
```

## STATUSES (exact strings, in this order)
`["Open", "In Progress", "Completed", "Deprecated", "Need Requirement"]`
- Default for a new task: `"Open"`.
- `"Completed"` is the "done" state (UI strikethrough + check).
- Any status change validates against this list → 400 if not in it.

## Users (unchanged)
Seed: `{id:"u1",name:"Alice"}`, `{id:"u2",name:"Bob"}`.

## Timestamps — browser time
- The **frontend sends** `createdAt` / `updatedAt` (and comment `createdAt`) as ISO strings from the browser clock (`new Date().toISOString()`).
- Backends **use the provided value if present, otherwise fall back** to their own clock.
- The frontend **displays** timestamps in the browser's local format (`toLocaleString()`).

## Endpoints
| Method | Route | Body | Notes |
|---|---|---|---|
| GET | `/users` | — | unchanged |
| GET | `/tasks?assignee=&status=&category=` | — | returns tasks incl. `comments` |
| POST | `/tasks` | `{title, description?, category?, assigneeId?, createdBy?, status?, createdAt?}` | status defaults "Open"; new task has `comments: []` |
| PUT | `/tasks/:id` | `{title?, description?, category?, assigneeId?, status?, updatedAt?}` | updates any of these; validates status |
| PATCH | `/tasks/:id/status` | `{status, updatedAt?}` | validates against STATUSES |
| DELETE | `/tasks/:id` | — | 204 / 404 |
| POST | `/tasks/:id/comments` | `{author, text, createdAt?}` | appends a comment; `text` required → 400 if blank; returns the **updated task** |
| POST | `/simulate` | `{taskId, count}` | unchanged (toggles status Open/Completed); response `{taskId, operations, finalStatus}` |

## Validation
- `title` required on create → 400.
- `status` must be in STATUSES → 400.
- comment `text` required (non-blank) → 400.

## Concurrency note (unchanged behavior)
Field updates are **last-write-wins**; the lock (Java) / async queue (Node) prevents corruption, not lost updates. Comments are **append-only**, so concurrent comments never overwrite each other.
