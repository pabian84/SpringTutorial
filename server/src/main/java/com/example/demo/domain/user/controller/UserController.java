package com.example.demo.domain.user.controller;

import com.example.demo.domain.user.dto.UserLoginReq;
import com.example.demo.domain.user.dto.UserRes;
import com.example.demo.domain.user.entity.AccessLog;
import com.example.demo.domain.user.entity.User;
import com.example.demo.domain.user.mapper.UserMapper;
import com.example.demo.domain.user.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;

import org.springframework.web.bind.annotation.*;
import java.util.*;

@Tag(name = "User API", description = "사용자/로그인 관련 API")
@RestController
@RequestMapping("/api/user")
@RequiredArgsConstructor
public class UserController {
    private final UserMapper userMapper;
    private final UserService userService;

    @Operation(summary = "로그인")
    @PostMapping("/login")
    public Map<String, Object> login(@RequestBody UserLoginReq req) {
        User user = userMapper.findById(req.getId());
        Map<String, Object> result = new HashMap<>();

        if (user != null && user.getPassword().equals(req.getPassword())) {
            userMapper.saveLog(user.getId(), "LOGIN");
            
            // [추가] 접속 상태를 ON으로 변경
            userService.updateUserStatus(user.getId(), true);

            result.put("status", "ok");
            UserRes userRes = new UserRes(user.getId(), user.getName());
            result.put("user", userRes);
        } else {
            result.put("status", "fail");
        }
        return result;
    }

    @Operation(summary = "로그아웃")
    @PostMapping("/logout")
    public void logout(@RequestBody Map<String, String> body) {
        String userId = body.get("userId");
        userMapper.saveLog(userId, "LOGOUT");
        
        // [추가] 접속 상태를 OFF로 변경
        userService.updateUserStatus(userId, false);
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