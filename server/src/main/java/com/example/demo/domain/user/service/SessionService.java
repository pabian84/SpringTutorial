package com.example.demo.domain.user.service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;

import com.example.demo.domain.user.dto.UserRes;
import com.example.demo.domain.user.entity.Session;
import com.example.demo.domain.user.mapper.SessionMapper;
import com.example.demo.domain.user.mapper.UserMapper;
import com.example.demo.global.constant.SecurityConstants;
import com.example.demo.global.exception.CustomException;
import com.example.demo.global.exception.ErrorCode;
import com.example.demo.global.security.JwtTokenProvider;
import com.example.demo.global.util.CookieUtil;
import com.example.demo.handler.WebSocketHandler;
import com.fasterxml.jackson.core.JsonProcessingException;

import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
public class SessionService {

    private final SessionMapper sessionMapper;
    private final UserMapper userMapper; // Online List 조회용
    private final UserService userService;
    private final AccessLogService accessLogService;
    private final WebSocketHandler webSocketHandler;

    private final Map<String, Set<WebSocketSession>> webSocketSessionsMap = new ConcurrentHashMap<>();

    
    public SessionService(SessionMapper sessionMapper, UserMapper userMapper, UserService userService,
            JwtTokenProvider jwtTokenProvider, AccessLogService accessLogService, @Lazy WebSocketHandler webSocketHandler) {
        this.sessionMapper = sessionMapper;
        this.userMapper = userMapper;
        this.userService = userService;
        this.accessLogService = accessLogService;
        this.webSocketHandler = webSocketHandler;
    }

    // NOTE: refreshToken 쿠키 제거로 refresh() 메서드 제거
    // accessToken 만료 시 재로그인 필요

    /**
     * 내 기기 목록 조회
     */
    public List<Map<String, Object>> getMySessions(String userId, Long sessionId) {
        List<Session> sessions = sessionMapper.findByUserId(userId);

        // 보안상 토큰은 빼고 리턴
        return sessions.stream().map(s -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", s.getId());
            map.put("deviceType", s.getDeviceType() != null ? s.getDeviceType() : "Unknown");
            map.put("userAgent", s.getUserAgent());
            map.put("ipAddress", s.getIpAddress());
            map.put("location", s.getLocation() != null ? s.getLocation() : "Unknown");
            map.put("lastActive", s.getLastAccessedAt());
            map.put("isCurrent", s.getId().equals(sessionId));
            return map;
        }).collect(Collectors.toList());
    }

    /**
     * 특정 세션 삭제 (Kick / Logout)
     */
    @Transactional
    @CacheEvict(value = "online_users", allEntries = true) // [캐시 무효화] 접속자 목록 캐시 삭제
    public void deleteSession(Long targetSessionId, Long currentSessionId) {
        // 세션 조회
        Session targetSession = sessionMapper.findBySessionId(targetSessionId);
        // 권한 검사 (비즈니스 로직)
        if (targetSession == null) {
            throw new CustomException(ErrorCode.SESSION_NOT_FOUND);
        }
        String currentUserId = sessionMapper.findBySessionId(currentSessionId).getUserId();
        // 내 기기가 아닌 것을 삭제하려 함 (Forbidden)
        if (!targetSession.getUserId().equals(currentUserId)) {
            throw new CustomException(ErrorCode.NOT_MY_DEVICE);
        }
        //DB 삭제
        sessionMapper.deleteBySessionId(targetSessionId);
        log.warn("delete " + currentUserId + ", targetSessionId: " + targetSessionId);
        // 로그 기록 (약식)
        accessLogService.saveLog(currentUserId, currentSessionId, SecurityConstants.TYPE_KICK, null, null, null, null);
    }

    /**
     * 나를 제외한 다른 기기 로그아웃
     */
    @Transactional
    @CacheEvict(value = "online_users", allEntries = true) // [캐시 무효화] 접속자 목록 캐시 삭제
    public void deleteOtherSessions(String userId, Long currentSessionId) {
        sessionMapper.terminateOthers(userId, currentSessionId);
        // 로그 기록 (약식)
        accessLogService.saveLog(userId, currentSessionId, SecurityConstants.TYPE_KICK, null, null, null, "ALL_OTHERS");
    }

    /**
     * 모든 기기 로그아웃
     */
    @Transactional
    @CacheEvict(value = "online_users", allEntries = true) // [캐시 무효화] 접속자 목록 캐시 삭제
    public void deleteAllSessions(String userId, Long currentSessionId) {
        sessionMapper.deleteByUserId(userId);
        // 로그 기록 (약식)
        accessLogService.saveLog(userId, currentSessionId, SecurityConstants.TYPE_KICK, null, null, null, "ALL_DEVICES");
    }


    /**
     * 현재 접속 중인 사용자 목록 (Online List)
     */
    @Cacheable(value = "online_users") // [캐시 적용] 접속자 목록은 1분 동안 DB 조회 없이 캐시된 값 반환
    public List<UserRes> getOnlineUsers() {
        return userMapper.findOnlineUsers().stream()
                .map(u -> new UserRes(u.getId(), u.getName(), u.getRole()))
                .toList();
    }

    public void addSession(String userId, WebSocketSession session) throws JsonProcessingException {
        // 해당 유저의 세션 목록에 추가
        webSocketSessionsMap.computeIfAbsent(userId, k -> ConcurrentHashMap.newKeySet()).add(session);
        // DB Online 처리
        userService.updateUserStatus(userId, true);

        Map<String, Object> data = new HashMap<>();
        data.put("type", "USER_UPDATE"); // 타입 명시
        data.put("onlineUserCount", webSocketSessionsMap.size());

        webSocketHandler.broadcast(data);
    }

    public void removeWebSocket(WebSocketSession session) throws JsonProcessingException {
        log.warn("removeWebSocket 1");
        String userId = getUserIdFromWebSocketSession(session);
        if (userId != null) {
            log.warn("removeWebSocket 2");
            Set<WebSocketSession> webSocketSessions = webSocketSessionsMap.get(userId);
            if (webSocketSessions != null) {
                log.warn("removeWebSocket 3");
                // 목록에서 제거
                webSocketSessions.remove(session);
                // 더 이상 남은 웹소켓이 없으면 오프라인 처리
                if (webSocketSessions.isEmpty()) {
                    log.warn("removeWebSocket 4");
                    webSocketSessionsMap.remove(userId);
                    userService.updateUserStatus(userId, false); // DB Offline 처리

                    Map<String, Object> data = new HashMap<>();
                    data.put("type", "USER_UPDATE"); // 타입 명시
                    data.put("onlineUserCount", webSocketSessionsMap.size());

                    webSocketHandler.broadcast(data);
                } else {
                    log.warn("removeWebSocket 5");
                }
            }
        }
    }

    // [1] 특정 기기 하나만 로그아웃
    public void forceDisconnectWebSocket(String userId, Long targetSessionId) {
        Set<WebSocketSession> webSocketSessions = webSocketSessionsMap.get(userId);
        if (webSocketSessions == null) return;

        for (WebSocketSession webSocket : webSocketSessions) {
            Long sId = (Long) webSocket.getAttributes().get("sessionId");
            // 세션 ID가 일치하는 놈만 연결 끊기
            if (sId != null && sId.equals(targetSessionId)) {
                try {
                    log.warn("특정 기기 웹소켓 종료: UserId={}, SessionId={}", userId, targetSessionId);
                    webSocket.close(new CloseStatus(4001, "Force Logout by Admin"));
                } catch (Exception e) {
                    log.error("소켓 강제 종료 중 에러", e);
                }
            }
        }
    }

    /**
     * 특정 sessionId로 WebSocket 강제 종료
     * (sessionId 기반으로 정확한 세션만 끊음)
     */
    public void forceDisconnectWebSocket(Long sessionId) {
        // 현재 접속 중인 모든 세션에서 해당 sessionId 찾기
        for (Map.Entry<String, Set<WebSocketSession>> entry : webSocketSessionsMap.entrySet()) {
            String userId = entry.getKey();
            Set<WebSocketSession> webSocketSessions = entry.getValue();
            
            for (WebSocketSession webSocket : webSocketSessions) {
                Long sId = (Long) webSocket.getAttributes().get("sessionId");
                if (sId != null && sId.equals(sessionId)) {
                    try {
                        log.info("WebSocket 강제 종료: UserId={}, SessionId={}", userId, sessionId);
                        webSocket.close(new CloseStatus(4001, "Logout"));
                    } catch (Exception e) {
                        log.error("WebSocket 종료 중 에러", e);
                    }
                    return; // 하나 찾으면 종료
                }
            }
        }
        log.debug("WebSocket 세션 찾기 실패: sessionId={}", sessionId);
    }

    // [2] 나 빼고 나머지 다 로그아웃
    public void forceDisconnectOthers(String userId, Long mySessionId) {
        Set<WebSocketSession> webSocketSessions = webSocketSessionsMap.get(userId);
        if (webSocketSessions == null) return;

        for (WebSocketSession webSocket : webSocketSessions) {
            Long sId = (Long) webSocket.getAttributes().get("sessionId");
            // 내 세션 ID가 아니면 끊기
            if (sId != null && !sId.equals(mySessionId)) {
                try {
                    log.warn("다른 기기 강제 추방: UserId={}, SessionId={}", userId, sId);
                    webSocket.close(new CloseStatus(4001, "Force Logout Others"));
                } catch (Exception e) {
                    log.error("소켓 강제 종료 중 에러", e);
                }
            }
        }
    }
    
    // [3] 전부 다 로그아웃
    public void forceDisconnectAll(String userId) {
        Set<WebSocketSession> webSocketSessions = webSocketSessionsMap.get(userId);
        if (webSocketSessions != null) {
            for (WebSocketSession webSocket : webSocketSessions) {
                try {
                    webSocket.close(new CloseStatus(4001, "Force Logout All"));
                } catch (Exception e) {
                    log.error("소켓 강제 종료 중 에러", e);
                }
            }
        }
    }

    // HTTP attributes 또는 URL 파라미터에서 userId 추출 (공용 CookieUtil.getUserIdFromSession 사용)
    private String getUserIdFromWebSocketSession(WebSocketSession session) {
        return CookieUtil.getUserIdFromSession(session);
    }
}