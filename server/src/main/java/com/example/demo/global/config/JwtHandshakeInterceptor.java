package com.example.demo.global.config;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import com.example.demo.domain.user.entity.Session;
import com.example.demo.domain.user.mapper.SessionMapper;
import com.example.demo.global.security.JwtTokenProvider;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * WebSocket 연결 시 인증을 처리하는 Interceptor
 * 
 * <p>WebSocket 핸드셰이크 단계에서 다음을 수행합니다:</p>
 * <ol>
 *   <li>httpOnly 쿠키에서 accessToken 추출</li>
 *   <li>토큰에서 userId와 sessionId 추출</li>
 *   <li>DB에서 세션 존재 여부 확인 (인증 강화)</li>
 *   <li>WebSocket attributes에 userId와 sessionId 저장</li>
 * </ol>
 * 
 * <p>sessionId는 기기 강퇴(Kick) 기능에서 특정 기기의 WebSocket을 종료할 때 사용됩니다.</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class JwtHandshakeInterceptor implements HandshakeInterceptor {

    private final JwtTokenProvider jwtTokenProvider;
    private final SessionMapper sessionMapper;
    
    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response, WebSocketHandler wsHandler,
            Map<String, Object> attributes) throws Exception {

        if (request instanceof ServletServerHttpRequest) {
            ServletServerHttpRequest servletRequest = (ServletServerHttpRequest) request;
            HttpServletRequest req = servletRequest.getServletRequest();

            // 1. httpOnly 쿠키에서 토큰 추출 (최우선)
            String token = getTokenFromCookie(req);
            String userId = null;
            Long sessionId = null;
            
            if (token != null) {
                try {
                    // 만료된 토큰에서도 userId 추출 가능
                    userId = jwtTokenProvider.getUserIdFromExpiredToken(token);
                    // sessionId 추출 (기기 강퇴 기능용)
                    sessionId = jwtTokenProvider.getSessionIdFromExpiredToken(token);
                    log.debug("쿠키에서 토큰 추출 성공: userId={}, sessionId={}", userId, sessionId);
                    
                    // 2. 세션 존재 확인 (인증 강화)
                    // 토큰은 있지만 DB에 세션이 없으면 (이미 로그아웃됨) 연결 거부
                    if (sessionId != null) {
                        Session session = sessionMapper.findBySessionId(sessionId);
                        if (session == null) {
                            log.warn("WebSocket 연결 차단: 세션이 DB에 없음 (이미 로그아웃됨) - sessionId={}", sessionId);
                            response.setStatusCode(HttpStatus.UNAUTHORIZED);
                            return false;
                        }
                        log.debug("세션 확인 완료: sessionId={}", sessionId);
                    }
                } catch (Exception e) {
                    log.debug("JWT 파싱 실패: {}", e.getMessage());
                }
            }
            
            // 3. 쿠키에 토큰이 없으면 쿼리 파라미터에서 userId 직접 확인 (하위 호환성)
            if (userId == null) {
                String queryUserId = req.getParameter("userId");
                if (queryUserId != null && !queryUserId.isEmpty()) {
                    userId = queryUserId;
                    log.debug("쿼리 파라미터에서 userId 추출: {}", userId);
                }
            }

            // 4. userId가 있으면 인증 허용
            if (userId != null) {
                log.info("WebSocket 연결 허용: userId={}, sessionId={}", userId, sessionId);
                attributes.put("userId", userId);
                attributes.put("sessionId", sessionId);
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
