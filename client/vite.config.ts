import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import cesium from 'vite-plugin-cesium'; // 세슘 플러그인 임포트

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), cesium()], // 세슘 플러그인 추가
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080', // /api 요청은 8080으로 토스
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8080', // 웹소켓 주소
        ws: true,
        changeOrigin: true,
      },
    }
  }
})
