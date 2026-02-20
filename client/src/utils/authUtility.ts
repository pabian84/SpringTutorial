// ============================================
// authUtility.ts
// - httpOnly Cookie + Memory-based Token Expiration
// - localStorage, BroadcastChannel, Refresh Token Rotation
// ============================================

import axios from 'axios';
import { devError } from './logger';

// ============================================
// 1. Authentication State Flags (Centralized)
// ============================================
let isLoggingIn = false;   // Login in progress
let isLoggingOut = false;  // Logout in progress

export const setIsLoggingIn = (value: boolean) => { isLoggingIn = value; };
export const getIsLoggingIn = () => isLoggingIn;
export const setIsLoggingOut = (value: boolean) => { isLoggingOut = value; };
export const getIsLoggingOut = () => isLoggingOut;

// ============================================
// 2. Token Expiration Management (Memory-based)
// ============================================
// Memory variables (reset on page refresh)
let tokenExpiresAt: number | null = null;
let tokenDuration: number | null = null;  // 전체 토큰 유효시간 (ms)

// 최소 갱신 임계값: 1분 (너무 잦은 갱신 방지)
const MIN_REFRESH_THRESHOLD_MS = 60 * 1000;

/**
 * Set token expiration time (called on login/refresh)
 * @param expiresInSeconds Token validity in seconds
 */
export const setTokenExpiration = (expiresInSeconds: number): void => {
  tokenExpiresAt = Date.now() + (expiresInSeconds * 1000);
  tokenDuration = expiresInSeconds * 1000;
};

/**
 * Clear token expiration time (called on logout)
 */
export const clearTokenExpiration = (): void => {
  tokenExpiresAt = null;
  tokenDuration = null;
};

/**
 * Get token expiration time
 */
export const getTokenExpiration = (): number | null => {
  return tokenExpiresAt;
};

/**
 * Check if token is expiring soon
 * @returns true if less than 20% of total duration remaining (min 1 minute)
 */
export const isTokenExpiringSoon = (): boolean => {
  if (!tokenExpiresAt || !tokenDuration) return false;
  
  const now = Date.now();
  const remaining = tokenExpiresAt - now;
  
  // Already expired
  if (remaining <= 0) return false;
  
  // 동적 임계값: 전체 시간의 20% (최소 1분)
  const threshold = Math.max(tokenDuration * 0.2, MIN_REFRESH_THRESHOLD_MS);
  
  return remaining < threshold;
};

// ============================================
// 3. Token Refresh (Memory-based, No BroadcastChannel)
// ============================================
let refreshPromise: Promise<boolean> | null = null;

/**
 * Refresh token
 * - Single tab: simple refresh
 * - Multi tab: each tab refreshes independently
 * @returns Refresh success
 */
export const refreshToken = async (): Promise<boolean> => {
  // Already refreshing, return existing promise
  if (refreshPromise) {
    return refreshPromise;
  }
  
  refreshPromise = (async () => {
    try {
      const response = await axios.post('/api/auth/refresh');
      
      if (response.data.success && response.data.expiresIn) {
        // Update memory expiration time
        setTokenExpiration(response.data.expiresIn);
        return true;
      }
      return false;
    } catch (error) {
      devError('[authUtility] Token refresh failed:', error);
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  
  return refreshPromise;
};

// ============================================
// 4. Auth Status Check (Singleton + TTL)
// ============================================
// 사용자 정보 타입
interface UserInfo {
  id: string;
  name: string;
}

// 캐시된 인증 결과에 타임스탬프 추가 (TTL용)
interface CachedAuthResult {
  result: { authenticated: boolean; user?: UserInfo; expiresIn?: number };
  timestamp: number;
}

// 캐시 설정
const CACHE_TTL_MS = 5000; // 5초 TTL

let authCheckPromise: Promise<{ authenticated: boolean; user?: UserInfo }> | null = null;
let cachedAuthResult: CachedAuthResult | null = null;

/**
 * 캐시가 유효한지 확인
 */
const isCacheValid = (): boolean => {
  if (cachedAuthResult === null) return false;
  return Date.now() - cachedAuthResult.timestamp < CACHE_TTL_MS;
};

/**
 * 인증 상태 확인 API 호출
 * - 한 번만 호출하고 결과를 캐싱 (TTL 적용)
 * - 로그아웃 시 resetAuthCheck() 호출 필요
 * - 로그인/로그아웃 진행 중에는 캐시된 결과 반환
 * 
 * @returns 인증 결과 { authenticated: boolean, user?: UserInfo }
 */
export const checkAuthStatus = async (): Promise<{ authenticated: boolean; user?: UserInfo }> => {
  // 로그인 진행 중이면 캐시된 결과 반환 (없으면 인증 안됨으로 처리)
  if (isLoggingIn) {
    if (isCacheValid()) {
      return cachedAuthResult!.result;
    }
    return { authenticated: false };
  }

  // 로그아웃 진행 중이면 무조건 인증 안됨
  if (isLoggingOut) {
    return { authenticated: false };
  }

  // 캐시가 유효하면 캐시된 결과 반환
  if (isCacheValid()) {
    return cachedAuthResult!.result;
  }

  // 캐시 만료되었으면 초기화
  if (cachedAuthResult !== null) {
    cachedAuthResult = null;
  }

  // 이미 확인 중이면 해당 프라미스 반환 (경쟁 조건 방지)
  if (authCheckPromise !== null) {
    return authCheckPromise;
  }

  // 최초 확인 시작
  authCheckPromise = axios.get('/api/auth/check')
    .then(response => {
      const result = {
        authenticated: true,
        user: response.data.user as UserInfo
      };
      
      // Update token expiration from server response
      if (response.data.expiresIn) {
        setTokenExpiration(response.data.expiresIn);
      }
      
      // Cache result
      cachedAuthResult = {
        result,
        timestamp: Date.now()
      };
      return result;
    })
    .catch(error => {
      // 401은 인증되지 않은 것 - 정상적인 케이스
      if (error.response?.status === 401) {
        const result = { authenticated: false };
        // 실패 결과도 캐싱 (짧은 시간 동안)
        cachedAuthResult = {
          result,
          timestamp: Date.now()
        };
        return result;
      }
      // 다른 에러는 일단 인증 실패로 처리
      devError('[authUtility] 인증 확인 중 오류:', error);
      const result = { authenticated: false };
      cachedAuthResult = {
        result,
        timestamp: Date.now()
      };
      return result;
    })
    .finally(() => {
      // 프라미스 참조 정리 (다음 호출 시 새 요청 허용)
      authCheckPromise = null;
    });

  return authCheckPromise;
};

/**
 * 인증 확인 결과 리셋
 * - 로그아웃 시 호출하여 캐시된 결과 삭제
 */
export const resetAuthCheck = (): void => {
  authCheckPromise = null;
  cachedAuthResult = null;
};

/**
 * 인증 상태 확인 (간단한 버전)
 */
export const isAuthenticated = async (): Promise<boolean> => {
  const result = await checkAuthStatus();
  return result.authenticated;
};

// ============================================
// 5. Background Token Refresh Timer
// ============================================
let backgroundRefreshTimer: number | null = null;

/**
 * 백그라운드 토큰 갱신 시작
 * - 1분마다 토큰 만료 임박 여부 체크
 * - 만료 임박 시 자동 갱신
 */
export const startBackgroundRefresh = (): void => {
  if (backgroundRefreshTimer) return; // 이미 실행 중

  // 1분마다 체크
  backgroundRefreshTimer = window.setInterval(async () => {
    if (isTokenExpiringSoon()) {
      const success = await refreshToken();
      if (!success) {
        // 갱신 실패 시 타이머 정지 (로그아웃될 것임)
        stopBackgroundRefresh();
      }
    }
  }, 60 * 1000); // 1분
};

/**
 * 백그라운드 토큰 갱신 정지
 */
export const stopBackgroundRefresh = (): void => {
  if (backgroundRefreshTimer) {
    window.clearInterval(backgroundRefreshTimer);
    backgroundRefreshTimer = null;
  }
};
