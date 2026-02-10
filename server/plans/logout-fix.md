# 로그아웃 무한 루프 수정 계획 (복합 방식)

## 목표
1. 백엔드에서 logout을 인증 없이 허용 (SecurityConfig)
2. 프론트엔드에서 먼저 UX 정리 (localStorage 선택적 삭제)
3. axiosConfig에서 401/403 적절히 처리

---

## 1단계: SecurityConfig 수정
**파일**: `src/main/java/com/example/demo/global/config/SecurityConfig.java`

```java
// /api/user/logout을 permitAll()로 변경
.requestMatchers("/api/user/logout").permitAll()
```

---

## 2단계: UserController 수정
**파일**: `src/main/java/com/example/demo/domain/user/controller/UserController.java`

userId를 body에서 받도록 변경:

```java
@PostMapping("/logout")
public ResponseEntity<?> logout(
        @RequestBody(required = false) Map<String, String> body,
        HttpServletRequest request,
        HttpServletResponse response) {

    // 1. body에서 userId 가져오기 (우선)
    String userId = (body != null) ? body.get("userId") : null;

    // 2. 없으면 토큰에서 추출
    if (userId == null) {
        String token = jwtTokenProvider.resolveToken(request);
        userId = jwtTokenProvider.getUserIdFromExpiredToken(token);
    }

    // 3. userId가 있으면 처리
    if (userId != null) {
        String userAgent = request.getHeader("User-Agent");
        String ipAddress = request.getRemoteAddr();

        // 세션 ID 조회 (있으면 삭제)
        String token = jwtTokenProvider.resolveToken(request);
        if (token != null && jwtTokenProvider.validateToken(token)) {
            Long sessionId = jwtTokenProvider.getSessionId(token);
            if (sessionId != null) {
                userService.logout(userId, sessionId, userAgent, ipAddress);
                sessionService.forceDisconnectOne(userId, sessionId);
            }
        }
    }

    // 4. 쿠키 삭제
    boolean isHttps = "https".equalsIgnoreCase(request.getScheme());
    ResponseCookie accessCookie = cookieUtil.deleteCookie("accessToken", isHttps);
    response.addHeader("Set-Cookie", accessCookie.toString());

    return ResponseEntity.ok().body("로그아웃 되었습니다.");
}
```

---

## 3단계: authUtility 수정 (프론트엔드)
**파일**: `client/src/utils/authUtility.ts`

선택적 localStorage 삭제:

```typescript
// 삭제하지 않을 키 목록
const PROTECTED_KEYS = ['theme', 'languagePreference', 'lastVisitedPage'];

export const logout = async (reason?: string): Promise<void> => {
    if (reason) {
        showToast(reason, 'error');
    }

    // 1. 선택적 삭제 (_protected_keys 제외)
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
        if (!PROTECTED_KEYS.includes(key)) {
            localStorage.removeItem(key);
        }
    });

    // 2. 로그아웃 이벤트 발생
    emitLogoutEvent();

    // 3. 백엔드 로그아웃 (선택적 - 실패해도 무시)
    try {
        await userApi.logout(localStorage.getItem('myId'));
    } catch (e) {
        devError(e);
    }
};
```

---

## 4단계: userApi 수정 (프론트엔드)
**파일**: `client/src/api/userApi.ts`

userId를 body로 전달:

```typescript
export const userApi = {
    logout: async (userId?: string | null) => {
        const { data } = await axios.post('/api/user/logout', { userId });
        return data;
    },
    // ...
};
```

---

## 5단계: axiosConfig 수정 (프론트엔드)
**파일**: `client/src/utils/axiosConfig.ts`

401/403 적절히 처리:

```typescript
// 1. 로그아웃 요청은 401/403 모두 성공으로 처리
if (originalRequest.url?.includes('/logout')) {
    return Promise.resolve({ data: 'ok' });
}

// 2. 401 토큰 만료
if (status === 401 && !originalRequest._retry) {
    originalRequest._retry = true;
    showToast('세션이 만료되었습니다.', 'error');
    logout();
    return Promise.reject(error);
}
```

---

## 예상 변경 파일

### 백엔드 (2개)
| 파일 | 변경 내용 |
|------|----------|
| `SecurityConfig.java` | /logout permitAll() 추가 |
| `UserController.java` | body에서 userId 받도록 변경 |

### 프론트엔드 (3개)
| 파일 | 변경 내용 |
|------|----------|
| `authUtility.ts` | 선택적 삭제 + userApi.logout 호출 |
| `userApi.ts` | userId body로 전달 |
| `axiosConfig.ts` | 401/403 적절히 처리 |

---

## 테스트 체크리스트
- [ ] 로그아웃 시 토스트 한 번만 출력
- [ ] 로그인 페이지로 정상 이동
- [ ] theme, languagePreference는 유지
- [ ] 재로그인 가능
- [ ] 백엔드 세션 정상 삭제
