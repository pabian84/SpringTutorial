/**
 * @file axiosConfig.ts
 * @description Axios 인터셉터 설정 및 인증 에러 처리
 */

import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { AUTH_EVENTS, checkAuthStatus, getIsLoggingOut, isTokenExpiringSoon, refreshToken } from './authUtility';
import { devLog } from './logger';

type RetryRequest = {
  config: InternalAxiosRequestConfig;
  resolve: (value: string) => void;
  reject: (error: Error) => void;
};

const authRetryQueue: RetryRequest[] = [];

const PUBLIC_ENDPOINTS = [
  '/api/user/login',
  '/api/user/logout',
  '/api/auth/check',
  '/api/auth/refresh',
];

const isPublicEndpoint = (url: string): boolean => PUBLIC_ENDPOINTS.some(ep => url.includes(ep));

const handleAuthError = async (onAuthRestored: () => void): Promise<boolean> => {
  if (getIsLoggingOut()) return false;

  try {
    const authResult = await checkAuthStatus(true);
    if (authResult.authenticated) {
      onAuthRestored();
      authRetryQueue.forEach(({ resolve }) => resolve(authResult.user?.id || ''));
      authRetryQueue.length = 0;
      return true;
    }
  } catch (error) {
    devLog('[axiosConfig] 인증 확인 중 예외 발생:', error);
  }

  authRetryQueue.forEach(({ reject }) => reject(new Error('인증 세션이 만료되었습니다.')));
  authRetryQueue.length = 0;
  
  // [이벤트 발행] AuthProvider에게 로그아웃 요청
  window.dispatchEvent(new CustomEvent(AUTH_EVENTS.REQUEST_LOGOUT, {
    detail: { reason: '세션이 만료되어 자동으로 로그아웃되었습니다.', force: true }
  }));
  
  return false;
};

interface InterceptorCallbacks {
  onAuthFailed: (message: string) => void; // Deprecated but kept for signature compatibility
  onAuthRestored: () => void;
}

export const setupAxiosInterceptors = (callbacks: InterceptorCallbacks) => {
  const { onAuthRestored } = callbacks;
  
  axios.defaults.baseURL = '';
  axios.defaults.withCredentials = true;

  axios.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
      const url = config.url || '';
      if (isPublicEndpoint(url)) return config;
      if (getIsLoggingOut()) return Promise.reject(new Error('로그아웃 진행 중입니다.'));

      if (isTokenExpiringSoon()) {
        const success = await refreshToken();
        if (!success) {
          window.dispatchEvent(new CustomEvent(AUTH_EVENTS.REQUEST_LOGOUT, {
            detail: { reason: '세션 갱신에 실패하여 로그아웃합니다.', force: true }
          }));
          return Promise.reject(new Error('토큰 갱신 실패'));
        }
      }

      if (authRetryQueue.length > 0) {
        return new Promise<string>((resolve, reject) => {
          authRetryQueue.push({ config, resolve, reject });
        }).then(() => config);
      }
      return config;
    },
    (error: AxiosError) => Promise.reject(error)
  );

  axios.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      if (!error.response) return Promise.reject(error);

      const config = error.config as InternalAxiosRequestConfig;
      const url = config?.url || '';
      const status = error.response.status;

      if (isPublicEndpoint(url)) return Promise.reject(error);

      const isAuthError = status === 401 || (status === 403 && (error.response.data as { code?: string })?.code !== 'A006');

      if (isAuthError) {
        const handled = await handleAuthError(onAuthRestored);
        if (handled) return axios(config);
      }

      return Promise.reject(error);
    }
  );
};
