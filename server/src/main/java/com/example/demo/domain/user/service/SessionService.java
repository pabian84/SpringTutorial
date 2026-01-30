package com.example.demo.domain.user.service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.demo.domain.user.dto.UserRes;
import com.example.demo.domain.user.entity.Session;
import com.example.demo.domain.user.mapper.SessionMapper;
import com.example.demo.domain.user.mapper.UserMapper;
import com.example.demo.global.constant.SecurityConstants;
import com.example.demo.global.exception.CustomException;
import com.example.demo.global.exception.ErrorCode;
import com.example.demo.global.security.JwtTokenProvider;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@RequiredArgsConstructor
public class SessionService {

    private final SessionMapper sessionMapper;
    private final UserMapper userMapper; // Online List 조회용
    private final JwtTokenProvider jwtTokenProvider;
    private final AccessLogService accessLogService;

    /**
     * 토큰 갱신 (Refresh)
     */
    @Transactional
    public Map<String, Object> refresh(String refreshToken) {
        log.warn("리프레시 토큰으로 액세스 토큰 재발급 시도: {}", refreshToken);

        // 1. 토큰 유효성 검사 (서명 위조 등)
        if (!jwtTokenProvider.validateToken(refreshToken)) {
            throw new CustomException(ErrorCode.INVALID_TOKEN);
        }

        // 2. DB(user_sessions)에 해당 토큰이 살아있는지 확인!
        // 화면에서 '로그아웃' 버튼을 눌러 DB에서 삭제했다면, 여기서 null이 나와서 튕겨내야 합니다.
        Session session = sessionMapper.findByRefreshToken(refreshToken);
        if (session == null) {
            throw new CustomException(ErrorCode.EXPIRED_TOKEN); // 여기서 401/403 발생 -> 프론트가 튕겨냄
        }

        // "토큰으로는 찾았는데, ID로는 못 찾는" 황당한 경우를 방지합니다.
        // 필터가 findById로 검사하므로, 여기서도 똑같이 검사해서 없으면 죽여야 합니다.
        if (sessionMapper.findBySessionId(session.getId()) == null) {
            log.error("치명적 오류: 세션 불일치 감지 (토큰 O, ID X) - 강제 만료 처리. ID: {}", session.getId());
            // 여기서 예외를 던지면 axiosConfig가 401로 인식하고 로그인 페이지로 보냅니다.
            throw new CustomException(ErrorCode.SESSION_NOT_FOUND);
        }

        // 4. 새 액세스 토큰 발급
        String userId = session.getUserId();
        String newAccessToken = jwtTokenProvider.createAccessToken(userId, session.getId());

        Map<String, Object> result = new HashMap<>();
        result.put("status", "ok");
        result.put("accessToken", newAccessToken);

        log.info("새 액세스 토큰 발급 완료 for userId={}: {}", userId, newAccessToken);
        
        return result;
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
}