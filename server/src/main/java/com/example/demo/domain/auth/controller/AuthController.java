package com.example.demo.domain.auth.controller;

import java.util.HashMap;
import java.util.Map;

import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.demo.domain.user.entity.Session;
import com.example.demo.domain.user.entity.User;
import com.example.demo.domain.user.mapper.SessionMapper;
import com.example.demo.domain.user.mapper.UserMapper;
import com.example.demo.global.config.JwtProperties;
import com.example.demo.global.security.JwtTokenProvider;
import com.example.demo.global.util.CookieUtil;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final JwtTokenProvider jwtTokenProvider;
    private final JwtProperties jwtProperties;
    private final UserMapper userMapper;
    private final SessionMapper sessionMapper;
    private final CookieUtil cookieUtil;

    /**
     * 인증 상태 확인 API
     * - httpOnly 쿠키에서 accessToken을 읽어 인증 상태 확인
     * - 응답: { authenticated: true, user: { id, name } } 또는 401
     */
    @GetMapping("/check")
    public ResponseEntity<?> checkAuthStatus(HttpServletRequest request, HttpServletResponse response) {
        // https 여부 확인
        boolean isHttps = "https".equalsIgnoreCase(request.getScheme());

        // httpOnly 쿠키에서 accessToken 읽기
        String token = cookieUtil.extractTokenFromCookie(request, "accessToken");

        if (token == null) {
            log.debug("인증 확인 실패: 토큰이 쿠키에 없음");
            // 인증 실패 시 쿠키 삭제
            response.addHeader("Set-Cookie", cookieUtil.deleteCookie("accessToken", isHttps).toString());
            return ResponseEntity.status(401).body(Map.of("authenticated", false));
        }

        // 토큰 유효성 검증 (만료된 토큰도 userId 추출 가능)
        try {
            String userId = jwtTokenProvider.getAuthentication(token).getName();
            
            if (userId == null || userId.isEmpty()) {
                log.debug("인증 확인 실패: userId가 토큰에 없음");
                // 인증 실패 시 쿠키 삭제
                response.addHeader("Set-Cookie", cookieUtil.deleteCookie("accessToken", isHttps).toString());
                return ResponseEntity.status(401).body(Map.of("authenticated", false));
            }

            // 사용자 정보 조회 (비밀번호 제외)
            User user = userMapper.findById(userId);
            
            if (user == null) {
                log.debug("인증 확인 실패: 사용자를 찾을 수 없음");
                // 인증 실패 시 쿠키 삭제
                response.addHeader("Set-Cookie", cookieUtil.deleteCookie("accessToken", isHttps).toString());
                return ResponseEntity.status(401).body(Map.of("authenticated", false));
            }

            log.debug("인증 확인 성공: userId={}", userId);

            Map<String, Object> responseBody = new HashMap<>();
            responseBody.put("authenticated", true);
            responseBody.put("user", Map.of(
                "id", user.getId(),
                "name", user.getName()
            ));
            // 토큰의 실제 남은 시간 (초) - Proactive Refresh용
            long remainingSeconds = jwtTokenProvider.getTokenRemainingTime(token);
            responseBody.put("expiresIn", remainingSeconds);

            return ResponseEntity.ok(responseBody);

        } catch (Exception e) {
            log.error("인증 확인 중 오류 발생: {}", e.getMessage());
            // 인증 실패 시 쿠키 삭제
            response.addHeader("Set-Cookie", cookieUtil.deleteCookie("accessToken", isHttps).toString());
            return ResponseEntity.status(401).body(Map.of("authenticated", false));
        }
    }

    /**
     * 토큰 갱신 API
     * - httpOnly 쿠키에서 accessToken을 읽어 세션 ID 추출
     * - DB에서 세션 조회 후 새 accessToken 발급
     * - 응답: 새 accessToken이 설정된 쿠키
     */
    @PostMapping("/refresh")
    public ResponseEntity<?> refreshToken(HttpServletRequest request, HttpServletResponse response) {
        boolean isHttps = "https".equalsIgnoreCase(request.getScheme());
        
        // 1. 현재 accessToken 쿠키에서 토큰 추출
        String token = cookieUtil.extractTokenFromCookie(request, "accessToken");
        
        if (token == null) {
            log.debug("토큰 갱신 실패: 토큰이 쿠키에 없음");
            response.addHeader("Set-Cookie", cookieUtil.deleteCookie("accessToken", isHttps).toString());
            return ResponseEntity.status(401).body(Map.of("error", "No token"));
        }
        
        try {
            // 2. 토큰에서 sessionId 추출 (만료된 토큰에서도 추출 가능)
            Long sessionId = jwtTokenProvider.getSessionIdFromExpiredToken(token);
            String userId = jwtTokenProvider.getUserIdFromExpiredToken(token);
            
            if (sessionId == null || userId == null) {
                log.debug("토큰 갱신 실패: sessionId 또는 userId 없음");
                response.addHeader("Set-Cookie", cookieUtil.deleteCookie("accessToken", isHttps).toString());
                return ResponseEntity.status(401).body(Map.of("error", "Invalid token"));
            }
            
            // 3. DB에서 세션 조회
            Session session = sessionMapper.findBySessionId(sessionId);
            if (session == null || !session.getUserId().equals(userId)) {
                log.debug("토큰 갱신 실패: 세션을 찾을 수 없음");
                response.addHeader("Set-Cookie", cookieUtil.deleteCookie("accessToken", isHttps).toString());
                return ResponseEntity.status(401).body(Map.of("error", "Session not found"));
            }
            
            // 4. 새 accessToken 생성
            String newAccessToken = jwtTokenProvider.createAccessToken(userId, sessionId);
            
            // 5. 새 쿠키 설정
            int maxAge = (int) jwtProperties.getAccessTokenValidityInSeconds();
            ResponseCookie newCookie = cookieUtil.createTokenCookie("accessToken", newAccessToken, maxAge, isHttps);
            response.addHeader("Set-Cookie", newCookie.toString());
            
            // 6. 세션 마지막 접속 시간 업데이트
            sessionMapper.updateLastAccessedAt(sessionId);
            
            log.debug("토큰 갱신 성공: userId={}, sessionId={}", userId, sessionId);
            return ResponseEntity.ok(Map.of(
                "success", true,
                "expiresIn", jwtProperties.getAccessTokenValidityInSeconds()
            ));
            
        } catch (Exception e) {
            log.error("토큰 갱신 중 오류: {}", e.getMessage());
            response.addHeader("Set-Cookie", cookieUtil.deleteCookie("accessToken", isHttps).toString());
            return ResponseEntity.status(401).body(Map.of("error", "Token refresh failed"));
        }
    }
}
