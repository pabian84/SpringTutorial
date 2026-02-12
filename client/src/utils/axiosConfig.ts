import axios, { type InternalAxiosRequestConfig, type AxiosError } from 'axios';
import { showToast } from './Alert';
import { resetAuthCheck, checkAuthStatus } from './authUtility';

// ============================================
// 인증 재시도 큐 (401/403/404 에러 시 요청 일시정지)
// ============================================
type RetryRequest = {
  config: InternalAxiosRequestConfig;
  resolve: (value: string) => void;
  reject: (error: Error) => void;
};

const authRetryQueue: RetryRequest[] = [];

// ============================================
// 상태 관리 플래그
// ============================================
let isProcessingError = false;  // 인증 에러 처리 중복 방지
let isLoggingOut = false;        // 로그아웃 중복 방지

// 로그아웃 상태 리셋 (재로그인 시 호출)
export const resetLoggingOut = () => {
  isLoggingOut = false;
};

// ============================================
// public 엔드포인트 확인
// ============================================

const PUBLIC_ENDPOINTS = [
  '/api/user/login',
  '/api/user/logout',
  '/api/auth/check',
  '/api/sessions/refresh',
];

const isPublicEndpoint = (url: string): boolean => {
  return PUBLIC_ENDPOINTS.some(ep => url.includes(ep));
};

// ============================================
// 인증 에러 공통 처리 함수
// ============================================

interface AuthErrorConfig {
  status: number;
  errorCode?: string;
  message: string;
}

const handleAuthError = async (
  errorConfig: AuthErrorConfig,
  onAuthFailed: (message: string) => void,
  onAuthRestored: () => void
): Promise<boolean> => {
  // 이미 처리 중이면 중복 방지
  if (isProcessingError) {
    return false;
  }

  // 로그아웃 중이면 무시
  if (isLoggingOut) {
    return false;
  }

  isProcessingError = true;

  try {
    // 인증 상태 재확인
    const authResult = await checkAuthStatus();

    if (authResult.authenticated) {
      // 인증 OK → 요청 재진행
      isProcessingError = false;
      resetAuthCheck();

      // 큐에 있는 모든 요청에 토큰 전달하고 재시도
      authRetryQueue.forEach(({ resolve }) => {
        resolve(authResult.user?.id || '');
      });
      authRetryQueue.length = 0;

      onAuthRestored();  // WebSocket 재연결 등
      return true;
    } else {
      //showToast(errorConfig.message, 'error');
      
      // 인증 FAIL → 로그아웃 처리
      resetAuthCheck();
      isLoggingOut = true;
      // 큐에 있는 요청들 모두 실패 처리
      const errorMessage = errorConfig.status === 401 ? 'Session expired' : 
                           errorConfig.status === 403 ? 'Access denied' : 'Not found';
      authRetryQueue.forEach(({ reject }) => {
        reject(new Error(errorMessage));
      });
      authRetryQueue.length = 0;
    }
  } catch {
    isLoggingOut = true;
  } finally {
    // 인증 FAIL 시에만 onAuthFailed() 호출 (중복 방지)
    if (isLoggingOut) {
      onAuthFailed(errorConfig.message);
    }
    isProcessingError = false;
  }

  return false;
};

// ============================================
// Axios Interceptor 설정
// ============================================

interface InterceptorCallbacks {
  onAuthFailed: (message: string) => void;  // 인증 실패 (로그인 페이지로)
  onAuthRestored: () => void;                 // 인증 복구 (재연결 등)
}

export const setupAxiosInterceptors = (callbacks: InterceptorCallbacks) => {
  const { onAuthFailed, onAuthRestored } = callbacks;

  axios.defaults.baseURL = '';
  axios.defaults.withCredentials = true;

  // ------------------------------------------
  // 1. 요청 인터셉터
  // ------------------------------------------
  axios.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
      const url = config.url || '';

      // Public 엔드포인트는 통과
      if (isPublicEndpoint(url)) {
        return config;
      }

      // 인증 재확인 후 대기 중인 요청이 있으면 토큰 주입
      if (authRetryQueue.length > 0) {
        return new Promise<string>((resolve, reject) => {
          authRetryQueue.push({
            config,
            resolve: (token: string) => resolve(token),
            reject: (error: Error) => reject(error),
          });
        }).then((token) => {
          // 인증 성공 시 원래 요청 재시도
          if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
          }
          return config;
        });
      }

      return config;
    },
    (error: AxiosError) => {
      showToast('요청 인터셉터');
      return Promise.reject(error);
    }
  );

  // ------------------------------------------
  // 2. 응답 인터셉터
  // ------------------------------------------
  axios.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      // 네트워크 에러 (응답 없음)
      if (!error.response) {
        return Promise.reject(error);
      }

      const config = error.config as InternalAxiosRequestConfig;
      const url = config?.url || '';
      const status = error.response.status;
      const data = error.response.data as { code?: string };
      const errorCode = data?.code;

      // ------------------------------------------
      // Public 엔드포인트 에러는 무시
      // ------------------------------------------
      if (isPublicEndpoint(url)) {
        return Promise.reject(error);
      }

      // ------------------------------------------
      // 401 Unauthorized
      // ------------------------------------------
      if (status === 401) {
        const handled = await handleAuthError(
          { status: 401, message: '세션이 만료되었습니다.' },
          onAuthFailed,
          onAuthRestored
        );

        if (handled) {
          return axios(config);
        }

        return Promise.reject(error);
      }

      // ------------------------------------------
      // 403 Forbidden (A006 에러코드 제외)
      // ------------------------------------------
      if (status === 403 && errorCode !== 'A006') {
        const handled = await handleAuthError(
          { status: 403, errorCode, message: '접근이 거부되었습니다.' },
          onAuthFailed,
          onAuthRestored
        );

        if (handled) {
          return axios(config);
        }

        return Promise.reject(error);
      }

      // ------------------------------------------
      // 404 Not Found (S001 에러코드 제외)
      // ------------------------------------------
      if (status === 404 && errorCode !== 'S001') {
        const handled = await handleAuthError(
          { status: 404, errorCode, message: '페이지를 찾을 수 없습니다.' },
          onAuthFailed,
          onAuthRestored
        );

        if (handled) {
          return axios(config);
        }

        return Promise.reject(error);
      }

      // 그 외 에러는 그대로 전달
      return Promise.reject(error);
    }
  );
};
