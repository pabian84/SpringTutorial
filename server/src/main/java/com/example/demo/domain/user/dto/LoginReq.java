package com.example.demo.domain.user.dto;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class LoginReq {
    @NotBlank(message = "아이디는 필수 입력값입니다.")
    private String id;
    @NotBlank(message = "비밀번호는 필수 입력값입니다.")
    private String password;
    private boolean isRememberMe; // 로그인 유지 여부
}