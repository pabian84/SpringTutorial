package com.example.demo.domain.user.controller;

import com.example.demo.domain.user.entity.UserSession;
import com.example.demo.domain.user.mapper.UserSessionMapper;
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
        
        // 헤더에서 토큰 추출 (Bearer 제거 등은 JwtTokenProvider 로직에 따름)
        String token = request.getHeader("Authorization");
        if (token != null && token.startsWith("Bearer ")) {
            token = token.substring(7);
        }
        
        // 주의: 여기서는 'Refresh Token'이 아니라 현재 접속중인 'Access Token'이나 
        // DB에 저장된 식별자를 써야 하는데, 보통 DB 세션 테이블의 refreshToken과 비교하려면
        // 클라이언트가 Refresh Token을 같이 보내주거나, Access Token 내부에 식별자가 있어야 합니다.
        // 편의상 여기서는 DB에 저장된 '가장 최근 세션'을 제외하거나, 
        // 요청 시 body로 refresh token을 받는 것이 정확합니다.
        
        // [임시 해결] 클라이언트가 현재 자신의 Refresh Token을 Body나 Header로 보낸다고 가정
        String currentRefreshToken = request.getHeader("Refresh-Token"); 
        
        if (currentRefreshToken == null || currentRefreshToken.isEmpty()) {
            return ResponseEntity.badRequest().body("현재 기기 식별을 위한 Refresh Token이 필요합니다.");
        }

        sessionMapper.terminateOthers(userId, currentRefreshToken);
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