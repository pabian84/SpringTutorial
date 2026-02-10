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
            // 새 Refresh Token을 HttpOnly 쿠키로 설정
            ResponseCookie refreshCookie = cookieUtil.createTokenCookie("refreshToken", result.getRefreshToken(), 7 * 24 * 60 * 60, isHttps);
            // 새 Access Token을 HttpOnly 쿠키로 설정 (keepLogin에 따라 maxAge 결정)
            ResponseCookie accessCookie = cookieUtil.createTokenCookie("accessToken", result.getAccessToken(), maxAge, isHttps);

            response.addHeader("Set-Cookie", refreshCookie.toString());
            response.addHeader("Set-Cookie", accessCookie.toString());

            Map<String, Object> body = new HashMap<>();
            body.put("accessToken", result.getAccessToken());
            body.put("user", result.getUser());
            
            return ResponseEntity.ok(body);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(401).body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.status(500).body(e.getMessage());
        }
    }

    @Operation(summary = "로그아웃")
    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpServletRequest request, HttpServletResponse response) {
        String token = jwtTokenProvider.resolveToken(request);
        Long sessionId = null;
        String userId = null;
        
        if (token != null && jwtTokenProvider.validateToken(token)) {
            sessionId = jwtTokenProvider.getSessionId(token);
            userId = jwtTokenProvider.getAuthentication(token).getName();
        }

        if (userId != null && sessionId != null) {
            String userAgent = request.getHeader("User-Agent");
            String ipAddress = request.getRemoteAddr();
            userService.logout(userId, sessionId, userAgent, ipAddress); 
            sessionService.forceDisconnectOne(userId, sessionId);
        }
        
        // 환경별 쿠키 옵션 적용
        boolean isHttps = "https".equalsIgnoreCase(request.getScheme());
        ResponseCookie refreshCookie = cookieUtil.deleteCookie("refreshToken", isHttps);
        ResponseCookie accessCookie = cookieUtil.deleteCookie("accessToken", isHttps);
        
        response.addHeader("Set-Cookie", refreshCookie.toString());
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