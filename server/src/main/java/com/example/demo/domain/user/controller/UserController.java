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
import com.example.demo.domain.user.dto.LoginResult;
import com.example.demo.domain.user.entity.AccessLog;
import com.example.demo.domain.user.service.UserService;
import com.example.demo.global.security.JwtTokenProvider;
import com.example.demo.handler.UserConnectionHandler;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Tag(name = "User API", description = "사용자/로그인 관련 API")
@RestController
@RequestMapping("/api/user")
@RequiredArgsConstructor
public class UserController {
    private final UserService userService;
    // 토큰 해석기 (세션 ID 꺼내기용)
    private final JwtTokenProvider jwtTokenProvider;
    // 소켓 핸들러 (강제 연결 끊기용)
    private final UserConnectionHandler userConnectionHandler;

    @Operation(summary = "로그인")
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginReq req, HttpServletRequest request, HttpServletResponse response) {
        // IP와 브라우저 정보를 추출해서 서비스로 넘김
        try {
            String ipAddress = request.getRemoteAddr();
            String userAgent = request.getHeader("User-Agent");
            // 서비스 호출
            LoginResult result = userService.login(req, userAgent, ipAddress);
            int maxAge;
            // 로그인 유지 체크 여부에 따른 수명 결정
            if (req.isRememberMe()) {
                maxAge = 7 * 24 * 60 * 60; // 7일 (브라우저 꺼도 유지)
            } else {
                maxAge = -1; // 세션 쿠키 (브라우저 끄면 삭제, 탭 닫으면 유지)
            }

            // 쿠키 설정 (컨트롤러 역할)
            ResponseCookie cookie = ResponseCookie.from("refreshToken", result.getRefreshToken())
                        .httpOnly(true)
                        .path("/")
                        .secure(false) //https false
                        .maxAge(maxAge) // 7일
                        .build();
            response.addHeader("Set-Cookie", cookie.toString());

            // 응답 생성
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
        // 프론트에서 { "userId": "...", "refreshToken": "..." } 이렇게 보내줘야 함
        // 1. 헤더에서 Access Token 추출
        String token = jwtTokenProvider.resolveToken(request);
        
        // 2. 토큰에서 세션 ID와 유저 ID 추출
        Long sessionId = null;
        String userId = null;
        
        if (token != null && jwtTokenProvider.validateToken(token)) {
            sessionId = jwtTokenProvider.getSessionId(token);
            userId = jwtTokenProvider.getAuthentication(token).getName();
        }

        // 3. DB 삭제 + 소켓 끊기 (둘 다 sessionId 이용)
        if (userId != null && sessionId != null) {
            // 서비스에는 세션 ID를 넘겨서 DB 삭제
            userService.logout(userId, sessionId); 
            // 내 소켓도 즉시 끊어버리기 (좀비 방지)
            userConnectionHandler.forceDisconnectOne(userId, sessionId);
        }
        
        // 쿠키 삭제
        ResponseCookie cookie = ResponseCookie.from("refreshToken", "").maxAge(0).path("/").build();
        return ResponseEntity.ok().header("Set-Cookie", cookie.toString()).body("로그아웃 되었습니다.");
    }

    @Operation(summary = "사용자 활동 로그 조회")
    @GetMapping("/logs")
    public List<AccessLog> getMyLogs(@AuthenticationPrincipal UserDetails userDetails) {
        // 남의 아이디를 넣어서 훔쳐볼 수 없게 됨 (토큰에 있는 내 아이디 사용)
        return userService.getLogs(userDetails.getUsername());
    }
}