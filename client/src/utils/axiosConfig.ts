import axios, { AxiosHeaders } from 'axios';
import { showToast } from './Alert';

// 토큰 갱신 중인지 확인하는 플래그
let isRefreshing = false;
// 갱신을 기다리는 요청들을 담아둘 대기열
let refreshSubscribers: ((token: string) => void)[] = [];

// 대기열에 있는 요청들을 처리하는 함수 (새 토큰을 나눠줌)
const onRefreshed = (accessToken: string) => {
  refreshSubscribers.forEach((callback) => callback(accessToken));
  refreshSubscribers = [];
};

// 대기열에 요청을 등록하는 함수
const addRefreshSubscriber = (callback: (token: string) => void) => {
  refreshSubscribers.push(callback);
};

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
        //config.headers['Authorization'] = `Bearer ${token}`;
        // Axios v1.x 호환성을 위한 헤더 처리
        if (!config.headers) {
          config.headers = new AxiosHeaders();
        }
        config.headers.set('Authorization', `Bearer ${token}`);
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
      if (error.response && (error.response.status === 401 || error.response.status === 403) && !originalRequest._retry) {

        // 토큰이 없는데 403이 뜨면 바로 로그인 페이지로
        if (error.response.status === 403 && !localStorage.getItem('accessToken')) {
             window.location.href = '/';
             return Promise.reject(error);
        }

        // 이미 누군가 갱신을 하고 있다면? -> 줄 서서 기다림
        if (isRefreshing) {
          return new Promise((resolve) => {
            addRefreshSubscriber((token: string) => {
              // 새 토큰을 받으면 헤더 갈아끼우고 재요청
              // [핵심 수정] Axios v1.x 헤더 객체 호환성 처리
              if (originalRequest.headers instanceof AxiosHeaders) {
                originalRequest.headers.set('Authorization', `Bearer ${token}`);
              } else {
                originalRequest.headers['Authorization'] = `Bearer ${token}`;
              }
              resolve(axios(originalRequest));
            });
          });
        }

        // 내가 첫 번째라면? -> 깃발 들고 갱신하러 감
        originalRequest._retry = true;
        isRefreshing = true;

        try {
          // 리프레시 토큰으로 새 액세스 토큰 요청
          // (쿠키는 withCredentials=true 덕분에 자동으로 같이 감)
          const { data } = await axios.post('/api/user/refresh');
          
          if (data.status === 'ok') {
            const newAccessToken = data.accessToken;

            // 1. 새 토큰 저장
            localStorage.setItem('accessToken', newAccessToken);
            axios.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;

            // 2. 깃발 내리고 대기하던 애들한테 새 토큰 배급
            isRefreshing = false;
            onRefreshed(newAccessToken);

            // 3. 실패했던 요청의 헤더를 새 토큰으로 교체
            if (originalRequest.headers instanceof AxiosHeaders) {
              originalRequest.headers.set('Authorization', `Bearer ${newAccessToken}`);
            } else {
              originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
            }
            return axios(originalRequest);
          }
          throw new Error("토큰 리프레시 실패"); 
        } catch (e) {
          // 갱신 실패 시 -> 다 같이 사망 (로그아웃)
          isRefreshing = false;
          refreshSubscribers = []; // 대기열 비움

          // 진짜 로그아웃 (강제 청소)
          console.log("세션이 만료되어 강제 로그아웃 됩니다.");
          showToast("세션이 만료되었습니다. 다시 로그인해주세요.", "error");
          
          localStorage.removeItem('accessToken');
          localStorage.removeItem('myId');
          
          window.location.href = '/'; // 강제로 로그인 페이지로 이동
          return Promise.reject(e);
        } finally {
          isRefreshing = false;
        }
      }
      return Promise.reject(error);
    }
  );
};