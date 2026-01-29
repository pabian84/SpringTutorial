package com.example.demo.handler;

import java.net.URI;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import com.example.demo.domain.user.service.UserService;

import lombok.extern.slf4j.Slf4j;

@Slf4j
@Component
public class UserConnectionHandler extends TextWebSocketHandler {

    private final UserService userService;
    private final DashboardHandler dashboardHandler; // 모니터링 핸들러
    
    // 유저 ID별로 열려있는 세션들을 관리 (멀티 탭 지원)
    // Map<UserId, Set<Session>>
    private final Map<String, Set<WebSocketSession>> userSessionsMap = new ConcurrentHashMap<>();

    public UserConnectionHandler(UserService userService, DashboardHandler systemStatusHandler) {
        this.userService = userService;
        this.dashboardHandler = systemStatusHandler;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        String userId = getUserIdFromSession(session);
        System.out.println("userId 연결 시도: " + userId);
        if (userId != null) {
            // 1. 해당 유저의 세션 목록에 추가
            userSessionsMap.computeIfAbsent(userId, k -> ConcurrentHashMap.newKeySet()).add(session);
            
            // 2. DB에 '온라인' 도장 쾅!
            userService.updateUserStatus(userId, true);
            log.info("접속 감지(Online): {}", userId);

            // [호출] 유저 수 변동 방송해라!
            dashboardHandler.broadcastUserUpdate();
        } else {
            try { session.close(); } catch (Exception e) {}
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String userId = getUserIdFromSession(session);
        
        if (userId != null) {
            Set<WebSocketSession> sessions = userSessionsMap.get(userId);
            if (sessions != null) {
                sessions.remove(session); // 목록에서 제거

                // [핵심 로직] 더 이상 열린 탭(세션)이 하나도 없을 때만 '오프라인' 처리
                if (sessions.isEmpty()) {
                    userSessionsMap.remove(userId); // 맵에서 삭제
                    userService.updateUserStatus(userId, false);
                    log.info("접속 종료(Offline): {}", userId);

                    // [호출] 유저 수 변동 방송해라!
                    dashboardHandler.broadcastUserUpdate();
                } else {
                    log.info("탭 닫힘(여전히 접속중): {}, 남은 세션 수: {}", userId, sessions.size());
                }
            }
        }
    }

    // [1] 특정 기기 하나만 로그아웃
    public void forceDisconnectOne(String userId, Long targetSessionId) {
        Set<WebSocketSession> sessions = userSessionsMap.get(userId);
        if (sessions == null) return;

        for (WebSocketSession session : sessions) {
            Long sId = (Long) session.getAttributes().get("sessionId");
            // 세션 ID가 일치하는 놈만 연결 끊기
            if (sId != null && sId.equals(targetSessionId)) {
                try {
                    log.warn("특정 기기 세션 종료: User={}, Session={}", userId, targetSessionId);
                    session.close(new CloseStatus(4001, "Force Logout by Admin"));
                } catch (Exception e) {
                    log.error("소켓 강제 종료 중 에러", e);
                }
            }
        }
    }

    // [2] 나 빼고 나머지 다 로그아웃
    public void forceDisconnectOthers(String userId, Long mySessionId) {
        Set<WebSocketSession> sessions = userSessionsMap.get(userId);
        if (sessions == null) return;

        for (WebSocketSession session : sessions) {
            Long sId = (Long) session.getAttributes().get("sessionId");
            // 내 세션 ID가 아니면 다 끊어!
            if (sId != null && !sId.equals(mySessionId)) {
                try {
                    log.warn("다른 기기 강제 추방: User={}, Session={}", userId, sId);
                    session.close(new CloseStatus(4001, "Force Logout Others"));
                } catch (Exception e) {
                    log.error("소켓 강제 종료 중 에러", e);
                }
            }
        }
    }
    
    // [3] 전부 다 로그아웃
    public void forceDisconnectAll(String userId) {
        Set<WebSocketSession> sessions = userSessionsMap.get(userId);
        if (sessions != null) {
            for (WebSocketSession session : sessions) {
                try {
                    session.close(new CloseStatus(4001, "Force Logout All"));
                } catch (Exception e) {
                    log.error("소켓 강제 종료 중 에러", e);
                }
            }
        }
    }

    // URL 파싱 (?userId=xxx)
    private String getUserIdFromSession(WebSocketSession session) {
        try {
            URI uri = session.getUri();
            if (uri != null && uri.getQuery() != null) {
                String query = uri.getQuery();
                for (String param : query.split("&")) {
                    String[] pair = param.split("=");
                    if (pair.length == 2 && "userId".equals(pair[0])) {
                        return pair[1];
                    }
                }
            }
        } catch (Exception e) {
            log.error("ID 파싱 실패", e);
        }
        return null;
    }
}