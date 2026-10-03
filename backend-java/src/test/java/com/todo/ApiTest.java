// backend-java/src/test/java/com/todo/ApiTest.java
package com.todo;

import com.todo.service.TaskService;
import com.todo.store.TaskRepository;
import io.javalin.testtools.JavalinTest;
import org.junit.jupiter.api.Test;

import java.nio.file.*;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

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
            // new tasks default to "Open" with an empty comments list
            String created = create.body().string();
            assertTrue(created.contains("\"status\":\"Open\""));
            assertTrue(created.contains("\"comments\":[]"));

            var list = client.get("/tasks");
            assertEquals(200, list.code());
            assertTrue(list.body().string().contains("Write report"));
        });

        Files.deleteIfExists(f);
    }

    @Test
    void postCommentAppendsAndBlankTextIs400() throws Exception {
        Path f = Files.createTempFile("tasks", ".json");
        Files.deleteIfExists(f);
        var app = Main.buildApp(new TaskService(new TaskRepository(f.toString())));

        JavalinTest.test(app, (server, client) -> {
            var create = client.post("/tasks", Map.of("title", "Discuss"));
            assertEquals(201, create.code());
            Matcher m = Pattern.compile("\"id\":\"([^\"]+)\"").matcher(create.body().string());
            assertTrue(m.find());
            String id = m.group(1);

            // valid comment is appended and the updated task is returned
            var ok = client.post("/tasks/" + id + "/comments",
                    Map.of("author", "u1", "text", "looks good"));
            assertEquals(201, ok.code());
            String body = ok.body().string();
            assertTrue(body.contains("looks good"));
            assertTrue(body.contains("\"author\":\"u1\""));

            // blank text → 400
            var blank = client.post("/tasks/" + id + "/comments",
                    Map.of("author", "u1", "text", "   "));
            assertEquals(400, blank.code());
        });

        Files.deleteIfExists(f);
    }
}
