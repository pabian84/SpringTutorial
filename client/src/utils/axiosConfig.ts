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
      if (!error.response) {
        return Promise.reject(error);
      }

      // 2. 401 에러(인증 실패)가 떴는데, 아직 재시도를 안 한 요청이라면
      if (error.response && error.response.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true; // "재시도 했다"고 표시

        try {
          // 리프레시 토큰으로 새 액세스 토큰 요청
          // (쿠키는 withCredentials=true 덕분에 자동으로 같이 감)
          const { data } = await axios.post('/api/user/refresh');
          
          if (data.status === 'ok') {
            const newAccessToken = data.accessToken;

            // 1. 새 토큰 저장
            localStorage.setItem('accessToken', newAccessToken);

            // 2. 실패했던 요청의 헤더를 새 토큰으로 교체
            originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;

            // 3. 실패했던 요청 재시도 (감쪽같이!)
            return axios(originalRequest);
          }
          throw new Error("세션 만료"); 
        } catch (e) {
          // 4. 재발급도 실패하면? -> 진짜 로그아웃 (강제 청소)
          console.log("세션이 만료되어 강제 로그아웃 됩니다.");
          showToast("세션이 만료되었습니다. 다시 로그인해주세요.", "error");
          
          localStorage.removeItem('accessToken');
          localStorage.removeItem('myId');
          
          window.location.href = '/'; // 강제로 로그인 페이지로 이동
          return Promise.reject(e);
        }
      }
      return Promise.reject(error);
    }
  );
};