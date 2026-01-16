package com.example.demo.global.security;

import java.nio.charset.StandardCharsets;
import java.util.Date;

import javax.crypto.SecretKey;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.stereotype.Component;

import com.example.demo.global.config.JwtProperties;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Component
@RequiredArgsConstructor // 생성자 주입 자동화 (코드가 확 줄어듭니다)
public class JwtTokenProvider {

    // @Value 대신 Properties 객체 주입
    private final JwtProperties jwtProperties;
    private final UserDetailsService userDetailsService;
    private SecretKey key;

    @PostConstruct
    protected void init() {
        // 비밀키를 암호화 객체로 변환
        this.key = Keys.hmacShaKeyFor(jwtProperties.getSecret().getBytes(StandardCharsets.UTF_8));
    }

    // 1. 토큰 생성 (Access, Refresh 둘 다)
    public String createToken(String userId, long validityInSeconds) {
        Date now = new Date();
        Date validity = new Date(now.getTime() + validityInSeconds * 1000);

        return Jwts.builder()
                .subject(userId) // 사용자 ID 넣기
                .issuedAt(now)
                .expiration(validity)
                .signWith(key) // 도장 찍기
                .compact();
    }
    
    public String createAccessToken(String userId) {
        return createToken(userId, jwtProperties.getAccessTokenValidityInSeconds());
    }
    
    public String createRefreshToken(String userId) {
        return createToken(userId, jwtProperties.getRefreshTokenValidityInSeconds());
    }

    // 2. 토큰에서 사용자 정보 꺼내기 (인증 객체 생성)
    public Authentication getAuthentication(String token) {
        String userId = Jwts.parser().verifyWith(key).build()
                .parseSignedClaims(token).getPayload().getSubject();
        
        UserDetails userDetails = userDetailsService.loadUserByUsername(userId);
        return new UsernamePasswordAuthenticationToken(userDetails, "", userDetails.getAuthorities());
    }

    // 3. 헤더에서 토큰 꺼내기 (Bearer 제거)
    public String resolveToken(HttpServletRequest req) {
        String bearerToken = req.getHeader("Authorization");
        if (bearerToken != null && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7);
        }
        return null;
    }

    // 4. 토큰 유효성 검사
    public boolean validateToken(String token) {
        try {
            Jwts.parser().verifyWith(key).build().parseSignedClaims(token);
            return true;
        } catch (io.jsonwebtoken.ExpiredJwtException e) {
            log.info("만료된 토큰입니다. (Refresh 시도 예정)"); // 에러 아님
            return false;
        } catch (Exception e) {
            log.error("유효하지 않은 토큰입니다: {}", e.getMessage());
            return false;
        }
    }
}