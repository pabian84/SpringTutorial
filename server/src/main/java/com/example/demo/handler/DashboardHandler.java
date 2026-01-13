package com.example.demo.handler;

import java.io.IOException;
import java.lang.management.ManagementFactory;
import java.lang.management.MemoryMXBean;
import java.lang.management.OperatingSystemMXBean;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import com.example.demo.domain.user.mapper.UserMapper;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Component
@RequiredArgsConstructor
public class DashboardHandler extends TextWebSocketHandler {

    // 현재 접속한 사람들의 목록 (동시 접속 처리용 안전한 Set 사용)
    private static final Set<WebSocketSession> sessions = ConcurrentHashMap.newKeySet();
    private final UserMapper userMapper;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        // 누군가 접속하면 명단에 추가
        sessions.add(session);
        System.out.println("새로운 모니터링 접속자: " + session.getId());
        // 접속하자마자 최신 상태 한번씩 쏴줌
        broadcastSystemStats(); // CPU, RAM
        broadcastUserUpdate();  // 접속자 수
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        // 나가면 명단에서 제거
        sessions.remove(session);
        System.out.println("모니터링 접속 해제: " + session.getId());
    }

    // 모든 사람에게 메시지(JSON)를 쏘는 기능
    public void broadcast(String message) {
        for (WebSocketSession session : sessions) {
            if (session.isOpen()) {
                try {
                    session.sendMessage(new TextMessage(message));
                } catch (IOException e) {
                    // 전송 실패 시 무시
                }
            }
        }
    }

    // [Type 1] 시스템 상태 방송 (스케줄러가 호출)
    public void broadcastSystemStats() {
        if (sessions.isEmpty()) return; // 듣는 사람 없으면 방송 안 함 (효율)

        try {
            // 1. 시스템 정보 수집 (CPU, Memory)
            OperatingSystemMXBean osBean = ManagementFactory.getOperatingSystemMXBean();
            MemoryMXBean memoryBean = ManagementFactory.getMemoryMXBean();

            double cpuLoad = 0.0;
            // com.sun.management 패키지 호환성 체크
            if (osBean instanceof com.sun.management.OperatingSystemMXBean) {
                cpuLoad = ((com.sun.management.OperatingSystemMXBean) osBean).getCpuLoad() * 100;
            }

            long totalMemory = memoryBean.getHeapMemoryUsage().getMax();
            long usedMemory = memoryBean.getHeapMemoryUsage().getUsed();
            double memoryUsage = (double) usedMemory / totalMemory * 100;
            // [복구] 현재 시간 포맷팅
            String currentTime = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));

            // 2. 데이터 포장
            Map<String, Object> data = new HashMap<>();
            data.put("type", "SYSTEM_STATUS"); // 타입 명시
            data.put("cpuUsage", String.format("%.2f", cpuLoad));
            data.put("memoryUsage", String.format("%.2f", memoryUsage));
            data.put("time", currentTime);

             sendMessage(data);
        } catch (IOException e) {
            log.error("시스템 상태 방송 실패", e);
        }
    }

    // [Type 2] 유저 접속자 수 방송 (UserConnectionHandler가 호출)
    public void broadcastUserUpdate() {
        if (sessions.isEmpty()) return;

        try {
            int onlineUserCount = userMapper.findOnlineUsers().size();

            Map<String, Object> data = new HashMap<>();
            data.put("type", "USER_UPDATE"); // 타입 명시
            data.put("onlineUserCount", onlineUserCount);

            sendMessage(data);
        } catch (Exception e) {
            log.error("유저 상태 방송 실패", e);
        }
    }

    // 공통 전송 메서드
    private void sendMessage(Map<String, Object> data) throws IOException {
        String payload = objectMapper.writeValueAsString(data);
        TextMessage message = new TextMessage(payload);

        for (WebSocketSession session : sessions) {
            if (session.isOpen()) {
                session.sendMessage(message);
            }
        }
    }
}