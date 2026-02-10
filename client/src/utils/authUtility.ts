// 인증 관련 유틸리티 (React 외부에서 사용 가능)
import { showToast } from './Alert';
import { AUTH_CONSTANTS } from '../constants/auth';
import { userApi } from '../api/userApi';
import { devError } from './logger';

// 토큰 변경/로그아웃 이벤트 리스너 (WebSocket 재연결 및 페이지 이동용)
const LOGOUT_EVENT = 'authLogout';
const LOGIN_EVENT = 'authLogin';

// 로그아웃 이벤트 발생 (WebSocket 정리용)
export const emitLogoutEvent = (): void => {
  window.dispatchEvent(new CustomEvent(LOGOUT_EVENT));
};

// 로그인 이벤트 발생
export const emitLoginEvent = (): void => {
  window.dispatchEvent(new CustomEvent(LOGIN_EVENT));
};

const TOKEN_EXPIRY_KEY = 'accessTokenExpiresAt';
const AUTH_STATE_KEY = 'isAuthenticated'; // 로그인 상태 플래그

// ============================================
// ⚙️ 토큰 설정 (constants/auth.ts에서 수정)
// ⚠️ application.yml의 access-token-validity-in-seconds와 일치시켜야 함
// ============================================

// 현재 설정값 가져오기 (외부에서 사용 가능)
export const getTokenExpirySeconds = (): number => {
  return AUTH_CONSTANTS.IS_TEST_MODE
    ? AUTH_CONSTANTS.TEST_TOKEN_EXPIRY
    : AUTH_CONSTANTS.PROD_TOKEN_EXPIRY;
};

// JWT 토큰에서 userId 추출
export const extractUserIdFromToken = (token: string): string | null => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    const payload = JSON.parse(jsonPayload);
    return payload.sub || payload.userId || null;
  } catch (e) {
    devError('[authUtility] JWT 디코딩 실패:', e);
    return null;
  }
};

// 토큰 만료 시간 가져오기
export const getTokenExpiry = (): number | null => {
  const expiresAt = localStorage.getItem(TOKEN_EXPIRY_KEY);
  return expiresAt ? parseInt(expiresAt, 10) : null;
};

// 토큰 만료 시간 설정
export const setTokenExpiry = (expiresInSeconds: number): void => {
  const expiresAt = Date.now() + (expiresInSeconds * 1000);
  localStorage.setItem(TOKEN_EXPIRY_KEY, expiresAt.toString());
};

// 토큰 버퍼 시간 가져오기 (테스트/운영 모드 자동 감지)
const getTokenBuffer = (): number => {
  const expiresAt = getTokenExpiry();
  if (!expiresAt) return 0;

  const remaining = expiresAt - Date.now();
  // 20초 미만은 테스트 모드로 간주 (15초 토큰 + 여유)
  const isTestMode = remaining < 20000;
  return isTestMode
    ? AUTH_CONSTANTS.BUFFER_TEST
    : AUTH_CONSTANTS.BUFFER_PROD;
};

// 토큰이 만료 임박했는지 확인
export const shouldRefreshToken = (): boolean => {
  const expiresAt = getTokenExpiry();
  if (!expiresAt) return false;

  return Date.now() >= (expiresAt - getTokenBuffer());
};

// 토큰 유효성 검사
export const isTokenValid = (): boolean => {
  const token = localStorage.getItem('accessToken');
  if (!token) {
    return false;
  }

  const expiresAt = getTokenExpiry();
  if (!expiresAt) {
    return true;
  }

  return Date.now() < (expiresAt - getTokenBuffer());
};

// 인증 상태 확인 (localStorage 플래그 사용)
export const isAuthenticated = (): boolean => {
  // localStorage의 인증 상태 플래그 확인
  const authState = localStorage.getItem(AUTH_STATE_KEY);
  if (authState === 'true') {
    return true;
  }
  // 플래그가 없으면 토큰 유효성으로 판단 (하위 호환성)
  return isTokenValid();
};

// 로그아웃
export const logout = async (reason?: string, skipApi = false): Promise<void> => {
  // 토스트 표시 (있는 경우)
  if (reason) {
    showToast(reason, 'error');
  }

  // 1. userId 미리 추출 (localStorage 삭제 전)
  const userId = localStorage.getItem('myId');

  // 2. 인증 상태 플래그 즉시 false로 설정 (API 호출 차단)
  localStorage.setItem(AUTH_STATE_KEY, 'false');

  // 3. 로컬 스토리지 선택적 정리 (safeKeys 제외)
  const safeKeys = ['theme', 'language', 'sidebarState']; // 유지할 키들
  const allKeys = Object.keys(localStorage);
  
  allKeys.forEach(key => {
    if (!safeKeys.includes(key)) {
      localStorage.removeItem(key);
    }
  });

  // 4. 로그아웃 이벤트 발생 (WebSocket 정리 + 페이지 이동)
  emitLogoutEvent();

  // 5. 서버 로그아웃 API 호출 (skipApi 플래그로 무한 루프 방지)
  if (!skipApi) {
    try {
      await userApi.logout(userId || undefined);
    } catch (e) {
      // 서버 로그아웃 실패해도 클라이언트 측 로그아웃은 이미 완료
      devError(e);
    }
  }
};

// 토큰 설정 (로그인 시 사용)
export const setToken = (token: string, expiresInSeconds: number): void => {
  localStorage.setItem('accessToken', token);
  setTokenExpiry(expiresInSeconds);
  
  // 인증 상태 플래그 설정 (API 호출 허용)
  localStorage.setItem(AUTH_STATE_KEY, 'true');

  // 토큰 변경 이벤트 발생 (WebSocket 재연결용)
  window.dispatchEvent(new Event('tokenChange'));
};

// 토큰 가져오기
export const getAccessToken = (): string | null => {
  return localStorage.getItem('accessToken');
};
