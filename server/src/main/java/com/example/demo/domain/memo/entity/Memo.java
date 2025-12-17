package com.example.demo.domain.memo.entity;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class Memo {
    private Long id;
    private String userId;
    private String content;
    private LocalDateTime createdAt;
}