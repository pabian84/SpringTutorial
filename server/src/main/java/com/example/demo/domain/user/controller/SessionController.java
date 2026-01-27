package com.example.demo.domain.user.controller;

import com.example.demo.domain.user.entity.UserSession;
import com.example.demo.domain.user.mapper.UserSessionMapper;
import com.example.demo.global.security.JwtTokenProvider;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/sessions")
@RequiredArgsConstructor
public class SessionController {

    private final UserSessionMapper sessionMapper;
    private final JwtTokenProvider jwtTokenProvider;

    // 1. 내 기기 목록 조회
    @GetMapping
    public ResponseEntity<?> getMySessions(@AuthenticationPrincipal UserDetails userDetails) {
        String userId = userDetails.getUsername();
        List<UserSession> sessions = sessionMapper.findByUserId(userId);

        // 보안상 토큰은 빼고 리턴
        List<Map<String, Object>> result = sessions.stream().map(s -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", s.getId());
            map.put("deviceType", s.getDeviceType() != null ? s.getDeviceType() : "Unknown");
            map.put("userAgent", s.getUserAgent());
            map.put("ipAddress", s.getIpAddress());
            map.put("location", s.getLocation() != null ? s.getLocation() : "Unknown");
            map.put("lastActive", s.getLastAccessedAt());
            return map;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    // 2. 특정 기기 추방 (로그아웃)
    @DeleteMapping("/{sessionId}")
    public ResponseEntity<?> revokeSession(@PathVariable Long sessionId) {
        sessionMapper.deleteById(sessionId);
        return ResponseEntity.ok("선택한 기기를 로그아웃 시켰습니다.");
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
        sessionMapper.terminateOthers(userId, currentSessionId);
        
        return ResponseEntity.ok("다른 모든 기기에서 로그아웃 되었습니다.");
    }

    // 4. 전체 로그아웃
    @DeleteMapping("/all")
    public ResponseEntity<?> revokeAllSessions(@AuthenticationPrincipal UserDetails userDetails) {
        String userId = userDetails.getUsername();
        sessionMapper.deleteByUserId(userId);
        return ResponseEntity.ok("모든 기기에서 로그아웃 되었습니다.");
    }
}