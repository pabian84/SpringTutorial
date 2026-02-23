import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { sessionApi } from '../api/sessionApi';
import { chatApi, financeApi, memoApi, statsApi } from '../api/widgetApi';
import { isAuthenticatedRef } from '../constants/authRef';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../contexts/WebSocketContext';
import type { ChatMessage, CodeData, SystemStatusMessage } from '../types/dtos';
import { showConfirm, showToast } from '../utils/Alert';
import { AUTH_EVENTS } from '../utils/authUtility';
import { devLog } from '../utils/logger';

export const useDashboardData = () => {
  const queryClient = useQueryClient();
  const { user, logout } = useAuth();
  const myId = user?.id;
  
  // Context 사용
  const { lastMessage, sendMessage } = useWebSocket();
  
  // 상태 관리
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [serverData, setServerData] = useState<SystemStatusMessage[]>([]);
  
  // 주의: ProtectedRoute에서 이미 인증을 체크하므로 여기서는 중복 체크하지 않음
  // isAuthenticatedRef.current가 없으면 API 호출이 enabled=false로 막히므로 안전함

  // 2. 접속자 리스트 (React Query)
  const { data: onlineUsers = [] } = useQuery({
    queryKey: ['onlineUsers'], 
    queryFn: sessionApi.getOnlineUsers,
    enabled: !!isAuthenticatedRef.current,
    retry: false, // 401 에러 시 재시도 안 함 (토스트 반복 방지)
  });

  // 3. 환율 데이터
  const { data: exchangeData = [] } = useQuery({
    queryKey: ['exchangeData'],
    queryFn: financeApi.getExchangeRates,
    staleTime: 1000 * 60, // 1분 캐시
    enabled: !!isAuthenticatedRef.current,
    retry: false,
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
    enabled: !!isAuthenticatedRef.current,
    retry: false,
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
    enabled: !!isAuthenticatedRef.current && !!myId,
    refetchOnWindowFocus: false,
    retry: false,
    staleTime: 0, // 메모 동기화를 위해 항상 낡은 상태로 유지
  });

  // 6. 채팅 기록 (myId가 없으면 요청하지 않음)
  useQuery({
    queryKey: ['chatHistory'],
    queryFn: async () => {
      if (!myId) {
        return [];
      }
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
    enabled: !!isAuthenticatedRef.current && !!myId,
    refetchOnWindowFocus: false,
    retry: false, // 401 에러 시 재시도 안 함 (토스트 반복 방지)
  });

  // === [WebSocket 수신 처리] ===
  useEffect(() => {
    if (!lastMessage) {
      return;
    }

    // 함수로 분리하여 useEffect 내 직접적인 setState 경고 해결
    const handleIncomingMessage = async () => {
      switch (lastMessage.type) {
        case 'SYSTEM_STATUS': {
          setServerData((prev) => {
            const updated = [...prev, lastMessage];
            return updated.length > 20 ? updated.slice(updated.length - 20) : updated;
          });
          break;
        }

        case 'CHAT': {
          setChatMessages((prev) => {
            return [...prev, lastMessage];
          });
          break;
        }

        case 'USER_UPDATE': {
          queryClient.invalidateQueries({ queryKey: ['onlineUsers'] });
          break;
        }

        case 'MEMO_UPDATE': {
          /**
           * [해결] 메모 실시간 동기화 강화
           * 1. invalidateQueries: 해당 유저의 메모 캐시를 무효화
           * 2. refetchQueries: 모든 탭(백그라운드 포함)에서 즉시 새로운 네트워크 요청 발생
           */
          if (!lastMessage.userId || lastMessage.userId === myId) {
            devLog('[WebSocket] 메모 갱신 신호 수신 -> 강제 업데이트');
            await queryClient.refetchQueries({ 
              queryKey: ['memos'], 
              type: 'all', 
              exact: false 
            });
          }
          break;
        }

        case 'FORCE_LOGOUT': {
          // 다른 기기에서 접속하여 강제 로그아웃됨
          window.dispatchEvent(new CustomEvent(AUTH_EVENTS.REQUEST_LOGOUT, {
            detail: { reason: '관리자 또는 보안 정책에 의해 로그아웃되었습니다.', force: true }
          }));
          break;
        }
      }
    };

    handleIncomingMessage();
  }, [lastMessage, queryClient, myId]);

  // === [메모 추가 핸들러] ===
  const handleAddMemo = useCallback(async (content: string) => {
    if (!myId) {
      return;
    }
    try {
      await memoApi.addMemo(myId, content);
      // 로컬 탭 즉시 갱신
      refetchMemos();
    } catch (e) {
      console.error("메모 추가 실패", e);
      showToast('메모 저장 실패', 'error');
    }
  }, [myId, refetchMemos]);

  // === [메모 삭제 핸들러] ===
  const handleDeleteMemo = useCallback(async (id: number) => {
    const result = await showConfirm('메모 삭제', '이 메모를 삭제하시겠습니까?');
    if (result.isConfirmed) {
      try {
        await memoApi.deleteMemo(id);
        showToast('메모가 삭제되었습니다.', 'success');
        // 로컬 탭 즉시 갱신
        refetchMemos();
      } catch (e) {
        console.error("메모 삭제 실패", e);
        showToast('삭제 중 오류가 발생했습니다.', 'error');
      }
    }
  }, [refetchMemos]);

  // === [메시지 전송] ===
  const handleSendMessage = useCallback((text: string) => {
    if (myId) {
      // SendChatMessage 타입에 맞춰 전송
      sendMessage({ type: 'CHAT', sender: myId, text });
    }
  }, [myId, sendMessage]);

  // === [로그아웃 핸들러] ===
  const handleLogout = useCallback(async () => {
    const result = await showConfirm('로그아웃', '정말 로그아웃 하시겠습니까?');
    if (result.isConfirmed) {
      logout('사용자 로그아웃');
    }
  }, [logout]);

  // 리렌더링 최적화를 위한 반환값 메모이제이션
  return useMemo(() => ({
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
  }), [
    myId, onlineUsers, exchangeData, codeData, memos, 
    serverData, chatMessages, handleAddMemo, handleDeleteMemo, 
    handleSendMessage, handleLogout
  ]);
};
