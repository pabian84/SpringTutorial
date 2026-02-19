package com.example.demo.domain.user.service;

import java.util.ArrayList;
import java.util.List;

import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.demo.domain.user.dto.LoginReq;
import com.example.demo.domain.user.dto.LoginRes;
import com.example.demo.domain.user.dto.UserRes;
import com.example.demo.domain.user.entity.AccessLog;
import com.example.demo.domain.user.entity.Session;
import com.example.demo.domain.user.entity.User;
import com.example.demo.domain.user.event.NewDeviceLoginEvent;
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
public class UserService {
    private final UserMapper userMapper;
    private final SessionMapper sessionMapper;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final AccessLogService accessLogService;
    private final ApplicationEventPublisher eventPublisher;

    @Transactional
    @CacheEvict(value = "online_users", allEntries = true) // [캐시 무효화] 접속자 목록 캐시 삭제
    public LoginRes login(LoginReq loginReq, String userAgent, String ipAddress) {
        // 1. 유저 검증
        User user = userMapper.findById(loginReq.getId());
        if (user == null) {
            throw new CustomException(ErrorCode.USER_NOT_FOUND); // Controller가 잡아서 401로 처리
        }
        if (!passwordEncoder.matches(loginReq.getPassword(), user.getPassword())) {
            throw new CustomException(ErrorCode.INVALID_PASSWORD); // 비밀번호 틀림
        }

        // 2. 토큰 생성
        String refreshToken = jwtTokenProvider.createRefreshToken(user.getId());

        // 3. 중복 로그인 방지 & 세션 저장
        // 세션 insert 직전에 실행
        // "이 유저의 세션이 5개를 넘어가면, 제일 오래된 거 하나 지워라"
        List<Session> sessions = sessionMapper.findByUserId(user.getId());
        
        // [새 기기 로그인 알림] 기존 세션이 있으면 알림 전송
        boolean hasExistingSessions = !sessions.isEmpty();
        log.info("[로그인] userId={}, 기존 세션 수={}, 알림 전송 여부={}", user.getId(), sessions.size(), hasExistingSessions);
        
        if (sessions.size() >= 5) {
            // lastAccessedAt으로 정렬되어 있다고 가정할 때, 가장 뒤(오래된) 세션 삭제
            // 혹은 DB 쿼리로 "DELETE ... ORDER BY last_accessed_at ASC LIMIT 1" 실행
            Session oldest = sessions.get(sessions.size() - 1);
            sessionMapper.deleteBySessionId(oldest.getId());
        }

        // 로그인 성공 시 세션 정보 DB에 저장
        Session session = Session.builder()
            .userId(user.getId()) // User 객체 대신 ID String 사용
            .refreshToken(refreshToken)
            .deviceType(detectDeviceType(userAgent))
            .userAgent(userAgent)
            .ipAddress(ipAddress)
            .location("Unknown")
            .keepLogin(loginReq.isRememberMe())
            .build(); // createdAt 등은 DB에서 NOW()로 처리하거나 여기서 넣거나
        sessionMapper.insertSession(session);

        // [확인용 로그]
        if (session.getId() == null) {
            log.error("CRITICAL: Session ID was NOT generated!");
            throw new CustomException(ErrorCode.INTERNAL_SERVER_ERROR);
        }
        
        // 생성된 session.getId()를 가지고 Access Token 생성 (세션 바인딩)
        // JwtTokenProvider에 createAccessToken(userId, sessionId) 메서드가 있어야 함
        String accessToken = jwtTokenProvider.createAccessToken(user.getId(), session.getId());

        // 로그 및 상태 업데이트
        userMapper.updateStatus(user.getId(), true);
        // 로그 저장
        accessLogService.saveLog(user.getId(), session.getId(), SecurityConstants.TYPE_LOGIN, ipAddress, null, userAgent, "/api/user/login");

        // [새 기기 로그인 알림] 기존 기기에 WebSocket으로 알림 전송
        if (hasExistingSessions) {
            notifyNewDeviceLogin(user.getId(), session.getId(), detectDeviceType(userAgent), ipAddress);
        }

        // 5. 결과 반환 (쿠키 설정은 컨트롤러에게 위임)
        return LoginRes.builder()
                .accessToken(accessToken)
                .user(user)
                .build();
    }

    // 로그아웃 처리 (특정 기기)
    @Transactional
    @CacheEvict(value = "online_users", allEntries = true) // [캐시 무효화] 접속자 목록 캐시 삭제
    public void logout(String userId, Long sessionId, String userAgent, String ipAddress) {
        // 1. DB에서 바로 삭제
        if (sessionId != null) {
            sessionMapper.deleteBySessionId(sessionId); // user_sessions에서 삭제
        }
        // 2. 로그 기록
        accessLogService.saveLog(userId, sessionId, SecurityConstants.TYPE_LOGOUT, ipAddress, null, userAgent, "/api/user/logout");
    }
    
    // 로그아웃 처리 (전체 기기 - 토큰 없이)
    @Transactional
    @CacheEvict(value = "online_users", allEntries = true)
    public void logoutAll(String userId, String userAgent, String ipAddress) {
        // 1. 사용자의 모든 세션 삭제
        List<Session> sessions = sessionMapper.findByUserId(userId);
        for (Session session : sessions) {
            sessionMapper.deleteBySessionId(session.getId());
            accessLogService.saveLog(userId, session.getId(), SecurityConstants.TYPE_LOGOUT, ipAddress, null, userAgent, "/api/user/logout");
        }
        // 2. 상태 업데이트 (오프라인으로)
        userMapper.updateStatus(userId, false);
    }

    // 반환 타입이 List<User> -> List<UserRes>로 변경
    @Cacheable(value = "users") // [캐시 적용] 전체 유저 목록은 10분 동안 DB 조회 없이 캐시된 값 반환
    public List<UserRes> getUserList() {
        // 1. 창고에서 원본(User)을 다 꺼내옴
        List<User> userEntities = userMapper.findAll();
        
        // 2. 포장된 박스(UserRes)들을 담을 리스트 준비
        List<UserRes> result = new ArrayList<>();

        // 3. 하나씩 꺼내서 안전한 상자에 옮겨 담기 (비밀번호 제외)
        for (User user : userEntities) {
            result.add(new UserRes(user.getId(), user.getName(), user.getRole()));
        }

        // 4. 포장된 것들만 반환
        return result;
    }

    // 상태 업데이트용 메서드 (Controller에서 부를 예정)
    @CacheEvict(value = "online_users", allEntries = true)
    public void updateUserStatus(String id, boolean isOnline) {
        userMapper.updateStatus(id, isOnline);
    }

    public List<AccessLog> getLogs(String userId) {
        return userMapper.findLogs(userId);
    }

    // 간단한 기기 판별 메서드 (UserService 내부에 추가)
    private String detectDeviceType(String userAgent) {
        if (userAgent.contains("Mobile")) return "mobile";
        if (userAgent.contains("Tablet")) return "tablet";
        return "desktop";
    }

    /**
     * 새 기기 로그인 알림 전송 (이벤트 발행)
     * 순환 참조 방지를 위해 이벤트 기반으로 처리
     */
    private void notifyNewDeviceLogin(String userId, Long newSessionId, String deviceType, String ipAddress) {
        eventPublisher.publishEvent(new NewDeviceLoginEvent(this, userId, newSessionId, deviceType, ipAddress));
        log.info("[새 기기 로그인 이벤트 발행] userId={}, device={}", userId, deviceType);
    }
}