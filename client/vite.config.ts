import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import cesium from 'vite-plugin-cesium'; // 세슘 플러그인 임포트
import basicSsl from '@vitejs/plugin-basic-ssl'; // ssl 설정

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isHttps = process.env.VITE_HTTPS === 'true';
  const port = process.env.PORT ? parseInt(process.env.PORT) : 5173;

  return {
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
