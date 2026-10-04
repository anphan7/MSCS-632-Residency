// backend-java/src/main/java/com/todo/model/Comment.java
package com.todo.model;

// A single comment attached to a task.
// Fields are public so Jackson can map them without getters/setters.
public class Comment {
    public String id;
    public String author;
    public String text;
    public String createdAt;

    public Comment() {} // required by Jackson
}
