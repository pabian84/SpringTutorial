/**
 * @file AuthProvider.tsx
 * @description 애플리케이션 전체의 인증 상태를 관리하고 하위 컴포넌트에 제공하는 컨텍스트 프로바이더
 * - Ref와 State를 동시에 업데이트하여 리액트 렌더링 지연에 따른 레이스 컨디션 해결
 * - Axios 인터셉터와 유기적으로 협력하여 401 에러 자동 처리 및 로그아웃 수행
 * - 인증 상태 변경 시 이벤트를 발행하여 WebSocketProvider 등과 연동
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { userApi } from '../api/userApi';
import { AUTH_CONSTANTS } from '../constants/auth';
import { isAuthenticatedRef } from '../constants/authRef';
import { showAlert, showToast } from '../utils/Alert';
import { 
  AUTH_EVENTS, 
  checkAuthStatus, 
  clearTokenExpiration, 
  getIsLoggingOut, 
  resetAuthCheck, 
  setIsLoggingIn, 
  setIsLoggingOut, 
  setTokenExpiration, 
  startBackgroundRefresh, 
  stopBackgroundRefresh,
  broadcastLogin,
  broadcastLogout,
  listenAuthSync
} from '../utils/authUtility';
import { setupAxiosInterceptors } from '../utils/axiosConfig';
import { devLog } from '../utils/logger';
import { AuthContext } from './AuthContext';
import { useWebSocket } from './WebSocketContext';
import { type UserDTO } from '../types/dtos';

// 인증 확인을 건너뛰어도 되는 공개 페이지 목록
const PUBLIC_PAGES = ['/weather'];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { forceReconnect, forceDisconnect } = useWebSocket();
  const mountedRef = useRef(true); // 언마운트 시 비동기 처리 방지용
  
  // 마지막 로그아웃 처리 시각 (중복 토스트 방지용 디바운싱)
  const lastLogoutTimeRef = useRef<number>(0);
  
  // 인증 상태 (React UI 반영용)
  const [authState, setAuthState] = useState<{
    authenticated: boolean;
    user: UserDTO | null;
    loading: boolean;
  }>({
    authenticated: false,
    user: null,
    loading: true,
  });

  /**
   * [중요] 인증 상태 동기화 함수
   * - Ref(동기적 확인용)와 State(UI 반영용)를 동시에 업데이트하여 찰나의 간극을 메움
   * @param authenticated 인증 여부
   * @param user 사용자 정보
   */
  const syncAuthState = useCallback((authenticated: boolean, user: UserDTO | null = null) => {
    // 1. Ref 즉시 업데이트: 리액트의 렌더링 사이클과 상관없이 즉시 접근 가능해야 하는 로직(예: 인터셉터, 웹소켓)용
    isAuthenticatedRef.current = authenticated;
    
    // 2. React State 업데이트: UI를 다시 그려서 로딩을 풀고 화면을 전환하는 용도
    setAuthState(prev => {
      return {
        ...prev,
        authenticated,
        user,
        loading: false,
      };
    });
  }, []);

  /**
   * 로그인 처리 함수
   */
  const login = useCallback(async (id: string, password: string, keepLogin: boolean) => {
    // 로그인 도중 다른 인증 확인이 끼어들지 못하도록 플래그 설정
    setIsLoggingIn(true);
    
    try {
      // [전략 2] 로그인 요청 전 사전 검사 (Double-Lock)
      // 이미 다른 탭에서 로그인된 세션 쿠키가 있는지 서버에 확인
      const preCheck = await checkAuthStatus(true);
      if (preCheck.authenticated) {
        showToast('이미 다른 환경에서 로그인되었습니다.', 'info');
        // 상태 동기화 후 즉시 이동
        syncAuthState(true, preCheck.user || null);
        window.dispatchEvent(new CustomEvent(AUTH_EVENTS.LOGIN_SUCCESS));
        broadcastLogin(); 
        navigate('/dashboard', { replace: true });
        return;
      }

      const data = await userApi.login(id, password, keepLogin);
      const { user, expiresIn } = data;

      if (user) {
        setIsLoggingOut(false);
        resetAuthCheck();

        // 서버에서 알려준 유효기간 설정
        if (expiresIn) {
          setTokenExpiration(expiresIn);
        }

        // 상태 통합 업데이트
        syncAuthState(true, { id: user.id, name: user.name, role: user.role });
        
        // 로그인 성공 이벤트 발행 (웹소켓 등 연동)
        window.dispatchEvent(new CustomEvent(AUTH_EVENTS.LOGIN_SUCCESS));
        
        // [전략 1] 다른 탭에 로그인 성공 사실을 브로드캐스트
        broadcastLogin();
        
        showToast(`환영합니다, ${user.name}님!`, 'success');
        
        // 약간의 지연 후 대시보드로 이동
        setTimeout(() => { 
          if (mountedRef.current) {
            navigate('/dashboard', { replace: true }); 
          }
        }, AUTH_CONSTANTS.NAVIGATE_DELAY_LOGIN);
      } else {
        showAlert('로그인 실패', "서버 응답 데이터 형식이 올바르지 않습니다.", 'error');
      }
    } catch (err: unknown) {
      // 백엔드에서 409 Conflict(이미 로그인됨)를 던진 경우 처리
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosError = err as { response: { status: number } };
        if (axiosError.response?.status === 409) {
          showToast('이미 로그인된 상태입니다. 대시보드로 이동합니다.', 'info');
          const authResult = await checkAuthStatus(true);
          syncAuthState(true, authResult.user || null);
          window.dispatchEvent(new CustomEvent(AUTH_EVENTS.LOGIN_SUCCESS));
          broadcastLogin();
          navigate('/dashboard', { replace: true });
          return;
        }
      }

      let errorMessage = '아이디 또는 비밀번호를 확인해주세요.';
      if (err instanceof Error) {
        errorMessage = err.message;
      }
      showAlert('로그인 오류', errorMessage, 'error');
    } finally {
      setIsLoggingIn(false);
    }
  }, [navigate, syncAuthState]);

  /**
   * 로그아웃 처리 함수 (강제 로그아웃 포함)
   * @param reason 로그아웃 사유 (토스트 메시지로 표시)
   * @param force 서버 API 호출 없이 클라이언트 상태만 정리할지 여부
   */
  const logout = useCallback(async (reason?: string, force: boolean = false) => {
    const now = Date.now();
    
    // [중요] 이미 로그아웃 중이거나, 1초 이내에 로그아웃 처리가 이미 일어났다면 무시 (중복 토스트 방지)
    if (getIsLoggingOut() || (now - lastLogoutTimeRef.current < 1000)) {
      return;
    }
    
    lastLogoutTimeRef.current = now;
    setIsLoggingOut(true); // 로그아웃 플래그 설정
    
    // 1. WebSocket부터 선제적으로 끊기
    forceDisconnect();
    
    // 2. 외부 모듈에 로그아웃 사실을 알림
    window.dispatchEvent(new CustomEvent(AUTH_EVENTS.LOGOUT_COMPLETED));
    
    // 3. 다른 탭에 로그아웃 사실 전파 (브로드캐스트)
    broadcastLogout();
    
    // 4. 서버 로그아웃 API 호출 (강제 로그아웃이 아닐 때만)
    if (!force) {
      try {
        await userApi.logout(undefined);
      } catch (e) {
        devLog('[AuthProvider] 로그아웃 API 실패(무시):', e);
      }
    }
    
    // 5. 로그아웃 사유 알림
    if (reason) {
      showToast(reason, 'warning');
    }

    // 6. 모든 로컬 상태와 인증 캐시 정리
    syncAuthState(false, null);
    resetAuthCheck();
    clearTokenExpiration();

    // 7. 민감한 로컬 스토리지 정리 (테마 등 설정값 제외)
    const safeKeys = ['theme', 'language', 'sidebarState'];
    Object.keys(localStorage).forEach(key => {
      if (!safeKeys.includes(key)) {
        localStorage.removeItem(key);
      }
    });

    devLog('[AuthProvider] 로그아웃 프로세스 완료');
  }, [forceDisconnect, syncAuthState]);

  /**
   * 외부(인터셉터 등)에서 호출하는 로그아웃 래퍼
   */
  const handleLogout = useCallback((reason?: string, force: boolean = false) => {
    logout(reason, force);
  }, [logout]);

  /**
   * 초기 마운트 시 실행되는 설정 로직 및 이벤트 리스너
   */
  useEffect(() => {
    let mounted = true;

    // Axios 인터셉터 등록: 401 에러 발생 시 자동으로 handleLogout이 불리도록 설정
    setupAxiosInterceptors({
      onAuthFailed: (message: string) => handleLogout(message),
      onAuthRestored: () => forceReconnect(), // 세션 복구 시 웹소켓 재연결
    });

    // 외부(웹소켓 등) 로그아웃 요청 수신
    const handleLogoutRequest = (event: Event) => {
      const customEvent = event as CustomEvent;
      const reason = customEvent.detail?.reason || '로그아웃되었습니다.';
      const force = customEvent.detail?.force ?? true;
      handleLogout(reason, force);
    };
    
    window.addEventListener(AUTH_EVENTS.REQUEST_LOGOUT, handleLogoutRequest);

    // [전략 1] 다른 탭으로부터의 인증 동기화 메시지 수신
    listenAuthSync((type) => {
      if (type === 'LOGIN_SYNC' && location.pathname === '/') {
        // 다른 탭에서 로그인하면 나도 즉시 대시보드로 이동
        devLog('[Sync] 다른 탭 로그인 감지 -> 대시보드 이동');
        checkAuthStatus(true).then(result => {
          syncAuthState(result.authenticated, result.user || null);
          if (result.authenticated) {
            window.dispatchEvent(new CustomEvent(AUTH_EVENTS.LOGIN_SUCCESS));
            navigate('/dashboard', { replace: true });
          }
        });
      } else if (type === 'LOGOUT_SYNC' && location.pathname !== '/') {
        // 다른 탭에서 로그아웃하면 나도 즉시 로그인 페이지로 이동
        devLog('[Sync] 다른 탭 로그아웃 감지 -> 로그인 페이지 이동');
        handleLogout('다른 환경에서 로그아웃되었습니다.', true);
      }
    });

    // 공개 페이지면 로딩만 풀고 인증 확인은 건너뜀
    if (PUBLIC_PAGES.some(page => location.pathname === page)) {
      setAuthState(prev => ({ ...prev, loading: false }));
      return () => {
        mounted = false;
        mountedRef.current = false;
        window.removeEventListener(AUTH_EVENTS.REQUEST_LOGOUT, handleLogoutRequest);
      };
    }

    // [중요] 최초 진입 시 서버 세션 확인
    checkAuthStatus().then((result) => {
      if (mounted) {
        syncAuthState(result.authenticated, result.user || null);
        if (result.authenticated) {
            window.dispatchEvent(new CustomEvent(AUTH_EVENTS.LOGIN_SUCCESS));
        }
      }
    });

    return () => { 
      mounted = false; 
      mountedRef.current = false; 
      window.removeEventListener(AUTH_EVENTS.REQUEST_LOGOUT, handleLogoutRequest);
    };
  }, [handleLogout, forceReconnect, location.pathname, syncAuthState, navigate]);

  /**
   * 인증 상태 감지 및 라우팅 제어 (인증 실패 시 로그인 화면으로 강제 이동)
   */
  useEffect(() => {
    // 로딩 중이거나 루트 페이지('/')면 동작하지 않음
    if (authState.loading || location.pathname === '/') {
      return;
    }
    
    // [핵심 해결책] 리액트 State 업데이트 지연(Gap) 동안 Ref를 확인하여 튕김 현상 방지
    // authState.authenticated가 false이더라도 isAuthenticatedRef.current가 true라면 
    // 방금 로그인 동기화가 일어난 것으로 간주하고 리다이렉트를 유보함
    if (!authState.authenticated && !isAuthenticatedRef.current && !PUBLIC_PAGES.includes(location.pathname)) {
      devLog('[Guard] 비인증 접근 감지 -> 로그인 페이지 이동');
      navigate('/', { replace: true });
    }
  }, [authState.authenticated, authState.loading, location.pathname, navigate]);

  /**
   * 인증 성공 시에만 백그라운드 토큰 감시 타이머 가동
   */
  useEffect(() => {
    if (authState.authenticated) {
      startBackgroundRefresh();
    } else {
      stopBackgroundRefresh();
    }
    return () => stopBackgroundRefresh();
  }, [authState.authenticated]);

  /**
   * 명시적으로 인증 상태를 재확인해야 할 때 호출하는 함수
   */
  const checkAuth = useCallback(async () => {
    const result = await checkAuthStatus();
    syncAuthState(result.authenticated, result.user || null);
    return result.authenticated;
  }, [syncAuthState]);

  return (
    <AuthContext.Provider value={{ authState, isAuthenticated: authState.authenticated, isLoading: authState.loading, user: authState.user, login, logout: handleLogout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};
