package com.example.demo.global.util;

import java.net.URI;
import java.util.Map;

import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketSession;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;

/**
 * 쿠키 및 WebSocket 유틸리티 클래스
 */
@Component
public class CookieUtil {

    /**
     * 토큰 쿠키 생성 (공통 메서드)
     */
    public ResponseCookie createTokenCookie(String cookieName, String token, int maxAge, boolean isHttps) {
        return ResponseCookie.from(cookieName, token)
                    .httpOnly(true)
                    .path("/")
                    .secure(isHttps)
                    .sameSite(isHttps ? "None" : "Lax")
                    .maxAge(maxAge)
                    .build();
    }

    /**
     * 쿠키 삭제 (maxAge=0)
     */
    public ResponseCookie deleteCookie(String cookieName, boolean isHttps) {
        return ResponseCookie.from(cookieName, "")
                    .httpOnly(true)
                    .path("/")
                    .secure(isHttps)
                    .sameSite(isHttps ? "None" : "Lax")
                    .maxAge(0)
                    .build();
    }

    /**
     * httpOnly 쿠키에서 토큰 추출
     * @param request HttpServletRequest
     * @param cookieName 쿠키 이름
     * @return 토큰 값 또는 null
     */
    public String extractTokenFromCookie(HttpServletRequest request, String cookieName) {
        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (Cookie cookie : cookies) {
                if (cookieName.equals(cookie.getName())) {
                    return cookie.getValue();
                }
            }
        }
        return null;
    }

    /**
     * WebSocketSession에서 userId 추출 (공용 함수)
     * - 먼저 HTTP request attributes에서 가져옴 (JwtHandshakeInterceptor에서 설정)
     * - 없으면 URL 파라미터에서 추출 (하위 호환성)
     * 
     * @param session WebSocketSession
     * @return userId 또는 null
     */
    public static String getUserIdFromSession(WebSocketSession session) {
        // 1. 먼저 HTTP request attributes에서 userId 가져오기
        Map<String, Object> attributes = session.getAttributes();
        if (attributes != null) {
            Object userId = attributes.get("userId");
            if (userId != null) {
                return userId.toString();
            }
        }
        
        // 2. URL 파라미터에서 추출 (하위 호환성)
        try {
            URI uri = session.getUri();
            if (uri != null && uri.getQuery() != null) {
                String query = uri.getQuery();
                for (String param : query.split("&")) {
                    String[] pair = param.split("=");
                    if (pair.length == 2 && "userId".equals(pair[0])) {
                        return pair[1];
                    }
                }
            }
        } catch (Exception e) {
            // ignore
        }
        return null;
    }
}
