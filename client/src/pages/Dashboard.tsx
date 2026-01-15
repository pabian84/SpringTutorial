import { useQuery, useQueryClient } from '@tanstack/react-query'; // 임포트 추가
import axios from 'axios';
import { AnimatePresence, motion } from 'framer-motion'; // 애니메이션용
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary'; // 에러 바운더리 관련 임포트
import { Responsive, WidthProvider } from 'react-grid-layout/legacy'; // React Grid Layout 관련
import { BiExpand, BiX } from 'react-icons/bi';
import { FaChartLine, FaCode, FaComments, FaMapMarkedAlt, FaServer, FaStickyNote } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import ChatWidget from '../components/ChatWidget';
import CodeStatsWidget, { type CodeData } from '../components/CodeStatsWidget';
import ErrorFallback from '../components/common/ErrorFallback'; // 에러 바운더리 관련 임포트
import ExchangeWidget from '../components/ExchangeWidget';
import KakaoMapWidget from '../components/KakaoMapWidget';
import MemoWidget from '../components/MemoWidget';
import ServerMonitor from '../components/Servermonitor';
import WeatherWidget from '../components/WeatherWidget';
import { useUserLocation } from '../contexts/UserLocationContext';
import type { ChatHistoryDTO, StockDTO, SystemStatusDTO, UserDTO } from '../types/dtos'; // 통합 DTO 가져오기
import { showToast } from '../utils/alert';

const WS_URL = import.meta.env.VITE_WS_URL;
const ResponsiveGridLayout = WidthProvider(Responsive);
// [설정] 초기 레이아웃 정의 (12 컬럼 기준)
// x: 가로 위치(0~11), y: 세로 위치, w: 너비, h: 높이
const initialLayouts = {
  lg: [
    { i: 'weather', x: 0, y: 0, w: 9, h: 8 },      // 날씨 (왼쪽 상단)
    { i: 'online', x: 9, y: 0, w: 3, h: 18 },       // 접속자 (오른쪽 길게)
    { i: 'map', x: 0, y: 8, w: 9, h: 10 },          // 지도 (날씨 아래)
    { i: 'exchange', x: 0, y: 16, w: 6, h: 8 },    // 환율 (지도 아래 1)
    { i: 'code', x: 6, y: 16, w: 6, h: 8 },        // 코드 통계 (지도 아래 2)
    { i: 'server', x: 0, y: 16, w: 6, h: 8 },      // 서버 모니터 (맨 아래)
    { i: 'memo', x: 6, y: 16, w: 3, h: 8 },        // 메모
    { i: 'chat', x: 9, y: 16, w: 3, h: 8 },        // 채팅
  ],
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
}

// React.memo를 사용하여 props가 변하지 않으면 재렌더링 방지
const DashboardCard = memo(({ id, title, icon, children, onExpand, onClose, isExpanded, noHeader }: DashboardCardProps) => {
  return (
    <motion.div
      layoutId={id} // [핵심] 이 ID가 같으면 그리드<->전체화면 전환 시 이어지는 효과
      style={{
        backgroundColor: 'var(--card-color)',
        borderRadius: isExpanded ? 0 : '16px', // 확장되면 꽉 차게
        boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        // 확장 시 스타일
        ...(isExpanded && {
          width: '100%', height: '100%',
          position: 'relative', zIndex: 1001 // 모달 내부에서 렌더링되므로 상대위치
        })
      }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
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
            minHeight: '25px' // 높이 고정으로 들쑥날쑥 방지
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
            {onExpand && !isExpanded && (
              <button
                onClick={(e) => {
                  e.stopPropagation(); // 클릭 이벤트가 카드 뒤로 전달되지 않도록 방지(드래그 방지)
                  onExpand(); // 확장 함수 호출
                }}
                style={{
                  background: 'none', border: 'none', color: '#aaa',
                  cursor: 'pointer', padding: '4px', display: 'flex',
                  transition: 'color 0.2s'
                }}
                title="Expand"
              >
                <BiExpand size={20} />
              </button>
            )}
            {onClose && isExpanded && (
              <button
                onClick={onClose}
                style={{
                  background: 'none', border: 'none', color: '#fff',
                  cursor: 'pointer', padding: '4px', display: 'flex'
                }}
                title="Close"
              >
                <BiX size={24} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* 2. 컨텐츠 영역 */}
      <div style={{ flex: 1, padding: noHeader ? 0 : '10px', overflow: 'hidden', position: 'relative' }}>
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          {children}
        </ErrorBoundary>
      </div>
    </motion.div>
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

  useEffect(() => {
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

  // [추가] 환율 데이터 (부모에서 관리)
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
        // [핵심] 서버 응답이 배열인지 꼭 확인해야 함! (DB 에러 시 객체가 옴)
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
        // [수정] refreshToken 안 보냄 (쿠키로 감)
        await axios.post('api/user/logout', { userId: myId });
      }
    } catch (e) {
      console.error("로그아웃 요청 실패:", e);
      showToast('Logout failed on server side(session expired)', 'error');
    } finally {
      // 3. 클라이언트 정보 삭제 (소켓도 여기서 끊김 -> UserConnectionHandler가 오프라인 처리함)
      // [수정] localStorage만 청소
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
  const exchangeWidget = useMemo(() => <ExchangeWidget data={exchangeData} />, [exchangeData]);
  // CodeStatsWidget은 의존성이 없으므로 마운트 시 한 번만 생성됨 -> 애니메이션 재실행 방지
  const codeStatsWidget = useMemo(() => <CodeStatsWidget data={codeData} />, [codeData]);
  // ServerMonitor는 serverData가 바뀔 때만 갱신됨
  const serverMonitorWidget = useMemo(() => <ServerMonitor data={serverData} />, [serverData]);
  const memoWidget = useMemo(() => <MemoWidget />, []);
  // useMemo 의존성 배열에 handleSendMessage 추가 (경고 해결)
  const chatWidget = useMemo(() => (
    <ChatWidget myId={myId!} messages={chatMessages} onSendMessage={handleSendMessage} />
  ), [myId, chatMessages, handleSendMessage]); // 채팅 메시지나 ID가 바뀔 때만 갱신

  // --- 위젯 내용 정의 (재사용을 위해 객체로 분리) ---
  const widgetContents = {
    weather: weatherWidget,
    online: onlineWidget,
    map: mapWidget,
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

  return (
    <div style={styles.container}>
      {/* 1. 상단 헤더 */}
      <header style={styles.header}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px' }}>Smart Dashboard</h1>
          <span style={{ color: 'var(--accent-color)', fontSize: '14px' }}>Logged in as {myId}</span>
        </div>
        <button onClick={handleLogout} style={{ width: 'auto', padding: '10px 20px', fontSize: '14px' }}>
          System Logout
        </button>
      </header>

      {/* 2. 메인 그리드 영역 */}
      {/* ResponsiveGridLayout 도입 */}
      <ResponsiveGridLayout
        className="layout"
        layouts={initialLayouts}
        // 반응형 설정 (화면 크기에 따라 12컬럼 -> 10 -> ... -> 2)
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
        rowHeight={30} // 그리드 한 칸의 높이 (px)
        draggableHandle=".drag-handle" // 이 클래스를 가진 요소만 드래그 가능
      >
        
        {/* 날씨 위젯 */}
        <div key="weather">
          {/* 확장된 상태라면(expandedId === 'weather') 그리드에서는 숨김(opacity: 0) */}
          <div style={{ height: '100%', opacity: expandedId === 'weather' ? 0 : 1 }}>
            <DashboardCard id="weather" noHeader onExpand={() => setExpandedId('weather')}>
              {widgetContents.weather}
            </DashboardCard>
          </div>
        </div>

        {/* 온라인 접속자 리스트 */}
        <div key="online">
          <div style={{ height: '100%', opacity: expandedId === 'online' ? 0 : 1 }}>
            <DashboardCard id="online" title={`Online (${onlineUsers.length})`}
              icon={<div style={{width:10, height:10, background:'#00ff00', borderRadius:'50%'}}/>}
              onExpand={() => setExpandedId('online')}>
              <div style={{ height: '100%', overflowY: 'auto' }}>{widgetContents.online}</div>
            </DashboardCard>
          </div>
        </div>

        {/* 지도 기능 KakaoMapWidget */}
        <div key="map">
          <div style={{ height: '100%', opacity: expandedId === 'map' ? 0 : 1 }}>
            <DashboardCard id="map" 
              title="Location" icon={<FaMapMarkedAlt style={{ color: '#00c6ff' }} />} 
              onExpand={() => setExpandedId('map')}>
              {widgetContents.map}
            </DashboardCard>
          </div>
        </div>
        
        {/* 환율 차트 위젯 */}
        <div key="exchange">
          <div style={{ height: '100%', opacity: expandedId === 'exchange' ? 0 : 1 }}>
            <DashboardCard id="exchange" 
              title="Exchange" icon={<FaChartLine style={{ color: '#f59e0b' }} />} 
              onExpand={() => setExpandedId('exchange')}>
              {widgetContents.exchange}
            </DashboardCard>
        </div>
        </div>

        {/* 프로젝트 코드 통계 */}
        <div key="code">
          <div style={{ height: '100%', opacity: expandedId === 'code' ? 0 : 1 }}>
            <DashboardCard id="code"
              title="Project Tech Stack" icon={<FaCode style={{ color: '#3178c6' }} />} 
              onExpand={() => setExpandedId('code')}>
                {widgetContents.code}
              </DashboardCard>
          </div>
        </div>

        {/* 서버 모니터링 */}
        <div key="server">
          <div style={{ height: '100%', opacity: expandedId === 'server' ? 0 : 1 }}>
            <DashboardCard id="server" 
              title="Server Status" 
              icon={<FaServer style={{ color: '#e74c3c' }} />} 
              onExpand={() => setExpandedId('server')}>
              {widgetContents.server}
            </DashboardCard>
          </div>
        </div>

        {/* 관리자 메모 */}
        <div key="memo">
          <div style={{ height: '100%', opacity: expandedId === 'memo' ? 0 : 1 }}>
            <DashboardCard id="memo" 
              title="Memo" icon={<FaStickyNote style={{ color: '#f1c40f' }} />} 
              onExpand={() => setExpandedId('memo')}>
              {widgetContents.memo}
            </DashboardCard>
          </div>
        </div>

        {/* 실시간 채팅 (미니 뷰) */}
        <div key="chat">
          <div style={{ height: '100%', opacity: expandedId === 'chat' ? 0 : 1 }}>
            <DashboardCard id="chat" 
              title="Live Chat" 
              icon={<FaComments style={{ color: '#2ecc71' }} />} 
              onExpand={() => setExpandedId('chat')}>
              {widgetContents.chat}
            </DashboardCard>
          </div>
        </div>
      </ResponsiveGridLayout>

      {/* [확장 오버레이] AnimatePresence로 등장/퇴장 애니메이션 처리 */}
      <AnimatePresence>
        {expandedId && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 1000, pointerEvents: 'none' // 배경 클릭 통과 방지 로직은 아래 오버레이에
          }}>
            {/* 검은 배경 */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', pointerEvents: 'auto' }}
              onClick={() => setExpandedId(null)}
            />
             
            {/* 중앙 정렬된 확장 카드 */}
            <div style={{ position: 'absolute', top: '5%', left: '5%', right: '5%', bottom: '5%', pointerEvents: 'none', display:'flex', justifyContent:'center', alignItems:'center' }}>
              <div style={{ width: '100%', height: '100%', maxWidth: '1200px', pointerEvents: 'auto' }}>
                {/* 선택된 카드 렌더링 (layoutId 매칭으로 애니메이션 연결) */}
                {expandedId === 'weather' && <DashboardCard id="weather" noHeader isExpanded onClose={() => setExpandedId(null)}>{widgetContents.weather}</DashboardCard>}
                {expandedId === 'online' && <DashboardCard id="online" title="Online" isExpanded onClose={() => setExpandedId(null)}><div style={{ height: '100%', overflowY: 'auto' }}>{widgetContents.online}</div></DashboardCard>}
                {expandedId === 'map' && <DashboardCard id="map" title="Location" icon={<FaMapMarkedAlt style={{ color: '#00c6ff' }} />} isExpanded onClose={() => setExpandedId(null)}>{widgetContents.map}</DashboardCard>}
                {expandedId === 'exchange' && <DashboardCard id="exchange" title="Exchange" icon={<FaChartLine style={{ color: '#f59e0b' }} />} isExpanded onClose={() => setExpandedId(null)}>{widgetContents.exchange}</DashboardCard>}
                {expandedId === 'code' && <DashboardCard id="code" title="Project Tech Stack" icon={<FaCode style={{ color: '#3178c6' }} />} isExpanded onClose={() => setExpandedId(null)}>{widgetContents.code}</DashboardCard>}
                {expandedId === 'server' && <DashboardCard id="server" title="Server Status" icon={<FaServer style={{ color: '#e74c3c' }} />} isExpanded onClose={() => setExpandedId(null)}>{widgetContents.server}</DashboardCard>}
                {expandedId === 'memo' && <DashboardCard id="memo" title="Memo" icon={<FaStickyNote style={{ color: '#f1c40f' }} />} isExpanded onClose={() => setExpandedId(null)}>{widgetContents.memo}</DashboardCard>}
                {expandedId === 'chat' && <DashboardCard id="chat" title="Live Chat" icon={<FaComments style={{ color: '#2ecc71' }} />} isExpanded onClose={() => setExpandedId(null)}>{widgetContents.chat}</DashboardCard>}
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}