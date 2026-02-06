import axios, { AxiosHeaders } from 'axios';
import { showToast } from './Alert';
import { 
  shouldRefreshToken, 
  addRefreshSubscriber, 
  refreshToken, 
  logout,
  isRefreshing
} from './authUtility';

// Axios 전역 설정
export const setupAxiosInterceptors = () => {
  axios.defaults.baseURL = '';
  axios.defaults.withCredentials = true;

  // 1. 요청 인터셉터
  axios.interceptors.request.use(
    async (config) => {
      // 리프레시 요청일 때는 토큰 제외
      if (config.url && config.url.includes('/refresh')) {
        return config;
      }
      
      // 토큰이 없으면 그대로 반환
      const token = localStorage.getItem('accessToken');
      if (!token) {
        return config;
      }
      
      // 토큰 갱신이 필요한 경우
      if (shouldRefreshToken() && !isRefreshing()) {
        try {
          const newToken = await refreshToken();
          if (newToken) {
            if (!config.headers) {
              config.headers = new AxiosHeaders();
            }
            config.headers.set('Authorization', `Bearer ${newToken}`);
          }
        } catch {
          // 갱신 실패해도 요청은 진행 (응답 인터셉터에서 401 처리)
        }
      } else if (isRefreshing()) {
        // 갱신 중이면 새 토큰이 나올 때까지 대기 (블로킹)
        try {
          const newToken = await refreshToken();
          if (newToken) {
            if (!config.headers) {
              config.headers = new AxiosHeaders();
            }
            config.headers.set('Authorization', `Bearer ${newToken}`);
          }
        } catch {
          // 갱신 실패해도 요청은 진행
        }
      } else if (token) {
        // 토큰이 유효하면 헤더에 추가
        if (!config.headers) {
          config.headers = new AxiosHeaders();
        }
        config.headers.set('Authorization', `Bearer ${token}`);
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
      
      // 네트워크 에러 (서버 응답 없음)
      if (!error.response) {
        return Promise.reject(error);
      }

      const { status, data } = error.response;
      const errorCode = data?.code;

      // 리프레시 요청 401 -> 즉시 로그아웃 (refresh 토큰 자체가 만료됨)
      if (originalRequest.url?.includes('/refresh') && status === 401) {
        showToast('로그인 세션이 만료되었습니다. 다시 로그인해주세요.', 'error');
        logout();
        return Promise.reject(error);
      }

      // 로그아웃 요청 401 -> 이미 로그아웃됨
      if (originalRequest.url?.includes('/logout') && status === 401) {
        logout();
        return Promise.reject(error);
      }

      // 403 접근 거부
      if (status === 403) {
        // 이미 logout 중이면 중복 호출 방지
        if (isRefreshing()) {
          return new Promise((resolve) => {
            addRefreshSubscriber((token: string) => {
              if (originalRequest.headers instanceof AxiosHeaders) {
                originalRequest.headers.set('Authorization', `Bearer ${token}`);
              } else {
                originalRequest.headers['Authorization'] = `Bearer ${token}`;
              }
              resolve(axios(originalRequest));
            });
          });
        }
        
        // 토큰이 이미 정리되었으면 중복 로그아웃 방지
        const token = localStorage.getItem('accessToken');
        if (!token) {
          // 이미 로그아웃 상태
          return Promise.reject(error);
        }
        
        if (errorCode === 'A006') {
          showToast("본인의 기기만 로그아웃 할 수 있습니다.", "error");
        } else {
          showToast("접근이 거부되었습니다.", "error");
        }
        logout();
        return Promise.reject(error);
      }

      // 404 세션 없음
      if (status === 404 && errorCode === 'S001') {
        logout();
        return Promise.reject(error);
      }

      // 401 Unauthorized - 토큰 만료 의심
      if (status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;

        // 이미 갱신 중이면 대기
        if (isRefreshing()) {
          return new Promise((resolve) => {
            addRefreshSubscriber((token: string) => {
              if (originalRequest.headers instanceof AxiosHeaders) {
                originalRequest.headers.set('Authorization', `Bearer ${token}`);
              } else {
                originalRequest.headers['Authorization'] = `Bearer ${token}`;
              }
              resolve(axios(originalRequest));
            });
          });
        }

        // 토큰 갱신 시도
        try {
          const newToken = await refreshToken();
          if (newToken) {
            if (originalRequest.headers instanceof AxiosHeaders) {
              originalRequest.headers.set('Authorization', `Bearer ${newToken}`);
            } else {
              originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
            }
            return axios(originalRequest);
          }
          logout();
          return Promise.reject(error);
        } catch {
          logout();
          return Promise.reject(error);
        }
      }

      return Promise.reject(error);
    }
  );
};
