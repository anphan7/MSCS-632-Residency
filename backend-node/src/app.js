// backend-node/src/app.js
import express from "express";
import cors from "cors";
import { ValidationError } from "./service.js";

export function createApp(service) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/users", (req, res) => res.json(service.listUsers()));

  app.post("/users", async (req, res, next) => {
    try {
      res.status(201).json(await service.addUser(req.body));
    } catch (e) { next(e); }
  });

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
      const t = await service.setStatus(req.params.id, req.body.status, req.body.updatedAt);
      if (!t) return res.status(404).json({ error: "not found" });
      res.json(t);
    } catch (e) { next(e); }
  });

  app.post("/tasks/:id/comments", async (req, res, next) => {
    try {
      const t = await service.addComment(req.params.id, req.body);
      if (!t) return res.status(404).json({ error: "not found" });
      res.status(201).json(t);
    } catch (e) { next(e); }
  });

  app.delete("/tasks/:id", async (req, res, next) => {
    try {
      const ok = await service.deleteTask(req.params.id);
      res.status(ok ? 204 : 404).end();
    } catch (e) { next(e); }
  });

  // central error handler
  app.use((err, req, res, next) => {
    const code = err instanceof ValidationError ? 400 : 500;
    res.status(code).json({ error: err.message });
  });

  return app;
}
