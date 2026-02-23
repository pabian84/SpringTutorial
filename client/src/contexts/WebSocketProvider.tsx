/**
 * @file WebSocketProvider.tsx
 * @description 웹소켓 연결 및 메시지 송수신 관리 (리렌더링 최적화 적용)
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { WebSocketMessage, WebSocketSendMessage } from '../types/dtos';
import { WebSocketContext, isWebSocketMessage } from './WebSocketContext';
import { AUTH_EVENTS, checkAuthStatus, isAuthenticated, getIsLoggingOut } from '../utils/authUtility';
import { AUTH_CONSTANTS } from '../constants/auth';
import { devLog } from '../utils/logger';

export const WebSocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const isConnectingRef = useRef(false);
  const connectSocketRef = useRef<(() => Promise<void>) | null>(null);

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const WS_URL = `${protocol}//${window.location.host}`;

  const connectSocket = useCallback(async () => {
    if (isConnectingRef.current || getIsLoggingOut()) return;
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      setIsConnected(true);
      return;
    }

    isConnectingRef.current = true;
    try {
      const authResult = await checkAuthStatus();
      if (!authResult.authenticated) {
        isConnectingRef.current = false;
        return;
      }

      if (socketRef.current) socketRef.current.close();
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
        } catch { /* silent fail */ }
      };

      ws.onclose = async (event: CloseEvent) => {
        isConnectingRef.current = false;
        setIsConnected(false);
        socketRef.current = null;

        if (getIsLoggingOut()) return;

        if (event.code === 4001) {
          devLog('[WebSocket] 4001 강제 종료 수신');
          window.dispatchEvent(new CustomEvent(AUTH_EVENTS.REQUEST_LOGOUT, { 
            detail: { reason: '세션이 만료되었거나 관리자에 의해 종료되었습니다.', force: true } 
          }));
          return;
        }

        const isAuth = await isAuthenticated();
        if (!isAuth || event.code === 1000 || window.location.pathname === '/') return;

        reconnectTimerRef.current = window.setTimeout(() => {
          if (connectSocketRef.current) connectSocketRef.current();
        }, AUTH_CONSTANTS.RECONNECT_DELAY_NORMAL);
      };

      ws.onerror = () => { isConnectingRef.current = false; };
      socketRef.current = ws;
    } catch (error) {
      isConnectingRef.current = false;
      devLog('[WebSocket] 연결 오류:', error);
    }
  }, [WS_URL]);

  useEffect(() => {
    connectSocketRef.current = connectSocket;
  }, [connectSocket]);

  useEffect(() => {
    const handleLoginSuccess = () => connectSocket();
    const handleLogoutCompleted = () => {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      setIsConnected(false);
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    window.addEventListener(AUTH_EVENTS.LOGIN_SUCCESS, handleLoginSuccess);
    window.addEventListener(AUTH_EVENTS.LOGOUT_COMPLETED, handleLogoutCompleted);
    
    return () => {
      window.removeEventListener(AUTH_EVENTS.LOGIN_SUCCESS, handleLoginSuccess);
      window.removeEventListener(AUTH_EVENTS.LOGOUT_COMPLETED, handleLogoutCompleted);
    };
  }, [connectSocket]);

  const forceReconnect = useCallback(() => {
    if (socketRef.current) socketRef.current.close();
    socketRef.current = null;
    setTimeout(connectSocket, AUTH_CONSTANTS.RECONNECT_DELAY_FORCE);
  }, [connectSocket]);

  const forceDisconnect = useCallback(() => {
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

  // [핵심] Context Value 메모이제이션: lastMessage가 변해도 다른 값의 참조는 유지하여 불필요한 리렌더링 방지
  const contextValue = useMemo(() => ({
    isConnected,
    lastMessage,
    sendMessage,
    forceReconnect,
    forceDisconnect
  }), [isConnected, lastMessage, sendMessage, forceReconnect, forceDisconnect]);

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};
