package com.example.demo.domain.user.controller;

import java.util.List;
import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.demo.domain.user.dto.UserLoginReq;
import com.example.demo.domain.user.dto.UserRes;
import com.example.demo.domain.user.entity.AccessLog;
import com.example.demo.domain.user.service.UserService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;

@Tag(name = "User API", description = "사용자/로그인 관련 API")
@RestController
@RequestMapping("/api/user")
@RequiredArgsConstructor
public class UserController {
    private final UserService userService;

    @Operation(summary = "로그인")
    @PostMapping("/login")
    public Map<String, Object> login(@RequestBody UserLoginReq req, HttpServletRequest request) {
        // IP와 브라우저 정보를 추출해서 서비스로 넘김
        String ip = request.getRemoteAddr();
        String userAgent = request.getHeader("User-Agent");
        
        return userService.login(req, ip, userAgent);
    }

    @Operation(summary = "로그아웃")
    @PostMapping("/logout")
    public void logout(@RequestBody Map<String, String> body) {
        // 프론트에서 { "userId": "...", "refreshToken": "..." } 이렇게 보내줘야 함
        String userId = body.get("userId");
        String refreshToken = body.get("refreshToken");
        
        userService.logout(userId, refreshToken);
    }

    @Operation(summary = "로그아웃(모든 기기)")
    @PostMapping("/logoutAllDevices")
    public void logoutAllDevices(@RequestBody Map<String, String> body) {
        userService.logout(body.get("userId"));
    }

    @Operation(summary = "접속 중인 사용자 조회")
    @GetMapping("/list")
    public List<UserRes> list() {
        // [수정] 전체 리스트 대신 접속 중인 리스트 반환
        return userService.getOnlineUserList();
    }

    @Operation(summary = "사용자 활동 로그 조회")
    @GetMapping("/logs/{userId}")
    public List<AccessLog> logs(@PathVariable("userId") String userId) {
        return userService.getLogs(userId);
    }
}