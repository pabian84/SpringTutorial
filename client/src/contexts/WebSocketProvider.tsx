import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { WebSocketMessage, WebSocketSendMessage } from '../types/dtos';
import { WebSocketContext, isWebSocketMessage } from './WebSocketContext';
import { extractUserIdFromToken, isAuthenticated } from '../utils/authUtility';
import { AUTH_CONSTANTS } from '../constants/auth';

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
    // 인증 상태 확인
    if (!isAuthenticated()) {
      return;
    }

    // 토큰이 없으면 연결하지 않음
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

    // 이미 연결 중이면 건너뜀
    if (isConnectingRef.current) {
      return;
    }

    // 이미 연결되어 있으면 건너뜀
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      setIsConnected(true);
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
      
      // 인증 상태 확인 후 재연결 여부 결정
      if (!isAuthenticated()) {
        setIsConnected(false);
        socketRef.current = null;
        return;
      }

      // 정상 종료 또는 로그인 페이지면 재연결하지 않음
      if (event.code === 1000 || window.location.pathname === '/') {
        setIsConnected(false);
        socketRef.current = null;
        return;
      }

      setIsConnected(false);
      socketRef.current = null;

      // 재연결 시도 (일반 재연결)
      reconnectTimerRef.current = window.setTimeout(() => {
        connectSocketRef.current?.();
      }, AUTH_CONSTANTS.RECONNECT_DELAY_NORMAL);
    };

    ws.onerror = () => {
      isConnectingRef.current = false;
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
      if (isAuthenticated()) {
        connectSocket();
      }
    };
    
    // 로그아웃 이벤트 감지 (WebSocket 정리)
    const handleLogout = () => {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
        setIsConnected(false);
      }
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
    
    window.addEventListener('tokenChange', handleTokenChange);
    window.addEventListener('authLogout', handleLogout);
    return () => {
      window.removeEventListener('tokenChange', handleTokenChange);
      window.removeEventListener('authLogout', handleLogout);
    };
  }, [connectSocket]);

  // 초기 연결 시도
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isAuthenticated()) {
        connectSocket();
      }
    }, AUTH_CONSTANTS.RECONNECT_DELAY_INITIAL);
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
    if (!isAuthenticated()) {
      return;
    }
    if (socketRef.current) {
      socketRef.current.close();
    }
    socketRef.current = null;
    setTimeout(() => {
      connectSocket();
    }, AUTH_CONSTANTS.RECONNECT_DELAY_FORCE);
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
