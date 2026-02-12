import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { WebSocketMessage, WebSocketSendMessage } from '../types/dtos';
import { WebSocketContext, isWebSocketMessage } from './WebSocketContext';
import { checkAuthStatus, isAuthenticated } from '../utils/authUtility';
import { AUTH_CONSTANTS } from '../constants/auth';

export const WebSocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const isConnectingRef = useRef(false);
  const isLoggedOutRef = useRef(true); // 로그아웃 후 재연결 방지

  // useCallback 참조 저장 (재귀 호출용)
  const connectSocketRef = useRef<(() => void) | null>(null);

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const WS_URL = `${protocol}//${window.location.host}`;

  const connectSocket = useCallback(async () => {
    // 로그아웃 후 재연결 방지
    if (isLoggedOutRef.current) {
      return;
    }

    // 인증 상태 확인 (비동기)
    const authResult = await checkAuthStatus();
    if (!authResult.authenticated) {
      return;
    }

    // myId는 checkAuthStatus에서 가져옴
    const myId = authResult.user?.id;
    if (!myId) {
      // myId가 없으면 인증되지 않은 것으로 간주
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

    // 쿠키가 자동으로 전송되므로 URL 파라미터에서 토큰 제거
    // 서버의 JwtHandshakeInterceptor가 쿠키에서 토큰을 읽음
    const ws = new WebSocket(`${WS_URL}/ws`);

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

    ws.onclose = async (event: CloseEvent) => {
      isConnectingRef.current = false;

      // 인증 상태 확인 후 재연결 여부 결정
      const isAuth = await isAuthenticated();
      if (!isAuth) {
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

  // 로그인/로그아웃 이벤트 감지
  useEffect(() => {
    const handleAuthLogin = async () => {
      const isAuth = await isAuthenticated();
      if (isAuth) {
        connectSocket();
      }
    };

    const handleLogout = () => {
      isLoggedOutRef.current = true; // 로그아웃 상태로 설정

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

    window.addEventListener('authLogin', handleAuthLogin);
    window.addEventListener('authLogout', handleLogout);
    return () => {
      window.removeEventListener('authLogin', handleAuthLogin);
      window.removeEventListener('authLogout', handleLogout);
    };
  }, [connectSocket]);

  // 초기 연결 시도
  useEffect(() => {
    const timer = setTimeout(async () => {
      // 로그아웃 상태면 연결하지 않음
      if (isLoggedOutRef.current) {
        return;
      }

      const isAuth = await isAuthenticated();
      if (isAuth) {
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

  const forceReconnect = useCallback(async () => {
    const isAuth = await isAuthenticated();
    isLoggedOutRef.current = false;

    if (!isAuth) {
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
