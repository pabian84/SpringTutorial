import { createContext, useContext } from 'react';
import type { WebSocketMessage, WebSocketSendMessage } from '../types/dtos';

interface WebSocketContextType {
  isConnected: boolean;
  lastMessage: WebSocketMessage | null;
  sendMessage: (message: WebSocketSendMessage) => void;
  forceReconnect: () => void;
}

export const WebSocketContext = createContext<WebSocketContextType | null>(null);

// [Helper] 타입 가드
export function isWebSocketMessage(data: unknown): data is WebSocketMessage {
  if (typeof data !== 'object' || data === null) return false;
  const type = (data as { type?: unknown }).type;
  return typeof type === 'string' && 
    ['SYSTEM_STATUS', 'CHAT', 'USER_UPDATE', 'MEMO_UPDATE', 'FORCE_LOGOUT'].includes(type);
}


export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) throw new Error('useWebSocket must be used within WebSocketProvider');
  return context;
};