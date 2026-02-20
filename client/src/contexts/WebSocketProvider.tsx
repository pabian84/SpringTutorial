import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { WebSocketMessage, WebSocketSendMessage } from '../types/dtos';
import { WebSocketContext, isWebSocketMessage } from './WebSocketContext';
import { checkAuthStatus, isAuthenticated, getIsLoggingOut, setIsLoggingOut } from '../utils/authUtility';
import { AUTH_CONSTANTS } from '../constants/auth';
import { devLog } from '../utils/logger';

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

  const connectSocket = useCallback(async () => {
    // [핵심] 맨 앞에서 연결 중 체크 (경쟁 조건 방지)
    if (isConnectingRef.current) {
      devLog('[WebSocket] 이미 연결 중, 요청 무시');
      return;
    }

    // 로그아웃 중이면 연결하지 않음
    if (getIsLoggingOut()) {
      return;
    }

    // 이미 연결되어 있으면 건너뜀
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      setIsConnected(true);
      return;
    }

    // [핵심] 연결 시작 플래그 설정 (비동기 작업 전)
    isConnectingRef.current = true;

    try {
      // 인증 상태 확인 (비동기)
      const authResult = await checkAuthStatus();
      if (!authResult.authenticated) {
        isConnectingRef.current = false;
        return;
      }

      // myId는 checkAuthStatus에서 가져옴
      const myId = authResult.user?.id;
      if (!myId) {
        isConnectingRef.current = false;
        return;
      }

      // 기존 소켓 정리
      if (socketRef.current) {
        socketRef.current.close();
      }

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

        // 4001 (Force Logout): 기기 강퇴 또는 세션 초과
        // 재연결하지 않고 로그아웃 이벤트 발생
        if (event.code === 4001) {
          devLog('[WebSocket] Force Logout (4001)');
          setIsConnected(false);
          socketRef.current = null;
          setIsLoggingOut(true);
          // 로그아웃 이벤트 발생 → AuthProvider에서 처리
          window.dispatchEvent(new CustomEvent('authLogout'));
          return;
        }

        // 로그아웃 중이면 재연결하지 않음
        if (getIsLoggingOut()) {
          setIsConnected(false);
          socketRef.current = null;
          return;
        }

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
    } catch (error) {
      isConnectingRef.current = false;
      devLog('[WebSocket] 연결 중 오류:', error);
    }
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
      // 로그아웃 중이면 연결하지 않음
      if (getIsLoggingOut()) {
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
    setIsLoggingOut(false);

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

  // 로그아웃 시 WebSocket 강제 종료
  const forceDisconnect = useCallback(() => {
    devLog('[WebSocketProvider] WebSocket 강제 종료');
    setIsLoggingOut(true);

    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    setIsConnected(false);

    if (reconnectTimerRef.current) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

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
      forceReconnect,
      forceDisconnect
    }}>
      {children}
    </WebSocketContext.Provider>
  );
};
