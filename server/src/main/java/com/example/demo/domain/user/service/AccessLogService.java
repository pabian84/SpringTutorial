package com.example.demo.domain.user.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.demo.domain.user.entity.AccessLog;
import com.example.demo.domain.user.mapper.UserMapper;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class AccessLogService {

    private final UserMapper userMapper;

    // 비즈니스 로직과 상관없이 로그는 무조건 남아야 하므로 트랜잭션 분리(REQUIRES_NEW) 고려 가능
    // 여기서는 일단 기본 트랜잭션 참여
    @Transactional
    public void saveLog(String userId, Long sessionId, String type, String ipAddress, String location, String userAgent, String endpoint) {
        
        if (location == null || location == "") {
            location = "Unknown";
        }
        // 1. UserAgent 파싱 로직 중앙화 (여기서만 고치면 됨)
        String browser = "Unknown";
        String os = "Unknown";
        
        if (userAgent != null) {
            if (userAgent.contains("Chrome")) browser = "Chrome";
            else if (userAgent.contains("Firefox")) browser = "Firefox";
            else if (userAgent.contains("Safari")) browser = "Safari";
            else if (userAgent.contains("Edg")) browser = "Edge";
            
            if (userAgent.contains("Windows")) os = "Windows";
            else if (userAgent.contains("Mac")) os = "Mac";
            else if (userAgent.contains("Linux")) os = "Linux";
            else if (userAgent.contains("Android")) os = "Android";
            else if (userAgent.contains("iPhone")) os = "iOS";
        }

        // 2. 로그 객체 생성
        AccessLog log = AccessLog.builder()
                .userId(userId)
                .sessionId(sessionId)
                .type(type)
                .ipAddress(ipAddress)
                .userAgent(userAgent)
                .browser(browser) // 파싱된 정보
                .os(os)           // 파싱된 정보
                .location(location) // 추후 GeoIP 연동 위치
                .endpoint(endpoint)
                .build();

        // 3. 저장
        userMapper.saveLog(log);
    }
}