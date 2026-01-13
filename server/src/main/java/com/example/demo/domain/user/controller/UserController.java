package com.example.demo.domain.user.controller;

import java.util.List;
import java.util.Map;

import org.springframework.web.bind.annotation.CookieValue;
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
import jakarta.servlet.http.Cookie;
    import jakarta.servlet.http.HttpServletRequest;
    import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;

@Tag(name = "User API", description = "사용자/로그인 관련 API")
@RestController
@RequestMapping("/api/user")
@RequiredArgsConstructor
public class UserController {
    private final UserService userService;

    @Operation(summary = "로그인")
    @PostMapping("/login")
    public Map<String, Object> login(@RequestBody UserLoginReq req, HttpServletRequest request, HttpServletResponse response) {
        // IP와 브라우저 정보를 추출해서 서비스로 넘김
        String ip = request.getRemoteAddr();
        String userAgent = request.getHeader("User-Agent");
        
        // 서비스 호출
        Map<String, Object> result = userService.login(req, ip, userAgent);

        if ("ok".equals(result.get("status"))) {
            String refreshToken = (String) result.get("refreshToken");
            
            // [정석] 쿠키 굽기
            Cookie cookie = new Cookie("refreshToken", refreshToken);
            cookie.setHttpOnly(true); // 자바스크립트 접근 불가 (보안)
            cookie.setSecure(false);  // 로컬 개발이라 false (https면 true)
            cookie.setPath("/");      // 모든 경로에서 유효
            
            // [핵심] 로그인 유지 체크 여부에 따른 수명 결정
            if (req.isRememberMe()) {
                cookie.setMaxAge(7 * 24 * 60 * 60); // 7일 (브라우저 꺼도 유지)
            } else {
                cookie.setMaxAge(-1); // 세션 쿠키 (브라우저 끄면 삭제, 탭 닫으면 유지)
            }
            response.addCookie(cookie);
        }
        
        return result;
    }

    @Operation(summary = "로그아웃")
    @PostMapping("/logout")
    public void logout(@RequestBody Map<String, String> body, 
                       @CookieValue(value = "refreshToken", required = false) String cookieToken,
                       HttpServletResponse response) {
        // 프론트에서 { "userId": "...", "refreshToken": "..." } 이렇게 보내줘야 함
        String userId = body.get("userId");
        // 프론트가 토큰을 안 보내주니 쿠키에서 꺼내 씁니다.
        if (userId != null && cookieToken != null) {
            userService.logout(userId, cookieToken);
        }
        
        // 쿠키 삭제 (수명 0)
        Cookie cookie = new Cookie("refreshToken", null);
        cookie.setMaxAge(0);
        cookie.setPath("/");
        response.addCookie(cookie);
    }

    @Operation(summary = "로그아웃(모든 기기)")
    @PostMapping("/logoutAllDevices")
    public void logoutAllDevices(@RequestBody Map<String, String> body, HttpServletResponse response) {
        String userId = body.get("userId");
        if (userId != null) {
            userService.logoutAllDevices(userId);
        }
        // 내 쿠키도 삭제
        Cookie cookie = new Cookie("refreshToken", null);
        cookie.setMaxAge(0);
        cookie.setPath("/");
        response.addCookie(cookie);
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