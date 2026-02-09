package com.example.demo.global.security;

import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.Date;
import java.util.Map;
import java.util.UUID;

import javax.crypto.SecretKey;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.stereotype.Component;

import com.example.demo.global.config.JwtProperties;
import com.example.demo.global.constant.SecurityConstants;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtBuilder;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Component
@RequiredArgsConstructor
public class JwtTokenProvider {

    private final JwtProperties jwtProperties;
    private final UserDetailsService userDetailsService;
    private SecretKey key;

    @PostConstruct
    protected void init() {
        this.key = Keys.hmacShaKeyFor(jwtProperties.getSecret().getBytes(StandardCharsets.UTF_8));
    }

    // 1. Refresh Token 생성 (기존 유지)
    public String createRefreshToken(String userId) {
        if (userId == null) {
            throw new IllegalArgumentException("User ID cannot be null for Access Token");
        }
        
        long refreshValidity = jwtProperties.getRefreshTokenValidityInSeconds();
        return createToken(userId, null, refreshValidity);
    }

    // 2. Access Token 생성 (세션 바인딩)
    public String createAccessToken(String userId, Long sessionId) {
        if (userId == null) {
            throw new IllegalArgumentException("User ID cannot be null for Access Token");
        }
        if (sessionId == null) {
            throw new IllegalArgumentException("Session ID cannot be null for Access Token");
        }
        return createToken(userId, Collections.singletonMap("sessionId", sessionId), jwtProperties.getAccessTokenValidityInSeconds());
    }

    private String createToken(String userId, Map<String, Object> claims, long validityInSeconds) {
        Date now = new Date();
        Date validity = new Date(now.getTime() + (validityInSeconds * 1000));

        // 빌더 생성 (기본 정보 세팅)
        JwtBuilder builder = Jwts.builder()
                .subject(userId)
                .id(UUID.randomUUID().toString()) // [핵심] 모든 토큰에 고유 ID 부여 (중복 방지)
                .issuedAt(now)
                .expiration(validity)
                .signWith(key);

        // 추가 클레임이 있으면 넣기 (Access Token용)
        if (claims != null && !claims.isEmpty()) {
            claims.forEach(builder::claim);
        }

        return builder.compact();
    }

    public Authentication getAuthentication(String token) {
        String userId = parseClaims(token).getSubject();
        
        UserDetails userDetails = userDetailsService.loadUserByUsername(userId);
        return new UsernamePasswordAuthenticationToken(userDetails, "", userDetails.getAuthorities());
    }

    // 안전하게 SessionId 꺼내기
    public Long getSessionId(String token) {
        return getSessionIdFromToken(token, false);
    }

    // 만료된 토큰에서도 SessionId 꺼내기 (로그아웃용)
    public Long getSessionIdFromExpiredToken(String token) {
        return getSessionIdFromToken(token, true);
    }

    // 토큰에서 UserId 추출 (유효한 토큰)
    public String getUserIdFromToken(String token) {
        return parseClaims(token).getSubject();
    }

    // 만료된 토큰에서도 UserId 추출 (로그아웃용)
    public String getUserIdFromExpiredToken(String token) {
        try {
            Claims claims = parseClaimsWithExpired(token);
            return claims.getSubject();
        } catch (Exception e) {
            log.error("UserId Parsing Error: {}", e.getMessage());
            return null;
        }
    }

    private Long getSessionIdFromToken(String token, boolean allowExpired) {
        try {
            Claims claims;
            if (allowExpired) {
                // 만료된 토큰에서도 Claims 추출
                claims = parseClaimsWithExpired(token);
            } else {
                claims = parseClaims(token);
            }
            
            Object sessionIdObj = claims.get("sessionId");

            if (sessionIdObj == null) {
                return null;
            }

            // Integer -> Long 안전 변환
            if (sessionIdObj instanceof Integer) {
                return ((Integer) sessionIdObj).longValue();
            } else if (sessionIdObj instanceof Long) {
                return (Long) sessionIdObj;
            } else {
                return Long.valueOf(sessionIdObj.toString());
            }
        } catch (Exception e) {
            log.error("SessionId Parsing Error: {}", e.getMessage());
            return null;
        }
    }

    // 3. 헤더에서 토큰 꺼내기 (Bearer 제거)
    public String resolveToken(HttpServletRequest req) {
        String bearerToken = req.getHeader(SecurityConstants.AUTH_HEADER);
        if (bearerToken != null && bearerToken.startsWith(SecurityConstants.TOKEN_PREFIX)) {
            return bearerToken.substring(SecurityConstants.TOKEN_PREFIX.length());
        }
        return null;
    }

    // 4. 토큰 유효성 검사
    public boolean validateToken(String token) {
        try {
            parseClaims(token);
            return true;
        } catch (ExpiredJwtException e) {
            log.info("만료된 토큰입니다. (Refresh 시도 예정)"); // 에러 아님
            return false;
        } catch (Exception e) {
            log.error("유효하지 않은 토큰입니다: {}", e.getMessage());
            return false;
        }
    }

    // 만료된 토큰에서도 Claims 추출 (로그아웃 시 세션 ID 획득용)
    private Claims parseClaimsWithExpired(String token) {
        try {
            return Jwts.parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
        } catch (ExpiredJwtException e) {
            // 만료되었지만 Claims는 가져올 수 있음
            log.debug("만료된 토큰에서 Claims 추출");
            return e.getClaims();
        }
    }

    // 내부적으로 중복되는 파싱 로직도 하나로 통일
    private Claims parseClaims(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
