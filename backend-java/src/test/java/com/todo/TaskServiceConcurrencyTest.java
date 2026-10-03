// backend-java/src/test/java/com/todo/TaskServiceConcurrencyTest.java
package com.todo;

import com.todo.model.Task;
import com.todo.service.TaskService;
import com.todo.store.TaskRepository;
import org.junit.jupiter.api.*;

import java.nio.file.*;

import static org.junit.jupiter.api.Assertions.*;

class TaskServiceConcurrencyTest {
    Path dataFile;
    TaskService service;

    @BeforeEach
    void setup() throws Exception {
        dataFile = Files.createTempFile("tasks", ".json");
        Files.deleteIfExists(dataFile); // start empty so the repo seeds fresh
        service = new TaskService(new TaskRepository(dataFile.toString()));
    }

    @AfterEach
    void cleanup() throws Exception { Files.deleteIfExists(dataFile); }

    @Test
    void simulateKeepsStoreConsistent() throws Exception {
        Task input = new Task();
        input.title = "race";
        Task created = service.addTask(input);

        TaskService.SimResult result = service.simulate(created.id, 200);

        assertEquals(200, result.operations);
        assertEquals(1, service.listTasks(null, null, null).size());
        assertTrue(result.finalStatus.equals("pending")
                || result.finalStatus.equals("completed"));
    }
}
