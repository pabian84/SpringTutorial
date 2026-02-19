import axios, { type InternalAxiosRequestConfig, type AxiosError } from 'axios';
import { resetAuthCheck, checkAuthStatus, getIsLoggingOut, setIsLoggingOut } from './authUtility';

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
  url: string;
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
  if (getIsLoggingOut()) {
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
      // 인증 FAIL → 로그아웃 처리
      resetAuthCheck();
      setIsLoggingOut(true);
    }
  } catch {
    setIsLoggingOut(true);
  } finally {
    // 로그아웃 처리 시 큐 비우기
    if (getIsLoggingOut()) {
      const errorMessage = errorConfig.status === 401 ? 'Session expired' : 
                           errorConfig.status === 403 ? 'Access denied' : 'Not found';
      authRetryQueue.forEach(({ reject }) => {
        reject(new Error(errorMessage));
      });
      authRetryQueue.length = 0;
      
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
  onAuthFailed: (message: string) => void;  // 인증 실패 (로그아웃 처리)
  onAuthRestored: () => void;               // 인증 복구 (재연결 등)
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
      // 요청 설정 오류는 조용히 실패
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
          { status: 401, message: '세션이 만료되었습니다.', url: url },
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
          { status: 403, errorCode, message: '접근이 거부되었습니다.', url: url },
          onAuthFailed,
          onAuthRestored
        );

        if (handled) {
          return axios(config);
        }

        return Promise.reject(error);
      }

      // ------------------------------------------
      // 404 Not Found (자원 문제)
      // ------------------------------------------
      if (status === 404) {
        // 404는 자원 문제이므로 각 컴포넌트에서 처리
        // 여기서는 조용히 실패
        return Promise.reject(error);
      }

      // 그 외 에러는 그대로 전달
      return Promise.reject(error);
    }
  );
};
