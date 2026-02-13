# 로그아웃 Race Condition 분석 (수정)

## 1. 현재 코드

```typescript
const logout = useCallback(async (reason?: string) => {
    forceDisconnect();

    if (reason) showToast(reason, 'error');

    setAuthState({ authenticated: false, user: null, loading: false });

    // ❌ 문제: 여기가 아니라 앞에 있어야 함
    resetAuthCheck();

    localStorage.clear();

    try {
        await userApi.logout(undefined);
    } catch (e) {
        devLog('[AuthProvider] 로그아웃 API 오류:', e);
    }

    navigate('/', { replace: true });
    devLog('[AuthProvider] 로그아웃 완료');
}, [navigate, forceDisconnect]);
```

## 2. Race Condition 원인

**핵심 문제**: `resetAuthCheck()`가 `await` **뒤**에 있음

```
t=0: User clicks logout
t=1: logout() starts
t=2: setAuthState(authenticated=false)
t=3: userApi.logout() starts (async)
t=4: navigate('/') triggers useEffect
t=5: checkAuthStatus() starts (async)
t=6: userApi.logout() finishes
t=7: resetAuthCheck() called ← 너무 늦음!
t=8: checkAuthStatus() finishes ← 이미 끝남, 결과는 cached
```

## 3. 정확한 Race Condition 시퀀스

### Case 1: checkAuthStatus가 먼저 시작됨

```mermaid
sequenceDiagram
    participant User
    participant AuthProvider
    participant AuthUtility
    participant Axios
    participant Backend
    
    User->>AuthProvider: logout()
    AuthProvider->>AuthProvider: authenticated=false
    AuthProvider->>Axios: POST /api/user/logout
    
    Note over AuthProvider: navigate('/')
    
    AuthProvider->>AuthUtility: checkAuthStatus()
    AuthUtility->>Axios: GET /api/auth/check
    
    par logout API
        Axios->>Backend: POST /api/user/logout
        Backend-->>Axios: 200 OK
        Axios-->>AuthProvider: complete
    and auth check
        Axios->>Backend: GET /api/auth/check
        Backend-->>Axios: 401 (쿠키 삭제됨)
        Axios-->>AuthUtility: fail
        AuthUtility-->>AuthProvider: authenticated=false
    end
    
    AuthProvider->>AuthUtility: resetAuthCheck() ← Promise는 이미 완료됨
    AuthProvider->>navigate('/')
    
    Note: ✅ 정상 작동 (checkAuthStatus가 먼저 완료됨)
```

### Case 2: logout API가 먼저 완료됨

```mermaid
sequenceDiagram
    participant User
    participant AuthProvider
    participant AuthUtility
    participant Axios
    participant Backend
    
    User->>AuthProvider: logout()
    AuthProvider->>AuthProvider: authenticated=false
    AuthProvider->>Axios: POST /api/user/logout
    
    Note over AuthProvider: navigate('/')
    
    AuthProvider->>AuthUtility: checkAuthStatus()
    AuthUtility->>Axios: GET /api/auth/check
    
    par logout API
        Axios->>Backend: POST /api/user/logout
        Backend-->>Axios: 200 OK
        Axios-->>AuthProvider: complete
        AuthProvider->>AuthUtility: resetAuthCheck()
    and auth check
        Axios->>Backend: GET /api/auth/check
        
        Backend-->>Axios: 200 (쿠키 아직 삭제 안 됨!)
        Axios-->>AuthUtility: authenticated=true
        AuthUtility-->>AuthProvider: authenticated=true
        
        Note AuthProvider: ❌ 문제: 로컬은 false인데 true로 설정됨
    end
    
    AuthProvider->>navigate('/')
    
    Note: ❌ 문제: 인증이 복구된 것으로 처리됨
```

## 4. 핵심 문제

** logout API가 `/api/auth/check`보다 먼저 완료되면**:
1. 쿠키가 아직 삭제되지 않음
2. `/api/auth/check`가 200 반환
3. `authCheckResult = { authenticated: true }` 설정
4. `setAuthState({ authenticated: true, ... })` 실행
5. 사용자가 **로그인 상태로 돌아감**!

## 5. 해결책

`resetAuthCheck()`를 `await` **앞**으로 이동:

```typescript
const logout = useCallback(async (reason?: string) => {
    forceDisconnect();

    if (reason) showToast(reason, 'error');

    setAuthState({ authenticated: false, user: null, loading: false });

    // ✅ 먼저 리셋 (race condition 방지)
    resetAuthCheck();

    localStorage.clear();

    try {
        await userApi.logout(undefined);
    } catch (e) {
        devLog('[AuthProvider] 로그아웃 API 오류:', e);
    }

    navigate('/', { replace: true });
    devLog('[AuthProvider] 로그아웃 완료');
}, [navigate, forceDisconnect]);
```

### 해결된 시퀀스

```mermaid
sequenceDiagram
    participant User
    participant AuthProvider
    participant AuthUtility
    participant Axios
    participant Backend
    
    User->>AuthProvider: logout()
    AuthProvider->>AuthProvider: authenticated=false
    
    AuthProvider->>AuthUtility: ✅ resetAuthCheck() 먼저!
    AuthUtility->>AuthUtility: authCheckPromise = null<br/>authCheckResult = null
    
    AuthProvider->>Axios: POST /api/user/logout
    AuthProvider->>AuthProvider: navigate('/')
    
    AuthProvider->>AuthUtility: checkAuthStatus()
    AuthUtility->>Axios: GET /api/auth/check
    
    par logout API
        Axios->>Backend: POST /api/user/logout
        Backend-->>Axios: 200 OK
        Axios-->>AuthProvider: complete
    and auth check
        Axios->>Backend: GET /api/auth/check
        
        Backend-->>Axios: 200 또는 401
        Axios-->>AuthUtility: result
        AuthUtility-->>AuthProvider: authenticated=false 또는 true
        
        Note AuthProvider: 로컬은 이미 authenticated=false이므로<br/>아무 일도 안 일어남
    end
    
    Note: ✅ 어떤 순서로 완료되든 문제 없음
```

## 6. 결론

| 문제 | 원인 | 해결책 |
|------|------|--------|
| Race condition | `resetAuthCheck()`가 `await` 뒤에 있음 | `resetAuthCheck()`를 앞으로 이동 |
| 인증 상태 불일치 | logout API가 먼저 완료되면 쿠키가 삭제되기 전 `/api/auth/check`가 200 반환 | `resetAuthCheck()`가 먼저 실행되면 `/api/auth/check`가 새로운 요청을 보냄 (쿠키 삭제 후) |

**수정된 코드:**

```typescript
const logout = useCallback(async (reason?: string) => {
    forceDisconnect();

    if (reason) showToast(reason, 'error');

    setAuthState({ authenticated: false, user: null, loading: false });

    // ✅ 먼저 리셋
    resetAuthCheck();

    localStorage.clear();

    try {
        await userApi.logout(undefined);
    } catch (e) {
        devLog('[AuthProvider] 로그아웃 API 오류:', e);
    }

    navigate('/', { replace: true });
    devLog('[AuthProvider] 로그아웃 완료');
}, [navigate, forceDisconnect]);
```
