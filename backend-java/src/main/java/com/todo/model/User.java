// backend-java/src/main/java/com/todo/model/User.java
package com.todo.model;

// A person who can create or be assigned tasks.
// Fields are public so Jackson can map them without getters/setters.
public class User {
    public String id;
    public String name;

    public User() {}
    public User(String id, String name) { this.id = id; this.name = name; }
}
