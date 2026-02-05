import React, { useState, useCallback } from 'react';
import {
  isTokenValid,
  refreshToken as utilityRefreshToken,
  setToken as utilitySetToken,
  logout as utilityLogout,
  isRefreshing,
  addRefreshSubscriber,
  getTokenExpirySeconds
} from '../utils/authUtility';
import { AuthContext } from './AuthContext';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    const token = localStorage.getItem('accessToken');
    if (!token) return null;

    const shouldRefresh = () => {
      const expiresAt = localStorage.getItem('accessTokenExpiresAt');
      if (!expiresAt) return false;
      const fiveMinutes = 5 * 60 * 1000;
      return Date.now() >= (parseInt(expiresAt) - fiveMinutes);
    };

    // 이미 갱신 중이면 대기
    if (isRefreshing()) {
      return new Promise<string | null>((resolve) => {
        addRefreshSubscriber((newToken: string) => {
          setAccessToken(newToken);
          resolve(newToken);
        });
      });
    }

    if (shouldRefresh()) {
      const newToken = await utilityRefreshToken();
      if (newToken) {
        setAccessToken(newToken);
        return newToken;
      }
      setAccessToken(null);
      return null;
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
