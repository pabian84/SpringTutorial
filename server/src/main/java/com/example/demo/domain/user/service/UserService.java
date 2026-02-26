package com.example.demo.domain.user.service;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

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

    /**
     * 로그인 처리 (기기 식별 쿠키를 통한 세션 재사용 로직 포함)
     * @param loginReq 로그인 요청 정보
     * @param userAgent 브라우저 정보
     * @param ipAddress IP 주소
     * @param deviceId 쿠키로부터 전달받은 기기 식별자 (null 가능)
     * @return 로그인 결과 (새로운 deviceId 포함)
     */
    @Transactional
    @CacheEvict(value = "online_users", allEntries = true)
    public LoginRes login(LoginReq loginReq, String userAgent, String ipAddress, String deviceId) {
        // 1. 사용자 확인
        User user = userMapper.findById(loginReq.getId());
        if (user == null) {
            throw new CustomException(ErrorCode.USER_NOT_FOUND);
        }
        if (!passwordEncoder.matches(loginReq.getPassword(), user.getPassword())) {
            throw new CustomException(ErrorCode.INVALID_PASSWORD);
        }

        // 2. [핵심] 기존 세션 재사용 확인
        Session session = null;
        boolean isNewSession = true;
        String finalDeviceId = deviceId;
        // 토큰 생성 및 정보 업데이트
        String refreshToken = jwtTokenProvider.createRefreshToken(user.getId());

        if (finalDeviceId != null) {
            // 동일 유저 & 동일 기기 식별자로 기존 세션 조회
            session = sessionMapper.findByUserIdAndDeviceId(user.getId(), finalDeviceId);
            if (session != null) {
                log.info("[세션 재사용] 기존 세션을 발견했습니다. SessionID={}, DeviceID={}", session.getId(), finalDeviceId);
                isNewSession = false;
                // 세션 정보 갱신
                session.setRefreshToken(refreshToken);
                session.setKeepLogin(loginReq.isRememberMe());
                session.setIpAddress(ipAddress);
                session.setUserAgent(userAgent);
                sessionMapper.updateSession(session);
            }
        }

        // 3. 신규 기기인 경우 처리
        if (isNewSession) {
            // 기기 식별자가 없으면 새로 생성 (UUID)
            if (finalDeviceId == null) {
                finalDeviceId = UUID.randomUUID().toString();
            }

            // 새 세션 객체 생성
            session = Session.builder()
                .userId(user.getId())
                .refreshToken(refreshToken)
                .deviceType(detectDeviceType(userAgent))
                .userAgent(userAgent)
                .ipAddress(ipAddress)
                .location("Unknown")
                .deviceId(finalDeviceId)
                .keepLogin(loginReq.isRememberMe())
                .build();
            
            try {
                // [중요] DB에 먼저 저장해야 MyBatis가 ID를 생성하여 채워줌
                sessionMapper.insertSession(session);
            } catch (Exception e) {
                log.error(e.getMessage());
            }
        }        
        
        // [안전장치] 생성된 세션 ID 확인 (로그인 프로세스 보장)
        if (session == null || session.getId() == null) {
            log.error("CRITICAL: Session ID was NOT generated! isNewSession={}", isNewSession);
            throw new CustomException(ErrorCode.INTERNAL_SERVER_ERROR);
        }

        if (!isNewSession) {
            // 기존 세션인 경우 리프레시 토큰 및 활동 시간 업데이트
            sessionMapper.updateRefreshToken(session.getId(), refreshToken);
            sessionMapper.updateLastAccessedAt(session.getId());
        }

        // 액세스 토큰 생성
        String accessToken = jwtTokenProvider.createAccessToken(user.getId(), session.getId());

        // 로그 및 상태 업데이트
        userMapper.updateStatus(user.getId(), true);
        // 로그 저장
        accessLogService.saveLog(user.getId(), session.getId(), SecurityConstants.TYPE_LOGIN, ipAddress, null, userAgent, "/api/user/login");

        // 새 기기 알림 (신규 세션일 때만 발송)
        if (isNewSession) {
            notifyNewDeviceLogin(user.getId(), session.getId(), detectDeviceType(userAgent), ipAddress);
        }

        // 로그인 결과 반환
        return LoginRes.builder()
                .accessToken(accessToken)
                .user(user)
                .deviceId(finalDeviceId)
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
        if (userAgent.contains("Mobile")) {
            return "mobile";
        }
        if (userAgent.contains("Tablet")) {
            return "tablet";
        }
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