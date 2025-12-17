package com.example.demo.scheduler;

import com.example.demo.handler.SystemStatusHandler;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.lang.management.ManagementFactory;
import com.sun.management.OperatingSystemMXBean; // [중요] CPU 정보를 위해 필요

@Component
public class SystemStatusScheduler {

    private final SystemStatusHandler systemStatusHandler;
    private final OperatingSystemMXBean osBean;

    public SystemStatusScheduler(SystemStatusHandler systemStatusHandler) {
        this.systemStatusHandler = systemStatusHandler;
        // 운영체제 정보를 가져오는 도구 초기화
        this.osBean = (OperatingSystemMXBean) ManagementFactory.getOperatingSystemMXBean();
    }

    // 1초(1000ms)마다 실행
    @Scheduled(fixedRate = 1000)
    public void sendSystemStatus() {
        // 1. CPU 사용량 (0.0 ~ 1.0 -> 0 ~ 100%)
        double cpuLoad = osBean.getCpuLoad() * 100; 
        
        // 2. 메모리 사용량 (전체 - 여유 = 사용중)
        long totalMem = osBean.getTotalMemorySize();
        long freeMem = osBean.getFreeMemorySize();
        long usedMem = totalMem - freeMem;
        
        // 보기 좋게 GB 단위로 변환
        double usedMemGB = (double) usedMem / (1024 * 1024 * 1024);

        // 3. JSON 문자열로 만들기 (간단하게 수동 생성)
        // 예: {"type": "STATUS", "cpu": 12.5, "memory": 4.2}
        String message = String.format(
            "{\"type\": \"STATUS\", \"cpu\": %.2f, \"memory\": %.2f}", 
            cpuLoad, usedMemGB
        );

        // 4. 접속한 모든 사람에게 전송
        systemStatusHandler.broadcast(message);
        
        // (확인용 로그 - 나중엔 지워도 됨)
        // System.out.println("전송됨: " + message);
    }
}