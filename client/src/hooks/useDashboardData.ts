import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sessionApi } from '../api/sessionApi';
import { chatApi, financeApi, memoApi, statsApi } from '../api/widgetApi';
import type { ChatHistoryDTO, ChatMessage, CodeData, SystemStatusMessage } from '../types/dtos';
import { showConfirm, showToast } from '../utils/Alert';
import { useWebSocket } from '../contexts/WebSocketContext';
import { resetAuthCheck } from '../utils/authUtility';
import { useAuth } from '../contexts/AuthContext';

export const useDashboardData = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, logout } = useAuth();
  const myId = user?.id;
  
  // Context 사용
  const { lastMessage, sendMessage } = useWebSocket();
  
  // 상태 관리
  const [chatMessages, setChatMessages] = useState<ChatHistoryDTO[]>([]);
  const [serverData, setServerData] = useState<SystemStatusMessage[]>([]);
  
  // 주의: ProtectedRoute에서 이미 인증을 체크하므로 여기서는 중복 체크하지 않음
  // myId가 없으면 API 호출이 enabled=false로 막히므로 안전함

  // 2. 접속자 리스트 (React Query)
  const { data: onlineUsers = [] } = useQuery({
    queryKey: ['onlineUsers'], 
    queryFn: sessionApi.getOnlineUsers,
    enabled: !!myId,
    retry: false, // 401 에러 시 재시도 안 함 (토스트 반복 방지)
  });

  // 3. 환율 데이터
  const { data: exchangeData = [] } = useQuery({
    queryKey: ['exchangeData'],
    queryFn: financeApi.getExchangeRates,
    staleTime: 1000 * 60, // 1분 캐시
    retry: false, // 401 에러 시 재시도 안 함 (토스트 반복 방지)
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
    staleTime: 1000 * 60 * 10, // 10분 캐시
    retry: false, // 401 에러 시 재시도 안 함 (토스트 반복 방지)
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
    retry: false, // 401 에러 시 재시도 안 함 (토스트 반복 방지)
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

  // 6. 채팅 기록 (myId가 없으면 요청하지 않음)
  useQuery({
    queryKey: ['chatHistory'],
    queryFn: async () => {
      if (!myId) return [];
      try {
        const data = await chatApi.getHistory();
        // API 응답(ChatHistoryDTO)을 소켓 메시지 타입(ChatMessage)으로 변환
        const formattedData: ChatMessage[] = Array.isArray(data) 
          ? data.map(d => ({
              type: 'CHAT',
              sender: d.sender,
              text: d.text,
              createdAt: d.createdAt || new Date().toISOString()
            }))
          : [];
        setChatMessages(formattedData);
        return formattedData;
      } catch (e) {
        console.error('채팅 기록을 가져 올 수 없습니다', e);
        return [];
      }
    },
    enabled: !!myId, // myId가 있어야만 요청
    refetchOnWindowFocus: false,
    retry: false, // 401 에러 시 재시도 안 함 (토스트 반복 방지)
  });

  // === [WebSocket 수신 처리] ===
  useEffect(() => {
    if (!lastMessage) return;

    // Discriminated Union 덕분에 switch-case에서 타입 추론 완벽 지원
    switch (lastMessage.type) {
      case 'SYSTEM_STATUS': {
        // 여기서 lastMessage는 자동으로 SystemStatusMessage 타입이 됨
        const statusMessage = lastMessage as SystemStatusMessage;
        const init = (msg : SystemStatusMessage) => {
            setServerData((prev) => {
            const updated = [...prev, msg];
            return updated.length > 20 ? updated.slice(updated.length - 20) : updated;
          });
        };
        // WebSocket 메시지 수신 시 상태 업데이트 (의도된 동작)
        init(statusMessage);
        break;
      }

      case 'CHAT': {
        // 여기서 lastMessage는 자동으로 ChatMessage 타입이 됨
        const chatMessage = lastMessage as ChatMessage
        const init2 = (msg : ChatMessage) => {
            setChatMessages((prev) => [...prev, msg]);
        };
        init2(chatMessage);
        break;
      }

      case 'USER_UPDATE':
        // 여기서 lastMessage는 UserUpdateMessage
        queryClient.invalidateQueries({ queryKey: ['onlineUsers'] });
        break;

      case 'MEMO_UPDATE':
        queryClient.invalidateQueries({ queryKey: ['memos'] });
        break;

      case 'FORCE_LOGOUT':
        showToast('다른 기기에서 접속하여 로그아웃되었습니다.', 'error');
        // 인증 확인 결과 리셋
        resetAuthCheck();
        // AuthProvider의 상태도 정리되어야 함 (logout 호출)
        navigate('/');
        break;
    }
  }, [lastMessage, queryClient, navigate]);

  // === [메시지 전송] ===
  const handleSendMessage = useCallback((text: string) => {
    if (myId) {
      // SendChatMessage 타입에 맞춰 전송
      sendMessage({ type: 'CHAT', sender: myId, text });
    }
  }, [myId, sendMessage]);

  // === [로그아웃 - 중앙화된 authUtility 사용] ===
  const handleLogout = async () => {
    await logout('사용자 로그아웃');
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