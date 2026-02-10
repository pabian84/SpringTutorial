import React, { useState, useCallback, useEffect } from 'react';
import {
  checkAuthStatus,
  logout as utilityLogout,
  emitLoginEvent,
  resetAuthCheck,
} from '../utils/authUtility';
import { AuthContext } from './AuthContext';
import { devLog } from '../utils/logger';

// 사용자 정보 타입
interface UserInfo {
  id: string;
  name: string;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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

  // 마운트 시 인증 상태 확인 (한 번만)
  useEffect(() => {
    let mounted = true;

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
  }, []);

  // 로그인 (쿠키에 이미 토큰이 설정되어 있으므로 단순히 상태 업데이트)
  const login = useCallback((_token: string, userId: string, userName: string) => {
    // 인증 확인 결과 리셋 (새 인증 강제 확인)
    resetAuthCheck();

    // 상태 업데이트
    setAuthState({
      authenticated: true,
      user: { id: userId, name: userName },
      loading: false,
    });

    // 로그인 이벤트 발생
    emitLoginEvent();

    devLog('[AuthProvider] 로그인 완료:', userId);
  }, []);

  // 로그아웃
  const logout = useCallback(async (reason?: string) => {
    // 로컬 상태 정리
    setAuthState({
      authenticated: false,
      user: null,
      loading: false,
    });

    // utilityLogout 호출 (로컬 스토리지 정리 + 서버 로그아웃)
    await utilityLogout(reason);

    devLog('[AuthProvider] 로그아웃 완료');
  }, []);

  // 인증 확인 함수 (필요시 호출)
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
        logout,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
