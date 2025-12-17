package com.example.demo.domain.user.dto;

import lombok.Data;

@Data
public class UserRes {
    private String id;
    private String name;

    // Entity -> DTO로 바꾸는 생성자 (편의 기능)
    public UserRes(String id, String name) {
        this.id = id;
        this.name = name;
    }
}