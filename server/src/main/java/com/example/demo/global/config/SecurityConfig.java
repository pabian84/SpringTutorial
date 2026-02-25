package com.example.demo.global.config;

import java.util.List;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import com.example.demo.domain.user.mapper.SessionMapper;
import com.example.demo.global.constant.SecurityConstants;
import com.example.demo.global.security.JwtAuthenticationFilter;
import com.example.demo.global.security.JwtTokenProvider;
import com.example.demo.global.util.CookieUtil;

import lombok.RequiredArgsConstructor;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtTokenProvider jwtTokenProvider;
    private final SessionMapper sessionMapper; // [추가] 필터에 넣어줘야 함
    private final CookieUtil cookieUtil; // 필터 주입용
    // CorsProperties 설정 클래스 주입
    private final CorsProperties corsProperties;

    // 비밀번호 암호화 기계 등록 (이게 있어야 로그인 가능)
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration authenticationConfiguration) throws Exception {
        return authenticationConfiguration.getAuthenticationManager();
    }

    // 2. 보안 필터 체인 설정 (문지기 설정)
    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .httpBasic(basic -> basic.disable()) // 기본 로그인 창 끄기
            .csrf(csrf -> csrf.disable()) // CSRF 끄기 (JWT 쓸 땐 필요 없음)
            .cors(cors -> cors.configurationSource(corsConfigurationSource())) // CORS 설정 적용
            .sessionManagement(session ->
                session.sessionCreationPolicy(SessionCreationPolicy.STATELESS)) // 세션 끄기 (JWT 필수)
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(
                    "/ws",
                    "/v3/api-docs/**", 
                    "/swagger-ui/**", 
                    "/api/user/login",
                    "/api/user/logout",
                    "/api/auth/check",
                    "/api/auth/refresh"
                ).permitAll()
                .anyRequest().authenticated()
            )
            // [수정] cookieUtil 추가 주입
            .addFilterBefore(new JwtAuthenticationFilter(jwtTokenProvider, sessionMapper, cookieUtil), UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();

        // 프론트엔드 주소. 하드코딩 제거 -> 설정값 사용. 쉼표(,)로 구분된 여러 도메인 지원
        // 콤마로 자른 뒤, 앞뒤 공백을 제거(.trim()) 해줌 -> 띄어쓰기 실수해도 OK
        config.setAllowedOrigins(corsProperties.getAllowedOrigins());
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);

        // 클라이언트에서 접근 가능한 헤더 설정 (토큰 갱신 시 필요할 수 있음)
        config.setExposedHeaders(List.of(SecurityConstants.AUTH_HEADER, SecurityConstants.REFRESH_HEADER));
        
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}