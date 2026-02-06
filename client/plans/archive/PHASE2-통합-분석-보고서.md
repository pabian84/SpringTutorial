# Phase 2: 인증/토큰/보안 통합 분석 보고서

## 📅 문서 정보

- **버전**: 1.1
- **작성일**: 2026-02-06
- **최종 수정**: 2026-02-06
- **대상**: plans/인증-토큰-보안-통합-분석-계획.md (v3.0)

---

## 📋 추가 요구사항 (2026-02-06 반영)

### 요구사항 1: ESLint 문제
- ❌ eslint-disable 주석으로 우회하지 않기
- ✅ 반드시 정식 방법으로 해결
- 현재 상태: **ESLint 통과** ✅

### 요구사항 2: workaround 방식 금지
- ❌ 꼼수적인解决方法 사용하지 않기
- ✅ 반드시 정석적인 방법 사용
- ⚠️ 현재 다수의 workaround 존재 (아래 분석 참조)

---

## 1. 발견된 문제점 종합

### 🔴 심각도: 높음 - 즉시 수정 필요

| # | 문제 | 위치 | 영향 | 수정 우선순위 |
|---|------|------|------|-------------|
| 1 | **코드 중복** | AuthProvider.tsx:54-59 | `shouldRefresh` 함수가 authUtility.ts와 중복 | **P0** |
| 2 | **임의의 타임아웃** | 다수 | 100ms, 200ms, 500ms, 3000ms가 임의로 설정됨 | **P0** |
| 3 | **로그아웃 3중 구조** | authUtility.ts, AuthProvider.tsx, App.tsx | 복잡도 증가, 유지보수 어려움 | **P1** |

### 🟡 심각도: 중간 -尽快 수정 권장

| # | 문제 | 위치 | 영향 |
|---|------|------|------|
| 4 | **레이스 컨디션 workaround** | WebSocketHandler.java | synchronized 블록으로 해결하지만 근본 원인 미해결 |
| 5 | **이벤트 시스템 복잡화** | authLogout, tokenChange | 이벤트 중첩 가능성 |
| 6 | **localStorage 분산 접근** | 다수 | 일관성 유지 어려움 |

---

## 2. 파일별 기능 매핑

### 2.1 인증 관련 파일

| 파일 | 책임 영역 | 상태 |
|------|----------|------|
| `authUtility.ts` | 핵심 인증 로직 (토큰 관리, 갱신, 로그아웃) | ✅ 핵심 기능 구현됨 |
| `AuthProvider.tsx` | React Context 상태 관리 | ⚠️ 중복 코드 존재 |
| `axiosConfig.ts` | HTTP 인터셉터 (401/403 처리) | ✅ 동작함 |
| `WebSocketProvider.tsx` | WebSocket 연결 관리 | ⚠️ 임의의 타임아웃 |
| `App.tsx` | 라우팅, 전역 이벤트 핸들러 | ✅ 정상 |

### 2.2 함수 중복 현황

```typescript
// authUtility.ts (line 88-99)
export const shouldRefreshToken = (): boolean => {
  const expiresAt = getTokenExpiry();
  if (!expiresAt) return false;
  const bufferTime = expiryTime < 10000 ? 2000 : 5 * 60 * 1000;
  return Date.now() >= (expiresAt - bufferTime);
};

// AuthProvider.tsx (line 54-59) - 중복!
const shouldRefresh = () => {
  const expiresAt = localStorage.getItem('accessTokenExpiresAt');
  if (!expiresAt) return false;
  const fiveMinutes = 5 * 60 * 1000;
  return Date.now() >= (parseInt(expiresAt) - fiveMinutes);
};
```

**문제점**: 
- 버퍼 시간이 다름 (authUtility: 2초/5분, AuthProvider: 5분 고정)
- 함수가 서로 다르게 동작할 수 있음

---

## 3. 레이스 컨디션 분석

### 3.1 WebSocket 연결 타이밍 문제

| 이벤트 | 타임아웃 | 문제점 |
|--------|----------|--------|
| 초기 연결 | 200ms | Dashboard 마운트 전에 연결 시도 가능 |
| forceReconnect | 100ms | navigate 완료 전에 연결 시도 |
| 토큰 갱신 후 재연결 | 500ms | 토큰이 완전히 저장되기 전에 연결 |
| 비정상 종료 재연결 | 3000ms | 너무 김 |

### 3.2 현재 해결책 (workaround)

```java
// WebSocketHandler.java - synchronized로 레이스 컨디션 방지
synchronized (session) {
  if (!session.isOpen()) {
    return;
  }
  try {
    session.sendMessage(message);
  } catch (IllegalStateException e) {
    // 예외吞
  }
}
```

**근본 원인**: `isOpen()` 체크와 `sendMessage()` 호출 사이에 다른 스레드가 세션을 닫음

---

## 4. 로그아웃 플로우 분석

### 4.1 현재 3중 구조

```
┌─────────────────────────────────────────────────────────────┐
│ 1. authUtility.logout()                                    │
│    - localStorage 정리                                     │
│    - 쿠키 삭제                                             │
│    - emitLogoutEvent() 발생                                │
│    - sessionApi.logout() API 호출                          │
├─────────────────────────────────────────────────────────────┤
│ 2. AuthProvider.logout() (약간 중복)                       │
│    - setAccessToken(null)                                   │
│    - setMyId(null)                                         │
│    - utilityLogout() 호출                                  │
├─────────────────────────────────────────────────────────────┤
│ 3. GlobalLogoutHandler (App.tsx)                           │
│    - authLogout 이벤트 리스너                               │
│    - navigate('/', { replace: true })                       │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 문제점

1. **isLoggingOut 플래그**: 중복 호출 방지를 위한 임시방편
2. **이벤트 연쇄**: logout() → emitLogoutEvent() → authLogout 리스너
3. **순서 의존성**: AuthProvider의 setAccessToken(null)이 localStorage 정리 후에 실행

---

## 5. 일반 시나리오별 검증

### 5.1 시나리오 1: 정상 로그인 → 대시보드

```
User: 로그인 버튼 클릭
    ↓
Login.tsx: handleLogin()
    ↓
userApi.login() → 백엔드 인증
    ↓
setToken() + localStorage.setItem('myId')
    ↓
forceReconnect() → WebSocket 연결 시도
    ↓
setTimeout(100ms) → navigate('/dashboard')
    ↓
Dashboard 마운트 → ProtectedRoute 통과
```

**평가**: ⚠️ 문제 없음, 하지만 forceReconnect의 100ms는 임의 값

### 5.2 시나리오 2: 대시보드에서 로그아웃

```
User: 로그아웃 버튼 클릭
    ↓
useDashboardData.handleLogout()
    ↓
authUtility.logout()
    ├─ localStorage.clear()
    ├─ deleteRefreshTokenCookie()
    ├─ emitLogoutEvent()
    └─ sessionApi.logout()
    ↓
GlobalLogoutHandler: authLogout 이벤트 수신
    ↓
navigate('/', { replace: true })
```

**평가**: ✅ 정상 동작, 플로우가 명확함

### 5.3 시나리오 3: 기기관리에서 전체 로그아웃

```
User: 전체 로그아웃 클릭
    ↓
DeviceManagement.revokeAll()
    ├─ sessionApi.revokeAll()
    └─ logout('전체 로그아웃')
    ↓
authUtility.logout() (중복 호출 방지됨)
    ↓
GlobalLogoutHandler: 페이지 이동
```

**평가**: ✅ 정상 동작, isLoggingOut 플래그가 중복 호출을 막음

### 5.4 시나리오 4: 토큰 만료 → 자동 갱신

```
API 요청
    ↓
axiosConfig: shouldRefreshToken() + isRefreshing()
    ↓
isRefreshing=true → 대기열에Subscriber 등록
    ↓
refreshToken() → sessionApi.refreshToken()
    ↓
localStorage.update + window.dispatchEvent('tokenChange')
    ↓
WebSocket: handleTokenChange() → reconnect
    ↓
onRefreshed() → 대기열에 토큰 전달
    ↓
원래 요청 재시도 (새 토큰 사용)
```

**평가**: ✅ 정상 동작, 복잡하지만 기능은 구현됨

---

## 6. 발견된 구체적 문제

### 문제 1: 코드 중복 (P0)

**파일**: `AuthProvider.tsx:54-59`

```typescript
// 중복된 shouldRefresh 함수
const shouldRefresh = () => {
  const expiresAt = localStorage.getItem('accessTokenExpiresAt');
  if (!expiresAt) return false;
  const fiveMinutes = 5 * 60 * 1000;
  return Date.now() >= (parseInt(expiresAt) - fiveMinutes);
};
```

**대안**: `authUtility.ts`의 `shouldRefreshToken()`을 import하여 사용

**정석 해결방안**: 중복 코드 제거, 단일 진실 공급원 원칙 적용

### 문제 2: 임의의 타임아웃 (P0)

| 위치 | 현재 값 | 권장값 |
|------|---------|--------|
| Login.tsx:39 | 100ms | 상태 기반 (WebSocket 연결 대기) |
| WebSocketProvider.tsx:151 | 200ms | 상태 기반 |
| WebSocketProvider.tsx:96 | 500ms | 상태 기반 |
| WebSocketProvider.tsx:105 | 3000ms | 지수 백오프 |

### 문제 3: 로그아웃 구조 복잡화 (P1)

**현재**: 3개 파일에 logout 관련 로직 분산

**대안**: 
- `authUtility.logout()`을 단일 진실 공급원으로 유지
- `AuthProvider.logout()` 단순화 (util만 호출)
- `GlobalLogoutHandler` 유지 (navigate 담당)

---

## 7. 개선 제안

### 7.1 단기 개선 (Phase 2.1)

| 작업 | 예상 시간 | 영향 |
|------|----------|------|
| AuthProvider.tsx 중복 코드 제거 | 10분 | 코드 품질 |
| 의미 있는 타임아웃 상수화 | 15분 | 가독성 |
| 주석 추가 및 코드 정리 | 20분 | 유지보수 |

### 7.2 중기 개선 (Phase 2.2)

| 작업 | 예상 시간 | 영향 |
|------|----------|------|
| 상태 기반 연결 로직 | 1시간 | 안정성 |
| 로그아웃 플로우 단순화 | 30분 | 복잡도 감소 |
| 테스트 코드 작성 | 2시간 | 품질 보증 |

### 7.3 장기 개선 (Phase 3 이후)

| 작업 | 예상 시간 | 영향 |
|------|----------|------|
| 인증 모듈 분리 | 3시간 | 아키텍처 개선 |
| WebSocket 재연결 로직 리팩토링 | 2시간 | 안정성 |
| 통합 테스트 작성 | 4시간 | 품질 보증 |

---

## 8. 결론

### 현재 상태

- ✅ 모든 기능이 정상 동작함
- ⚠️ 코드 품질과 아키텍처에 개선 필요
- ⚠️ workaround가 다수 존재

### 권장 진행 방식

1. **즉시**: 중복 코드 제거 (AuthProvider.tsx)
2. **현재 구조 유지**: 로그아웃 플로우 (이미 정상 동작하므로)
3. **Phase 3에서**: 아키텍처 리팩토링 (모듈화)

### 다음 단계

사용자에게 다음 중 선택 요청:
1. **단기 개선 먼저**: 중복 코드 제거, 타임아웃 상수화
2. **Phase 3으로 건너뛰기**: 보안 강화 (Refresh Token Rotation)
3. **전체 리팩토링**: 아키텍처 개선부터 진행
