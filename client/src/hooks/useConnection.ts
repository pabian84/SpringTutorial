import { useEffect, useRef } from 'react';

export const useConnection = () => {
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    // 1. 내 아이디 확인 (없으면 연결 안 함)
    const myId = localStorage.getItem('myId') || sessionStorage.getItem('myId');
    if (!myId) return;

    // 2. 접속 전용 소켓 연결
    // 기존 채팅 소켓과 다름! (/ws/connection)
    const socketUrl = `ws://localhost:8080/ws/connection?userId=${myId}`;
    ws.current = new WebSocket(socketUrl);

    ws.current.onopen = () => {
      console.log(`[Connection] 접속 상태 모니터링 시작: ${myId}`);
    };

    ws.current.onclose = () => {
      console.log('[Connection] 접속 모니터링 종료');
    };

    // 3. 페이지 닫거나 로그아웃 시 연결 끊기 -> 서버가 감지하고 오프라인 처리함
    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []); // 마운트 될 때 한 번만 실행
};