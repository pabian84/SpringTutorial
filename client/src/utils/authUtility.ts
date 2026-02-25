/**
 * @file authUtility.ts
 * @description 인증 상태 관리, 토큰 만료 체크, 그리고 전역 이벤트 상수를 관리합니다.
 */

import axios from 'axios';
import { devError } from './logger';
import { type UserDTO } from '../types/dtos';

// ============================================
// 0. 전역 이벤트 상수 (Event Bus Topics)
// ============================================
export const AUTH_EVENTS = {
  LOGIN_SUCCESS: 'auth:login',           // 로그인 성공 시 (AuthProvider -> External)
  LOGOUT_COMPLETED: 'auth:logged-out',   // 로그아웃 완료 시 (AuthProvider -> External)
  REQUEST_LOGOUT: 'auth:request-logout'  // 로그아웃 요청 시 (External -> AuthProvider)
} as const;

// 탭 간 실시간 동기화를 위한 BroadcastChannel (멀티 탭 중복 로그인 방어용)
const authSyncChannel = new BroadcastChannel('auth_sync_channel');

// ============================================
// 1. 인증 프로세스 상태 플래그
// ============================================
let isLoggingIn = false;
let isLoggingOut = false;

export const setIsLoggingIn = (value: boolean) => { isLoggingIn = value; };
export const getIsLoggingIn = () => isLoggingIn;

/**
 * 로그아웃 플래그 설정
 * - true가 설정되는 순간, 모든 중복 로그아웃 요청과 불필요한 API 재시도는 차단됩니다.
 */
export const setIsLoggingOut = (value: boolean) => { isLoggingOut = value; };
export const getIsLoggingOut = () => isLoggingOut;

// ============================================
// 2. 멀티 탭 동기화 로직 (BroadcastChannel)
// ============================================
/**
 * 다른 탭에 로그인 성공 사실을 알림
 */
export const broadcastLogin = () => {
  authSyncChannel.postMessage({ type: 'LOGIN_SYNC' });
};

/**
 * 다른 탭에 로그아웃 완료 사실을 알림
 */
export const broadcastLogout = () => {
  authSyncChannel.postMessage({ type: 'LOGOUT_SYNC' });
};

/**
 * 다른 탭으로부터의 인증 동기화 메시지를 수신
 * @param onSync 동기화 메시지 수신 시 실행할 콜백
 */
export const listenAuthSync = (onSync: (type: 'LOGIN_SYNC' | 'LOGOUT_SYNC') => void) => {
  authSyncChannel.onmessage = (event) => {
    onSync(event.data.type);
  };
};

// ============================================
// 3. 토큰 만료 관리
// ============================================
let tokenExpiresAt: number | null = null;
let tokenDuration: number | null = null;
const MIN_REFRESH_THRESHOLD_MS = 60 * 1000;

export const setTokenExpiration = (expiresInSeconds: number): void => {
  tokenExpiresAt = Date.now() + (expiresInSeconds * 1000);
  tokenDuration = expiresInSeconds * 1000;
};

export const clearTokenExpiration = (): void => {
  tokenExpiresAt = null;
  tokenDuration = null;
};

export const getTokenExpiration = (): number | null => tokenExpiresAt;

export const isTokenExpiringSoon = (): boolean => {
  if (!tokenExpiresAt || !tokenDuration) return false;
  const remaining = tokenExpiresAt - Date.now();
  if (remaining <= 0) return false;
  const threshold = Math.max(tokenDuration * 0.2, MIN_REFRESH_THRESHOLD_MS);
  return remaining < threshold;
};

// ============================================
// 4. 토큰 자동 갱신
// ============================================
let refreshPromise: Promise<boolean> | null = null;

export const refreshToken = async (): Promise<boolean> => {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const response = await axios.post('/api/auth/refresh');
      if (response.data.success && response.data.expiresIn) {
        setTokenExpiration(response.data.expiresIn);
        return true;
      }
      return false;
    } catch (error) {
      devError('[authUtility] 토큰 갱신 실패:', error);
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
};

// ============================================
// 5. 인증 상태 확인 (Promise Locking)
// ============================================
interface CachedAuthResult {
  result: { authenticated: boolean; user?: UserDTO; expiresIn?: number };
  timestamp: number;
}
const CACHE_TTL_MS = 2000;
let activeAuthPromise: Promise<{ authenticated: boolean; user?: UserDTO }> | null = null;
let cachedAuthResult: CachedAuthResult | null = null;

const isCacheValid = (): boolean => {
  if (cachedAuthResult === null) return false;
  return Date.now() - cachedAuthResult.timestamp < CACHE_TTL_MS;
};

export const checkAuthStatus = async (force = false): Promise<{ authenticated: boolean; user?: UserDTO }> => {
  if (isLoggingOut) return { authenticated: false };
  if (!force && isCacheValid() && cachedAuthResult) return cachedAuthResult.result;
  if (activeAuthPromise) return activeAuthPromise;

  activeAuthPromise = (async () => {
    try {
      const response = await axios.get('/api/auth/check');
      const result = { authenticated: true, user: response.data.user as UserDTO };
      if (response.data.expiresIn) setTokenExpiration(response.data.expiresIn);
      cachedAuthResult = { result, timestamp: Date.now() };
      return result;
    } catch (error) {
      const is401 = axios.isAxiosError(error) && error.response?.status === 401;
      const result = { authenticated: false };
      cachedAuthResult = { result, timestamp: Date.now() };
      if (!is401) devError('[authUtility] 인증 확인 에러:', error);
      return result;
    } finally {
      activeAuthPromise = null;
    }
  })();
  return activeAuthPromise;
};

export const resetAuthCheck = (): void => {
  activeAuthPromise = null;
  cachedAuthResult = null;
};

export const isAuthenticated = async (): Promise<boolean> => {
  const result = await checkAuthStatus();
  return result.authenticated;
};

// ============================================
// 6. 백그라운드 타이머
// ============================================
let backgroundRefreshTimer: number | null = null;
export const startBackgroundRefresh = (): void => {
  if (backgroundRefreshTimer) return;
  backgroundRefreshTimer = window.setInterval(async () => {
    if (isTokenExpiringSoon()) {
      const success = await refreshToken();
      if (!success) stopBackgroundRefresh();
    }
  }, 60 * 1000);
};
export const stopBackgroundRefresh = (): void => {
  if (backgroundRefreshTimer) {
    window.clearInterval(backgroundRefreshTimer);
    backgroundRefreshTimer = null;
  }
};
