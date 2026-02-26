package com.example.demo.domain.user.controller;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
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
@Tag(name = "User API", description = "사용자 및 인증 관련 API")
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
        // [중요] 멀티 탭 중복 로그인 방어 및 유령 쿠키(Deadlock) 해결
        String existingToken = cookieUtil.extractTokenFromCookie(request, "accessToken");
        boolean isHttps = "https".equalsIgnoreCase(request.getScheme());

        if (existingToken != null && jwtTokenProvider.validateToken(existingToken)) {
            try {
                Long sessionId = jwtTokenProvider.getSessionId(existingToken);
                String userId = jwtTokenProvider.getAuthentication(existingToken).getName();
                
                // 실제 DB에 세션이 존재하는지 확인 (유령 쿠키 방지)
                // getMySessions는 (userId, currentSessionId)를 받아 해당 유저의 세션 목록을 반환함
                List<Map<String, Object>> activeSessions = sessionService.getMySessions(userId, sessionId);
                
                // 조회된 세션 목록 중에 현재 토큰의 sessionId와 일치하는 것이 있는지 확인
                boolean isRealSession = activeSessions.stream()
                    .anyMatch(s -> s.get("id").toString().equals(String.valueOf(sessionId)));

                if (isRealSession) {
                    log.info("[중복 로그인 차단] 이미 유효한 세션이 존재함. userId={}", userId);
                    return ResponseEntity.status(HttpStatus.CONFLICT).body("이미 다른 탭에서 로그인된 상태입니다.");
                } else {
                    log.warn("[유령 쿠키 발견] DB 세션 없음. 기존 쿠키 삭제.");
                    ResponseCookie deleteCookie = cookieUtil.deleteCookie("accessToken", isHttps);
                    response.addHeader("Set-Cookie", deleteCookie.toString());
                }
            } catch (Exception e) {
                log.warn("[인증 체크 예외] 쿠키 정보 확인 불가. 쿠키 삭제 처리. error={}", e.getMessage());
                ResponseCookie deleteCookie = cookieUtil.deleteCookie("accessToken", isHttps);
                response.addHeader("Set-Cookie", deleteCookie.toString());
            }
        }

        try {
            // [추가] 기기 식별을 위한 deviceId 쿠키 추출
            String deviceId = cookieUtil.extractTokenFromCookie(request, "deviceId");
            
            String ipAddress = request.getRemoteAddr();
            String userAgent = request.getHeader("User-Agent");
            
            // 서비스 호출 (deviceId 포함)
            LoginRes result = userService.login(req, userAgent, ipAddress, deviceId);
            
            // 1. 액세스 토큰 쿠키 설정 (세션 기반)
            int maxAge = req.isRememberMe() ? 7 * 24 * 60 * 60 : -1;
            ResponseCookie accessCookie = cookieUtil.createTokenCookie("accessToken", result.getAccessToken(), maxAge, isHttps);
            response.addHeader("Set-Cookie", accessCookie.toString());

            // 2. 기기 식별 쿠키 설정 (영구적 - 1년)
            // 브라우저를 닫아도 유지되어 동일 프로필 재접속 시 세션 재사용을 가능케 함
            ResponseCookie deviceCookie = cookieUtil.createTokenCookie("deviceId", result.getDeviceId(), 365 * 24 * 60 * 60, isHttps);
            response.addHeader("Set-Cookie", deviceCookie.toString());

            Map<String, Object> body = new HashMap<>();
            // accessToken은 httpOnly 쿠키로 전달되므로 응답 바디에는 포함하지 않음
            body.put("user", result.getUser());
            // 토큰 만료 시간 (초) - Proactive Refresh용
            body.put("expiresIn", req.isRememberMe()
                ? jwtProperties.getRefreshTokenValidityInSeconds()
                : jwtProperties.getAccessTokenValidityInSeconds());

            return ResponseEntity.ok(body);
        } catch (IllegalArgumentException e) {
            ResponseCookie deleteCookie = cookieUtil.deleteCookie("accessToken", isHttps);
            response.addHeader("Set-Cookie", deleteCookie.toString());
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
            } else {
                // 2. 만료된 토큰에서도 sessionId 추출 시도 (로그아웃 처리용)
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
            
            try {
                // [수정] 사용자님 원본 로직 복구: userService로 로그아웃 처리 후 웹소켓 강제 종료
                if (sessionId != null) {
                    userService.logout(userId, sessionId, userAgent, ipAddress);
                    sessionService.forceDisconnectWebSocket(userId, sessionId);
                    log.info("로그아웃 완료: userId={}, sessionId={}", userId, sessionId);
                } else {
                    // sessionId를 추출할 수 없는 경우 (토큰 자체가 없거나 손상됨)
                    // 여러 기기 동시 접속 지원을 위해 전체 삭제하지 않음
                    log.warn("로그아웃 요청: sessionId 추출 실패, userId={}", userId);
                }
            } catch (Exception e) {
                log.warn("로그아웃 세션 정리 중 예외 발생 (무시 가능): userId={}, error={}", userId, e.getMessage());
            }
        }
        
        // 환경별 쿠키 옵션 적용
        boolean isHttps = "https".equalsIgnoreCase(request.getScheme());
        ResponseCookie accessCookie = cookieUtil.deleteCookie("accessToken", isHttps);
        response.addHeader("Set-Cookie", accessCookie.toString());

        return ResponseEntity.ok().body("로그아웃되었습니다.");
    }

    @Operation(summary = "사용자 활동 로그 조회")
    @GetMapping("/logs")
    public List<AccessLog> getMyLogs(@AuthenticationPrincipal UserDetails userDetails) {
        // 남의 아이디를 넣어서 훔쳐볼 수 없게 됨 (토큰에 있는 내 아이디 사용)
        return userService.getLogs(userDetails.getUsername());
    }
}