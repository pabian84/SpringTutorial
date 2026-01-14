import axios from 'axios';
import { showToast } from './alert';

// Axios 전역 설정
export const setupAxiosInterceptors = () => {
  // 환경 변수에서 기본 URL을 가져와 설정합니다.
  axios.defaults.baseURL = import.meta.env.VITE_API_URL;
  // 기본 설정: 쿠키를 포함한 요청을 보내도록 설정
  axios.defaults.withCredentials = true;

  // 1. 요청(Request) 챌 때마다 토큰 붙이기
  axios.interceptors.request.use(
    (config) => {
      // 로컬 또는 세션 스토리지 둘 다 확인
      const token = localStorage.getItem('accessToken');
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
      const originalRequest = error.config;
      // 1. 응답이 아예 없는 경우 (네트워크 오류 등)
      if (!error.response && !originalRequest._retry) {
        originalRequest._retry = true
        return Promise.reject(error);
      }

      // 2. 401 에러(인증 실패)가 떴는데, 아직 재시도를 안 한 요청이라면
      if (error.response && (error.response.status === 401 || error.response.status === 403) && !originalRequest._retry) {
        originalRequest._retry = true; // "재시도 했다"고 표시

        try {
            // 3. 리프레시 토큰으로 새 액세스 토큰 달라고 떼써보기
            // (주의: 여기 URL이나 로직이 서버 구현과 맞아야 함)
            /* 지금은 Refresh 로직이 복잡할 수 있으니, 
               심플하게 "401 뜨면 그냥 로그아웃 시키는" 안전빵 코드로 갑니다.
               나중에 Refresh Token Rotation을 완벽히 구현하면 그때 살리세요.
            */
             
            // 만약 리프레시 토큰 로직이 없다면 바로 아래 catch로 넘어갑니다.
            throw new Error("세션 만료"); 

        } catch (refreshError) {
            // 4. 재발급도 실패하면? -> 진짜 로그아웃 (강제 청소)
            console.log("세션이 만료되어 강제 로그아웃 됩니다.");
            showToast("세션이 만료되었습니다. 다시 로그인해주세요.", "error");
            
            localStorage.removeItem('accessToken');
            localStorage.removeItem('myId');
            
            window.location.href = '/'; // 강제로 로그인 페이지로 이동
            return Promise.reject(refreshError);
        }
      }
      return Promise.reject(error);
    }
  );
};