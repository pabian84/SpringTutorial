package com.example.demo.domain.user.service;

import java.sql.Timestamp;
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
import com.example.demo.domain.user.mapper.UserMapper;
import com.example.demo.global.security.JwtTokenProvider;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j; // [추가 1] 로그 기능 임포트

@Slf4j
@Service
@RequiredArgsConstructor
public class UserService {
    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder; // 암호화 기계
    private final JwtTokenProvider jwtTokenProvider; // 토큰 발급기

    @Transactional
    @CacheEvict(value = "online_users", allEntries = true) // [캐시 무효화] 접속자 목록 캐시 삭제
    public Map<String, Object> login(UserLoginReq req, String ip, String userAgent) {
        User user = userMapper.findById(req.getId());
        Map<String, Object> result = new HashMap<>();

        // 1. 비밀번호 검사 (BCrypt 매칭)
        if (user != null && passwordEncoder.matches(req.getPassword(), user.getPassword())) {
            
            // 2. 토큰 2개(Access, Refresh) 발급
            String accessToken = jwtTokenProvider.createAccessToken(user.getId());
            String refreshToken = jwtTokenProvider.createRefreshToken(user.getId());

            // 3. 리프레시 토큰 DB 저장 (기기 정보 포함)
            // 간단하게 파싱 (실무엔 라이브러리 사용 권장)
            String browser = "Unknown";
            String os = "Unknown";
            if (userAgent.contains("Chrome")) browser = "Chrome";
            else if (userAgent.contains("Safari")) browser = "Safari";
            if (userAgent.contains("Windows")) os = "Windows";
            else if (userAgent.contains("Mac")) os = "Mac";

            // 7일 후 만료
            Timestamp expiry = new Timestamp(System.currentTimeMillis() + (7L * 24 * 60 * 60 * 1000));
            userMapper.saveRefreshToken(user.getId(), refreshToken, ip, browser, os, expiry);

            // 4. 로그 및 상태 업데이트
            userMapper.updateStatus(user.getId(), true);
            
            // 로그 저장 객체 생성
            AccessLog logData = AccessLog.builder()
                    .userId(user.getId())
                    .ipAddress(ip)
                    .userAgent(userAgent)
                    .browser(browser)
                    .os(os)
                    .endpoint("/api/user/login")
                    .type("LOGIN")
                    .build();
            userMapper.saveLog(logData);

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

    @CacheEvict(value = "online_users", allEntries = true) // [캐시 무효화] 접속자 목록 캐시 삭제
    public void logout(String userId) {
        userMapper.updateStatus(userId, false);
        userMapper.deleteRefreshToken(userId); // 토큰 삭제 (로그아웃 핵심)
        
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
    //@Cacheable(value = "online_users") // [캐시 적용] 접속자 목록은 1분 동안 DB 조회 없이 캐시된 값 반환
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
}