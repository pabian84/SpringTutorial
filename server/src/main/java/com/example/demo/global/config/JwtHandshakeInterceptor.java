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

import jakarta.servlet.http.Cookie;
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

            // 1. httpOnly 쿠키에서 토큰 추출 (최우선)
            String token = getTokenFromCookie(req);
            String userId = null;
            
            if (token != null) {
                try {
                    // 만료된 토큰에서도 userId 추출 가능
                    userId = jwtTokenProvider.getUserIdFromExpiredToken(token);
                    log.debug("쿠키에서 토큰 추출 성공: userId={}", userId);
                } catch (Exception e) {
                    log.debug("JWT 파싱 실패: {}", e.getMessage());
                }
            }
            
            // 2. 쿠키에 토큰이 없으면 쿼리 파라미터에서 userId 직접 확인 (하위 호환성)
            if (userId == null) {
                String queryUserId = req.getParameter("userId");
                if (queryUserId != null && !queryUserId.isEmpty()) {
                    userId = queryUserId;
                    log.debug("쿼리 파라미터에서 userId 추출: {}", userId);
                }
            }

            // 3. userId가 있으면 인증 허용
            if (userId != null) {
                log.info("WebSocket 연결 허용: userId={}", userId);
                attributes.put("userId", userId);
                attributes.put("sessionId", (Long) null);
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

    /**
     * httpOnly 쿠키에서 accessToken 추출
     */
    private String getTokenFromCookie(HttpServletRequest req) {
        Cookie[] cookies = req.getCookies();
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
