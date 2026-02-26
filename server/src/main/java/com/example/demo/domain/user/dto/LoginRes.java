package com.example.demo.domain.user.dto;

import com.example.demo.domain.user.entity.User;
import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LoginRes {
    private String accessToken;
    private User user;
    private String deviceId; // [추가] 기기 식별값
}