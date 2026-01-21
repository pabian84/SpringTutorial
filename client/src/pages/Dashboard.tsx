import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import React, { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary'; // 에러 바운더리 관련 임포트
import 'react-grid-layout/css/styles.css';
import { Responsive, WidthProvider } from 'react-grid-layout/legacy'; // React Grid Layout 관련
import { BiCollapse, BiDetail, BiExpand } from 'react-icons/bi';
import { FaChartLine, FaCode, FaComments, FaGlobeAsia, FaMapMarkedAlt, FaServer, FaStickyNote } from 'react-icons/fa';
import 'react-resizable/css/styles.css';
import { useNavigate } from 'react-router-dom';
import CesiumWidget from '../components/cesium/CesiumWidget'; // 세슘 위젯
import ChatWidget from '../components/ChatWidget';
import CodeStatsWidget, { type CodeData } from '../components/CodeStatsWidget';
import ErrorFallback from '../components/common/ErrorFallback'; // 에러 바운더리 관련 임포트
import ExchangeWidget from '../components/ExchangeWidget';
import KakaoMapWidget from '../components/KakaoMapWidget';
import MemoWidget from '../components/MemoWidget';
import ServerMonitor from '../components/Servermonitor';
import WeatherWidget from '../components/WeatherWidget';
import { useUserLocation } from '../contexts/UserLocationContext';
import type { ChatHistoryDTO, MemoDTO, StockDTO, SystemStatusDTO, UserDTO } from '../types/dtos'; // 통합 DTO 가져오기
import { showConfirm, showToast } from '../utils/alert';

const WS_URL = import.meta.env.VITE_WS_URL;
const ResponsiveGridLayout = WidthProvider(Responsive);

// 비동기 렌더링 컴포넌트 (초기 로딩 렉 방지)
// 브라우저의 메인 스레드가 바쁠 때는 렌더링을 미루고, 여유가 있을 때(Idle) 처리하여 버벅임을 없앱니다.
const DeferredComponent = ({ children, idle = false, delay = 0 }: { children: React.ReactNode, idle?: boolean, delay?: number }) => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const run = () => {
      // delay가 있으면 setTimeout으로 지연
      if (delay > 0) {
        setTimeout(() => setIsMounted(true), delay);
      } else {
        setIsMounted(true);
      }
    };

    // idle=true면 브라우저가 쉴 때 렌더링 (지도, 차트 등 무거운 위젯용)
    if (idle && 'requestIdleCallback' in window) {
      const handle = window.requestIdleCallback(run);
      return () => window.cancelIdleCallback(handle);
    } else {
      // 일반 위젯은 다음 프레임에 렌더링
      const handle = requestAnimationFrame(run);
      return () => cancelAnimationFrame(handle);
    }
  }, [idle, delay]);

  // 로딩 전에는 공간만 차지하는 빈 div 반환 (Layout Shift 방지)
  if (!isMounted) return <div style={{ width: '100%', height: '100%' }} />; // 로딩 전 빈 공간
  return <>{children}</>;
};


// [설정] 초기 레이아웃 정의 (12 컬럼 기준)
// x: 가로 위치(0~11), y: 세로 위치, w: 너비, h: 높이
const initialLayouts = {
  lg: [
    { i: 'weather', x: 0, y: 0,  w: 9, h: 8 },    // 날씨 (왼쪽 상단)
    { i: 'online',  x: 9, y: 0,  w: 3, h: 8 },    // 접속자 (오른쪽 길게)
    { i: 'map',     x: 0, y: 8,  w: 6, h: 10 },   // 지도 (날씨 아래)
    { i: 'cesium',  x: 6, y: 8,  w: 6, h: 10 },   // 3D 지도 (지도 오른쪽)
    { i: 'exchange',x: 0, y: 16, w: 6, h: 8 },    // 환율 (지도 아래 1)
    { i: 'code',    x: 6, y: 16, w: 6, h: 8 },    // 코드 통계 (지도 아래 2)
    { i: 'server',  x: 0, y: 14, w: 6, h: 8 },    // 서버 모니터 (맨 아래)
    { i: 'memo',    x: 6, y: 14, w: 3, h: 8 },    // 메모
    { i: 'chat',    x: 9, y: 14, w: 3, h: 8 },    // 채팅
  ],
  // [md]: 10컬럼 기준 (자동 변환)
  md: [
    { i: 'weather', x: 0, y: 0, w: 7, h: 8 },
    { i: 'online', x: 7, y: 0, w: 3, h: 8 },
    { i: 'map', x: 0, y: 8, w: 5, h: 10 },
    { i: 'cesium', x: 5, y: 8, w: 5, h: 10 },
    { i: 'exchange', x: 0, y: 18, w: 5, h: 8 },
    { i: 'code', x: 5, y: 18, w: 5, h: 8 },
    { i: 'server', x: 0, y: 26, w: 10, h: 6 },
    { i: 'memo', x: 0, y: 32, w: 5, h: 8 },
    { i: 'chat', x: 5, y: 32, w: 5, h: 8 },
  ],
  // [sm]: 6컬럼 기준 (태블릿)
  sm: [
    { i: 'weather', x: 0, y: 0, w: 4, h: 8 },
    { i: 'online', x: 4, y: 0, w: 2, h: 8 },
    { i: 'map', x: 0, y: 8, w: 6, h: 8 },
    { i: 'cesium', x: 0, y: 16, w: 6, h: 8 },
    { i: 'exchange', x: 0, y: 24, w: 3, h: 8 },
    { i: 'code', x: 3, y: 24, w: 3, h: 8 },
    { i: 'server', x: 0, y: 32, w: 6, h: 6 },
    { i: 'memo', x: 0, y: 38, w: 3, h: 8 },
    { i: 'chat', x: 3, y: 38, w: 3, h: 8 },
  ],
  // [xs]: 4컬럼 기준 (모바일)
  xs: [
    { i: 'weather', x: 0, y: 0, w: 4, h: 6 },
    { i: 'online', x: 0, y: 6, w: 4, h: 4 },
    { i: 'map', x: 0, y: 10, w: 4, h: 6 },
    { i: 'cesium', x: 0, y: 16, w: 4, h: 6 },
    { i: 'exchange', x: 0, y: 22, w: 4, h: 6 },
    { i: 'code', x: 0, y: 28, w: 4, h: 6 },
    { i: 'server', x: 0, y: 34, w: 4, h: 6 },
    { i: 'memo', x: 0, y: 40, w: 4, h: 6 },
    { i: 'chat', x: 0, y: 46, w: 4, h: 8 },
  ],
  // [xxs]: 2컬럼 (초소형)
  xxs: [
    { i: 'weather', x: 0, y: 0, w: 2, h: 6 },
    { i: 'online', x: 0, y: 6, w: 2, h: 4 },
    { i: 'map', x: 0, y: 10, w: 2, h: 6 },
    { i: 'cesium', x: 0, y: 16, w: 2, h: 6 },
    { i: 'exchange', x: 0, y: 22, w: 2, h: 6 },
    { i: 'code', x: 0, y: 28, w: 2, h: 6 },
    { i: 'server', x: 0, y: 34, w: 2, h: 6 },
    { i: 'memo', x: 0, y: 40, w: 2, h: 6 },
    { i: 'chat', x: 0, y: 46, w: 2, h: 8 },
  ]
};

// 공통 카드 컴포넌트 (스타일 통일 및 애니메이션 담당)
interface DashboardCardProps {
  id: string;
  title?: string;      // 텍스트 타이틀만 받음
  icon?: React.ReactNode; // 아이콘 따로 받음
  children: React.ReactNode;
  onExpand?: () => void;
  onClose?: () => void;
  isExpanded?: boolean;
  noHeader?: boolean; // 날씨처럼 헤더 없는 경우
  headerAction?: React.ReactNode; // 헤더 우측에 들어갈 커스텀 액션 버튼
  keepMounted?: boolean; // 세슘처럼 리로드되면 안되는 컴포넌트인지 여부
}

// React.memo를 사용하여 props가 변하지 않으면 재렌더링 방지
const DashboardCard = memo(({ id, title, icon, children, onExpand, onClose, isExpanded, noHeader, headerAction, keepMounted = false }: DashboardCardProps) => {
  // 애니메이션 중인지 확인하는 상태
  const [isAnimating, setIsAnimating] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const prevRect = useRef<DOMRect | null>(null);

  // 1. 확장 클릭 시점의 좌표 저장 (First)
  const handleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (cardRef.current) {
      prevRect.current = cardRef.current.getBoundingClientRect();
    }
    if (onExpand) onExpand();
  };

  // FLIP (First, Last, Invert, Play) 애니메이션 로직
  useLayoutEffect(() => {
    if (!cardRef.current) return;

    if (isExpanded) {
      // 확장 시작 (Opening)
      if (prevRect.current) {
        // setIsAnimating을 비동기로 호출하여 'cascading renders' 오류 방지
        requestAnimationFrame(() => setIsAnimating(true));
        
        const el = cardRef.current;
        
        // Last: 확장된(Fixed) 상태의 좌표 측정
        const lastRect = el.getBoundingClientRect();
        const firstRect = prevRect.current;

        // Invert: 위치와 크기 차이 계산
        const deltaX = firstRect.left - lastRect.left;
        const deltaY = firstRect.top - lastRect.top;
        const deltaW = firstRect.width / lastRect.width;
        const deltaH = firstRect.height / lastRect.height;

        // 애니메이션 없이 시작 위치로 강제 이동 (Invert)
        el.style.transition = 'none';
        el.style.transformOrigin = 'top left'; 
        el.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(${deltaW}, ${deltaH})`;

        // Force Reflow
        el.getBoundingClientRect();

        // Play
        requestAnimationFrame(() => {
          el.style.transition = 'all 0.5s cubic-bezier(0.25, 1, 0.25, 1)';
          el.style.transform = 'none';
        });

        // 애니메이션 종료 정리
        const timer = setTimeout(() => {
          requestAnimationFrame(() => {
            setIsAnimating(false);
            if (el) {
                el.style.transition = '';
                el.style.transform = '';
            }
            prevRect.current = null;
          });
        }, 500);
        return () => clearTimeout(timer);
      }
    } else {
      // 2. 축소 시 (Closing) - [수정] 역방향 FLIP 적용하여 스프링 현상 제거
      // DOM은 이미 작아져 있음(isExpanded=false). 이를 JS로 강제로 화면 전체 크기인 척 늘렸다가 줄임.
      requestAnimationFrame(() => setIsAnimating(true));
      
      const el = cardRef.current;
      const currentRect = el.getBoundingClientRect(); // 현재(작아진) 위치
      const screenW = window.innerWidth;
      const screenH = window.innerHeight;

      // Invert: 현재 작은 카드를 화면 전체 크기만큼 확대/이동시킴
      // (작은 카드를 마치 화면 전체 덮고 있는 상태로 보이게 함)
      const scaleX = screenW / currentRect.width;
      const scaleY = screenH / currentRect.height;
      const transX = -currentRect.left; // 0,0으로 이동
      const transY = -currentRect.top;

      el.style.transition = 'none';
      el.style.transformOrigin = 'top left';
      el.style.transform = `translate(${transX}px, ${transY}px) scale(${scaleX}, ${scaleY})`;
      
      el.getBoundingClientRect(); // Reflow

      // Play: 원래의 작은 크기(transform: none)로 복귀
      requestAnimationFrame(() => {
        el.style.transition = 'all 0.5s cubic-bezier(0.25, 1, 0.25, 1)';
        el.style.transform = 'none';
      });

      const timer = setTimeout(() => {
        requestAnimationFrame(() => {
            setIsAnimating(false);
            if (el) {
                el.style.transition = '';
                el.style.transform = '';
            }
        });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isExpanded]);

  // keepMounted 최적화: 애니메이션 중에는 layout 업데이트를 멈추기 위해
  // 'shouldRenderContent' 대신 CSS의 'contain' 속성 등을 활용하여 렌더링 부하 제어
  // keepMounted=false인 차트 등은 아예 숨겨서 버벅임 제거
  const shouldRenderContent = keepMounted || !isAnimating;

  return (
    <div
      id={id}
      ref={cardRef}
      style={{
        backgroundColor: 'var(--card-color)',
        borderRadius: isExpanded ? '24px' : '16px', // 모달 형태일 때 더 둥글게
        boxShadow: isExpanded ? 'none' : '0 4px 15px rgba(0,0,0,0.3)',
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        // 축소 시에는 CSS 기본 Transition 사용
        transition: 'none',
        // keepMounted 상태에서 애니메이션 중일 때 레이아웃 계산을 멈추기 위해 contain 속성 사용 (버벅임 방지)
        contain: (isAnimating) ? 'strict' : 'none',
        willChange: 'contents'
      }}
    >
      {/* 1. 통일된 헤더 영역 */}
      {!noHeader && (
        <div
          className={!isExpanded ? "drag-handle" : ""} // 확장 안됐을 때만 드래그 가능
          style={{
            padding: '15px 20px',
            cursor: isExpanded ? 'default' : 'move',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center', // [해결] 수직 중앙 정렬
            background: 'rgba(255,255,255,0.02)',
            minHeight: '25px', // 높이 고정으로 들쑥날쑥 방지
            flexShrink: 0, // 헤더 영역이 줄어들지 않도록 고정
          }}
        >
          {/* [좌측] 아이콘 + 타이틀 (공간 차지) */}
          <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, flex: 1, gap: '10px' }}>
            {/* 아이콘 규격화 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', flexShrink: 0 }}>
              {icon}
            </div>
            {/* 타이틀: 말줄임표(...) 적용 */}
            <h3 style={{
              margin: 0,
              fontSize: '16px',
              fontWeight: 600,
              color: '#eaeaea',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              lineHeight: 1.2
            }}>
              {title}
            </h3>
          </div>

          {/* [우측] 버튼 (고정) */}
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
            {/* headerAction 렌더링 (확장 버튼 앞에 배치) */}
            {headerAction && (
              <div style={{ marginRight: '5px', display: 'flex', alignItems: 'center' }}>
                {headerAction}
              </div>
            )}
            {/* 확장/닫기 버튼 */}
            {onExpand && !isExpanded && (
              <button
                onClick={handleExpand}
                style={{
                  background: 'none', border: 'none', color: '#aaa',
                  cursor: 'pointer', padding: '4px', display: 'flex',
                  transition: 'color 0.2s'
                }}
                title="확장 하기"
              >
                <BiExpand size={24} />
              </button>
            )}
            {onClose && isExpanded && (
              <button
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                style={{
                  background: 'none', border: 'none', color: '#fff',
                  cursor: 'pointer', padding: '4px', display: 'flex',
                  transition: 'color 0.2s'
                }}
                title="닫기"
              >
                <BiCollapse size={24} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* 2. 컨텐츠 영역 */}
      <div
       style={{
          flex: 1,
          padding: noHeader ? 0 : '10px',
          overflow: 'hidden',
          position: 'relative',
          // 애니메이션 중에는 마우스 이벤트 차단 (불필요한 호버 연산 방지)
          pointerEvents: isAnimating ? 'none' : 'auto',
        }}
      >
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          {shouldRenderContent ? children : (
            <div style={{width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:'#555'}}>
              Loading...
            </div>
          )}
        </ErrorBoundary>
      </div>
    </div>
  );
});

// 대시보드 페이지 본체
export default function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient(); // 수동 갱신용 클라이언트
  const myId = localStorage.getItem('myId');
  // useState로 관리하던 위치 정보 삭제 -> 전역 Context 사용
  // 이제 Dashboard가 위치를 직접 찾지 않고, Context가 찾은 값을 받아오기만 합니다.
  const { lat, lon, loading: locLoading } = useUserLocation();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // 채팅 상태를 Dashboard에서 관리 (Lifting State Up)
  const [chatMessages, setChatMessages] = useState<ChatHistoryDTO[]>([]);
  // 서버 상태 데이터
  const [serverData, setServerData] = useState<SystemStatusDTO[]>([]);
  // 소켓 객체들을 useRef로 관리 (생명주기 유지 및 상태 체크용)
  const chatWs = useRef<WebSocket | null>(null);
  const dashboardWs = useRef<WebSocket | null>(null);
  // 초기 마운트 애니메이션용 상태
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    if (!myId) {
      navigate('/');
      return;
    }
  }, [myId, navigate]);

  // 접속자 리스트 (WebSocket 신호로 갱신) ---
  const { data: onlineUsers = [] } = useQuery({
    queryKey: ['onlineUsers'], 
    queryFn: async () => {
      const res = await axios.get('/api/user/onlineList');
      return res.data as UserDTO[];
    },
  });

  // 환율 데이터 (부모에서 관리)
  const { data: exchangeData = [] } = useQuery({
    queryKey: ['exchangeData'],
    queryFn: async () => {
      const res = await axios.get<StockDTO[]>('/api/finance/dashboard');
      return res.data;
    },
  });

  // 코드 통계 데이터 (부모에서 관리)
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
  });

  // 메모 데이터 Fetch (React Query 사용) -> 상태 끌어올리기 적용
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
      refetchMemos(); // 목록 갱신 -> 모든 MemoWidget에 반영됨
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
        refetchMemos(); // 목록 갱신 -> 모든 MemoWidget에 반영됨
      } catch (e) {
        console.error("메모 삭제 실패", e);
        showToast('삭제 중 오류가 발생했습니다.', 'error');
      }
    }
  }, [refetchMemos]);

  // 대시보드 상태 감지용 WebSocket (User Update 감지)
  useEffect(() => {
    // 안전한 연결 조건: 소켓이 없거나, 완전히 닫혔을 때만 연결
    if (!dashboardWs.current || dashboardWs.current.readyState === WebSocket.CLOSED) {
      dashboardWs.current = new WebSocket(`${WS_URL}/ws/dashboard`);
      dashboardWs.current.onopen = () => console.log("[Dashboard] 대시보드 소켓 연결 성공");
      dashboardWs.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          // 유저 변동 신호(USER_UPDATE)가 오면 목록 새로고침!
          if (message.type === 'USER_UPDATE') {
            queryClient.invalidateQueries({ queryKey: ['onlineUsers'] });
          }
          // 시스템 상태 데이터 처리
          else if (message.type === 'SYSTEM_STATUS') {
            const timeStr = new Date().toLocaleTimeString('en-GB', {
              hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
            });
            // 데이터 누적 (최대 20개 유지)
            setServerData(prev => {
              const newData = { ...message, time: message.time || timeStr };
              const updated = [...prev, newData];
              if (updated.length > 20) return updated.slice(updated.length - 20);
              return updated;
            });
          }
        } catch (error) {
          console.error("[Dashboard] Dashboard WS Parsing Error:", error);
        }
      };
      dashboardWs.current.onerror = (error) => console.error('[Dashboard] WebSocket Error:', error);
      dashboardWs.current.onclose = () => {
        console.log('[Dashboard] 접속 모니터링 종료');
        dashboardWs.current = null; // 끊기면 초기화
      };
    }
  }, [queryClient]);

  // 채팅 기록 불러오기 (React Query) -> DB에 저장된 이전 대화 로드
  useQuery({
    queryKey: ['chatHistory'],
    queryFn: async () => {
      try {
        const res = await axios.get('/api/chat/history');
        // 서버 응답이 배열인지 꼭 확인해야 함! (DB 에러 시 객체가 옴)
        if (Array.isArray(res.data)) {
          setChatMessages(res.data);
        } else {
          console.warn("채팅 기록 형식이 올바르지 않습니다(DB 확인 필요):", res.data);
          setChatMessages([]); // 안전하게 빈 배열로 초기화
        }
        return res.data as ChatHistoryDTO[];
      } catch (e) {
        console.error("채팅 기록 로드 실패", e);
        return [];
      }
    },
    refetchOnWindowFocus: false, // 창 왔다갔다 할 때마다 다시 부르지 않음
  });

  // Chatting WebSocket 연결 (Dashboard가 켜질 때 한 번만 연결)
  useEffect(() => {
    // 이미 연결되어 있으면 패스 (중복 연결 방지)
    if (chatWs.current && chatWs.current.readyState === WebSocket.OPEN) {
      return;
    }
    // 안전한 연결 조건 적용
    if (!chatWs.current || chatWs.current.readyState === WebSocket.CLOSED) {
      chatWs.current = new WebSocket(`${WS_URL}/ws/chat`);
      chatWs.current.onopen = () => console.log("[Chat] 채팅 서버 연결 성공");
      chatWs.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // 메시지가 유효한 객체인지 확인 후 추가
          if (data && typeof data === 'object') {
            // 메시지 오면 리스트에 추가 (작은 창, 큰 창 모두 반영됨)
            setChatMessages(prev => [...prev, data]);
          }
        } catch (e) {
          console.error("[Chat] 메시지 파싱 에러:", e);
        }
      };
      chatWs.current.onerror = (error) => console.error('[Chat] WebSocket Error:', error);
      chatWs.current.onclose = () => {
        console.log('[Chat] 접속 모니터링 종료');
        chatWs.current = null; // 끊기면 초기화
      };
    }
  }, []);

  // 컴포넌트 언마운트 시 소켓 정리
  useEffect(() => {
    return () => {
      // 컴포넌트 언마운트 시에만 닫기
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
  }, []);

  // 메시지 전송 함수 (ChatWidget에게 전달할 함수)
  // useCallback을 사용하여 함수 재생성 방지 -> useMemo 의존성 문제 해결
  const handleSendMessage = useCallback((text: string) => {
    if (chatWs.current && chatWs.current.readyState === WebSocket.OPEN && myId) {
      const msgData = { sender: myId, text: text };
      chatWs.current.send(JSON.stringify(msgData));
    } else {
      console.error("[Chat] 채팅 서버가 연결되지 않았습니다.");
    }
  }, [myId]); // myId가 바뀔 때만 함수 재생성

  // 로그아웃 처리 함수
  const handleLogout = async () => {
    try {
      const myId = localStorage.getItem('myId')
      if (myId) {
        // refreshToken 안 보냄 (쿠키로 감)
        await axios.post('api/user/logout', { userId: myId });
      }
    } catch (e) {
      console.error("로그아웃 요청 실패:", e);
      showToast('Logout failed on server side(session expired)', 'error');
    } finally {
      // 3. 클라이언트 정보 삭제 (소켓도 여기서 끊김 -> UserConnectionHandler가 오프라인 처리함)
      // localStorage만 청소
      localStorage.removeItem('accessToken');
      localStorage.removeItem('myId');
      
      showToast('로그아웃 되었습니다.');
      navigate('/');
    }
  };


  // 위젯 내용 정의 (Memoization 적용)
  // useMemo를 사용하여 대시보드가 리렌더링(serverData 업데이트 등)되어도
  // 위젯 컴포넌트 자체가 재생성되지 않도록 고정합니다.
  // 이렇게 하면 CodeStatsWidget의 애니메이션이 계속 다시 실행되는 문제를 막을 수 있습니다.
  const weatherWidget = useMemo(() => <WeatherWidget />, []);
  const onlineWidget = useMemo(() => (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {onlineUsers.map(u => (
        <li key={u.id} style={{ display:'flex', alignItems:'center', padding: '12px 0', borderBottom: '1px solid #333' }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#00ff00', marginRight: 10, boxShadow: '0 0 10px #00ff00' }}></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 'bold' }}>{u.name}</div>
            <div style={{ fontSize: '12px', color: '#777' }}>ID: {u.id}</div>
          </div>
          <button onClick={() => navigate(`/user/${u.id}`)} style={{ width: 'auto', padding: '5px 10px', fontSize: '12px', background: '#333' }}>Log</button>
        </li>
      ))}
    </ul>
  ), [onlineUsers, navigate]); // onlineUsers가 바뀔 때만 갱신
  const mapWidget = useMemo(() => (
    locLoading || !lat || !lon ? <div>위치 정보 찾는 중...</div> : <KakaoMapWidget lat={lat} lon={lon} />
  ), [locLoading, lat, lon]);
  // 세슘 위젯 useMemo 생성
  const cesiumWidget = useMemo(() => <CesiumWidget />, []);
  // 환율 위젯은 exchangeData가 바뀔 때만 갱신됨
  const exchangeWidget = useMemo(() => <ExchangeWidget data={exchangeData} />, [exchangeData]);
  // CodeStatsWidget은 의존성이 없으므로 마운트 시 한 번만 생성됨 -> 애니메이션 재실행 방지
  const codeStatsWidget = useMemo(() => <CodeStatsWidget data={codeData} />, [codeData]);
  // ServerMonitor는 serverData가 바뀔 때만 갱신됨
  const serverMonitorWidget = useMemo(() => <ServerMonitor data={serverData} />, [serverData]);
  const memoWidget = useMemo(() => <MemoWidget memos={memos} onAdd={handleAddMemo} onDelete={handleDeleteMemo} />, [memos, handleAddMemo, handleDeleteMemo]);
  // useMemo 의존성 배열에 handleSendMessage 추가 (경고 해결)
  const chatWidget = useMemo(() => (
    <ChatWidget myId={myId!} messages={chatMessages} onSendMessage={handleSendMessage} />
  ), [myId, chatMessages, handleSendMessage]); // 채팅 메시지나 ID가 바뀔 때만 갱신

  // --- 위젯 내용 정의 (재사용을 위해 객체로 분리) ---
  const widgetContents = {
    weather: weatherWidget,
    online: onlineWidget,
    map: mapWidget,
    cesium: cesiumWidget,
    exchange: exchangeWidget,
    code: codeStatsWidget,
    server: serverMonitorWidget,
    memo: memoWidget,
    chat: chatWidget,
  };

  const styles = {
    container: { padding: '20px', maxWidth: '1400px', margin: '0 auto', color: '#eaeaea' },
    header: { display: 'flex', justifyContent: 'space-between', marginBottom: '20px' },
  };

  // Cesium 상세 보기 버튼 (아이콘: BiDetail, 툴팁: 상세 보기)
  const cesiumDetailButton = (
    <button
      onClick={() => navigate('/cesium')}
      title="상세 보기"
      style={{
        background: 'none', border: 'none', color: '#aaa',
        cursor: 'pointer', padding: '4px', display: 'flex',
        transition: 'color 0.2s', marginRight: '5px',
      }}
    >
      <BiDetail size={24} />
    </button>
  );

  // [CSS] 트랜디한 모달 확장 스타일 + 렉 방지 최적화 (내부 정의)
  const expansionStyle = `
    /* 1. 드래그 잔상 스타일 */
    .react-grid-placeholder {
      background: rgba(255, 255, 255, 0.05) !important;
      opacity: 0.3 !important;
      border-radius: 16px !important;
    }
    
    /* 2. 확장된 래퍼 (화면 전체를 덮는 검은 배경 역할) */
    .grid-item-expanded {
      position: fixed !important;
      inset: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      
      /* [중요] RGL의 transform 좌표계를 해제하여 뷰포트 기준으로 배치 */
      transform: none !important;
      
      margin: 0 !important;
      z-index: 10000 !important;
      
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      
      box-sizing: border-box !important;
      
      /* FLIP 애니메이션을 위해 transition 제거 (JS가 제어) */
      transition: all 0.5s cubic-bezier(0.25, 1, 0.25, 1) !important;
    }

    /* 3. 평소 상태 (축소 시 부드러운 복귀를 위한 트랜지션) */
    .react-grid-item:not(.grid-item-expanded) {
      z-index: 1 !important;
      transition: none !important;
    }
  `;

  return (
    <div style={styles.container}>
      <style>{expansionStyle}</style>
      {/* 1. 상단 헤더 */}
      <header style={styles.header}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px' }}>Smart Dashboard</h1>
          <span style={{ color: 'var(--accent-color)', fontSize: '14px' }}>Logged in as {myId}</span>
        </div>
        <div style={{ alignContent: 'center' }}>
          <button onClick={handleLogout} style={{ width: 'auto', height: '75%', padding: '5px 10px', fontSize: '14px' }}>
            System Logout
          </button>
        </div>
      </header>

      {/* 2. 메인 그리드 영역 */}
      <div style={{ 
        opacity: isMounted ? 1 : 0, 
        transform: isMounted ? 'none' : 'translateY(20px)',
        transition: 'opacity 0.6s ease-out, transform 0.6s ease-out'
      }}>
        {/* ResponsiveGridLayout 도입 */}
        <ResponsiveGridLayout
          className="layout"
          layouts={initialLayouts}
          // 반응형 설정 (화면 크기에 따라 12컬럼 -> 10 -> ... -> 2)
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={30} // 그리드 한 칸의 높이 (px)
          draggableHandle=".drag-handle" // 이 클래스를 가진 요소만 드래그 가능
          useCSSTransforms={true} // 성능 향상
          isBounded={true} // 그리드 밖으로 못 나가게
          measureBeforeMount={false} // 미리 측정하지 않음
        >
          
          {/* 날씨 위젯 */}
          <div key="weather" className={expandedId === 'weather' ? "grid-item-expanded" : ""}>
            {/* 확장된 상태라면(expandedId === 'weather') 그리드에서는 숨김(opacity: 0) */}
            <div style={{ height: '100%', width: '100%' }}>
              <DashboardCard id="weather" noHeader isExpanded={expandedId === 'weather'}
                onExpand={() => setExpandedId('weather')}
                onClose={() => setExpandedId(null)}
                keepMounted={true}
              >
                <DeferredComponent idle>{widgetContents.weather}</DeferredComponent>
              </DashboardCard>
            </div>
          </div>

          {/* 온라인 접속자 리스트 */}
          <div key="online" className={expandedId === 'online' ? "grid-item-expanded" : ""}>
            <div style={{ height: '100%', width: '100%' }}>
              <DashboardCard id="online" title={`Online (${onlineUsers.length})`}
                icon={<div style={{width:10, height:10, background:'#00ff00', borderRadius:'50%'}}/>}
                isExpanded={expandedId === 'online'}
                onExpand={() => setExpandedId('online')}
                onClose={() => setExpandedId(null)}
                keepMounted={true}
              >
                <DeferredComponent>
                  <div style={{ height: '100%', overflowY: 'auto' }}>{widgetContents.online}</div>
                </DeferredComponent>
              </DashboardCard>
            </div>
          </div>

          {/* 지도 기능 KakaoMapWidget */}
          <div key="map" className={expandedId === 'map' ? "grid-item-expanded" : ""}>
            <div style={{ height: '100%', width: '100%' }}>
              <DashboardCard id="map" 
                title="Location" icon={<FaMapMarkedAlt style={{ color: '#00c6ff' }} />}
                isExpanded={expandedId === 'map'}
                onExpand={() => setExpandedId('map')}
                onClose={() => setExpandedId(null)}
                keepMounted={true}
              >
                <DeferredComponent>{widgetContents.map}</DeferredComponent>
              </DashboardCard>
            </div>
          </div>

          {/* 3D 지도 (세슘) */}
          <div key="cesium" className={expandedId === 'cesium' ? "grid-item-expanded" : ""}>
            <div style={{ height: '100%', width: '100%' }} className='wrapper'>
              <DashboardCard id="cesium" 
                title="3D Earth" icon={<FaGlobeAsia style={{ color: '#4facfe' }} />} 
                isExpanded={expandedId === 'cesium'}
                onExpand={() => setExpandedId('cesium')}
                onClose={() => setExpandedId(null)}
                headerAction={cesiumDetailButton}
                keepMounted={true}
              >
                <DeferredComponent idle>{widgetContents.cesium}</DeferredComponent>
              </DashboardCard>
            </div>
          </div>
          
          {/* 환율 차트 위젯 */}
          <div key="exchange" className={expandedId === 'exchange' ? "grid-item-expanded" : ""}>
            <div style={{ height: '100%', width: '100%' }}>
              <DashboardCard id="exchange" 
                title="Exchange" icon={<FaChartLine style={{ color: '#f59e0b' }} />}
                isExpanded={expandedId === 'exchange'}
                onExpand={() => setExpandedId('exchange')}
                onClose={() => setExpandedId(null)}
              >
                <DeferredComponent idle>{widgetContents.exchange}</DeferredComponent>
              </DashboardCard>
            </div>
          </div>

          {/* 프로젝트 코드 통계 */}
          <div key="code" className={expandedId === 'code' ? "grid-item-expanded" : ""}>
            <div style={{ height: '100%', width: '100%' }}>
              <DashboardCard id="code"
                title="Project Tech Stack" icon={<FaCode style={{ color: '#3178c6' }} />}
                isExpanded={expandedId === 'code'}
                onExpand={() => setExpandedId('code')}
                onClose={() => setExpandedId(null)}
              >
                <DeferredComponent idle>{widgetContents.code}</DeferredComponent>
              </DashboardCard>
            </div>
          </div>

          {/* 서버 모니터링 */}
          <div key="server" className={expandedId === 'server' ? "grid-item-expanded" : ""}>
            <div style={{ height: '100%', width: '100%' }}>
              <DashboardCard id="server" 
                title="Server Status" icon={<FaServer style={{ color: '#e74c3c' }} />}
                isExpanded={expandedId === 'server'}
                onExpand={() => setExpandedId('server')}
                onClose={() => setExpandedId(null)}
              >
                <DeferredComponent>{widgetContents.server}</DeferredComponent>
              </DashboardCard>
            </div>
          </div>

          {/* 관리자 메모 */}
          <div key="memo" className={expandedId === 'memo' ? "grid-item-expanded" : ""}>
            <div style={{ height: '100%', width: '100%' }}>
              <DashboardCard id="memo" 
                title="Memo" icon={<FaStickyNote style={{ color: '#f1c40f' }} />}
                isExpanded={expandedId === 'memo'}
                onExpand={() => setExpandedId('memo')}
                onClose={() => setExpandedId(null)}
              >
                <DeferredComponent>{widgetContents.memo}</DeferredComponent>
              </DashboardCard>
            </div>
          </div>

          {/* 실시간 채팅 (미니 뷰) */}
          <div key="chat" className={expandedId === 'chat' ? "grid-item-expanded" : ""}>
            <div style={{ height: '100%', width: '100%' }}>
              <DashboardCard id="chat" 
                title="Live Chat" icon={<FaComments style={{ color: '#2ecc71' }} />}
                isExpanded={expandedId === 'chat'}
                onExpand={() => setExpandedId('chat')}
                onClose={() => setExpandedId(null)}
              >
                <DeferredComponent>{widgetContents.chat}</DeferredComponent>
              </DashboardCard>
            </div>
          </div>
        </ResponsiveGridLayout>
      </div>
    </div>
  );
}