// backend-java/src/main/java/com/todo/Main.java
package com.todo;

import com.todo.model.Task;
import com.todo.service.TaskService;
import com.todo.store.TaskRepository;
import io.javalin.Javalin;

import java.util.Map;

public class Main {
    public static void main(String[] args) {
        // Read config from env (with defaults), wire repo -> service -> app, then listen.
        int port = Integer.parseInt(System.getenv().getOrDefault("PORT", "4001"));
        String dataFile = System.getenv().getOrDefault("DATA_FILE", "tasks.json");

        TaskService service = new TaskService(new TaskRepository(dataFile));
        Javalin app = buildApp(service);
        app.start(port);
        System.out.println("Java backend on http://localhost:" + port);
    }

    public static Javalin buildApp(TaskService service) {
        // Allow requests from any origin so the separate frontend can call this API.
        Javalin app = Javalin.create(cfg ->
            cfg.bundledPlugins.enableCors(cors -> cors.addRule(it -> it.anyHost()))
        );

        // Identifies which backend implementation is serving (Java vs Node).
        app.get("/meta", ctx -> ctx.json(Map.of("backend", "Java (Javalin)")));

        // List all users.
        app.get("/users", ctx -> ctx.json(service.listUsers()));

        // Create a user from the JSON body; 201 on success.
        app.post("/users", ctx -> {
            UserBody b = ctx.bodyAsClass(UserBody.class);
            ctx.status(201).json(service.addUser(b.name));
        });

        // List tasks, optionally filtered by query params.
        app.get("/tasks", ctx -> ctx.json(service.listTasks(
                ctx.queryParam("assignee"),
                ctx.queryParam("status"),
                ctx.queryParam("category"))));

        // Create a task from the JSON body; 201 on success.
        app.post("/tasks", ctx -> {
            Task body = ctx.bodyAsClass(Task.class);
            ctx.status(201).json(service.addTask(body));
        });

        // Patch a task's fields; 404 if the id doesn't exist.
        app.put("/tasks/{id}", ctx -> {
            Task patch = ctx.bodyAsClass(Task.class);
            Task t = service.updateTask(ctx.pathParam("id"), patch);
            if (t == null) ctx.status(404).json(err("not found"));
            else ctx.json(t);
        });

        // Change just a task's status; 404 if the id doesn't exist.
        app.patch("/tasks/{id}/status", ctx -> {
            StatusBody b = ctx.bodyAsClass(StatusBody.class);
            Task t = service.setStatus(ctx.pathParam("id"), b.status, b.updatedAt);
            if (t == null) ctx.status(404).json(err("not found"));
            else ctx.json(t);
        });

        // Append a comment to a task; 201 on success, 404 if the id doesn't exist.
        app.post("/tasks/{id}/comments", ctx -> {
            CommentBody b = ctx.bodyAsClass(CommentBody.class);
            Task t = service.addComment(ctx.pathParam("id"), b.author, b.text, b.createdAt);
            if (t == null) ctx.status(404).json(err("not found"));
            else ctx.status(201).json(t);
        });

        // Delete a task; 204 if removed, 404 if not found.
        app.delete("/tasks/{id}", ctx -> {
            boolean ok = service.deleteTask(ctx.pathParam("id"));
            ctx.status(ok ? 204 : 404);
        });

        // Validation errors from the service map to HTTP 400 with the message.
        app.exception(IllegalArgumentException.class, (e, ctx) ->
            ctx.status(400).json(err(e.getMessage())));

        return app;
    }

    // Shapes error responses as { "error": message }.
    static Map<String, String> err(String m) { return Map.of("error", m); }

    // Request-body shapes Jackson binds incoming JSON to.

    public static class StatusBody { public String status; public String updatedAt; }
    public static class CommentBody { public String author; public String text; public String createdAt; }
    public static class UserBody { public String name; }
}
