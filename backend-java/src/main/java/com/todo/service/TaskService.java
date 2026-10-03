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
