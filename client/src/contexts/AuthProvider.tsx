import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { checkAuthStatus, resetAuthCheck } from '../utils/authUtility';
import { userApi } from '../api/userApi';
import { setupAxiosInterceptors, resetLoggingOut } from '../utils/axiosConfig';
import { AuthContext } from './AuthContext';
import { showAlert, showToast } from '../utils/Alert';
import { devLog } from '../utils/logger';
import { AUTH_CONSTANTS } from '../constants/auth';
import { useWebSocket } from './WebSocketContext';

// 사용자 정보 타입
interface UserInfo {
  id: string;
  name: string;
}

// Public Pages 목록 (인증 확인 건너뛰기)
const PUBLIC_PAGES = ['/', '/weather'];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { forceReconnect } = useWebSocket();
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
    try {
      const data = await userApi.login(id, password, keepLogin);
      const { user } = data;

      if (user) {
        // 로그아웃 상태 리셋
        resetLoggingOut();
        
        // 인증 확인 결과 리셋
        resetAuthCheck();

        // 상태 업데이트
        setAuthState({
          authenticated: true,
          user: { id: user.id, name: user.name },
          loading: false,
        });

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
    }
  }, [navigate, forceReconnect]);

  // 로그아웃
  const logout = useCallback(async (reason?: string) => {
    // 토스트 표시
    if (reason) {
      showToast(reason, 'error');
    }

    // 로컬 상태 정리
    setAuthState({
      authenticated: false,
      user: null,
      loading: false,
    });

    // 인증 확인 결과 리셋
    resetAuthCheck();

    // 로컬 스토리지 선택적 정리
    const safeKeys = ['theme', 'language', 'sidebarState'];
    const allKeys = Object.keys(localStorage);
    allKeys.forEach(key => {
      if (!safeKeys.includes(key)) {
        localStorage.removeItem(key);
      }
    });

    // 서버 로그아웃 API 호출
    try {
      await userApi.logout(undefined);
    } catch (e) {
      devLog('[AuthProvider] 로그아웃 API 오류:', e);
    }

    // 로그인 페이지로 이동
    navigate('/', { replace: true });

    devLog('[AuthProvider] 로그아웃 완료');
  }, [navigate]);

  // 외부에서 호출할 수 있는 logout (handleLogout)
  const handleLogout = useCallback((reason?: string) => {
    logout(reason);
  }, [logout]);

  // ------------------------------------------
  // 경로 변경 시 인증 확인 (Protected Pages만)
  // ------------------------------------------
  useEffect(() => {
    // 마운트 완료 후에만 실행
    if (authState.loading) return;

    // Public Pages는 인증 확인 건너뛰기
    if (PUBLIC_PAGES.some(page => location.pathname === page)) {
      return;
    }
    // Protected Pages: 인증 확인
    checkAuthStatus().then((result) => {
      if (!result.authenticated) {
        showToast('로그인이 필요합니다.', 'error');
        resetAuthCheck();
        navigate('/', { replace: true });
      }
    });
  }, [location.pathname, authState.loading, navigate]);

  // ------------------------------------------
  // 마운트 시 인증 상태 확인 + Axios interceptor 설정
  // ------------------------------------------
  useEffect(() => {
    let mounted = true;

    // Axios interceptor 설정
    setupAxiosInterceptors({
      onAuthFailed: (message: string) => {
        // 인증 실패 → 로그인 페이지로
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
