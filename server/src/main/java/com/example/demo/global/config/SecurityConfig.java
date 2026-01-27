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

import com.example.demo.domain.user.mapper.UserSessionMapper;
import com.example.demo.global.security.JwtAuthenticationFilter;
import com.example.demo.global.security.JwtTokenProvider;

import lombok.RequiredArgsConstructor;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtTokenProvider jwtTokenProvider;
    private final UserSessionMapper sessionMapper; // [추가] 필터에 넣어줘야 함

    // 1. 비밀번호 암호화 기계 등록 (이게 있어야 로그인 가능)
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
                .requestMatchers("/api/user/login", "/api/user/refresh", "/ws/**", "/swagger-ui/**", "/v3/api-docs/**").permitAll() // 로그인, 소켓, 문서는 통과
                .anyRequest().authenticated() // 나머지는 출입증(JWT) 검사
            )
            // JWT 검사 필터를 먼저 실행
            .addFilterBefore(new JwtAuthenticationFilter(jwtTokenProvider, sessionMapper), UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    // 3. CORS 설정 (프론트엔드 5173 포트 허용)
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();

        // 프론트엔드 주소
        config.setAllowedOrigins(List.of("http://localhost:5173"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);

        // 클라이언트에서 접근 가능한 헤더 설정 (토큰 갱신 시 필요할 수 있음)
        config.setExposedHeaders(List.of("Authorization", "Refresh-Token"));
        
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}