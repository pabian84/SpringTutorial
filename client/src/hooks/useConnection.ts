import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom'; // 주소 변경 감지용

export const useConnection = () => {
  const ws = useRef<WebSocket | null>(null);
  const location = useLocation(); // 현재 주소 가져오기

  useEffect(() => {
    // 1. 내 아이디 확인 (없으면 연결 안 함)
    const myId = localStorage.getItem('myId');
    // 로그아웃 상태면 연결 끊기 (중요)
    if (!myId) {
      if (ws.current) {
        console.log('[Connection] 로그아웃 감지 -> 연결 종료');
        ws.current.close();
        ws.current = null;
      }
      return;
    }

    // 2. 이미 연결되어 있으면 패스 (중복 연결 방지)
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      return;
    }

    // 3. 로그인 상태인데 연결이 없다면 -> 연결 시도
    // (이전 소켓이 닫히는 중이거나 닫혀있으면 새로 연결)
    if (!ws.current || ws.current.readyState === WebSocket.CLOSED) {
      // 연결 시작
      const socketUrl = `ws://localhost:8080/ws/connection?userId=${myId}`;
      ws.current = new WebSocket(socketUrl);
      ws.current.onopen = () => console.log(`[Connection] 접속 상태 모니터링 시작: ${myId}`);
      ws.current.onerror = (error) => console.error('[Connection] WebSocket Error:', error);
      ws.current.onclose = () => {
        console.log('[Connection] 접속 모니터링 종료');
        ws.current = null; // 끊기면 초기화
      };
    }
  }, [location.pathname]); // 마운트 될 때 한 번만 실행

  // 앱이 완전히 종료될 때만 소켓 정리 (Unmount 시)
  useEffect(() => {
    // 페이지 닫거나 로그아웃 시 연결 끊기 -> 서버가 감지하고 오프라인 처리함
    return () => {
      if (ws.current) {
        // 소켓이 '연결 중(CONNECTING)'일 때 close()를 부르면 에러가 납니다.
        // 따라서 '연결됨(OPEN)' 상태일 때만 명시적으로 닫아줍니다.
        if (ws.current.readyState === WebSocket.OPEN) {
          console.log('[Connection] 앱 종료(F5 등) -> 소켓 정리');
          ws.current.onopen = null;
          ws.current.onmessage = null;
          ws.current.onerror = null;
          ws.current.close();
        }
      }
    };
  }, []);
};