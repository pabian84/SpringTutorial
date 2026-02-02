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
    // 추후 만료 시간이나 유저 정보가 필요하면 여기에 필드 추가
}