import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sessionApi } from '../api/sessionApi';
import { userApi } from '../api/userApi';
import { chatApi, financeApi, memoApi, statsApi } from '../api/widgetApi';
import type { ChatHistoryDTO, CodeData, SystemStatusDTO } from '../types/dtos';
import { showConfirm, showToast } from '../utils/Alert';

// 하드코딩된 주소 대신, 현재 브라우저 주소를 기반으로 설정
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_URL = `${protocol}//${window.location.host}`; // host는 도메인+포트 포함

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
    queryFn: sessionApi.getOnlineUsers,
    enabled: !!myId,
  });

  // 3. 환율 데이터
  const { data: exchangeData = [] } = useQuery({
    queryKey: ['exchangeData'],
    queryFn: financeApi.getExchangeRates,
    staleTime: 1000 * 60 // 1분 캐시
  });

  // 4. 코드 통계 데이터
  const { data: codeData = [] } = useQuery({
    queryKey: ['codeStats'],
    queryFn: async () => {
      const data = await statsApi.getCodeStats();
      const chartData = Object.entries(data).map(([name, value]) => ({
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
      if (!myId) {
        return [];
      }
       return await memoApi.getMemos(myId);
    },
    enabled: !!myId, 
    refetchOnWindowFocus: false, 
  });

  // 메모 추가 핸들러
  const handleAddMemo = useCallback(async (content: string) => {
    if (!myId) return;
    try {
      await memoApi.addMemo(myId, content);
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
        await memoApi.deleteMemo(id);
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
        const data = await chatApi.getHistory();
        if (Array.isArray(data)) {
          setChatMessages(data);
        } else {
          setChatMessages([]);
        }
        return data;
      } catch (e) {
        console.error('채팅 기록을 가져 올 수 없습니다', e);
        return [];
      }
    },
    refetchOnWindowFocus: false,
  });

  // 7. WebSocket 연결 (Dashboard & Chat)
  useEffect(() => {
    // 1. 토큰 확인 (토큰이 없으면 연결 시도조차 하지 않음)
    const token = localStorage.getItem('accessToken');
    
    // 로그아웃 상태면 연결 끊기
    if (!token) {
      return;
    }
    // Dashboard WS
    if (!dashboardWs.current || dashboardWs.current.readyState === WebSocket.CLOSED) {
      dashboardWs.current = new WebSocket(`${WS_URL}/ws/dashboard?token=${token}`);
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
      chatWs.current = new WebSocket(`${WS_URL}/ws/chat?token=${token}`);
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
      await userApi.logout();
    } catch (e) {
      console.error('Logout failed', e);
      showToast('Logout failed', 'error');
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('myId');
      showToast('로그아웃 되었습니다');
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