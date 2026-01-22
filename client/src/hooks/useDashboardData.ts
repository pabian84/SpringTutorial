import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ChatHistoryDTO, CodeData, MemoDTO, StockDTO, SystemStatusDTO, UserDTO } from '../types/dtos';
import { showConfirm, showToast } from '../utils/alert';

const WS_URL = import.meta.env.VITE_WS_URL;

export const useDashboardData = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const myId = localStorage.getItem('myId');
  
  // 상태 관리
  const [chatMessages, setChatMessages] = useState<ChatHistoryDTO[]>([]);
  const [serverData, setServerData] = useState<SystemStatusDTO[]>([]);
  
  // 소켓 Refs
  const chatWs = useRef<WebSocket | null>(null);
  const dashboardWs = useRef<WebSocket | null>(null);

  // 1. 유저 인증 체크
  useEffect(() => {
    if (!myId) {
      navigate('/');
    }
  }, [myId, navigate]);

  // 2. 접속자 리스트 (React Query)
  const { data: onlineUsers = [] } = useQuery({
    queryKey: ['onlineUsers'], 
    queryFn: async () => {
      const res = await axios.get('/api/user/onlineList');
      return res.data as UserDTO[];
    },
  });

  // 3. 환율 데이터
  const { data: exchangeData = [] } = useQuery({
    queryKey: ['exchangeData'],
    queryFn: async () => {
      const res = await axios.get<StockDTO[]>('/api/finance/dashboard');
      return res.data as StockDTO[];
    },
    staleTime: 1000 * 60 // 1분 캐시
  });

  // 4. 코드 통계 데이터
  const { data: codeData = [] } = useQuery({
    queryKey: ['codeStats'],
    queryFn: async () => {
      const res = await axios.get<Record<string, number>>('/api/stats/code');
      const chartData = Object.entries(res.data).map(([name, value]) => ({
        name,
        value
      }));
      chartData.sort((a, b) => b.value - a.value);
      return chartData as CodeData[];
    },
    staleTime: 1000 * 60 * 10 // 10분 캐시
  });

  // 5. 메모 데이터
  const { data: memos = [], refetch: refetchMemos } = useQuery({
    queryKey: ['memos', myId],
    queryFn: async () => {
       const res = await axios.get<MemoDTO[]>(`/api/memo/${myId}`);
       return res.data;
    },
    enabled: !!myId, 
    refetchOnWindowFocus: false, 
  });

  // 메모 추가 핸들러
  const handleAddMemo = useCallback(async (content: string) => {
    if (!myId) return;
    try {
      await axios.post('/api/memo', { userId: myId, content });
      refetchMemos();
    } catch (e) {
      console.error("메모 추가 실패", e);
      showToast('메모 저장 실패', 'error');
    }
  }, [myId, refetchMemos]);

  // 메모 삭제 핸들러
  const handleDeleteMemo = useCallback(async (id: number) => {
    const result = await showConfirm('메모 삭제', '이 메모를 삭제하시겠습니까?');
    if (result.isConfirmed) {
      try {
        await axios.delete(`/api/memo/${id}`);
        showToast('메모가 삭제되었습니다.', 'success');
        refetchMemos();
      } catch (e) {
        console.error("메모 삭제 실패", e);
        showToast('삭제 중 오류가 발생했습니다.', 'error');
      }
    }
  }, [refetchMemos]);

  // 6. 채팅 기록
  useQuery({
    queryKey: ['chatHistory'],
    queryFn: async () => {
      try {
        const res = await axios.get('/api/chat/history');
        if (Array.isArray(res.data)) {
          setChatMessages(res.data);
        } else {
          setChatMessages([]);
        }
        return res.data as ChatHistoryDTO[];
      } catch (e) {
        console.error('채팅 기록을 가져 올 수 없습니다', e);
        return [];
      }
    },
    refetchOnWindowFocus: false,
  });

  // 7. WebSocket 연결 (Dashboard & Chat)
  useEffect(() => {
    // Dashboard WS
    if (!dashboardWs.current || dashboardWs.current.readyState === WebSocket.CLOSED) {
      dashboardWs.current = new WebSocket(`${WS_URL}/ws/dashboard`);
      dashboardWs.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'USER_UPDATE') {
            queryClient.invalidateQueries({ queryKey: ['onlineUsers'] });
          } else if (message.type === 'SYSTEM_STATUS') {
            const timeStr = new Date().toLocaleTimeString('en-GB', {
              hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
            });
            setServerData(prev => {
              const newData = { ...message, time: message.time || timeStr };
              const updated = [...prev, newData];
              return updated.length > 20 ? updated.slice(updated.length - 20) : updated;
            });
          }
        } catch (e) { console.error(e); }
      };
    }

    // Chat WS
    if (!chatWs.current || chatWs.current.readyState === WebSocket.CLOSED) {
      chatWs.current = new WebSocket(`${WS_URL}/ws/chat`);
      chatWs.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && typeof data === 'object') {
            setChatMessages(prev => [...prev, data]);
          }
        } catch (e) { console.error(e); }
      };
    }

    return () => {
        if (dashboardWs.current) {
          if (dashboardWs.current.readyState === WebSocket.OPEN) {
            dashboardWs.current.onopen = null;
            dashboardWs.current.onmessage = null;
            dashboardWs.current.close();
        }
        }
        if (chatWs.current) {
          if (chatWs.current.readyState === WebSocket.OPEN) {
            chatWs.current.onopen = null;
            chatWs.current.onmessage = null;
            chatWs.current.onerror = null;
            chatWs.current.close();
          }
        }
    };
  }, [queryClient]);

  // 메시지 전송
  const handleSendMessage = useCallback((text: string) => {
    if (chatWs.current?.readyState === WebSocket.OPEN && myId) {
      chatWs.current.send(JSON.stringify({ sender: myId, text }));
    }
  }, [myId]);

  // 로그아웃
  const handleLogout = async () => {
    try {
      if (myId) await axios.post('api/user/logout', { userId: myId });
    } catch (e) {
      console.error('Logout failed', e);
      showToast('Logout failed', 'error');
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('myId');
      showToast('로그아웃 되었습니다.');
      navigate('/');
    }
  };

  return {
    myId,
    onlineUsers,
    exchangeData,
    codeData,
    memos,
    serverData,
    chatMessages,
    handleAddMemo,
    handleDeleteMemo,
    handleSendMessage,
    handleLogout
  };
};