import axios, { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { showToast } from './Alert';
import { logout, isAuthenticated } from './authUtility';

// 인증이 필요한지 확인하는 함수
const needsAuthentication = (url: string): boolean => {
  // 인증이 필요 없는 public 엔드포인트 목록
  const publicEndpoints = [
    '/api/user/login',
    '/api/user/logout',
    '/api/sessions/refresh',
  ];

  // public 엔드포인트는 인증 없이 허용
  for (const endpoint of publicEndpoints) {
    if (url.includes(endpoint)) {
      return false;
    }
  }

  return true;
};

// Axios 전역 설정
export const setupAxiosInterceptors = () => {
  axios.defaults.baseURL = '';
  axios.defaults.withCredentials = true;

  // 1. 요청 인터셉터
  axios.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
      const url = config.url || '';

      // public 엔드포인트는 인증 없이 허용
      if (!needsAuthentication(url)) {
        return config;
      }

      // 인증 상태 확인 (localStorage 플래그 사용)
      if (!isAuthenticated()) {
        // 로그인 상태가 아니면 요청 차단
        return Promise.reject(new Error('Not authenticated'));
      }

      // 토큰이 없으면 그대로 반환
      const token = localStorage.getItem('accessToken');
      if (!token) {
        return config;
      }

      // 토큰이 유효하면 헤더에 추가
      if (!config.headers) {
        config.headers = new AxiosHeaders();
      }
      config.headers.set('Authorization', `Bearer ${token}`);

      return config;
    },
    (error) => Promise.reject(error)
  );

  // 2. 응답 인터셉터
  axios.interceptors.response.use(
    (response) => response,
    async (error) => {
      // 인증 에러가 이미 처리되었으면 스킵
      if (error.message === 'Not authenticated') {
        return Promise.reject(error);
      }

      const originalRequest = error.config;

      // 네트워크 에러 (서버 응답 없음)
      if (!error.response) {
        return Promise.reject(error);
      }

      const { status, data } = error.response;
      const errorCode = data?.code;

      // 로그아웃 요청 401 -> 이미 로그아웃됨
      if (originalRequest?.url?.includes('/logout') && status === 401) {
        logout(undefined, true); // skipApi=true로 무한 루프 방지
        return Promise.reject(error);
      }

      // 로그아웃 요청 403 -> 토큰 만료로 인한 것일 수 있음
      if (originalRequest?.url?.includes('/logout') && status === 403) {
        logout(undefined, true); // skipApi=true로 무한 루프 방지
        return Promise.reject(error);
      }

      // 403 접근 거부
      if (status === 403) {
        const errorCode = data?.code;
        if (errorCode === 'A006') {
          showToast("본인의 기기만 로그아웃 할 수 있습니다.", "error");
        } else {
          showToast("접근이 거부되었습니다.", "error");
        }
        logout(undefined, true); // skipApi=true로 무한 루프 방지
        return Promise.reject(error);
      }

      // 404 세션 없음
      if (status === 404 && errorCode === 'S001') {
        logout(undefined, true);
        return Promise.reject(error);
      }

      // 401 Unauthorized - 토큰 만료로 간주하고 로그아웃
      // (refreshToken이 없으므로 재로그인 필요)
      if (status === 401 && !originalRequest?._retry) {
        showToast('세션이 만료되었습니다. 다시 로그인해주세요.', 'error');
        logout(undefined, true); // skipApi=true로 무한 루프 방지
        return Promise.reject(error);
      }

      return Promise.reject(error);
    }
  );
};
