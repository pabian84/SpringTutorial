package com.example.demo.global.config;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import com.example.demo.domain.user.mapper.SessionMapper;
import com.example.demo.global.security.JwtTokenProvider;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

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

            // 1. 토큰 추출 (Query String 또는 Header)
            String token = resolveToken(req);

            // 2. 토큰 유효성 검사
            if (token != null && jwtTokenProvider.validateToken(token)) {
                
                // 3. [핵심] DB 생존 확인 (세션 바인딩)
                Long sessionId = jwtTokenProvider.getSessionId(token);
                
                if (sessionId == null || sessionMapper.findBySessionId(sessionId) == null) {
                    log.warn("웹소켓 연결 차단: 유효하지 않은 세션 (Logout됨) - SessionID: {}", sessionId);
                    response.setStatusCode(HttpStatus.UNAUTHORIZED);
                    return false; // 접속 거부!
                }
                
                // 4. 통과되면 사용자 ID와 세션ID를 속성에 저장 (Handler에서 사용)
                String userId = jwtTokenProvider.getAuthentication(token).getName();
                attributes.put("userId", userId);
                attributes.put("sessionId", sessionId);
                return true;
            }
        }
        
        log.warn("웹소켓 연결 차단: 토큰 없음 또는 만료됨");
        response.setStatusCode(HttpStatus.UNAUTHORIZED);
        return false;
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response, WebSocketHandler wsHandler,
            Exception exception) {
        // Nothing to do
    }

    // 헤더 또는 쿼리 파라미터에서 토큰 추출
    private String resolveToken(HttpServletRequest req) {
        // 1. 헤더 확인
        String bearerToken = req.getHeader("Authorization");
        if (bearerToken != null && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7);
        }
        // 2. 쿼리 파라미터 확인 (ws://...?token=...)
        String queryToken = req.getParameter("token");
        if (queryToken != null) {
            return queryToken;
        }
        return null;
    }
}