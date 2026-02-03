import { createLogger, defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import cesium from 'vite-plugin-cesium'; // 세슘 플러그인 임포트
import basicSsl from '@vitejs/plugin-basic-ssl'; // ssl 설정

// "Node.js 시스템 에러는 code 속성을 가질 수 있다"는 것을 명시합니다.
interface NetworkError extends Error {
  code?: string;
}

// 1. 커스텀 로거 생성 (Vite 공식 API)
const logger = createLogger();
const originalError = logger.error;

// 2. 에러 로그 가로채기 (Override)
logger.error = (msg, options) => {
  if (options?.error) {
    const err = options.error as NetworkError;
    // 문자열이 아니라, '에러 코드'로 정확하게 비교합니다.
    const silentCodes = ['ECONNRESET', 'ECONNABORTED', 'EPIPE'];
    if (err.code && silentCodes.includes(err.code)) {
      // 이 에러들은 "브라우저가 연결을 끊음"을 의미하므로 개발 중엔 무시해도 안전합니다.
      console.warn(`${err.code}`);
      return;
    }
  }
  // 그 외 진짜 에러만 원래대로 출력
  originalError(msg, options);
};


// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isHttps = process.env.VITE_HTTPS === 'true';
  const port = process.env.PORT ? parseInt(process.env.PORT) : 5173;

  return {
    customLogger: logger,
    plugins: [ react(), cesium(), ...(isHttps ? [basicSsl()] : []) ], // 세슘 플러그인 추가
    server: {
      host: true,
      port: port,
      strictPort: true,
      proxy: {
        '/api': {
          target: env.VITE_API_TARGET || 'http://localhost:8080', // /api 요청은 8080으로 토스
          changeOrigin: true,
          secure: false,
        },
        '/ws': {
          target: env.VITE_WS_TARGET || 'ws://localhost:8080', // 웹소켓 주소
          ws: true,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  }
});
