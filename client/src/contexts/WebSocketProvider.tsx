import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { WebSocketMessage, WebSocketSendMessage } from '../types/dtos';
import { WebSocketContext, isWebSocketMessage } from './WebSocketContext';
import { refreshToken, isRefreshing, extractUserIdFromToken } from '../utils/authUtility';

export const WebSocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const isConnectingRef = useRef(false);
  
  // useCallback 참조 저장 (재귀 호출용)
  const connectSocketRef = useRef<(() => void) | null>(null);

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const WS_URL = `${protocol}//${window.location.host}`;

  const connectSocket = useCallback(() => {
    // 로그인 페이지에서는 연결하지 않음
    if (window.location.pathname === '/') {
      return;
    }
    
    // 이미 연결 중이면 건너뜀
    if (isConnectingRef.current) {
      return;
    }

    // 이미 연결되어 있으면 건너뜀
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      setIsConnected(true);
      return;
    }

    const token = localStorage.getItem('accessToken');
    let myId = localStorage.getItem('myId');

    // myId가 없으면 JWT에서 추출
    if (!myId && token) {
      myId = extractUserIdFromToken(token);
      if (myId) {
        localStorage.setItem('myId', myId);
      }
    }

    if (!token || !myId) {
      return;
    }

    // 기존 소켓 정리
    if (socketRef.current) {
      socketRef.current.close();
    }

    isConnectingRef.current = true;
    const ws = new WebSocket(`${WS_URL}/ws?userId=${myId}&token=${token}`);

    ws.onopen = () => {
      isConnectingRef.current = false;
      setIsConnected(true);
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
      } catch {
        // silent fail
      }
    };

    ws.onclose = (event: CloseEvent) => {
      isConnectingRef.current = false;
      
      // 정상 종료 또는 로그인 페이지면 재연결하지 않음
      if (event.code === 1000 || window.location.pathname === '/') {
        setIsConnected(false);
        socketRef.current = null;
        return;
      }

      setIsConnected(false);
      socketRef.current = null;

      // 1006(비정상 종료)면 토큰 갱신 후 재연결
      if (event.code === 1006) {
        if (isRefreshing()) {
          return;
        }
        refreshToken().then((newToken) => {
          if (newToken) {
            setTimeout(() => {
              connectSocketRef.current?.();
            }, 500);
          }
        });
        return;
      }

      // 다른 종료 코드는 3초 후 재연결
      reconnectTimerRef.current = window.setTimeout(() => {
        connectSocketRef.current?.();
      }, 3000);
    };

    socketRef.current = ws;
  }, [WS_URL]);

  // connectSocket 참조 저장
  useEffect(() => {
    connectSocketRef.current = connectSocket;
  }, [connectSocket]);

  // 토큰 변경 이벤트 감지
  useEffect(() => {
    const handleTokenChange = () => {
      const token = localStorage.getItem('accessToken');
      const myId = localStorage.getItem('myId');
      if (token && myId) {
        connectSocket();
      }
    };
    
    window.addEventListener('tokenChange', handleTokenChange);
    return () => window.removeEventListener('tokenChange', handleTokenChange);
  }, [connectSocket]);

  // 초기 연결 시도
  useEffect(() => {
    const timer = setTimeout(() => {
      connectSocket();
    }, 200);
    return () => clearTimeout(timer);
  }, [connectSocket]);

  // 정리
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
      }
    };
  }, []);

  const forceReconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.close();
    }
    socketRef.current = null;
    setTimeout(() => {
      connectSocket();
    }, 100);
  }, [connectSocket]);

  const sendMessage = useCallback((message: WebSocketSendMessage) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
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
