package com.example.demo.domain.user.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

import com.fasterxml.jackson.annotation.JsonFormat;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AccessLog {
    private Long id;
    private String userId;
    private String ipAddress;
    private String userAgent;
    
    // [신규] 통계 및 상세 정보를 위한 필드
    private String browser;
    private String os;
    
    private String endpoint;
    private String type;
    // 프론트로 보낼 때는 "2024-12-17 15:30:00" 형식으로 자동 변환해서 보냄
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd HH:mm:ss", timezone = "Asia/Seoul")
    private LocalDateTime logTime;
}