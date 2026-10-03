// backend-java/src/test/java/com/todo/ApiTest.java
package com.todo;

import com.todo.service.TaskService;
import com.todo.store.TaskRepository;
import io.javalin.testtools.JavalinTest;
import org.junit.jupiter.api.Test;

import java.nio.file.*;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class ApiTest {
    @Test
    void createAndListTask() throws Exception {
        Path f = Files.createTempFile("tasks", ".json");
        Files.deleteIfExists(f);
        var app = Main.buildApp(new TaskService(new TaskRepository(f.toString())));

        JavalinTest.test(app, (server, client) -> {
            var create = client.post("/tasks", Map.of("title", "Write report", "assigneeId", "u1"));
            assertEquals(201, create.code());

            var list = client.get("/tasks");
            assertEquals(200, list.code());
            assertTrue(list.body().string().contains("Write report"));
        });

        Files.deleteIfExists(f);
    }
}
