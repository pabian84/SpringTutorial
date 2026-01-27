package com.example.demo.global.security;

import java.io.IOException;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import com.example.demo.domain.user.mapper.UserSessionMapper;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenProvider jwtTokenProvider;
    private final UserSessionMapper sessionMapper; // DB 조회용

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        
        // 1. 요청에서 토큰 꺼내기
        String token = jwtTokenProvider.resolveToken(request);

        // 2. 토큰이 있고 유효하면 -> 인증 완료 도장 찍기
        if (token != null && jwtTokenProvider.validateToken(token)) {
            // 2. [추가] DB 생존 확인 (핵심!)
            // 토큰에 적힌 세션 ID가 DB에 진짜 있는지 확인
            Long sessionId = jwtTokenProvider.getSessionId(token);
            

            // [수정 핵심] 세션 ID가 없으면 -> 유령 토큰이므로 즉시 차단!
            if (sessionId == null) {
                log.warn("차단됨: 세션 ID가 없는 토큰입니다. (구버전 토큰이거나 손상됨)");
                response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Invalid Token: No Session ID");
                return; // 여기서 끝내야 함! (더 이상 진행 X)
            }

            if (sessionMapper.findById(sessionId) == null) {
                // DB에 없으면(로그아웃 당했으면) -> 인증 실패 처리!
                // 아무것도 안 하고 리턴하면 401 뜸 (또는 response.sendError 사용)
                log.warn("차단됨: DB에 없는 세션입니다. (이미 로그아웃됨) - ID: {}", sessionId);
                response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Session expired");
                return; 
            }

            // 3. 통과되면 인증 정보 설정 (기존)
            Authentication auth = jwtTokenProvider.getAuthentication(token);
            SecurityContextHolder.getContext().setAuthentication(auth); // "통과!"
        }

        // 3. 다음 단계로 진행
        filterChain.doFilter(request, response);
    }
}