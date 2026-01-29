package com.example.demo.domain.user.controller;

import java.util.Map;

import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.demo.domain.user.service.SessionService;
import com.example.demo.global.security.JwtTokenProvider;
import com.example.demo.handler.UserConnectionHandler;

import io.swagger.v3.oas.annotations.Operation;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/api/sessions")
@RequiredArgsConstructor
public class SessionController {

    private final JwtTokenProvider jwtTokenProvider;
    private final UserConnectionHandler userConnectionHandler;
    private final SessionService sessionService;

    @Operation(summary = "쿠키에 있는 refreshToken을 사용하여 accessToken 갱신")
    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(@CookieValue(value = "refreshToken", required = false) String refreshToken) {
        try {
            Map<String, Object> result = sessionService.refresh(refreshToken);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            ResponseCookie cookie = ResponseCookie.from("refreshToken", "").maxAge(0).path("/").build();
            return ResponseEntity.status(401).header("Set-Cookie", cookie.toString()).body("토큰 만료");
        }
    }

    // 1. 내 기기 목록 조회
    @GetMapping
    public ResponseEntity<?> getMySessions(@AuthenticationPrincipal UserDetails userDetails, HttpServletRequest request) {
        String token = jwtTokenProvider.resolveToken(request);
        Long mySessionId = (token != null) ? jwtTokenProvider.getSessionId(token) : null;
        return ResponseEntity.ok(sessionService.getMySessions(userDetails.getUsername(), mySessionId));
    }

    // [1] 특정 기기 추방 -> forceDisconnectOne 호출
    @Operation(summary = "특정 기기 강퇴 (Body 사용)")
    @PostMapping("/revoke")
    public ResponseEntity<?> revokeSession(@RequestBody Map<String, Long> body, @AuthenticationPrincipal UserDetails userDetails, HttpServletRequest request) {
        try {
            Long targetSessionId = body.get("targetSessionId");
            String currentUserId = userDetails.getUsername();
            // 토큰 조회
            String token = jwtTokenProvider.resolveToken(request);
            // 헤더 대신 토큰에서 내 세션 ID 추출
            Long currentSessionId = jwtTokenProvider.getSessionId(token);
            
            // [깔끔해짐] 서비스가 검증하고 삭제까지 다 함
            sessionService.deleteSession(targetSessionId, currentSessionId);
            
            // 소켓 끊기 (이건 Presentation Layer인 컨트롤러가 Handler를 호출하는 게 맞음)
            userConnectionHandler.forceDisconnectOne(currentUserId, targetSessionId);
            
            return ResponseEntity.ok("선택한 기기를 로그아웃 시켰습니다.");
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (SecurityException e) {
            return ResponseEntity.status(403).body(e.getMessage());
        }
    }

    // 3. 다른 기기 모두 로그아웃
    @DeleteMapping("/others")
    public ResponseEntity<?> revokeOtherSessions(@AuthenticationPrincipal UserDetails userDetails, HttpServletRequest request) {
        String userId = userDetails.getUsername();
        
        // 토큰 조회
        String token = jwtTokenProvider.resolveToken(request);
        if (token == null) {
             return ResponseEntity.status(401).body("인증 토큰이 없습니다.");
        }
        
        // 헤더 대신 토큰에서 내 세션 ID 추출
        Long currentSessionId = jwtTokenProvider.getSessionId(token);
        if (currentSessionId == null) {
             return ResponseEntity.badRequest().body("현재 세션 정보를 확인할 수 없습니다.");
        }

        // DB 삭제 실행
        sessionService.deleteOtherSessions(userId, currentSessionId);
        // 소켓 끊기
        userConnectionHandler.forceDisconnectOthers(userId, currentSessionId);
        
        return ResponseEntity.ok("다른 모든 기기에서 로그아웃 되었습니다.");
    }

    // 4. 전체 로그아웃
    @DeleteMapping("/all")
    public ResponseEntity<?> revokeAllSessions(@AuthenticationPrincipal UserDetails userDetails, HttpServletRequest request, HttpServletResponse response) {
        String userId = userDetails.getUsername();

        // 토큰 조회
        String token = jwtTokenProvider.resolveToken(request);
        if (token == null) {
             return ResponseEntity.status(401).body("인증 토큰이 없습니다.");
        }
        
        // 헤더 대신 토큰에서 내 세션 ID 추출
        Long currentSessionId = jwtTokenProvider.getSessionId(token);
        if (currentSessionId == null) {
             return ResponseEntity.badRequest().body("현재 세션 정보를 확인할 수 없습니다.");
        }
        // DB 삭제
        sessionService.deleteAllSessions(userId, currentSessionId);
        // 소켓 끊기
        userConnectionHandler.forceDisconnectAll(userId);
        
        ResponseCookie cookie = ResponseCookie.from("refreshToken", "").maxAge(0).path("/").build();
        return ResponseEntity.ok().header("Set-Cookie", cookie.toString()).body("전체 로그아웃 완료");
    }

    // [기존] 접속자 목록 (Online)
    @Operation(summary = "접속 중인 사용자 조회")
    @GetMapping("/onlineList")
    public ResponseEntity<?> getOnlineUsers() {
        return ResponseEntity.ok(sessionService.getOnlineUsers());
    }
}