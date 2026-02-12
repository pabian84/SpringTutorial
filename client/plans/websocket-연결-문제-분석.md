# WebSocket 연결 문제 분석

## 문제 개요

**현상**: 로그인 후 새로고침하면 웹소켓이 끊김

## 시나리오별 분석

### 시나리오 1: 정상 로그인

```
1. 사용자가 로그인 (/api/user/login)
   ↓
2. AuthProvider.login() 실행
   - resetAuthCheck()
   - setAuthState({ authenticated: true })
   - showToast("환영합니다"
   - setTimeout(() => navigate('/dashboard'), 100ms)
   ↓
3. Dashboard 마운트
   ↓
4. WebSocketProvider 초기 연결 시도
   - isLoggedOutRef.current = true (초기값)
   - setTimeout(() => checkAuthStatus(), 200ms)
   ↓
5. checkAuthStatus() 결과: authenticated = true
   ↓
6. connectSocket() 실행 → 연결 성공

결과: 정상 연결
```

### 시나리오 2: 로그인 후 새로고침

```
1. 사용자가 대시보드에 있음 (웹소켓 연결 중)
   ↓
2. 사용자가 브라우저 새로고침 (F5)
   ↓
3. 전체 컴포넌트 언마운트 → 마운트
   ↓
4. WebSocketProvider 마운트
   - isLoggedOutRef.current = true (초기값!)
   ↓
5. 초기 연결 시도 useEffect 실행
   - setTimeout(() => checkAuthStatus(), 200ms)
   ↓
6. 200ms 후 checkAuthStatus() 실행
   - authenticated = true
   ↓
7. connectSocket() 실행 → 연결 성공?

문제점:
- isLoggedOutRef.current = true로 초기화되어
  connectSocket()에서 조기 리턴 가능성
- WebSocketProvider의 connectSocket() 함수:
  ```typescript
  const connectSocket = useCallback(async () => {
    if (isLoggedOutRef.current) {
      return;  // 문제: isLoggedOutRef가 true라서 리턴
    }
    // ...
  }, []);
  ```

결과: 웹소켓 연결 실패 (끊김)
```

### 시나리오 3: 페이지 이동

```
1. 사용자가 대시보드에서 다른 페이지로 이동
   (예: /cesium, /threejs 등)
   ↓
2. 웹소켓 연결 유지?
   ↓
3. 페이지별 동작:
   - Dashboard: 웹소켓 메시지 수신
   - CesiumDetail: 웹소켓 메시지 수신?
   - ThreeJsDetail: 웹소켓 메시지 수신?

결과: 대부분의 페이지에서 웹소켓 연결 유지됨
```

### 시나리오 4: 로그아웃

```
1. 사용자가 로그아웃 버튼 클릭
   ↓
2. AuthProvider.logout() 실행
   - isLoggedOutRef는 AuthProvider에 없음
   ↓
3. handleLogout() 호출
   ↓
4. authLogout 이벤트 발생
   ↓
5. WebSocketProvider의 handleLogout() 실행
   - isLoggedOutRef.current = true
   - socket.close()
   ↓

결과: 정상 로그아웃, 웹소켓 연결 해제
```

---

## 문제 원인 분석

### 원인 1: isLoggedOutRef 초기값

```typescript
// WebSocketProvider.tsx
const isLoggedOutRef = useRef(true);  // 초기값: true
```

**문제**: 새로고침 시 `true`로 설정되어 초기 연결 시도 차단

### 원인 2: forceReconnect 미호출

```typescript
// AuthProvider.tsx의 login()
setTimeout(() => {
  if (mountedRef.current) {
    navigate('/dashboard', { replace: true });
    forceReconnect();  // forceReconnect 호출
  }
}, AUTH_CONSTANTS.NAVIGATE_DELAY_LOGIN);
```

**문제**: 새로고침 시에는 login()이 호출되지 않아 forceReconnect가 안 됨

### 원인 3: 인증 확인 타이밍

```typescript
// WebSocketProvider의 초기 연결 useEffect
useEffect(() => {
  const timer = setTimeout(async () => {
    if (isLoggedOutRef.current) {
      return;  // 조기 리턴!
    }
    const isAuth = await isAuthenticated();
    if (isAuth) {
      connectSocket();
    }
  }, 200);
  return () => clearTimeout(timer);
}, [connectSocket]);
```

**문제**: `isLoggedOutRef.current = true`라서 인증 확인도 안 함

---

## 해결 방안

### 방안 1: isLoggedOutRef 초기값을 false로 변경

```typescript
// Before
const isLoggedOutRef = useRef(true);

// After
const isLoggedOutRef = useRef(false);
```

**장점**: 간단, 새로고침 시 연결 시도
**단점**: 로그아웃 후 탭 닫지 않고 다른 페이지로 이동 시 재연결 시도 가능

### 방안 2: forceReconnect를 localStorage로 동기화

```typescript
// WebSocketProvider.tsx
useEffect(() => {
  // 로그인 상태면 forceReconnect 호출
  const savedLogout = localStorage.getItem('forceLogout');
  if (savedLogout !== 'true') {
    forceReconnect();
  }
}, []);
```

**장점**: 새로고침 시에도 재연결
**단점**: localStorage 의존

### 방안 3: Authenticated 상태 감지

```typescript
// WebSocketProvider.tsx
useEffect(() => {
  // AuthContext의 isAuthenticated를 사용
  // 하지만 AuthProvider가 먼저 마운트됨
}, []);
```

**장점**: React 상태 사용
**단점**: AuthProvider보다 먼저 실행 불가

### 방안 4: checkAuthStatus 결과 기반 연결

```typescript
// 초기 연결 시 isLoggedOutRef 체크 제거
const connectSocket = useCallback(async () => {
  // isLoggedOutRef.current 체크 제거
  const authResult = await checkAuthStatus();
  if (!authResult.authenticated) {
    return;
  }
  // ...
}, []);
```

**장점**: 인증 상태 기반 연결
**단점**: 로그아웃 후 재연결 제어 필요

---

## 권장 해결 방안

### 1순위: isLoggedOutRef 초기값을 false로 변경

**가장 간단하고 효과적**

```typescript
const isLoggedOutRef = useRef(false);  // 초기값 변경
```

### 2순위: 로그아웃 시에만 isLoggedOutRef 설정

```typescript
// handleLogout()에서만 isLoggedOutRef 설정
const handleLogout = () => {
  isLoggedOutRef.current = true;
  // ...
};
```

---

## 추가 분석 필요 사항

- [ ] 서버 측 WebSocket 핸들러 분석
- [ ] JwtHandshakeInterceptor 확인
- [ ] 세션 관리 방식 확인

---

## 결론

**주 원인**: `isLoggedOutRef.current = true`로 초기화되어 새로고침 시 초기 연결 차단

**권장 해결**: `isLoggedOutRef` 초기값을 `false`로 변경

**예상 소요 시간**: 낮음 (코드 변경 1줄)
