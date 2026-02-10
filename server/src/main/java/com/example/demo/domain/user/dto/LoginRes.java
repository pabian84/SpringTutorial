package com.example.demo.domain.user.dto;

import com.example.demo.domain.user.entity.User;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
@AllArgsConstructor
public class LoginRes {
    private String accessToken;
    private User user;
}
