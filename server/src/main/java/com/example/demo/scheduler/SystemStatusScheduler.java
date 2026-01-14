package com.example.demo.scheduler;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.example.demo.handler.DashboardHandler;

import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class SystemStatusScheduler {

    private final DashboardHandler dashboardHandler;

    // 5초마다 방송 버튼 누름
    @Scheduled(fixedRate = 500)
    public void sendSystemStatus() {
        dashboardHandler.broadcastSystemStats();
    }
}