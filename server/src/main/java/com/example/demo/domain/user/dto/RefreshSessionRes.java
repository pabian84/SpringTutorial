package com.example.demo.domain.user.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class RefreshSessionRes {
    private String accessToken;
    private String refreshToken;  // Refresh Token Rotation을 위한 새 Refresh Token
}
