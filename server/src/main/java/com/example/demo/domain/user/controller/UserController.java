package com.example.demo.domain.user.controller;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.demo.domain.user.dto.LoginReq;
import com.example.demo.domain.user.dto.LoginRes;
import com.example.demo.domain.user.entity.AccessLog;
import com.example.demo.domain.user.service.SessionService;
import com.example.demo.domain.user.service.UserService;
import com.example.demo.global.security.JwtTokenProvider;
import com.example.demo.global.util.CookieUtil;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Tag(name = "User API", description = "사용자/로그인 관련 API")
@RestController
@RequestMapping("/api/user")
@RequiredArgsConstructor
public class UserController {

    private final SessionService sessionService;
    private final UserService userService;
    private final JwtTokenProvider jwtTokenProvider;
    private final CookieUtil cookieUtil;
    private final com.example.demo.global.config.JwtProperties jwtProperties;

    @Operation(summary = "로그인")
    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginReq req, HttpServletRequest request, HttpServletResponse response) {
        try {
            String ipAddress = request.getRemoteAddr();
            String userAgent = request.getHeader("User-Agent");
            LoginRes result = userService.login(req, userAgent, ipAddress);
            int maxAge;
            if (req.isRememberMe()) {
                maxAge = 7 * 24 * 60 * 60; // 7일
            } else {
                maxAge = -1; // 세션 쿠키
            }

            // 환경별 쿠키 옵션 적용
            boolean isHttps = "https".equalsIgnoreCase(request.getScheme());
            
            // Access Token을 HttpOnly 쿠키로 설정
            ResponseCookie accessCookie = cookieUtil.createTokenCookie("accessToken", result.getAccessToken(), maxAge, isHttps);
            response.addHeader("Set-Cookie", accessCookie.toString());

            Map<String, Object> body = new HashMap<>();
            // accessToken은 httpOnly 쿠키로 전달되므로 응답 바디에는 포함하지 않음
            body.put("user", result.getUser());
            // 토큰 만료 시간 (초) - Proactive Refresh용
            body.put("expiresIn", req.isRememberMe() 
                ? jwtProperties.getRefreshTokenValidityInSeconds() 
                : jwtProperties.getAccessTokenValidityInSeconds());
            
            return ResponseEntity.ok(body);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(401).body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.status(500).body(e.getMessage());
        }
    }

    @Operation(summary = "로그아웃")
    @PostMapping("/logout")
    public ResponseEntity<?> logout(@RequestBody(required = false) Map<String, String> body, HttpServletRequest request, HttpServletResponse response) {
        String userId = null;
        Long sessionId = null;
        String token = jwtTokenProvider.resolveToken(request);
        
        // body에서 userId 우선 사용 (토큰 만료 시 프론트엔드에서 전달)
        if (body != null && body.containsKey("userId")) {
            userId = body.get("userId");
        }
        
        // 토큰이 있으면 sessionId와 userId 추출 시도
        if (token != null) {
            // 1. 유효한 토큰에서 추출
            if (jwtTokenProvider.validateToken(token)) {
                sessionId = jwtTokenProvider.getSessionId(token);
                if (userId == null) {
                    userId = jwtTokenProvider.getAuthentication(token).getName();
                }
            } 
            // 2. 만료된 토큰에서도 sessionId 추출 시도 (로그아웃 처리용)
            else {
                Long expiredSessionId = jwtTokenProvider.getSessionIdFromExpiredToken(token);
                String expiredUserId = jwtTokenProvider.getUserIdFromExpiredToken(token);
                
                if (expiredSessionId != null) {
                    sessionId = expiredSessionId;
                    log.debug("만료된 토큰에서 sessionId 추출: {}", sessionId);
                }
                if (userId == null && expiredUserId != null) {
                    userId = expiredUserId;
                    log.debug("만료된 토큰에서 userId 추출: {}", userId);
                }
            }
        }
        
        if (userId != null) {
            String userAgent = request.getHeader("User-Agent");
            String ipAddress = request.getRemoteAddr();
            
            // sessionId가 있으면 해당 세션만 로그아웃
            if (sessionId != null) {
                userService.logout(userId, sessionId, userAgent, ipAddress);
                sessionService.forceDisconnectWebSocket(userId, sessionId);
                log.info("로그아웃 완료: userId={}, sessionId={}", userId, sessionId);
            } else {
                // sessionId를 추출할 수 없는 경우 (토큰 자체가 없거나 손상됨)
                // 여러 기기 동시 접속 지원을 위해 전체 삭제하지 않음
                log.warn("로그아웃 요청: sessionId 추출 실패, userId={}", userId);
            }
        }
        
        // 환경별 쿠키 옵션 적용
        boolean isHttps = "https".equalsIgnoreCase(request.getScheme());
        ResponseCookie accessCookie = cookieUtil.deleteCookie("accessToken", isHttps);
        
        response.addHeader("Set-Cookie", accessCookie.toString());

        return ResponseEntity.ok().body("로그아웃 되었습니다.");
    }

    @Operation(summary = "사용자 활동 로그 조회")
    @GetMapping("/logs")
    public List<AccessLog> getMyLogs(@AuthenticationPrincipal UserDetails userDetails) {
        // 남의 아이디를 넣어서 훔쳐볼 수 없게 됨 (토큰에 있는 내 아이디 사용)
        return userService.getLogs(userDetails.getUsername());
    }
}