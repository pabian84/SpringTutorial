// 인증 상태 추적용 Ref (localStorage.getItem 제거 후 httpOnly 쿠키 사용)
// React Query의 enabled 옵션에서 사용됨 - 항상 최신 값을 참조
export const isAuthenticatedRef = { current: false };
