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
            Task t = service.setStatus(ctx.pathParam("id"), b.status, b.updatedAt);
            if (t == null) ctx.status(404).json(err("not found"));
            else ctx.json(t);
        });

        app.post("/tasks/{id}/comments", ctx -> {
            CommentBody b = ctx.bodyAsClass(CommentBody.class);
            Task t = service.addComment(ctx.pathParam("id"), b.author, b.text, b.createdAt);
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

    public static class StatusBody { public String status; public String updatedAt; }
    public static class SimBody { public String taskId; public int count; }
    public static class CommentBody { public String author; public String text; public String createdAt; }
}
