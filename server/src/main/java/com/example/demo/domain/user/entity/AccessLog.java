package com.example.demo.domain.user.entity;
import lombok.Data;

@Data
public class AccessLog {
    private int seq;
    private String userId;
    private String type;
    private String logTime;
}