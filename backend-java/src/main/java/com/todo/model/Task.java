// backend-java/src/main/java/com/todo/model/Task.java
package com.todo.model;

import java.util.ArrayList;
import java.util.List;

// A todo item: its metadata plus an inline list of comments.
// Fields are public so Jackson can serialize/deserialize them directly.
public class Task {
    public String id;
    public String title;
    public String description = "";
    public String category = "Work";
    public String status = "Open"; // one of TaskService.STATUSES, default "Open"
    public String assigneeId;
    public String createdBy;
    public String createdAt;
    public String updatedAt;
    public List<Comment> comments = new ArrayList<>();

    public Task() {} // required by Jackson
}
