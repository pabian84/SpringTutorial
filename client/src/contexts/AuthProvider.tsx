import React, { useState, useCallback, useEffect } from 'react';
import {
  isTokenValid,
  getAccessToken as utilityGetAccessToken,
  setToken as utilitySetToken,
  logout as utilityLogout,
  getTokenExpirySeconds,
} from '../utils/authUtility';
import { AuthContext } from './AuthContext';
import { devLog } from '../utils/logger';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // AuthProvider가 마운트되면 준비 완료 (logout은 GlobalLogoutHandler가 처리)
  useEffect(() => {
    devLog('[AuthProvider] 마운트 완료');
  }, []);
  const [accessToken, setAccessToken] = useState<string | null>(() => {
    return localStorage.getItem('accessToken');
  });

  // myId도 localStorage에서 복원
  const [myId, setMyId] = useState<string | null>(() => {
    return localStorage.getItem('myId');
  });

  const checkTokenValid = useCallback((): boolean => {
    return isTokenValid();
  }, []);

  const isAuthenticated = accessToken !== null && checkTokenValid() && !!myId;

  const login = useCallback((token: string, userId: string) => {
    // application.yml의 access-token-validity-in-seconds와 동기화
    utilitySetToken(token, getTokenExpirySeconds());
    localStorage.setItem('myId', userId);
    setAccessToken(token);
    setMyId(userId);
  }, []);

  const logout = useCallback(async (reason?: string) => {
    // 먼저 로컬 상태 정리
    setAccessToken(null);
    setMyId(null);
    
    // utilityLogout은 비동기이므로 await
    await utilityLogout(reason);
  }, []);

  // authUtility의 getAccessToken 사용 (중복 코드 제거)
  // setAccessToken 업데이트를 위해 콜백으로 감싸서 사용
  const getAccessToken = useCallback(async (): Promise<string | null> => {
    const token = await utilityGetAccessToken();
    if (token) {
      setAccessToken(token);
    }
    return token;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        accessToken,
        myId,
        isAuthenticated,
        isTokenValid: checkTokenValid,
        getAccessToken,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
