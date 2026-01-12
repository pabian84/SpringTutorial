import axios from 'axios';
import { showAlert } from './alert';

// Axios 전역 설정
export const setupAxiosInterceptors = () => {
  // 1. 요청(Request) 챌 때마다 토큰 붙이기
  axios.interceptors.request.use(
    (config) => {
      // 로컬 또는 세션 스토리지 둘 다 확인
      const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  // 2. 응답(Response) 받을 때 에러 체크
  axios.interceptors.response.use(
    (response) => response,
    async (error) => {
      // 401 에러 (토큰 만료 or 위조) 발생 시
      if (error.response && error.response.status === 401) {
        // 원래는 여기서 Refresh Token으로 재발급 시도를 해야 하지만,
        // 일단 연습용이므로 깔끔하게 로그아웃 시키고 튕겨냅니다.
        showAlert("세션 오류", "세션이 만료되었습니다. 다시 로그인해주세요.", "error");
        ['accessToken', 'refreshToken', 'myId'].forEach(key => {
            localStorage.removeItem(key);
            sessionStorage.removeItem(key);
        });
        window.location.href = '/'; // 로그인 페이지로 강제 이동
      }
      return Promise.reject(error);
    }
  );
};