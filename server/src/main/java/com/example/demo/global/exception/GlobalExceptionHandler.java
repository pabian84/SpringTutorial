package com.example.demo.global.exception;

import java.util.HashMap;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    // 우리가 발생시킨 RuntimeException을 잡아서 401로 변환
    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Map<String, String>> handleRuntimeException(RuntimeException e) {
        
        // 특정 에러 메시지인 경우 401(Unauthorized) 리턴
        if ("Session Expired or Logged Out".equals(e.getMessage()) || 
            "Invalid Refresh Token".equals(e.getMessage()) ||
            "Session Integrity Error".equals(e.getMessage()) ||
            e.getMessage().contains("Session Integrity Error")) {
            
            log.warn("인증 실패 예외 발생 -> 401 응답 변환: {}", e.getMessage());
            
            Map<String, String> body = new HashMap<>();
            body.put("error", "Unauthorized");
            body.put("message", e.getMessage());
            
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(body);
        }

        // 그 외 진짜 서버 에러는 500으로 처리
        log.error("서버 내부 오류 발생: ", e);
        Map<String, String> body = new HashMap<>();
        body.put("error", "Internal Server Error");
        body.put("message", e.getMessage());
        
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(body);
    }
}