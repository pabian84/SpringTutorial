package com.example.demo.global.constant;

public class SecurityConstants {
    public static final String AUTH_HEADER = "Authorization";
    public static final String TOKEN_PREFIX = "Bearer ";
    public static final String REFRESH_HEADER = "Refresh-Token"; // 쿠키 이름
    
    // 로그 타입
    public static final String TYPE_LOGIN = "LOGIN";
    public static final String TYPE_LOGOUT = "LOGOUT";
    public static final String TYPE_KICK = "KICK"; // 강제 추방
}