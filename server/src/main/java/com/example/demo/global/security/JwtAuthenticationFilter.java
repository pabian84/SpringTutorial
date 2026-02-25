package com.example.demo.global.security;

import java.io.IOException;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import com.example.demo.domain.user.mapper.SessionMapper;
import com.example.demo.global.util.CookieUtil;

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
    private final SessionMapper sessionMapper;
    private final CookieUtil cookieUtil;

    /**
     * 필터를 타지 않는 경로 (인증 로직 자체를 처리하는 경로들)
     */
    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return "/api/user/login".equals(request.getRequestURI());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String token = jwtTokenProvider.resolveToken(request);

        // 1. 토큰이 없는 경우 -> 다음 필터(Spring Security)에서 처리하도록 위임
        if (token == null) {
            filterChain.doFilter(request, response);
            return;
        }

        // 2. 토큰이 있지만 만료된 경우 (validateToken == false)
        // -> 쿠키를 지우지 않음! 프론트엔드가 Refresh Token으로 갱신할 기회를 줘야 함.
        if (!jwtTokenProvider.validateToken(token)) {
            filterChain.doFilter(request, response);
            return;
        }

        // 3. 토큰이 유효한 경우 (서명 OK, 만료 안됨)
        Long sessionId = jwtTokenProvider.getSessionId(token);
        // 세션 ID가 없으면 -> 유령 토큰이므로 즉시 차단!
        if (sessionId == null) {
            log.warn("Invalid Token Structure: No Session ID - URL: {}", request.getRequestURL());
            clearCookieAndFail(request, response, "Invalid Token");
            return;
        }

        // 4. [핵심] DB 세션 존재 여부 확인 (강퇴 여부 체크)
        if (sessionMapper.findBySessionId(sessionId) == null) {
            log.warn("Session Revoked (Kicked) - ID: {}, URL: {}", sessionId, request.getRequestURL());
            // 세션이 DB에서 사라진 경우에만 확실하게 쿠키를 삭제함 (데드락 방지)
            clearCookieAndFail(request, response, "Session Revoked");
            return;
        }

        // 5. 인증 성공
        Authentication auth = jwtTokenProvider.getAuthentication(token);
        SecurityContextHolder.getContext().setAuthentication(auth);
        // 마지막 접속 시간 업데이트 (세션 활동 추적)
        sessionMapper.updateLastAccessedAt(sessionId);
        // 다음 단계로 진행
        filterChain.doFilter(request, response);
    }

    private void clearCookieAndFail(HttpServletRequest request, HttpServletResponse response, String msg) throws IOException {
        boolean isHttps = "https".equalsIgnoreCase(request.getScheme());
        String cookieHeader = cookieUtil.deleteCookie("accessToken", isHttps).toString();
        response.addHeader("Set-Cookie", cookieHeader);
        response.sendError(HttpServletResponse.SC_UNAUTHORIZED, msg);
    }
}