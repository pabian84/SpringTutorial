package com.example.demo.global.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "jwt") // yml에서 'jwt'로 시작하는 설정을 가져옴
public class JwtProperties {
    private String secret;
    private long accessTokenValidityInSeconds;  // access-token-validity-in-seconds 자동 매핑
    private long refreshTokenValidityInSeconds; // refresh-token-validity-in-seconds 자동 매핑
}