// 인증 관련 상수 (중앙化管理)
// ⚠️ 환경 변수优先: .env 파일에서 값을 읽고, 없으면 기본값 사용

export const AUTH_CONSTANTS = {
  // ============================================
  // 토큰 설정
  // 사용법: .env 파일에서 VITE_IS_TEST_MODE, VITE_TOKEN_EXPIRY_SECONDS 설정
  // 기본값: 테스트 모드 (10초), 운영 모드 (30분)
  // ============================================
  
  // 테스트 모드 (환경 변수 또는 기본값 true)
  IS_TEST_MODE: import.meta.env.VITE_IS_TEST_MODE === 'true' || true,
  
  // 토큰 만료 시간 (초)
  // IS_TEST_MODE=true: 10초 (快速 테스트)
  // IS_TEST_MODE=false: 30분 (1800초) 운영
  TEST_TOKEN_EXPIRY: parseInt(import.meta.env.VITE_TOKEN_EXPIRY_SECONDS || '10', 10),
  PROD_TOKEN_EXPIRY: 1800,

  // Refresh Token (7일 = 604800초, 고정)
  REFRESH_TOKEN_EXPIRY: 604800,

  // ============================================
  // 토큰 버퍼 (테스트/운영 모드 자동 감지)
  // ============================================
  BUFFER_TEST: 2000,    // 테스트 모드: 2초 버퍼
  BUFFER_PROD: 300000,  // 운영 모드: 5분 버퍼 (5 * 60 * 1000)

  // ============================================
  // 재연결 타임아웃 (밀리초)
  // ============================================
  RECONNECT_DELAY_TOKEN_REFRESH: 500,  // 토큰 갱신 후 재연결
  RECONNECT_DELAY_NORMAL: 3000,          // 일반 재연결
  RECONNECT_DELAY_INITIAL: 200,         // 초기 연결
  RECONNECT_DELAY_FORCE: 100,           // 강제 재연결

  // ============================================
  // 기타
  // ============================================
  NAVIGATE_DELAY_LOGIN: 100,  // 로그인 페이지 이동 지연
  REFRESH_TIMEOUT: 10000,      // 토큰 갱신 타임아웃 (10초)
} as const;
