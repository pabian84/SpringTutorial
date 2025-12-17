package com.example.demo.domain.user.entity;
import java.time.LocalDateTime;

import com.fasterxml.jackson.annotation.JsonFormat;

import lombok.Data;

@Data
public class AccessLog {
    private int seq;
    private String userId;
    private String type;
    // 프론트로 보낼 때는 "2024-12-17 15:30:00" 형식으로 자동 변환해서 보냄
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd HH:mm:ss", timezone = "Asia/Seoul")
    private LocalDateTime logTime;
}