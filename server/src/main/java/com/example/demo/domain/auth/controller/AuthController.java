package com.example.demo.domain.auth.controller;

import java.util.HashMap;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.demo.domain.user.entity.User;
import com.example.demo.domain.user.mapper.UserMapper;
import com.example.demo.global.security.JwtTokenProvider;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final JwtTokenProvider jwtTokenProvider;
    private final UserMapper userMapper;

    /**
     * 인증 상태 확인 API
     * - httpOnly 쿠키에서 accessToken을 읽어 인증 상태 확인
     * - 응답: { authenticated: true, user: { id, name } } 또는 401
     */
    @GetMapping("/check")
    public ResponseEntity<?> checkAuthStatus(HttpServletRequest request) {
        // httpOnly 쿠키에서 accessToken 읽기
        String token = extractTokenFromCookie(request);

        if (token == null) {
            log.debug("인증 확인 실패: 토큰이 쿠키에 없음");
            return ResponseEntity.status(401).body(Map.of("authenticated", false));
        }

        // 토큰 유효성 검증 (만료된 토큰도 userId 추출 가능)
        try {
            String userId = jwtTokenProvider.getAuthentication(token).getName();
            
            if (userId == null || userId.isEmpty()) {
                log.debug("인증 확인 실패: userId가 토큰에 없음");
                return ResponseEntity.status(401).body(Map.of("authenticated", false));
            }

            // 사용자 정보 조회 (비밀번호 제외)
            User user = userMapper.findById(userId);
            
            if (user == null) {
                log.debug("인증 확인 실패: 사용자를 찾을 수 없음");
                return ResponseEntity.status(401).body(Map.of("authenticated", false));
            }

            log.debug("인증 확인 성공: userId={}", userId);

            Map<String, Object> response = new HashMap<>();
            response.put("authenticated", true);
            response.put("user", Map.of(
                "id", user.getId(),
                "name", user.getName()
            ));

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("인증 확인 중 오류 발생: {}", e.getMessage());
            return ResponseEntity.status(401).body(Map.of("authenticated", false));
        }
    }

    /**
     * httpOnly 쿠키에서 accessToken 추출
     */
    private String extractTokenFromCookie(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (Cookie cookie : cookies) {
                if ("accessToken".equals(cookie.getName())) {
                    return cookie.getValue();
                }
            }
        }
        return null;
    }
}
