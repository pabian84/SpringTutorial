package com.example.demo.global.constant;

/**
 * JWT 관련 상수 (中央管理)
 */
public class JwtConstants {
    
    // Access Token 유효기간 (초)
    // application.yml의 jwt.access-token-validity-in-seconds와 일치해야 함
    public static final long ACCESS_TOKEN_VALIDITY_SECONDS = 15; // 테스트용 15초
    
    // Refresh Token 유효기간 (초) - 현재는 사용 안함
    public static final long REFRESH_TOKEN_VALIDITY_SECONDS = 604800; // 7일
    
    // Cookie 설정
    public static final int COOKIE_MAX_AGE_SESSION = -1;  // 브라우저 세션 (브라우저 닫으면 삭제)
    public static final int COOKIE_MAX_AGE_7_DAYS = 7 * 24 * 60 * 60; // 7일
    
    // 쿠키 이름
    public static final String ACCESS_TOKEN_COOKIE = "accessToken";
    public static final String REFRESH_TOKEN_COOKIE = "refreshToken";
    
    private JwtConstants() {
        // 유틸리티 클래스는 인스턴스화 방지
    }
}
