// 인증 관련 유틸리티 (React 외부에서 사용 가능)
import { sessionApi } from '../api/sessionApi';
import { showToast } from './Alert';

// 토큰 변경/로그아웃 이벤트 리스너 (WebSocket 재연결 및 페이지 이동용)
const LOGOUT_EVENT = 'authLogout';

// 로그아웃 이벤트 발생 (WebSocket 정리용)
export const emitLogoutEvent = (): void => {
  window.dispatchEvent(new CustomEvent(LOGOUT_EVENT));
};

const TOKEN_EXPIRY_KEY = 'accessTokenExpiresAt';
const TOKEN_REFRESHING_KEY = 'isRefreshing';
const TOKEN_CHANGE_EVENT = 'tokenChange';

// 로그아웃 중복 호출 방지
let isLoggingOut = false;

// ============================================
// ⚙️ 토큰 설정 (테스트용으로 여기서 수정)
// ⚠️ application.yml의 access-token-validity-in-seconds와 일치시켜야 함
// ============================================
const IS_TEST_MODE = true; // 테스트 모드: true = 10초, false = 30분
const TEST_TOKEN_EXPIRY = 10; // 테스트용 토큰 만료 시간 (초)
const PROD_TOKEN_EXPIRY = 1800; // 운영용 토큰 만료 시간 (초) = 30분

// 현재 설정값 가져오기 (외부에서 사용 가능)
export const getTokenExpirySeconds = (): number => {
  return IS_TEST_MODE ? TEST_TOKEN_EXPIRY : PROD_TOKEN_EXPIRY;
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
    console.error('[authUtility] JWT 디코딩 실패:', e);
    return null;
  }
};

// 토큰 갱신 상태 추적 (localStorage 기반 - HMR 대응)
let refreshSubscribers: ((token: string) => void)[] = [];

// localStorage 기반 isRefreshing (HMR 대응)
const setRefreshing = (value: boolean): void => {
  if (value) {
    localStorage.setItem(TOKEN_REFRESHING_KEY, Date.now().toString());
  } else {
    localStorage.removeItem(TOKEN_REFRESHING_KEY);
  }
};

export const isRefreshing = (): boolean => {
  const value = localStorage.getItem(TOKEN_REFRESHING_KEY);
  if (!value) return false;
  
  // 10초 이상 경과했으면 상태 초기화 (응답이 안 왔을 경우)
  const timestamp = parseInt(value, 10);
  if (Date.now() - timestamp > 10000) {
    localStorage.removeItem(TOKEN_REFRESHING_KEY);
    return false;
  }
  
  return true;
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

// 토큰이 만료 임박했는지 확인 (만료 5분 전 또는 10초 미만)
export const shouldRefreshToken = (): boolean => {
  const expiresAt = getTokenExpiry();
  if (!expiresAt) return false;
  
  // 테스트용: 10초 만료 토큰은 2초 버퍼
  // 실제 배포 시: 5 * 60 * 1000 (5분 버퍼) 사용
  const expiryTime = expiresAt - Date.now();
  const bufferTime = expiryTime < 10000 ? 2000 : 5 * 60 * 1000;
  
  return Date.now() >= (expiresAt - bufferTime);
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
  
  // 남은 시간이 10초 미만일 때는 1초 버퍼, 그 외에는 5분 버퍼
  const remainingTime = expiresAt - Date.now();
  const bufferTime = remainingTime < 10000 ? 1000 : 5 * 60 * 1000;
  
  return Date.now() < (expiresAt - bufferTime);
};

// 대기열에 새 토큰 전달
const onRefreshed = (token: string): void => {
  refreshSubscribers.forEach(callback => callback(token));
  refreshSubscribers = [];
};

// 대기열에 등록
export const addRefreshSubscriber = (callback: (token: string) => void): void => {
  refreshSubscribers.push(callback);
};

// 토큰 갱신 - 새 토큰 반환
export const refreshToken = async (): Promise<string | null> => {
  // 이미 갱신 중이면 대기
  if (isRefreshing()) {
    return new Promise((resolve) => {
      addRefreshSubscriber((token: string) => {
        resolve(token);
      });
    });
  }
  
  setRefreshing(true);
  refreshSubscribers = [];
  
  try {
    const data = await sessionApi.refreshToken();
    
    if (data && data.accessToken) {
      localStorage.setItem('accessToken', data.accessToken);
      setTokenExpiry(getTokenExpirySeconds());
      onRefreshed(data.accessToken);
      
      // 토큰 변경 이벤트 발생 (WebSocket 재연결용)
      window.dispatchEvent(new Event(TOKEN_CHANGE_EVENT));
      
      setRefreshing(false);
      return data.accessToken;
    }
    
    setRefreshing(false);
    refreshSubscribers = [];
    return null;
  } catch {
    refreshSubscribers = [];
    setRefreshing(false);
    return null;
  }
};

// 쿠키 옵션 생성 (모든 환경에서 SameSite=Lax 사용)
// HttpOnly 쿠키이므로 JavaScript로 접근 불가, 보안상 안전
const getCookieOptions = (): string => {
  return 'path=/; SameSite=Lax';
};

// 쿠키 삭제 (도메인 경로 설정)
const deleteRefreshTokenCookie = (): void => {
  const cookieOptions = getCookieOptions();
  const domains = ['', 'localhost', window.location.hostname];
  
  domains.forEach(domain => {
    const domainPart = domain ? `; domain=${domain}` : '';
    document.cookie = `refreshToken=;${domainPart}; expires=Thu, 01 Jan 1970 00:00:00 GMT; ${cookieOptions}`;
  });
};

// 로그아웃
export const logout = async (reason?: string): Promise<void> => {
  // 이미 로그아웃 중이면 중복 호출 방지
  if (isLoggingOut) {
    return;
  }
  isLoggingOut = true;
  
  // 토스트 표시 (있는 경우)
  if (reason) {
    showToast(reason, 'error');
  }
  
  // 토스트가 보여줄 시간을 확보 (1초) - 사용자에게 메시지を見せる 시간
  //await new Promise(resolve => setTimeout(resolve, 1000));
  
  // 모든 정리 작업을 먼저 수행
  // 1. 로컬 스토리지 정리
  localStorage.removeItem('accessToken');
  localStorage.removeItem('myId');
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
  localStorage.removeItem(TOKEN_REFRESHING_KEY);
  
  // 2. 대기열 정리
  refreshSubscribers = [];
  
  // 3. 쿠키 삭제
  deleteRefreshTokenCookie();
  
  // 4. 로그아웃 이벤트 발생 (WebSocket 정리 + 페이지 이동)
  emitLogoutEvent();
  
  // 5. 서버 로그아웃 API 호출 (선택적 - 실패해도 무시)
  try {
    await sessionApi.logout();
  } catch (e) {
    // 서버 로그아웃 실패해도 클라이언트 측 로그아웃은 이미 완료
    console.error(e);
  }
  
  isLoggingOut = false;
};

// 새 토큰 가져오기 (갱신 필요시 갱신)
export const getAccessToken = async (): Promise<string | null> => {
  const token = localStorage.getItem('accessToken');
  if (!token) return null;
  
  // 만료 임박했으면 갱신 시도
  if (shouldRefreshToken()) {
    const newToken = await refreshToken();
    if (newToken) {
      return newToken;
    }
    return null;
  }
  
  return token;
};

// 토큰 설정 (로그인 시 사용)
export const setToken = (token: string, expiresInSeconds: number): void => {
  localStorage.setItem('accessToken', token);
  setTokenExpiry(expiresInSeconds);
  
  // 토큰 변경 이벤트 발생 (WebSocket 재연결용)
  window.dispatchEvent(new Event(TOKEN_CHANGE_EVENT));
};
