package com.example.demo.global.exception;

import lombok.AllArgsConstructor;
import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
@AllArgsConstructor
public enum ErrorCode {
    // 400 Bad Request
    INVALID_INPUT_VALUE(HttpStatus.BAD_REQUEST, "C001", "잘못된 입력값입니다."),
    INVALID_PASSWORD(HttpStatus.BAD_REQUEST, "A001", "비밀번호가 일치하지 않습니다."),

    // 401 Unauthorized (인증 문제)
    INVALID_TOKEN(HttpStatus.UNAUTHORIZED, "A002", "유효하지 않은 토큰입니다."),
    EXPIRED_TOKEN(HttpStatus.UNAUTHORIZED, "A003", "만료된 토큰입니다."),
    SESSION_EXPIRED(HttpStatus.UNAUTHORIZED, "A004", "세션이 만료되었거나 로그아웃 되었습니다."),
    SESSION_NOT_FOUND(HttpStatus.UNAUTHORIZED, "S001", "세션이 존재하지 않거나 만료되었습니다."),

    // 403 Forbidden (권한 없음)
    ACCESS_DENIED(HttpStatus.FORBIDDEN, "A005", "접근 권한이 없습니다."),
    NOT_MY_DEVICE(HttpStatus.FORBIDDEN, "A006", "본인의 기기만 로그아웃 할 수 있습니다."),

    // 404 Not Found (자원 문제)
    USER_NOT_FOUND(HttpStatus.NOT_FOUND, "U001", "사용자를 찾을 수 없습니다."),

    // 500 Internal Server Error
    INTERNAL_SERVER_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "C000", "서버 내부 오류입니다.");

    private final HttpStatus status;
    private final String code; // 프론트에서 식별할 코드 (예: A004)
    private final String message;
}