package com.example.demo.global.util;

import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

/**
 * 쿠키 생성을 위한 유틸리티 클래스
 */
@Component
public class CookieUtil {

    /**
     * Token 쿠키 생성
     */
    public ResponseCookie createTokenCookie(String cookieName, String token, int maxAge) {
        return createTokenCookie(cookieName, token, maxAge, false);
    }

    /**
     * Token 쿠키 생성
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
    public ResponseCookie deleteCookie(String cookieName) {
        return deleteCookie(cookieName, false);
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
}
