package com.example.demo.scheduler;

import java.lang.management.ManagementFactory;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.example.demo.handler.DashboardHandler;
import com.sun.management.OperatingSystemMXBean; // [중요] CPU 정보를 위해 필요

import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class SystemStatusScheduler {

    private final DashboardHandler systemStatusHandler;

    // 5초마다 방송 버튼 누름
    @Scheduled(fixedRate = 5000)
    public void sendSystemStatus() {
        systemStatusHandler.broadcastSystemStats();
    }
}