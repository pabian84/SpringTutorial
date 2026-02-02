package com.example.demo.scheduler;

import java.util.Map;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.example.demo.domain.stats.service.SystemStatusService;
import com.example.demo.domain.user.mapper.SessionMapper;
import com.example.demo.handler.WebSocketHandler;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Component
@RequiredArgsConstructor
public class SystemStatusScheduler {

    private final SessionMapper sessionMapper;

    private final WebSocketHandler webSocketHandler;
    private final SystemStatusService systemStatusService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    // 0.5초마다 방송 버튼 누름
    @Scheduled(fixedRate = 500)
    public void sendSystemStatus() {
        try {
            // 1. Service에서 데이터 가져오기 (Logic)
            Map<String, Object> stats = systemStatusService.getCurrentSystemStatus();
            
            // 2. Handler로 방송하기 (View/Routing)
            webSocketHandler.broadcast(objectMapper.writeValueAsString(stats));
        } catch (Exception e) {
            log.error("시스템 상태 방송 실패", e);
        }
    }

    // 매일 새벽 4시에 실행
    @Scheduled(cron = "0 0 4 * * *")
    public void cleanupExpiredSessions() {
        log.info("만료된 세션 정리 시작...");
        // 7일 동안 접속 안 한 기기는 로그인 풀림 처리 (DB 삭제)
        sessionMapper.deleteExpiredSessions(7);
        log.info("만료된 세션 정리 완료.");
    }
}