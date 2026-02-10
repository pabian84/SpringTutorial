package com.example.demo.domain.user.service;

import java.net.URI;
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

import com.example.demo.domain.user.dto.RefreshSessionRes;
import com.example.demo.domain.user.dto.UserRes;
import com.example.demo.domain.user.entity.Session;
import com.example.demo.domain.user.mapper.SessionMapper;
import com.example.demo.domain.user.mapper.UserMapper;
import com.example.demo.global.constant.SecurityConstants;
import com.example.demo.global.exception.CustomException;
import com.example.demo.global.exception.ErrorCode;
import com.example.demo.global.security.JwtTokenProvider;
import com.example.demo.handler.WebSocketHandler;
import com.fasterxml.jackson.core.JsonProcessingException;

import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
public class SessionService {

    private final SessionMapper sessionMapper;
    private final UserMapper userMapper; // Online List 조회용
    private final UserService userService;
    private final JwtTokenProvider jwtTokenProvider;
    private final AccessLogService accessLogService;
    private final WebSocketHandler webSocketHandler;

    private final Map<String, Set<WebSocketSession>> webSocketSessionsMap = new ConcurrentHashMap<>();

    
    public SessionService(SessionMapper sessionMapper, UserMapper userMapper, UserService userService,
            JwtTokenProvider jwtTokenProvider, AccessLogService accessLogService, @Lazy WebSocketHandler webSocketHandler) {
        this.sessionMapper = sessionMapper;
        this.userMapper = userMapper;
        this.userService = userService;
        this.jwtTokenProvider = jwtTokenProvider;
        this.accessLogService = accessLogService;
        this.webSocketHandler = webSocketHandler;
    }

    /**
     * 토큰 갱신 (Refresh Token Rotation)
     * 보안 강화를 위해 새 Refresh Token도 함께 발급합니다.
     */
    @Transactional
    public RefreshSessionRes refresh(String refreshToken) {
        log.warn("리프레시 토큰으로 액세스 토큰 재발급 시도: {}", refreshToken);

        // 1. 토큰 유효성 검사 (서명 위조 등)
        if (!jwtTokenProvider.validateToken(refreshToken)) {
            throw new CustomException(ErrorCode.INVALID_TOKEN);
        }

        // 2. DB(user_sessions)에 해당 토큰이 살아있는지 확인!
        // 화면에서 '로그아웃' 버튼을 눌러 DB에서 삭제했다면, 여기서 null이 나와서 튕겨내야 합니다.
        Session session = sessionMapper.findByRefreshToken(refreshToken);
        if (session == null) {
            throw new CustomException(ErrorCode.EXPIRED_TOKEN);
        }

        // 3. 세션 ID 유효성 검사
        if (sessionMapper.findBySessionId(session.getId()) == null) {
            log.error("치명적 오류: 세션 불일치 감지 (토큰 O, ID X) - 강제 만료 처리. ID: {}", session.getId());
            throw new CustomException(ErrorCode.SESSION_NOT_FOUND);
        }

        String userId = session.getUserId();
        Long sessionId = session.getId();

        // 4. 새 Refresh Token 생성 (Rotation) - 보안 강화
        String newRefreshToken = jwtTokenProvider.createRefreshToken(userId);

        // 5. DB에 새 Refresh Token 업데이트
        sessionMapper.updateRefreshToken(sessionId, newRefreshToken);

        // 6. 새 Access Token 발급
        String newAccessToken = jwtTokenProvider.createAccessToken(userId, sessionId);

        RefreshSessionRes response = RefreshSessionRes.builder()
                    .accessToken(newAccessToken)
                    .refreshToken(newRefreshToken)
                    .build();
        log.info("토큰 갱신 완료 (Rotation 적용) for userId={}, sessionId={}", userId, sessionId);

        return response;
    }

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

    public void removeSession(WebSocketSession session) throws JsonProcessingException {
        log.warn("removeSession 1");
        String userId = getUserIdFromSession(session);
        if (userId != null) {
            log.warn("removeSession 2");
            Set<WebSocketSession> userSessions = webSocketSessionsMap.get(userId);
            if (userSessions != null) {
                log.warn("removeSession 3");
                // 목록에서 제거
                userSessions.remove(session);
                // 더 이상 남은 세션이 없으면 오프라인 처리
                if (userSessions.isEmpty()) {
                    log.warn("removeSession 4");
                    webSocketSessionsMap.remove(userId);
                    userService.updateUserStatus(userId, false); // DB Offline 처리

                    Map<String, Object> data = new HashMap<>();
                    data.put("type", "USER_UPDATE"); // 타입 명시
                    data.put("onlineUserCount", webSocketSessionsMap.size());

                    webSocketHandler.broadcast(data);
                } else {
                    log.warn("removeSession 5");
                }
            }
        }
    }

    // [1] 특정 기기 하나만 로그아웃
    public void forceDisconnectOne(String userId, Long targetSessionId) {
        Set<WebSocketSession> sessions = webSocketSessionsMap.get(userId);
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
        Set<WebSocketSession> sessions = webSocketSessionsMap.get(userId);
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
        Set<WebSocketSession> sessions = webSocketSessionsMap.get(userId);
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