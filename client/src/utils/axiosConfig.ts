import axios, { type InternalAxiosRequestConfig } from 'axios';
import { showToast } from './Alert';
import { logout } from './authUtility';

// ============================================
// 토스트/리다이렉트 중복 방지 플래그
// ============================================

let isLoggingOut = false; // 로그아웃 중복 방지
let hasShown401Toast = false;

// ============================================
// public 엔드포인트 확인 (요청/응답 공용)
// ============================================

const isPublicEndpoint = (url: string): boolean => {
  const publicEndpoints = [
    '/api/user/login',
    '/api/user/logout',
    '/api/auth/check', // 인증 확인 API - 401이 와도 처리하지 않음
    '/api/sessions/refresh',
  ];

  for (const endpoint of publicEndpoints) {
    if (url.includes(endpoint)) {
      return true;
    }
  }

  return false;
};

// ============================================
// Axios 전역 설정
// ============================================

export const setupAxiosInterceptors = () => {
  axios.defaults.baseURL = '';
  axios.defaults.withCredentials = true;

  // 1. 요청 인터셉터
  axios.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
      const url = config.url || '';

      if (isPublicEndpoint(url)) {
        return config;
      }

      return config;
    },
    (error) => Promise.reject(error)
  );

  // 2. 응답 인터셉터
  axios.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;

      if (!error.response) {
        return Promise.reject(error);
      }

      const url = originalRequest?.url || '';
      const { status, data } = error.response;
      const errorCode = data?.code;

      // 중요: public 엔드포인트의 401 응답은 무시 (토스트/리다이렉트 없음)
      if (isPublicEndpoint(url)) {
        return Promise.reject(error);
      }

      // 로그아웃 요청 401/403
      if (url.includes('/logout') && (status === 401 || status === 403)) {
        logout(undefined, true);
        return Promise.reject(error);
      }

      // 403 접근 거부
      if (status === 403) {
        if (errorCode === 'A006') {
          showToast("본인의 기기만 로그아웃 할 수 있습니다.", "error");
        } else {
          showToast("접근이 거부되었습니다.", "error");
        }
        logout(undefined, true);
        return Promise.reject(error);
      }

      // 404 세션 없음
      if (status === 404 && errorCode === 'S001') {
        logout(undefined, true);
        return Promise.reject(error);
      }

      // 401 Unauthorized
      if (status === 401) {
        // 이미 로그아웃 처리 중이면 무시
        if (isLoggingOut) {
          return Promise.reject(error);
        }

        isLoggingOut = true;

        if (!hasShown401Toast) {
          hasShown401Toast = true;
          showToast('세션이 만료되었습니다. 다시 로그인해주세요.', 'error');
        }

        logout(undefined, true);
        window.location.href = '/';

        // 5초 후 플래그 리셋 (이동 후 상태 정리)
        setTimeout(() => {
          isLoggingOut = false;
          hasShown401Toast = false;
        }, 5000);
      }

      return Promise.reject(error);
    }
  );
};
