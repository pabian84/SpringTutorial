package com.example.demo.domain.user.entity;

import lombok.*;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Session {
    private Long id;
    private String userId;

    private String refreshToken; // 이 토큰을 삭제하면 해당 기기는 튕김
    private String deviceType; // "Mobile", "Desktop", "Tablet"
    private String userAgent;  // "Chrome on Windows 11"
    private String ipAddress;  // "192.168.0.1"
    private String location;   // "Suwon, KR" (IP로 조회)
    private String deviceId;   // 기기 고유 아이디
    
    private LocalDateTime lastAccessedAt; // 마지막 활동 시간
    private LocalDateTime createdAt;      // 최초 로그인 시간
    private Boolean keepLogin;             // 로그인 유지 여부 (true=지속적, false=브라우저 닫으면 종료)
}