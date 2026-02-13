// 인증 관련 유틸리티 (httpOnly 쿠키 기반)
import axios from 'axios';
import { devError } from './logger';

// ============================================
// 인증 확인 (Singleton Pattern + TTL)
// 중복 API 호출 방지 + 캐시 만료 관리
// ============================================

// 사용자 정보 타입
interface UserInfo {
  id: string;
  name: string;
}

// 캐시된 인증 결과에 타임스탬프 추가 (TTL용)
interface CachedAuthResult {
  result: { authenticated: boolean; user?: UserInfo };
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
  const elapsed = Date.now() - cachedAuthResult.timestamp;
  return elapsed < CACHE_TTL_MS;
};

/**
 * 인증 상태 확인 API 호출
 * - 한 번만 호출하고 결과를 캐싱 (TTL 적용)
 * - 로그아웃 시 resetAuthCheck() 호출 필요
 * 
 * @returns 인증 결과 { authenticated: boolean, user?: UserInfo }
 */
export const checkAuthStatus = async (): Promise<{ authenticated: boolean; user?: UserInfo }> => {
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
      // 캐시 저장 (현재 시간 포함)
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
