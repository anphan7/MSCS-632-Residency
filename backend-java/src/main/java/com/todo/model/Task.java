// backend-java/src/main/java/com/todo/model/Task.java
package com.todo.model;

public class Task {
    public String id;
    public String title;
    public String description = "";
    public String category = "Work";
    public String status = "pending"; // "pending" | "completed"
    public String assigneeId;
    public String createdBy;
    public String createdAt;
    public String updatedAt;

    public Task() {} // required by Jackson
}
