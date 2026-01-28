package com.example.demo.domain.user.dto;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class LoginReq {
    private String id;
    private String password;
    private boolean isRememberMe; // 로그인 유지 여부
}