/**
 * @file AuthProvider.tsx
 * @description 인증 상태 관리 및 이벤트 기반의 로그아웃 처리
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
  stopBackgroundRefresh 
} from '../utils/authUtility';
import { setupAxiosInterceptors } from '../utils/axiosConfig';
import { devLog } from '../utils/logger';
import { AuthContext } from './AuthContext';
import { useWebSocket } from './WebSocketContext';
import { type UserDTO } from '../types/dtos';

const PUBLIC_PAGES = ['/weather'];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { forceReconnect, forceDisconnect } = useWebSocket();
  const mountedRef = useRef(true);
  
  // 마지막 로그아웃 처리 시각 (중복 토스트 방지용)
  const lastLogoutTimeRef = useRef<number>(0);
  
  const [authState, setAuthState] = useState<{
    authenticated: boolean;
    user: UserDTO | null;
    loading: boolean;
  }>({
    authenticated: false,
    user: null,
    loading: true,
  });

  const syncAuthState = useCallback((authenticated: boolean, user: UserDTO | null = null) => {
    isAuthenticatedRef.current = authenticated;
    setAuthState(prev => ({ ...prev, authenticated, user, loading: false }));
  }, []);

  // === [로그인] ===
  const login = useCallback(async (id: string, password: string, keepLogin: boolean) => {
    setIsLoggingIn(true);
    try {
      const data = await userApi.login(id, password, keepLogin);
      const { user, expiresIn } = data;

      if (user) {
        setIsLoggingOut(false);
        resetAuthCheck();
        if (expiresIn) setTokenExpiration(expiresIn);
        
        syncAuthState(true, { id: user.id, name: user.name, role: user.role });
        window.dispatchEvent(new CustomEvent(AUTH_EVENTS.LOGIN_SUCCESS));
        showToast(`환영합니다, ${user.name}님!`, 'success');
        
        setTimeout(() => { 
          if (mountedRef.current) navigate('/dashboard', { replace: true }); 
        }, AUTH_CONSTANTS.NAVIGATE_DELAY_LOGIN);
      } else {
        showAlert('로그인 실패', "응답 데이터 오류", 'error');
      }
    } catch (e) {
      let errorMessage = '로그인 중 오류가 발생했습니다.';
      if (e instanceof Error) errorMessage = e.message;
      showAlert('로그인 오류', errorMessage, 'error');
    } finally {
      setIsLoggingIn(false);
    }
  }, [navigate, syncAuthState]);

  // 로그아웃
  const logout = useCallback(async (reason?: string, force: boolean = false) => {
    const now = Date.now();
    
    // 이미 로그아웃 중이거나, 1초 이내에 로그아웃 처리가 이미 일어났다면 무시
    if (getIsLoggingOut() || (now - lastLogoutTimeRef.current < 1000)) {
      return;
    }
    
    lastLogoutTimeRef.current = now;
    setIsLoggingOut(true);
    
    forceDisconnect();
    window.dispatchEvent(new CustomEvent(AUTH_EVENTS.LOGOUT_COMPLETED));
    
    if (!force) {
      try {
        await userApi.logout(undefined);
      } catch (e) {
        devLog('[AuthProvider] 로그아웃 API 실패(무시):', e);
      }
    }
    
    // 토스트 표시
    if (reason) {
      showToast(reason, 'warning');
    }

    syncAuthState(false, null);
    resetAuthCheck();
    clearTokenExpiration();

    // 로컬 스토리지 정리
    const safeKeys = ['theme', 'language', 'sidebarState'];
    Object.keys(localStorage).forEach(key => {
      if (!safeKeys.includes(key)) {
        localStorage.removeItem(key);
      }
    });

    devLog('[AuthProvider] 로그아웃 프로세스 완료');
  }, [forceDisconnect, syncAuthState]);

  const handleLogout = useCallback((reason?: string, force: boolean = false) => {
    logout(reason, force);
  }, [logout]);

  useEffect(() => {
    let mounted = true;

    // Axios interceptor 설정
    setupAxiosInterceptors({
      onAuthFailed: (message: string) => handleLogout(message),
      onAuthRestored: () => forceReconnect(),
    });

    const handleLogoutRequest = (event: Event) => {
      const customEvent = event as CustomEvent;
      const reason = customEvent.detail?.reason || '로그아웃되었습니다.';
      const force = customEvent.detail?.force ?? true;
      handleLogout(reason, force);
    };
    
    window.addEventListener(AUTH_EVENTS.REQUEST_LOGOUT, handleLogoutRequest);

    if (PUBLIC_PAGES.some(page => location.pathname === page)) {
      setAuthState(prev => ({ ...prev, loading: false }));
      return () => {
        mounted = false;
        mountedRef.current = false;
        window.removeEventListener(AUTH_EVENTS.REQUEST_LOGOUT, handleLogoutRequest);
      };
    }

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
  }, [handleLogout, forceReconnect, location.pathname, syncAuthState]);

  useEffect(() => {
    if (authState.loading || location.pathname === '/') return;
    if (!authState.authenticated && !PUBLIC_PAGES.includes(location.pathname)) {
      navigate('/', { replace: true });
    }
  }, [authState.authenticated, authState.loading, location.pathname, navigate]);

  useEffect(() => {
    if (authState.authenticated) {
      startBackgroundRefresh();
    } else {
      stopBackgroundRefresh();
    }
    return () => stopBackgroundRefresh();
  }, [authState.authenticated]);

  const checkAuth = useCallback(async () => {
    const result = await checkAuthStatus();
    syncAuthState(result.authenticated, result.user || null);
    return result.authenticated;
  }, [syncAuthState]);

  return (
    <AuthContext.Provider
      value={{
        authState,
        isAuthenticated: authState.authenticated,
        isLoading: authState.loading,
        user: authState.user,
        login,
        logout: handleLogout,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
