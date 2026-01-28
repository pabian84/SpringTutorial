package com.example.demo.scheduler;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.example.demo.domain.user.mapper.SessionMapper;
import com.example.demo.handler.DashboardHandler;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Component
@RequiredArgsConstructor
public class SystemStatusScheduler {

    private final DashboardHandler dashboardHandler;
    private final SessionMapper sessionMapper;

    // 0.5초마다 방송 버튼 누름
    @Scheduled(fixedRate = 500)
    public void sendSystemStatus() {
        dashboardHandler.broadcastSystemStats();
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