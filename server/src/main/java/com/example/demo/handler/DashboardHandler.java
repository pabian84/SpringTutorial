package com.example.demo.handler;

import java.io.IOException;
import java.lang.management.ManagementFactory;
import java.util.Arrays;
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
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.management.OperatingSystemMXBean; // [중요] CPU 정보를 위해 필요

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import oshi.SystemInfo;
import oshi.hardware.CentralProcessor;

@Slf4j
@Component
@RequiredArgsConstructor
public class DashboardHandler extends TextWebSocketHandler {
    // 현재 접속한 사람들의 목록 (동시 접속 처리용 안전한 Set 사용)
    private static final Set<WebSocketSession> sessions = ConcurrentHashMap.newKeySet();
    private final UserMapper userMapper;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final OperatingSystemMXBean osBean = (OperatingSystemMXBean) ManagementFactory.getOperatingSystemMXBean();
    private final SystemInfo si = new SystemInfo();
    private final CentralProcessor processor = si.getHardware().getProcessor();

    private final double GB = 1024 * 1024 * 1024; // 1GB

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
                synchronized (session) { // 세션별 동기화
                    try {
                        session.sendMessage(new TextMessage(message));
                    } catch (IOException e) {
                        // 전송 실패 시 무시
                    }
                }
            }
        }
    }

    // [Type 1] 시스템 상태 방송 (스케줄러가 호출)
    public void broadcastSystemStats() {
        if (sessions.isEmpty()) return; // 듣는 사람 없으면 방송 안 함 (효율)

        try {
            // 1. CPU 사용량 (0.0 ~ 1.0 -> 0 ~ 100%)
            double cpuLoad = osBean.getCpuLoad() * 100; 
            if (Double.isNaN(cpuLoad)) cpuLoad = 0.0; // NaN 방지
            
            // 최고 클럭 (단위: Hz -> GHz 변환)
            //long maxFreq = processor.getMaxFreq();
            // 현재 클럭
            long[] currentFreqs = processor.getCurrentFreq();
            // 모든 코어의 클럭을 합산하여 평균을 구합니다.
            // OptionalDouble을 반환하므로 orElse(0.0)로 기본값을 설정합니다.
            double averageFreqHz = Arrays.stream(currentFreqs)
                                        .average()
                                        .orElse(0.0);
            // 보기 좋게 GHz 단위로 변환
            double cpu = averageFreqHz / GB;

            // 2. 메모리 사용량 (전체 - 여유 = 사용중)
            long totalMem = osBean.getTotalMemorySize();
            long freeMem = osBean.getFreeMemorySize();
            long usedMem = totalMem - freeMem;
            double memoryPercent = (double) (usedMem * 100) / totalMem;
            // 보기 좋게 GB 단위로 변환
            double usedMemGB = (double) usedMem / GB;

            // 3. 데이터 포장
            Map<String, Object> data = new HashMap<>();
            data.put("type", "SYSTEM_STATUS"); // 타입 명시
            // 프론트엔드와 포맷 맞춤 (문자열로 보내서 소수점 제어)
            data.put("cpu", Double.valueOf(String.format("%.2f", cpu))); 
            data.put("cpuPercent", Double.valueOf(String.format("%.2f", cpuLoad))); 
            data.put("memory", Double.valueOf(String.format("%.2f", usedMemGB)));
            data.put("memoryPercent", Double.valueOf(String.format("%.2f", memoryPercent)));
            // 시간은 프론트엔드에서 현재 시간 기준으로 처리하는 게 더 자연스러울 수 있으나,
            // 싱크를 위해 서버 시간을 보내줍니다. (형식: 시:분:초)
            data.put("time", java.time.LocalTime.now().format(java.time.format.DateTimeFormatter.ofPattern("HH:mm:ss")));

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

    // 공통 전송 메서드 (동시성 제어 추가)
    private void sendMessage(Map<String, Object> data) throws IOException {
        try {
            String payload = objectMapper.writeValueAsString(data);
            if (payload == null) {
                log.error("메시지 변환 실패: null payload");
                return;
            }
            TextMessage message = new TextMessage(payload);

            for (WebSocketSession session : sessions) {
                // 이미 닫힌 세션은 시도조차 하지 않음
                if (!session.isOpen()) {
                    continue; 
                }

                // [핵심 해결] 해당 세션에 대한 쓰기 작업을 동기화(Lock)합니다.
                // 스케줄러와 유저 접속 핸들러가 동시에 메시지를 보내려 해도,
                // 여기서 줄을 서서 순서대로 보내게 되므로 충돌이 발생하지 않습니다.
                synchronized (session) { // 세션별 동기화
                    try {
                        session.sendMessage(message);
                    } catch (IOException e) {
                        // [핵심] 개별 전송 실패 시, 전체 에러를 터뜨리지 않고 조용히 넘어감
                        // 여기서 잡히기 때문에 "현재 연결은 사용자의..." 에러가 콘솔에 뜨지 않습니다.
                        log.debug("메시지 전송 실패 (클라이언트 연결 종료됨): {}", session.getId());
                    }
                }
            }
        } catch (JsonProcessingException e) {
            log.error("메시지 변환 중 오류", e);
        }
    }
}