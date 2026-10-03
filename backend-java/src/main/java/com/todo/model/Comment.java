// backend-java/src/main/java/com/todo/model/Comment.java
package com.todo.model;

public class Comment {
    public String id;
    public String author;
    public String text;
    public String createdAt;

    public Comment() {} // required by Jackson
}
