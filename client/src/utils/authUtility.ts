// 인증 관련 유틸리티 (httpOnly 쿠키 기반)
import axios from 'axios';
import { showToast } from './Alert';
import { userApi } from '../api/userApi';
import { AUTH_CONSTANTS } from '../constants/auth';
import { devError } from './logger';

// 이벤트 리스너 키
const LOGOUT_EVENT = 'authLogout';
const LOGIN_EVENT = 'authLogin';

// ============================================
// 단일 인증 확인 (Singleton Pattern)
// 중복 API 호출 방지
// ============================================

let authCheckPromise: Promise<{ authenticated: boolean; user?: UserInfo }> | null = null;
let authCheckResult: { authenticated: boolean; user?: UserInfo } | null = null;

// 사용자 정보 타입
interface UserInfo {
  id: string;
  name: string;
}

/**
 * 인증 상태 확인 API 호출
 * - 한 번만 호출하고 결과를 캐싱
 * - 로그아웃 시 resetAuthCheck() 호출 필요
 */
export const checkAuthStatus = async (): Promise<{ authenticated: boolean; user?: UserInfo }> => {
  // 이미 확인 완료했으면 캐시된 결과 반환
  if (authCheckResult !== null) {
    return authCheckResult;
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
      authCheckResult = result;
      return result;
    })
    .catch(error => {
      // 401은 인증되지 않은 것 - 정상적인 케이스
      if (error.response?.status === 401) {
        authCheckResult = { authenticated: false };
        return authCheckResult;
      }
      // 다른 에러는 일단 인증 실패로 처리
      devError('[authUtility] 인증 확인 중 오류:', error);
      authCheckResult = { authenticated: false };
      return authCheckResult;
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
  authCheckResult = null;
};

// ============================================
// 토큰 설정 (constants/auth.ts에서 수정)
// 하위 호환성을 위해 유지
// ============================================

// 현재 설정값 가져오기
export const getTokenExpirySeconds = (): number => {
  return AUTH_CONSTANTS.IS_TEST_MODE
    ? AUTH_CONSTANTS.TEST_TOKEN_EXPIRY
    : AUTH_CONSTANTS.PROD_TOKEN_EXPIRY;
};

// ============================================
// 이벤트 관련
// ============================================

export const emitLogoutEvent = (): void => {
  window.dispatchEvent(new CustomEvent(LOGOUT_EVENT));
};

export const emitLoginEvent = (): void => {
  window.dispatchEvent(new CustomEvent(LOGIN_EVENT));
};

// ============================================
// 인증 상태 확인
// ============================================

/**
 * 인증 상태 확인
 * - 내부적으로 checkAuthStatus를 사용
 */
export const isAuthenticated = async (): Promise<boolean> => {
  const result = await checkAuthStatus();
  return result.authenticated;
};

// ============================================
// 로그아웃
// ============================================

export const logout = async (reason?: string, skipApi = false): Promise<void> => {
  // 토스트 표시
  if (reason) {
    showToast(reason, 'error');
  }

  // 1. 인증 확인 결과 리셋
  resetAuthCheck();

  // 2. 로컬 스토리지 선택적 정리 (safeKeys 제외)
  const safeKeys = ['theme', 'language', 'sidebarState'];
  const allKeys = Object.keys(localStorage);

  allKeys.forEach(key => {
    if (!safeKeys.includes(key)) {
      localStorage.removeItem(key);
    }
  });

  // 3. 로그아웃 이벤트 발생 (WebSocket 정리 + 페이지 이동)
  emitLogoutEvent();

  // 4. 서버 로그아웃 API 호출
  if (!skipApi) {
    try {
      // body에 userId를 전달하여 토큰 없이도 로그아웃 처리
      await userApi.logout(undefined);
    } catch (e) {
      devError(e);
    }
  }
};
