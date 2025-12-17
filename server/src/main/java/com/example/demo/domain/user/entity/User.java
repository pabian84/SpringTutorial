package com.example.demo.domain.user.entity;
import lombok.Data;

@Data
public class User {
    private String id;
    private String name;
    private String password;
    private boolean isOnline;
}