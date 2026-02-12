# onAuthFailed에 url 파라미터 추가 설계

## 현재 상태

### axiosConfig.ts - InterceptorCallbacks (현재)
```typescript
interface InterceptorCallbacks {
  onAuthFailed: (message: string) => void;  // 인증 실패 (로그인 페이지로)
  onAuthRestored: () => void;                 // 인증 복구 (재연결 등)
}
```

### AuthProvider.tsx - setupAxiosInterceptors (현재)
```typescript
setupAxiosInterceptors({
  onAuthFailed: (message: string) => {
    showToast('인증실패, 로그아웃');
    handleLogout(message);
  },
  // ...
});
```

## 수정 설계

### 1. axiosConfig.ts - InterceptorCallbacks (수정)
```typescript
interface InterceptorCallbacks {
  onAuthFailed: (message: string, url?: string) => void;  // 인증 실패 (url 포함)
  onAuthRestored: () => void;                               // 인증 복구 (재연결 등)
}
```

### 2. axiosConfig.ts - handleAuthError 호출 (수정)
```typescript
// 401 Unauthorized
if (status === 401) {
  const handled = await handleAuthError(
    { status: 401, message: '세션이 만료되었습니다.' },
    onAuthFailed,  // 이제 url도 전달 가능
    onAuthRestored
  );
  // ...
}

// 403 Forbidden
if (status === 403 && errorCode !== 'A006') {
  const handled = await handleAuthError(
    { status: 403, errorCode, message: '접근이 거부되었습니다.' },
    onAuthFailed,  // 이제 url도 전달 가능
    onAuthRestored
  );
  // ...
}
```

### 3. AuthProvider.tsx - setupAxiosInterceptors (수정)
```typescript
setupAxiosInterceptors({
  onAuthFailed: (message: string, url?: string) => {
    // url에 따라 다르게 처리
    if (url === '/api/auth/check') {
      // 인증 확인 API는 토스트만 표시 (이미 로그아웃 처리 중)
      return;
    }
    showToast(message || '인증실패, 로그아웃');
    handleLogout(message);
  },
  onAuthRestored: () => {
    forceReconnect();
  },
});
```

## 수정 파일 목록

| 파일 | 수정 내용 |
|------|----------|
| `src/utils/axiosConfig.ts` | 1. `InterceptorCallbacks.onAuthFailed`에 `url?: string` 파라미터 추가<br>2. `handleAuthError` 호출 시 `url` 전달 |
| `src/contexts/AuthProvider.tsx` | `onAuthFailed` 콜백에 `url` 파라미터 추가 및 처리 로직 추가 |
