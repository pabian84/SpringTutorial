package com.example.demo.global.config;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import com.example.demo.global.security.JwtTokenProvider;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Component
@RequiredArgsConstructor
public class JwtHandshakeInterceptor implements HandshakeInterceptor {

    private final JwtTokenProvider jwtTokenProvider;
    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response, WebSocketHandler wsHandler,
            Map<String, Object> attributes) throws Exception {

        if (request instanceof ServletServerHttpRequest) {
            ServletServerHttpRequest servletRequest = (ServletServerHttpRequest) request;
            HttpServletRequest req = servletRequest.getServletRequest();

            // 1. 토큰 또는 userId 추출
            String userId = resolveUserId(req);

            // 2. userId가 있으면 인증 허용 (임시 방식)
            if (userId != null) {
                log.info("WebSocket 연결 허용: userId={}", userId);
                attributes.put("userId", userId);
                attributes.put("sessionId", (Long) null); // 세션 ID는 null로 설정
                return true;
            }
        }

        log.warn("WebSocket 연결 차단: userId 없음");
        response.setStatusCode(HttpStatus.UNAUTHORIZED);
        return false;
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response, WebSocketHandler wsHandler,
            Exception exception) {
        // Nothing to do
    }

    // 토큰 또는 쿼리 파라미터에서 userId 추출
    private String resolveUserId(HttpServletRequest req) {
        // 1. 쿼리 파라미터에서 userId 직접 확인
        String userId = req.getParameter("userId");
        if (userId != null && !userId.isEmpty()) {
            return userId;
        }

        // 2. 토큰이 있으면 JWT에서 userId 추출
        String token = getToken(req);
        if (token != null) {
            try {
                // 만료된 토큰에서도 userId 추출 가능
                String extractedUserId = jwtTokenProvider.getUserIdFromExpiredToken(token);
                if (extractedUserId != null) {
                    return extractedUserId;
                }
            } catch (Exception e) {
                log.debug("JWT 파싱 실패: {}", e.getMessage());
            }
        }

        return null;
    }

    // 헤더 또는 쿼리 파라미터에서 토큰 추출
    private String getToken(HttpServletRequest req) {
        // 1. 헤더 확인
        String bearerToken = req.getHeader("Authorization");
        if (bearerToken != null && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7);
        }
        // 2. 쿼리 파라미터 확인 (ws://...?token=...)
        return req.getParameter("token");
    }
}
