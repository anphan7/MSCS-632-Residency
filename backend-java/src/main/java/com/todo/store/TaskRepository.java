// backend-java/src/main/java/com/todo/store/TaskRepository.java
package com.todo.store;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.todo.model.Comment;
import com.todo.model.Task;
import com.todo.model.User;

import java.io.File;
import java.io.IOException;
import java.util.*;
import java.util.concurrent.locks.ReentrantReadWriteLock;
import java.util.function.Consumer;

// Tasks live in a LinkedHashMap guarded by an explicit ReentrantReadWriteLock.
// Reads take the read lock (many can run at once); writes take the write lock
// (exclusive) and persist to disk inside it, so a read-modify-write-persist
// cycle is atomic even when many threads hit the same task. This is the direct
// counterpart to the Node store's single-thread + async queue approach.
public class TaskRepository {
    private final File file;
    private final ObjectMapper mapper = new ObjectMapper();
    private final ReentrantReadWriteLock lock = new ReentrantReadWriteLock();

    private final LinkedHashMap<String, Task> tasks = new LinkedHashMap<>();
    private final List<User> users = new ArrayList<>(List.of(
            new User("u1", "Alice"), new User("u2", "Bob")));

    public TaskRepository(String path) {
        this.file = new File(path);
        load();
    }

    // on-disk shape mirrors the Node file: { users: [...], tasks: [...] }
    static class Snapshot {
        public List<User> users;
        public List<Task> tasks;
    }

    // Write lock: populate in-memory maps from disk (or seed the file if missing).
    private void load() {
        lock.writeLock().lock();
        try {
            if (file.exists()) {
                Snapshot s = mapper.readValue(file, Snapshot.class);
                if (s.users != null) { users.clear(); users.addAll(s.users); }
                if (s.tasks != null) for (Task t : s.tasks) tasks.put(t.id, t);
            } else {
                persistUnlocked();
            }
        } catch (IOException e) {
            throw new RuntimeException("Failed to load tasks", e);
        } finally {
            lock.writeLock().unlock();
        }
    }

    // Writes current state to disk; caller must already hold the write lock.
    private void persistUnlocked() {
        try {
            Snapshot s = new Snapshot();
            s.users = users;
            s.tasks = new ArrayList<>(tasks.values());
            mapper.writerWithDefaultPrettyPrinter().writeValue(file, s);
        } catch (IOException e) {
            throw new RuntimeException("Failed to persist tasks", e);
        }
    }

    // Read lock: return a copy so callers can't mutate the backing list.
    public List<User> listUsers() {
        lock.readLock().lock();
        try { return new ArrayList<>(users); }
        finally { lock.readLock().unlock(); }
    }

    // Write lock: add the user and persist atomically.
    public User addUser(User u) {
        lock.writeLock().lock();
        try { users.add(u); persistUnlocked(); return u; }
        finally { lock.writeLock().unlock(); }
    }

    // Read lock: filter tasks by optional assignee/status/category.
    public List<Task> listTasks(String assignee, String status, String category) {
        lock.readLock().lock();
        try {
            List<Task> out = new ArrayList<>();
            for (Task t : tasks.values()) {
                if (assignee != null && !assignee.equals(t.assigneeId)) continue;
                if (status != null && !status.equals(t.status)) continue;
                if (category != null && !category.equals(t.category)) continue;
                out.add(t);
            }
            return out;
        } finally { lock.readLock().unlock(); }
    }

    // Read lock: look up a single task (null if absent).
    public Task get(String id) {
        lock.readLock().lock();
        try { return tasks.get(id); }
        finally { lock.readLock().unlock(); }
    }

    // Write lock: insert the task and persist atomically.
    public Task add(Task t) {
        lock.writeLock().lock();
        try { tasks.put(t.id, t); persistUnlocked(); return t; }
        finally { lock.writeLock().unlock(); }
    }

    // Write lock: read-modify-write-persist in one atomic step via the mutator.
    public Task update(String id, Consumer<Task> mutator) {
        lock.writeLock().lock();
        try {
            Task t = tasks.get(id);
            if (t == null) return null;
            mutator.accept(t);
            persistUnlocked();
            return t;
        } finally { lock.writeLock().unlock(); }
    }

    // Comments are append-only. Done inside the write lock so the append and the
    // disk persist are atomic: concurrent comments never overwrite each other.
    public Task addComment(String id, Comment c) {
        lock.writeLock().lock();
        try {
            Task t = tasks.get(id);
            if (t == null) return null;
            if (t.comments == null) t.comments = new ArrayList<>();
            t.comments.add(c);
            persistUnlocked();
            return t;
        } finally { lock.writeLock().unlock(); }
    }

    // Write lock: remove the task and persist only if something was removed.
    public boolean delete(String id) {
        lock.writeLock().lock();
        try {
            boolean removed = tasks.remove(id) != null;
            if (removed) persistUnlocked();
            return removed;
        } finally { lock.writeLock().unlock(); }
    }
}
