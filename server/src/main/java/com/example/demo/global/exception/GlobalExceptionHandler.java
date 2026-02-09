package com.example.demo.global.exception;

import java.time.LocalDateTime;
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

    // CustomException 처리
    @ExceptionHandler(CustomException.class)
    public ResponseEntity<Map<String, Object>> handleCustomException(CustomException e) {
        ErrorCode errorCode = e.getErrorCode();
        
        Map<String, Object> body = new HashMap<>();
        body.put("timestamp", LocalDateTime.now());
        body.put("code", errorCode.getCode()); // 예: A004
        body.put("error", errorCode.getStatus().name());
        body.put("message", errorCode.getMessage());

        return ResponseEntity
                .status(errorCode.getStatus())
                .body
                (body);
    }

    // 나머지 예외 처리 (서버 오류 등)
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleException(Exception e) {
        // 그 외 진짜 서버 에러는 500으로 처리
        log.error("서버 내부 오류 발생: ", e);
        Map<String, Object> body = new HashMap<>();
        body.put("timestamp", LocalDateTime.now());
        body.put("code", ErrorCode.INTERNAL_SERVER_ERROR.getCode());
        body.put("error", "Internal Server Error");
        body.put("message", e.getMessage());
        
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(body);
    }
}