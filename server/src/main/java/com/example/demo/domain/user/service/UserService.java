package com.example.demo.domain.user.service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.demo.domain.user.dto.UserLoginReq;
import com.example.demo.domain.user.dto.UserRes;
import com.example.demo.domain.user.entity.AccessLog;
import com.example.demo.domain.user.entity.User;
import com.example.demo.domain.user.entity.UserSession;
import com.example.demo.domain.user.mapper.UserMapper;
import com.example.demo.domain.user.mapper.UserSessionMapper;
import com.example.demo.global.security.JwtTokenProvider;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j; // [추가 1] 로그 기능 임포트

@Slf4j
@Service
@RequiredArgsConstructor
public class UserService {
    private final UserMapper userMapper;
    private final UserSessionMapper sessionMapper;
    private final PasswordEncoder passwordEncoder; // 암호화 기계
    private final JwtTokenProvider jwtTokenProvider; // 토큰 발급기

    @Transactional
    @CacheEvict(value = "online_users", allEntries = true) // [캐시 무효화] 접속자 목록 캐시 삭제
    public Map<String, Object> login(UserLoginReq req, String ip, String userAgent) {
        User user = userMapper.findById(req.getId());
        Map<String, Object> result = new HashMap<>();

        // 1. 비밀번호 검사 (BCrypt 매칭)
        if (user != null && passwordEncoder.matches(req.getPassword(), user.getPassword())) {
            
            // Refresh Token 먼저 생성 (DB 저장용)
            // Refresh Token에는 세션 ID를 안 넣어도 됩니다. (DB에 저장되니까)
            String refreshToken = jwtTokenProvider.createRefreshToken(user.getId());

            // 세션 insert 직전에 실행
            // "이 유저의 세션이 5개를 넘어가면, 제일 오래된 거 하나 지워라"
            List<UserSession> sessions = sessionMapper.findByUserId(user.getId());
            if (sessions.size() >= 5) {
                // lastAccessedAt으로 정렬되어 있다고 가정할 때, 가장 뒤(오래된) 세션 삭제
                // 혹은 DB 쿼리로 "DELETE ... ORDER BY last_accessed_at ASC LIMIT 1" 실행
                UserSession oldest = sessions.get(sessions.size() - 1);
                sessionMapper.deleteById(oldest.getId());
            }

            // 로그인 성공 시 세션 정보 DB에 저장
            UserSession session = UserSession.builder()
                .userId(user.getId()) // User 객체 대신 ID String 사용
                .refreshToken(refreshToken)
                .deviceType(detectDeviceType(userAgent))
                .userAgent(userAgent)
                .ipAddress(ip)
                .location("Unknown")
                .build(); // createdAt 등은 DB에서 NOW()로 처리하거나 여기서 넣거나

            sessionMapper.insertSession(session);

            // [확인용 로그]
            if (session.getId() == null) {
                log.error("CRITICAL: Session ID was NOT generated!");
                throw new RuntimeException("Session ID generation failed");
            }
            
            // 생성된 session.getId()를 가지고 Access Token 생성 (세션 바인딩)
            // JwtTokenProvider에 createAccessToken(userId, sessionId) 메서드가 있어야 함
            String accessToken = jwtTokenProvider.createAccessToken(user.getId(), session.getId());

            // 로그 및 상태 업데이트
            userMapper.updateStatus(user.getId(), true);
            // 로그 저장 객체 생성
            String browser = "Unknown";
            String os = "Unknown";
            if (userAgent != null) {
                if (userAgent.contains("Chrome")) browser = "Chrome";
                else if (userAgent.contains("Firefox")) browser = "Firefox";
                else if (userAgent.contains("Safari")) browser = "Safari";
                
                if (userAgent.contains("Windows")) os = "Windows";
                else if (userAgent.contains("Mac")) os = "Mac";
                else if (userAgent.contains("Linux")) os = "Linux";
            }
            AccessLog logData = AccessLog.builder()
                    .userId(user.getId())
                    .sessionId(session.getId())
                    .ipAddress(ip)
                    .location(session.getLocation())
                    .userAgent(userAgent)
                    .browser(browser)
                    .os(os)
                    .endpoint("/api/user/login")
                    .type("LOGIN")
                    .build();
            userMapper.saveLog(logData);

            // 컨트롤러에게 토큰을 넘겨줍니다.
            result.put("status", "ok");
            result.put("accessToken", accessToken);  // 프론트로 보냄
            result.put("refreshToken", refreshToken); // 프론트로 보냄
            result.put("user", new UserRes(user.getId(), user.getName(), user.getRole())); // 사용자 정보도 함께 반환
        } else {
            result.put("status", "fail");
            result.put("message", "아이디 또는 비밀번호가 틀렸습니다.");
        }
        return result;
    }

    // 로그아웃 처리 (특정 기기)
    @Transactional
    @CacheEvict(value = "online_users", allEntries = true) // [캐시 무효화] 접속자 목록 캐시 삭제
    public void logout(String userId, String refreshToken) {
        // 1. DB에서 해당 기기의 리프레시 토큰만 삭제
        if (refreshToken != null) {
            //userMapper.deleteRefreshToken(refreshToken);
            sessionMapper.deleteByRefreshToken(refreshToken); // user_sessions에서 삭제
        }
        
        // [중요] 여기서 updateStatus(false)를 하지 않습니다!
        // 이유: PC에서 로그아웃했다고 해서, 핸드폰까지 오프라인 처리되면 안 되기 때문입니다.
        // 진짜 오프라인 처리는 클라이언트가 소켓을 끊을 때 UserConnectionHandler가 알아서 합니다.
        
        // 2. 로그 기록
        AccessLog logData = AccessLog.builder()
                .userId(userId)
                .type("LOGOUT")
                .endpoint("/api/user/logout") // 엔드포인트 명시
                .build();
        userMapper.saveLog(logData);
    }

    // 로그아웃 처리 (모든 기기)
    @Transactional
    @CacheEvict(value = "online_users", allEntries = true) // [캐시 무효화] 접속자 목록 캐시 삭제
    public void logoutAllDevices(String userId) {
        sessionMapper.deleteByUserId(userId);
        userMapper.updateStatus(userId, false); // 상태 오프라인 처리
        
        // 로그 기록 (약식)
        AccessLog logData = AccessLog.builder()
                .userId(userId)
                .type("LOGOUT")
                .build();
        userMapper.saveLog(logData);
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

    // 접속 중인 유저 리스트 반환
    /// [캐시 적용] 접속자 목록은 1분 동안 DB 조회 없이 캐시된 값 반환
    // 로그인/로그아웃 시 데이터가 변하더라도 1분 정도의 오차는 허용하거나, 
    // login/logout 메서드에 @CacheEvict(value = "online_users", allEntries = true)를 붙여서 즉시 갱신할 수도 있습니다.
    @Cacheable(value = "online_users") // [캐시 적용] 접속자 목록은 1분 동안 DB 조회 없이 캐시된 값 반환
    public List<UserRes> getOnlineUserList() {
        List<User> userEntities = userMapper.findOnlineUsers();
        List<UserRes> result = new ArrayList<>();
        for (User user : userEntities) {
            result.add(new UserRes(user.getId(), user.getName(), user.getRole()));
        }
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

    // 리프레시 토큰으로 액세스 토큰 재발급
    public Map<String, Object> refreshAccessToken(String refreshToken) {

        log.warn("리프레시 토큰으로 액세스 토큰 재발급 시도: {}", refreshToken);

        // 1. 토큰 유효성 검사 (서명 위조 등)
        if (!jwtTokenProvider.validateToken(refreshToken)) {
            throw new RuntimeException("Invalid Refresh Token");
        }

        // 2. [추가] DB(user_sessions)에 해당 토큰이 살아있는지 확인!
        // 화면에서 '로그아웃' 버튼을 눌러 DB에서 삭제했다면, 여기서 null이 나와서 튕겨내야 합니다.
        UserSession session = sessionMapper.findByRefreshToken(refreshToken);
        if (session == null) {
            throw new RuntimeException("Session Expired or Logged Out"); // 여기서 401/403 발생 -> 프론트가 튕겨냄
        }

        // "토큰으로는 찾았는데, ID로는 못 찾는" 황당한 경우를 방지합니다.
        // 필터가 findById로 검사하므로, 여기서도 똑같이 검사해서 없으면 죽여야 합니다.
        if (sessionMapper.findById(session.getId()) == null) {
            log.error("치명적 오류: 세션 불일치 감지 (토큰 O, ID X) - 강제 만료 처리. ID: {}", session.getId());
            // 여기서 예외를 던지면 axiosConfig가 401로 인식하고 로그인 페이지로 보냅니다.
            throw new RuntimeException("Session Integrity Error: ID not found"); 
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

    // 간단한 기기 판별 메서드 (UserService 내부에 추가)
    private String detectDeviceType(String userAgent) {
        if (userAgent.contains("Mobile")) return "mobile";
        if (userAgent.contains("Tablet")) return "tablet";
        return "desktop";
    }
}