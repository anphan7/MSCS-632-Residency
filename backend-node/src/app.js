// backend-node/src/app.js
import express from "express";
import cors from "cors";
import { ValidationError } from "./service.js";

export function createApp(service) {
  const app = express();
  app.use(cors());         // allow the browser frontend to call this API
  app.use(express.json()); // parse JSON request bodies into req.body

  // Report which backend implementation is serving (Node vs. others).
  app.get("/meta", (req, res) => res.json({ backend: "Node (Express)" }));

  // List all users.
  app.get("/users", (req, res) => res.json(service.listUsers()));

  // Create a user; 201 with the new user, or forward errors to the handler.
  app.post("/users", async (req, res, next) => {
    try {
      res.status(201).json(await service.addUser(req.body));
    } catch (e) { next(e); }
  });

  // List tasks, optionally filtered via query params.
  app.get("/tasks", (req, res) => {
    const { assignee, status, category } = req.query;
    res.json(service.listTasks({ assignee, status, category }));
  });

  // Create a task.
  app.post("/tasks", async (req, res, next) => {
    try {
      res.status(201).json(await service.addTask(req.body));
    } catch (e) { next(e); }
  });

  // Update a task's fields; 404 if the id doesn't exist.
  app.put("/tasks/:id", async (req, res, next) => {
    try {
      const t = await service.updateTask(req.params.id, req.body);
      if (!t) return res.status(404).json({ error: "not found" });
      res.json(t);
    } catch (e) { next(e); }
  });

  // Change just a task's status.
  app.patch("/tasks/:id/status", async (req, res, next) => {
    try {
      const t = await service.setStatus(req.params.id, req.body.status, req.body.updatedAt);
      if (!t) return res.status(404).json({ error: "not found" });
      res.json(t);
    } catch (e) { next(e); }
  });

  // Add a comment to a task; returns the updated task.
  app.post("/tasks/:id/comments", async (req, res, next) => {
    try {
      const t = await service.addComment(req.params.id, req.body);
      if (!t) return res.status(404).json({ error: "not found" });
      res.status(201).json(t);
    } catch (e) { next(e); }
  });

  // Delete a task; 204 on success, 404 if it wasn't there.
  app.delete("/tasks/:id", async (req, res, next) => {
    try {
      const ok = await service.deleteTask(req.params.id);
      res.status(ok ? 204 : 404).end();
    } catch (e) { next(e); }
  });

  // central error handler: map validation errors to 400, everything else to 500
  app.use((err, req, res, next) => {
    const code = err instanceof ValidationError ? 400 : 500;
    res.status(code).json({ error: err.message });
  });

  return app;
}
