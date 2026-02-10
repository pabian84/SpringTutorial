# AccessToken Only 리팩토링 계획

## 목표
- refreshToken 쿠키 제거하고 accessToken만 사용
- JWT 유효기간 상수化管理
- WebSocket 인증 임시 수정 (myId만 인증)
- 프론트엔드同步 수정

---

## 1단계: JwtConstants.java 생성 (백엔드)
**파일**: `src/main/java/com/example/demo/global/constant/JwtConstants.java`

```java
public class JwtConstants {
    // Access Token 유효기간 (초) - application.yml과 일치
    public static final long ACCESS_TOKEN_VALIDITY_SECONDS = 15; // 테스트용 15초

    // Cookie 설정
    public static final int COOKIE_MAX_AGE_SESSION = -1;  // 브라우저 세션
    public static final int COOKIE_MAX_AGE_7_DAYS = 7 * 24 * 60 * 60;

    // 쿠키 이름
    public static final String ACCESS_TOKEN_COOKIE = "accessToken";
}
```

---

## 2단계: application.yml 업데이트 (백엔드)
**파일**: `src/main/resources/application.yml`

```yaml
jwt:
  secret: ${JWT_SECRET:your-secret-key-here}
  access-token-validity-in-seconds: 15  # 테스트용 15초
  refresh-token-validity-in-seconds: 604800  # 사용 안함 (남겨둠)
```

---

## 3단계: CookieUtil 단순화 (백엔드)
**파일**: `src/main/java/com/example/demo/global/util/CookieUtil.java`

- `createRefreshTokenCookie()` 제거
- `createAccessTokenCookie()`만 유지

---

## 4단계: UserController 수정 (백엔드)
**파일**: `src/main/java/com/example/demo/domain/user/controller/UserController.java`

1. `cookieUtil.createRefreshTokenCookie()` 호출 제거
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

## 5단계: SessionController 정리 (백엔드)
**파일**: `src/main/java/com/example/demo/domain/user/controller/SessionController.java`

1. `refresh()` endpoint 제거
2. `CookieUtil` 관련 refreshToken 코드 제거
3. 쿠키 삭제 시 accessToken만 삭제

---

## 6단계: SessionService 정리 (백엔드)
**파일**: `src/main/java/com/example/demo/domain/user/service/SessionService.java`

1. `refresh()` 메서드 제거 (사용 안함)
2. `getKeepLogin()` 제거 (사용 안함)

---

## 7단계: LoginRes DTO 수정 (백엔드)
**파일**: `src/main/java/com/example/demo/domain/user/dto/LoginRes.java`

```java
// refreshToken 필드 제거
private String accessToken;
private UserRes user;
```

---

## 8단계: WebSocket 인증 임시 수정 (백엔드)
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

## 9단계: auth.ts 상수 업데이트 (프론트엔드)
**파일**: `client/src/constants/auth.ts`

```typescript
export const AUTH_CONSTANTS = {
  // 토큰 만료 시간 (초) - 백엔드와 일치
  IS_TEST_MODE: import.meta.env.VITE_IS_TEST_MODE === 'true' || true,
  TEST_TOKEN_EXPIRY: parseInt(import.meta.env.VITE_TOKEN_EXPIRY_SECONDS || '15', 10), // 15초로 변경
  PROD_TOKEN_EXPIRY: 1800,

  // Refresh Token 관련 상수 제거 (사용 안함)
  // REFRESH_TOKEN_EXPIRY: 604800,  // 제거

  // 토큰 버퍼
  BUFFER_TEST: 2000,
  BUFFER_PROD: 300000,

  // 재연결 타임아웃
  RECONNECT_DELAY_TOKEN_REFRESH: 500,
  RECONNECT_DELAY_NORMAL: 3000,
  RECONNECT_DELAY_INITIAL: 200,
  RECONNECT_DELAY_FORCE: 100,

  NAVIGATE_DELAY_LOGIN: 100,
  REFRESH_TIMEOUT: 10000,
} as const;
```

---

## 10단계: authUtility.ts 정리 (프론트엔드)
**파일**: `client/src/utils/authUtility.ts`

1. `refreshToken()` 함수 제거 (사용 안함)
2. `deleteRefreshTokenCookie()` 제거
3. `isRefreshing()` 관련 로직 제거
4. 토큰 갱신 관련 코드 제거

```typescript
// 제거할 함수들:
// - refreshToken()
// - deleteRefreshTokenCookie()
// - isRefreshing()
// - setRefreshing()
// - addRefreshSubscriber()
// - onRefreshed()

// 단순화된 getAccessToken()
export const getAccessToken = (): string | null => {
  return localStorage.getItem('accessToken');
};
```

---

## 11단계: axiosConfig.ts 정리 (프론트엔드)
**파일**: `client/src/utils/axiosConfig.ts`

1. `/refresh` 관련 인터셉터 로직 제거
2. 토큰 갱신 관련 코드 제거
3. 401 응답 시 즉시 로그아웃

```typescript
// 변경: 401 시 갱신 시도 없이 바로 로그아웃
if (status === 401) {
  logout();
  return Promise.reject(error);
}
```

---

## 12단계: Login.tsx 정리 (프론트엔드)
**파일**: `client/src/pages/Login.tsx`

- `getTokenExpirySeconds` import 제거 (단순화)

---

## 13단계: WebSocketProvider.tsx 정리 (프론트엔드)
**파일**: `client/src/contexts/WebSocketProvider.tsx`

1. `refreshToken` import 제거
2. `isRefreshing` import 제거
3. 토큰 갱신 관련 로직 제거

```typescript
// 변경 전
import { refreshToken, isRefreshing, extractUserIdFromToken } from '../utils/authUtility';

// 변경 후
import { extractUserIdFromToken } from '../utils/authUtility';

// WebSocket 연결 시 토큰만 전달 (갱신 로직 제거)
const ws = new WebSocket(`${WS_URL}/ws?userId=${myId}&token=${token}`);
```

---

## 14단계: sessionApi.ts 정리 (프론트엔드)
**파일**: `client/src/api/sessionApi.ts`

```typescript
export const sessionApi = {
  // refreshToken API 제거
  // refreshToken: async () => { ... },

  getMySessions: async () => { ... },
  revokeSession: async (targetSessionId: number) => { ... },
  revokeOthers: async () => { ... },
  revokeAll: async () => { ... },
  getOnlineUsers: async () => { ... },
};
```

---

## 예상 변경 파일 목록

### 백엔드 (7개)
| 파일 | 변경 내용 |
|------|----------|
| `JwtConstants.java` | **신규 생성** |
| `application.yml` | access-token-validity: 15초로 변경 |
| `CookieUtil.java` | refreshToken 메서드 제거 |
| `UserController.java` | refreshToken 쿠키 제거 |
| `SessionController.java` | refresh endpoint 제거 |
| `SessionService.java` | refresh 메서드 제거 |
| `LoginRes.java` | refreshToken 필드 제거 |
| `JwtHandshakeInterceptor.java` | 인증 로직 임시 수정 |

### 프론트엔드 (6개)
| 파일 | 변경 내용 |
|------|----------|
| `constants/auth.ts` | 토큰 만료 15초로 변경, refresh 상수 제거 |
| `utils/authUtility.ts` | refreshToken 함수 제거 |
| `utils/axiosConfig.ts` | 갱신 로직 제거 |
| `pages/Login.tsx` | import 정리 |
| `contexts/WebSocketProvider.tsx` | refreshToken 로직 제거 |
| `api/sessionApi.ts` | refreshToken API 제거 |

---

## 테스트 체크리스트

### 백엔드 테스트
- [ ] 로그인 시 accessToken만 반환
- [ ] accessToken으로 API 호출 성공
- [ ] accessToken 만료 시 401 반환
- [ ] WebSocket 연결 시 userId로 인증

### 프론트엔드 테스트
- [ ] 로그인 후 Dashboard 이동
- [ ] 토큰 만료 시 로그인 페이지로 이동
- [ ] WebSocket 정상 연결
- [ ] 재로그인 시 정상 동작

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
