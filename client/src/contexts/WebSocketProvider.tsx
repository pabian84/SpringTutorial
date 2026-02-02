import React, { useCallback, useEffect, useRef, useState } from 'react';
import { sessionApi } from '../api/sessionApi';
import type { WebSocketMessage, WebSocketSendMessage } from '../types/dtos';
import { WebSocketContext, isWebSocketMessage } from './WebSocketContext';

export const WebSocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  
  // [핵심] 재연결 트리거 (함수 재귀 호출 대신 상태 변경으로 useEffect 실행)
  const [retryCount, setRetryCount] = useState(0);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const WS_URL = `${protocol}//${window.location.host}`; 

  // [기능 1] 소켓 연결 함수 (재귀 호출 없음)
  const connectSocket = useCallback(() => {
    // 1. 토큰 및 ID 확인 (없으면 연결 시도 안 함)
    const token = localStorage.getItem('accessToken');
    const myId = localStorage.getItem('myId');

    if (!token || !myId) {
      console.warn("[WebSocket] 토큰 또는 ID가 없어 연결하지 않습니다.");
      return;
    }

    // 기존 연결 정리
    if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.close();
    }

    const ws = new WebSocket(`${WS_URL}/ws?userId=${myId}&token=${token}`);

    ws.onopen = () => {
      console.log(`✅ WebSocket Connected: ${myId}`);
      setIsConnected(true);
      // 연결 성공 시 재연결 타이머 제거
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const rawData = JSON.parse(event.data);
        if (isWebSocketMessage(rawData)) {
          setLastMessage(rawData);
        }
      } catch (e) {
        console.error('Socket message parse error', e);
      }
    };

    ws.onclose = (event: CloseEvent) => {
      console.log('❌ WebSocket Disconnected', event.code);
      setIsConnected(false);
      socketRef.current = null;

      // [복구] 1006 (비정상 종료/401) 처리 -> 토큰 갱신 시도
      if (event.code === 1006) {
        console.warn("⚠️ 1006 비정상 종료 감지: 토큰 갱신 시도");
        sessionApi.refreshToken()
          .then(() => console.log("✅ 토큰 갱신 성공, 재연결 대기..."))
          .catch((err) => {
            console.error("❌ 토큰 갱신 실패, 로그아웃 처리 예정", err);
            // axiosConfig 인터셉터가 로그아웃 처리하겠지만, 여기서도 안전하게 연결 중단
            return; 
          });
      }

      // 재연결 로직 (정상 종료 1000, 강제 로그아웃 4001 제외)
      if (event.code !== 1000 && event.code !== 4001) {
        reconnectTimerRef.current = window.setTimeout(() => {
          console.log('🔄 Reconnecting...');
          // [해결] 함수를 직접 호출하지 않고 상태를 변경해 useEffect를 트리거
          setRetryCount(prev => prev + 1); 
        }, 3000);
      }
    };

    socketRef.current = ws;
  }, [WS_URL]);

  // [기능 2] 연결 관리 (초기 실행 + retryCount 변경 시 실행)
  useEffect(() => {
    connectSocket();
    
    // Cleanup Function
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
      }
    };
  }, [connectSocket, retryCount]); // retryCount가 바뀌면 재연결

  // [기능 3] 수동 재연결 (외부 노출용)
  const forceReconnect = useCallback(() => {
    setRetryCount(prev => prev + 1);
  }, []);

  const sendMessage = useCallback((message: WebSocketSendMessage) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
    } else {
      console.warn('Socket not connected');
    }
  }, []);

  return (
    <WebSocketContext.Provider value={{ 
      isConnected, 
      lastMessage, 
      sendMessage,
      forceReconnect 
    }}>
      {children}
    </WebSocketContext.Provider>
  );
};