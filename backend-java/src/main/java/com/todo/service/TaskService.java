// backend-java/src/main/java/com/todo/service/TaskService.java
package com.todo.service;

import com.todo.model.Comment;
import com.todo.model.Task;
import com.todo.model.User;
import com.todo.store.TaskRepository;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;

public class TaskService {
    private final TaskRepository repo;

    // Contract v2: the ordered, exact set of allowed statuses. New tasks default
    // to "Open"; every status change is validated against this list.
    public static final List<String> STATUSES = List.of(
            "Open", "In Progress", "Completed", "Deprecated", "Need Requirement");
    private static final Set<String> STATUS_SET = Set.copyOf(STATUSES);

    public TaskService(TaskRepository repo) { this.repo = repo; }

    public List<User> listUsers() { return repo.listUsers(); }

    public List<Task> listTasks(String assignee, String status, String category) {
        return repo.listTasks(assignee, status, category);
    }

    public Task addTask(Task input) {
        if (input.title == null || input.title.isBlank())
            throw new IllegalArgumentException("title is required");
        String status = input.status == null ? "Open" : input.status;
        if (!STATUS_SET.contains(status))
            throw new IllegalArgumentException("invalid status");

        Task t = new Task();
        t.id = UUID.randomUUID().toString();
        t.title = input.title;
        t.description = input.description == null ? "" : input.description;
        t.category = input.category == null ? "Work" : input.category;
        t.status = status;
        t.assigneeId = input.assigneeId;
        t.createdBy = input.createdBy;
        t.createdAt = input.createdAt != null ? input.createdAt : Instant.now().toString();
        t.updatedAt = t.createdAt;
        t.comments = new ArrayList<>();
        return repo.add(t);
    }

    public Task updateTask(String id, Task patch) {
        if (patch.status != null && !STATUS_SET.contains(patch.status))
            throw new IllegalArgumentException("invalid status");
        return repo.update(id, t -> {
            if (patch.title != null) t.title = patch.title;
            if (patch.description != null) t.description = patch.description;
            if (patch.category != null) t.category = patch.category;
            if (patch.assigneeId != null) t.assigneeId = patch.assigneeId;
            if (patch.status != null) t.status = patch.status;
            t.updatedAt = patch.updatedAt != null ? patch.updatedAt : Instant.now().toString();
        });
    }

    public Task setStatus(String id, String status, String updatedAt) {
        if (!STATUS_SET.contains(status))
            throw new IllegalArgumentException("invalid status");
        return repo.update(id, t -> {
            t.status = status;
            t.updatedAt = updatedAt != null ? updatedAt : Instant.now().toString();
        });
    }

    public Task addComment(String id, String author, String text, String createdAt) {
        if (text == null || text.isBlank())
            throw new IllegalArgumentException("text is required");
        Comment c = new Comment();
        c.id = UUID.randomUUID().toString();
        c.author = author;
        c.text = text;
        c.createdAt = createdAt != null ? createdAt : Instant.now().toString();
        return repo.addComment(id, c);
    }

    public boolean deleteTask(String id) { return repo.delete(id); }
}
