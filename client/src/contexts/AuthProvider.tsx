import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { userApi } from '../api/userApi';
import { AUTH_CONSTANTS } from '../constants/auth';
import { isAuthenticatedRef } from '../constants/authRef';
import { showAlert, showToast } from '../utils/Alert';
import { checkAuthStatus, clearTokenExpiration, getIsLoggingOut, resetAuthCheck, setIsLoggingIn, setIsLoggingOut, setTokenExpiration, startBackgroundRefresh, stopBackgroundRefresh } from '../utils/authUtility';
import { setupAxiosInterceptors } from '../utils/axiosConfig';
import { devLog } from '../utils/logger';
import { AuthContext } from './AuthContext';
import { useWebSocket } from './WebSocketContext';

// 사용자 정보 타입
interface UserInfo {
  id: string;
  name: string;
}

// Public Pages 목록 (인증 확인 건너뛰기)
const PUBLIC_PAGES = ['/weather'];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { forceReconnect, forceDisconnect } = useWebSocket();
  const mountedRef = useRef(true);
  
  // 인증 상태
  const [authState, setAuthState] = useState<{
    authenticated: boolean;
    user: UserInfo | null;
    loading: boolean;
  }>({
    authenticated: false,
    user: null,
    loading: true,
  });

  // 로그인
  const login = useCallback(async (id: string, password: string, keepLogin: boolean) => {
    // 로그인 시작 플래그 설정
    setIsLoggingIn(true);
    
    try {
      const data = await userApi.login(id, password, keepLogin);
      const { user, expiresIn } = data;

      if (user) {
        // 로그아웃 상태 리셋
        setIsLoggingOut(false);
        
        // 인증 확인 결과 리셋
        resetAuthCheck();

        // 토큰 만료 시간 저장 (서버 응답의 expiresIn 사용)
        if (expiresIn) {
          setTokenExpiration(expiresIn);
        }

        // 상태 업데이트
        setAuthState({
          authenticated: true,
          user: { id: user.id, name: user.name },
          loading: false,
        });
        
        // isAuthenticatedRef도 true로 설정 (React Query용)
        isAuthenticatedRef.current = true;

        showToast(`환영합니다, ${user.name}님!`, 'success');
        devLog('[AuthProvider] 로그인 완료:', user.id);

        // 대시보드로 이동
        setTimeout(() => {
          if (mountedRef.current) {
            navigate('/dashboard', { replace: true });
            forceReconnect();
          }
        }, AUTH_CONSTANTS.NAVIGATE_DELAY_LOGIN);
      } else {
        showAlert('로그인 실패', "로그인 응답 데이터 오류", 'error');
      }
    } catch (e) {
      let errorMessage = '로그인 중 오류가 발생했습니다.';

      if (e instanceof Error) {
        errorMessage = e.message;
      }
      showAlert('로그인 실패', errorMessage, 'error');
    } finally {
      // 로그인 종료 플래그 해제
      setIsLoggingIn(false);
    }
  }, [navigate, forceReconnect]);

  // 로그아웃
  const logout = useCallback(async (reason?: string, force: boolean = false) => {
    // 이미 로그아웃 중이면 중복 실행 방지 (강제 실행 제외)
    if (!force && getIsLoggingOut()) {
      return;
    }
    
    // 로그아웃 시작 플래그 설정
    setIsLoggingOut(true);
    
    // 먼저 WebSocket 닫기 (Frontend에서 먼저 닫기)
    forceDisconnect();
    
    // 서버 로그아웃 API 호출 (강제 실행이 아닐 때만)
    if (!force) {
      try {
        await userApi.logout(undefined);
      } catch (e) {
        devLog('[AuthProvider] 로그아웃 API 오류:', e);
      }
    }
    
    // 토스트 표시
    if (reason) {
      showToast(reason, 'warning');
    }

    // 먼저 isAuthenticatedRef를 false로 설정 (React Query 비활성화)
    isAuthenticatedRef.current = false;
    
    // 로컬 상태 정리
    setAuthState({
      authenticated: false,
      user: null,
      loading: false,
    });

    // 인증 확인 결과 리셋
    resetAuthCheck();

    // 토큰 만료 시간 삭제 (Proactive Refresh용)
    clearTokenExpiration();

    // 로컬 스토리지 선택적 정리
    const safeKeys = ['theme', 'language', 'sidebarState'];
    const allKeys = Object.keys(localStorage);
    allKeys.forEach(key => {
      if (!safeKeys.includes(key)) {
        localStorage.removeItem(key);
      }
    });

    // navigate는 useEffect에서 처리함
    devLog('[AuthProvider] 로그아웃 완료');
  }, [forceDisconnect]);

  // 외부에서 호출할 수 있는 logout (handleLogout)
  const handleLogout = useCallback((reason?: string, force: boolean = false) => {
    logout(reason, force);
  }, [logout]);

  // ------------------------------------------
  // 마운트 시 인증 상태 확인 + Axios interceptor 설정
  // 주의: 경로 변경 시 인증 확인은 제거됨
  // 이유: axios interceptor가 401을 처리하므로 중복 방지
  // ------------------------------------------
  useEffect(() => {
    let mounted = true;

    // Axios interceptor 설정
    setupAxiosInterceptors({
      onAuthFailed: (message: string) => {
        // 인증 실패 → 로그아웃 처리
        handleLogout(message);
      },
      onAuthRestored: () => {
        // 인증 복구 → WebSocket 재연결
        forceReconnect();
      },
    });

    if (PUBLIC_PAGES.some(page => location.pathname === page)) {
      const stopLoading = () => {
        setAuthState(prev => ({ ...prev, loading: false }));
      };
      stopLoading();
      return;
    }

    checkAuthStatus().then((result) => {
      if (mounted) {
        // isAuthenticatedRef도同步 설정 (React Query용)
        isAuthenticatedRef.current = result.authenticated;
        
        setAuthState({
          authenticated: result.authenticated,
          user: result.user || null,
          loading: false,
        });
        devLog('[AuthProvider] 인증 상태 확인 완료:', result);
      }
    });

    return () => {
      mounted = false;
    };
  }, [handleLogout, forceReconnect, location.pathname]);

  // ------------------------------------------
  // 인증 상태 변경 감지 → 로그인 페이지로 이동
  // ------------------------------------------
  useEffect(() => {
    // 로딩 중이거나 '/'이면 실행 안 함
    if (authState.loading || location.pathname === '/') return;
    
    // authenticated가 false로 변경되었을 때 navigate
    if (!authState.authenticated) {
      navigate('/', { replace: true });
    }
  }, [authState.authenticated, authState.loading, location.pathname, navigate]);

  // ------------------------------------------
  // 백그라운드 토큰 갱신 타이머
  // ------------------------------------------
  useEffect(() => {
    if (authState.authenticated) {
      startBackgroundRefresh();
    } else {
      stopBackgroundRefresh();
    }
    
    return () => stopBackgroundRefresh();
  }, [authState.authenticated]);

  // ------------------------------------------
  // 인증 확인 함수 (필요시 호출)
  // ------------------------------------------
  const checkAuth = useCallback(async () => {
    const result = await checkAuthStatus();
    setAuthState({
      authenticated: result.authenticated,
      user: result.user || null,
      loading: false,
    });
    return result.authenticated;
  }, []);

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
