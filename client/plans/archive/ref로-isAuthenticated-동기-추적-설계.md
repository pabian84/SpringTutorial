# ref로 isAuthenticated 동기 추적 설계

## 문제

React의 `setState`는 비동기라서 `setAuthState` 호출 후 바로 `isAuthenticated`가 업데이트되지 않습니다.

## 해결책: ref로 isAuthenticated 추적

### AuthProvider.tsx 수정

```typescript
import { useRef } from 'react';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const { forceReconnect, forceDisconnect } = useWebSocket();
  const mountedRef = useRef(true);
  const queryClient = useQueryClient();

  // ✅ ref로 isAuthenticated 동기 추적
  const isAuthenticatedRef = useRef(false);

  const [authState, setAuthState] = useState({...});

  // ✅ isAuthenticated getter/setter
  const isAuthenticated = authState.authenticated;  // React state (렌더링용)
  const setIsAuthenticated = (value: boolean) => {
    isAuthenticatedRef.current = value;  // ref (동기 접근용)
  };

  // login 함수에서
  const login = useCallback(async (...) => {
    if (user) {
      setIsAuthenticated(true);  // ✅ 먼저 ref 설정
      setAuthState({ authenticated: true, ... });
      // ...
    }
  }, [...]);

  // logout 함수에서
  const logout = useCallback(async (reason?: string) => {
    // ✅ 먼저 ref 설정 (동기)
    setIsAuthenticated(false);

    // ✅ 그 다음 state 설정
    setAuthState({
      authenticated: false,
      user: null,
      loading: false,
    });

    // 이후 진행
    forceDisconnect();
    queryClient.cancelQueries();
    // ...
  }, [navigate, forceDisconnect, queryClient]);
```

### AuthContext.tsx 수정

```typescript
export interface AuthContextType {
  // ...
  isAuthenticated: boolean;  // React state (렌더링용)
  // ...
}
```

### useDashboardData.ts 수정

```typescript
const { user, isAuthenticated } = useAuth();  // React state (렌더링용)

const { data: onlineUsers = [] } = useQuery({
  queryKey: ['onlineUsers'],
  queryFn: sessionApi.getOnlineUsers,
  enabled: isAuthenticated,  // React state (렌더링용)
});
```

## 왜 작동하나요?

| 시점 | isAuthenticated (React state) | isAuthenticatedRef.current |
|------|------------------------------|---------------------------|
| 로그인 완료 후 | true | true |
| logout 호출 직후 | true (아직) | **false** (즉시) |
| 리렌더링 후 | **false** | false |

### useDashboardData의 useQuery enabled 체크

`enabled: isAuthenticated`는 **렌더링 시점**에 평가됩니다. React가 리렌더링되면서 `isAuthenticated`가 `false`가 되면, React Query가 `enabled`를 다시 평가하고 요청을 취소합니다.

## 전체 흐름

```
1. logout() 호출
2. setIsAuthenticated(false) → isAuthenticatedRef.current = false (즉시)
3. setAuthState({ authenticated: false }) → state 설정
4. forceDisconnect() → WebSocket 닫기
5. queryClient.cancelQueries() → 진행 중인 요청 취소
6. React가 리렌더링
7. isAuthenticated = false → React Query가 enabled=false 평가
8. 새 요청이 생기지 않음
9. navigate('/') → Login 페이지
```

## 결론

**ref는 즉각적으로 값을 설정**하지만, **컴포넌트 리렌더링은 React의 스케줄에 따라** 이루어집니다. `enabled: isAuthenticated`가 `false`가 되면 React Query가 자동으로 새 요청을 막습니다.
