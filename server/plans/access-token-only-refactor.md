# AccessToken Only 리팩토링 계획

## 목표
- refreshToken 쿠키 제거하고 accessToken만 사용
- JWT 유효기간 상수化管理
- WebSocket 인증 임시 수정

---

## 1단계: JwtConstants.java 생성
**파일**: `src/main/java/com/example/demo/global/constant/JwtConstants.java`

```java
public class JwtConstants {
    // Access Token 유효기간 (초)
    public static final long ACCESS_TOKEN_VALIDITY_SECONDS = 15; // 테스트용 15초

    // Cookie 설정
    public static final int COOKIE_MAX_AGE_SESSION = -1;  // 브라우저 세션
    public static final int COOKIE_MAX_AGE_7_DAYS = 7 * 24 * 60 * 60;

    // 쿠키 이름
    public static final String ACCESS_TOKEN_COOKIE = "accessToken";
}
```

---

## 2단계: JwtProperties 업데이트
**파일**: `src/main/resources/application.yml`

```yaml
jwt:
  secret: ${JWT_SECRET:your-secret-key-here}
  access-token-validity-in-seconds: 15  # 테스트용 15초
  refresh-token-validity-in-seconds: 604800  # 7일 (현재는 사용 안함)
```

---

## 3단계: CookieUtil 단순화
**파일**: `src/main/java/com/example/demo/global/util/CookieUtil.java`

- `createRefreshTokenCookie()` 제거
- `createAccessTokenCookie()`만 유지

---

## 4단계: UserController 수정
**파일**: `src/main/java/com/example/demo/domain/user/controller/UserController.java`

1. `createRefreshTokenCookie()` 호출 제거
2. 로그인 응답에서 refreshToken 제거
3. accessToken만 클라이언트에 반환

```java
// 변경 전
body.put("accessToken", result.getAccessToken());
body.put("refreshToken", result.getRefreshToken());
body.put("user", result.getUser());

// 변경 후
body.put("accessToken", result.getAccessToken());
body.put("user", result.getUser());
```

---

## 5단계: SessionController 정리
**파일**: `src/main/java/com/example/demo/domain/user/controller/SessionController.java`

1. `refresh()` endpoint 제거
2. `createRefreshTokenCookie` 관련 코드 제거
3. 쿠키 삭제 시 accessToken만 삭제

---

## 6단계: SessionService 정리
**파일**: `src/main/java/com/example/demo/domain/user/service/SessionService.java`

1. `refresh()` 메서드 제거 (사용 안함)
2. `getKeepLogin()` 제거 (사용 안함)

---

## 7단계: WebSocket 인증 임시 수정
**파일**: `src/main/java/com/example/demo/global/config/JwtHandshakeInterceptor.java`

토큰 유효성 검사를 통과하지 못해도 `userId`만 추출하여 인증:

```java
// 변경 전: 토큰 유효성 검사 통과해야 함
if (token != null && jwtTokenProvider.validateToken(token)) { ... }

// 변경 후: userId만 추출하면 허용 (임시)
String userId = getUserIdFromToken(req);
if (userId != null) {
    attributes.put("userId", userId);
    return true;
}
```

**파일**: `src/main/java/com/example/demo/handler/WebSocketHandler.java`

```java
// 쿼리 파라미터에서 userId 직접 추출
private String getUserIdFromToken(HttpServletRequest req) {
    String token = req.getParameter("token");
    if (token != null) {
        return jwtTokenProvider.getUserIdFromExpiredToken(token);
    }
    return req.getParameter("userId");
}
```

---

## 8단계: LoginRes DTO 수정
**파일**: `src/main/java/com/example/demo/domain/user/dto/LoginRes.java`

```java
// refreshToken 필드 제거
private String accessToken;
private UserRes user;
```

---

## 9단계: 테스트

### 테스트 케이스
1. ✅ 로그인 시 accessToken만 반환
2. ✅ accessToken으로 API 호출 성공
3. ✅ accessToken 만료 시 401 반환 → 재로그인 필요
4. ✅ WebSocket 연결 시 userId로 인증

---

## 웹소켓 인증 개선 방안 (나중에)

### 옵션 A: 세션 기반 인증
- WebSocket 연결 시 이미 로그인된 세션인지 DB 확인
- `SessionMapper`로 userId로 모든 세션 조회

### 옵션 B: 별도 WebSocket 토큰
- WebSocket 전용 짧은 유효기간 토큰 발급
- `/api/ws/connect?token=xxx` 형태

### 옵션 C: Redis 기반
- Redis에 WebSocket 세션 매핑
- 실시간 세션 유효성 검증

---

## 예상 변경 파일 목록
| 파일 | 변경 내용 |
|------|----------|
| `JwtConstants.java` | **신규 생성** |
| `CookieUtil.java` | refreshToken 메서드 제거 |
| `UserController.java` | refreshToken 쿠키 제거 |
| `SessionController.java` | refresh endpoint 제거 |
| `SessionService.java` | refresh 메서드 제거 |
| `LoginRes.java` | refreshToken 필드 제거 |
| `JwtHandshakeInterceptor.java` | 인증 로직 임시 수정 |
| `WebSocketHandler.java` | userId 추출 로직 수정 |
