import axios from 'axios';
import { useEffect, useRef, useState } from 'react';
import { FaChartLine, FaMapMarkedAlt } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { useUserLocation } from '../contexts/UserLocationContext';

import { useQuery, useQueryClient } from '@tanstack/react-query'; // 임포트 추가
import { BiExpand, BiX } from 'react-icons/bi';
import { FaCode } from 'react-icons/fa';

//import MapWidget from '../components/MapWidget';
import ChatWidget from '../components/ChatWidget';
import CodeStatsWidget from '../components/CodeStatsWidget';
import ExchangeWidget from '../components/ExchangeWidget';
import KakaoMapWidget from '../components/KakaoMapWidget';
import MemoWidget from '../components/MemoWidget';
import ServerMonitor from '../components/Servermonitor';
import WeatherWidget from '../components/WeatherWidget';
import { showToast } from '../utils/alert';

// 에러 바운더리 관련 임포트
import { ErrorBoundary } from 'react-error-boundary';
import ErrorFallback from '../components/common/ErrorFallback';
// 통합 DTO 가져오기
import type { ChatHistoryDTO, UserDTO } from '../types/dtos';
// [추가] React Grid Layout 관련
import { Responsive, WidthProvider } from 'react-grid-layout/legacy';

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


export default function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient(); // [추가] 수동 갱신용 클라이언트
  const myId = localStorage.getItem('myId');

  // [수정] useState로 관리하던 위치 정보 삭제 -> 전역 Context 사용
  // 이제 Dashboard가 위치를 직접 찾지 않고, Context가 찾은 값을 받아오기만 합니다.
  const { lat, lon, loading: locLoading } = useUserLocation();
  const [isChatExpanded, setIsChatExpanded] = useState(false);

  // [1] 채팅 상태를 Dashboard에서 관리 (Lifting State Up)
  const [chatMessages, setChatMessages] = useState<ChatHistoryDTO[]>([]);
  // 소켓 객체들을 useRef로 관리 (생명주기 유지 및 상태 체크용)
  const chatWs = useRef<WebSocket | null>(null);
  const dashboardWs = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!myId) {
      navigate('/');
      return;
    }
  }, [myId, navigate]);

  // [수정] 접속자 리스트 (WebSocket 신호로 갱신) ---
  const { data: onlineUsers = [] } = useQuery({
    queryKey: ['onlineUsers'], 
    queryFn: async () => {
      const res = await axios.get('/api/user/onlineList');
      return res.data as UserDTO[];
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
          // [핵심] 유저 변동 신호(USER_UPDATE)가 오면 목록 새로고침!
          if (message.type === 'USER_UPDATE') {
            queryClient.invalidateQueries({ queryKey: ['onlineUsers'] });
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
  const handleSendMessage = (text: string) => {
    if (chatWs.current && chatWs.current.readyState === WebSocket.OPEN && myId) {
      const msgData = { sender: myId, text: text };
      chatWs.current.send(JSON.stringify(msgData));
    } else {
        console.error("[Chat] 채팅 서버가 연결되지 않았습니다.");
    }
  };

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

  // --- 스타일 정의 (Grid Layout) ---
  const styles = {
    container: {
      padding: '20px',
      maxWidth: '1400px', // '1200px'
      margin: '0 auto',
      color: '#eaeaea',
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      //alignItems: 'center',
      marginBottom: '20px',
      //paddingBottom: '20px',
      //borderBottom: '1px solid #333',
    },
    // 카드는 이제 100% 채우도록 변경 (Grid Item 내부)
    card: {
      backgroundColor: 'var(--card-color)', 
      borderRadius: '16px', 
      boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column' as const, 
      overflow: 'hidden'
    },
    // 드래그 손잡이 스타일 (커서 변경)
    dragHeader: {
      padding: '15px 20px',
      cursor: 'move', // 여기가 핵심! 마우스 올리면 이동 아이콘 뜸
      borderBottom: '1px solid rgba(255,255,255,0.1)',
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center',
      background: 'rgba(255,255,255,0.02)'
    },
    contentBody: {
      flex: 1,
      padding: '10px',
      overflow: 'hidden'
    },
    // 모달 오버레이 스타일
    modalOverlay: {
      position: 'fixed' as const,
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.8)', // 배경 어둡게
      zIndex: 1000, // 제일 위에 뜨도록
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '40px'
    },
    modalContent: {
      width: '80%',
      maxWidth: '1000px',
      height: '80vh',
      backgroundColor: '#1a1a2e',
      borderRadius: '16px',
      padding: '20px',
      boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
      display: 'flex',
      flexDirection: 'column' as const
    }
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
      {/* [변경] ResponsiveGridLayout 도입 */}
      <ResponsiveGridLayout
        className="layout"
        layouts={initialLayouts}
        // 반응형 설정 (화면 크기에 따라 12컬럼 -> 10 -> ... -> 2)
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
        rowHeight={30} // 그리드 한 칸의 높이 (px)
        draggableHandle=".drag-handle" // 이 클래스를 가진 요소만 드래그 가능
      >
        
        {/* [왼쪽 위] 날씨 위젯 (스타일 적용됨) */}
        <div key="weather">
          <div style={{ ...styles.card, padding: 0 }} id="weather-widget-card">
            {/* 날씨는 위젯 자체가 예뻐서 헤더 없이 통째로 드래그 핸들로 써도 됨 */}
            <div className="drag-handle" style={{height: '100%'}}>
              <ErrorBoundary FallbackComponent={ErrorFallback} onReset={() => window.location.reload()}>
                <WeatherWidget />
              </ErrorBoundary>
            </div>
          </div>
        </div>

        {/* [오른쪽 위] 온라인 접속자 리스트 */}
        <div key="online">
          <div style={styles.card}>
            <div style={styles.dragHeader} className="drag-handle">
              <h3 style={{margin:0, fontSize:'16px'}}>🟢 Online ({onlineUsers.length})</h3>
            </div>
            <div style={{...styles.contentBody, overflowY: 'auto'}}>
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {onlineUsers.map(u => (
                  <li key={u.id} style={{ display:'flex', alignItems:'center', padding: '12px 0', borderBottom: '1px solid #333' }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#00ff00', marginRight: 10, boxShadow: '0 0 10px #00ff00' }}></div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 'bold' }}>{u.name}</div>
                      <div style={{ fontSize: '12px', color: '#777' }}>ID: {u.id}</div>
                    </div>
                    <button 
                      onClick={() => navigate(`/user/${u.id}`)} 
                      style={{ width: 'auto', padding: '5px 10px', fontSize: '12px', background: '#333' }}
                    >
                      Log
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* [왼쪽 중간] 지도 기능 KakaoMapWidget */}
        <div key="map">
          <div style={styles.card}>
            <div style={styles.dragHeader} className="drag-handle">
              <h3 style={{margin:0, fontSize:'16px'}}><FaMapMarkedAlt style={{ color: '#00c6ff', fontSize: '24px' }} /> Location</h3>
            </div>
            {/* 기존 placeholderBox 대신 KakaoMapWidget 사용 */}
            <div style={ styles.contentBody }>
              {/* 에러 바운더리로 감싸기 */}
              <ErrorBoundary FallbackComponent={ErrorFallback} onReset={() => window.location.reload()}>
                {/* Context에서 받은 lat, lon 사용. 로딩중이거나 null이면 처리 */}
                {locLoading || !lat || !lon ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                      위치 정보 찾는 중...
                  </div>
                ) : (
                  <KakaoMapWidget lat={lat} lon={lon} />
                )}
              </ErrorBoundary>
            </div>
          </div>
        </div>
        
        {/* 환율 차트 위젯 (지도 아래에 배치) */}
        <div key="exchange">
          <div style={styles.card}>
            <div style={styles.dragHeader} className="drag-handle">
               <h3 style={{margin:0, fontSize:'16px'}}><FaChartLine style={{ color: '#f59e0b', fontSize: '24px' }} /> Exchange</h3>
            </div>
            {/* 차트 영역 */}
            <div style={styles.contentBody}>
              <ErrorBoundary FallbackComponent={ErrorFallback} onReset={() => window.location.reload()}>
                <ExchangeWidget />
              </ErrorBoundary>
            </div>
          </div>
        </div>

        {/* 프로젝트 코드 통계 (1/2 사이즈 */}
        <div key="code">
          <div style={styles.card}>
            <div style={styles.dragHeader} className="drag-handle">
               <h3 style={{margin:0, fontSize:'16px'}}><FaCode style={{ color: '#3178c6', fontSize: '24px' }} /> Project Tack Stack</h3>
            </div>
            <div style={styles.contentBody}>
              <ErrorBoundary FallbackComponent={ErrorFallback} onReset={() => window.location.reload()}>
                <CodeStatsWidget />
              </ErrorBoundary>
            </div>
          </div>
        </div>

        {/* 서버 모니터링 */}
        <div key="server">
          <div style={styles.card}>
            <div style={styles.dragHeader} className="drag-handle">
               <h3 style={{margin:0, fontSize:'16px'}}>🖥️ Server</h3>
            </div>
            <div style={styles.contentBody}>
              <ErrorBoundary FallbackComponent={ErrorFallback} onReset={() => window.location.reload()}>
                <ServerMonitor />
              </ErrorBoundary>
            </div>
          </div>
        </div>

        {/* 관리자 메모 (유지) */}
        <div key="memo">
          <div style={styles.card}>
            <div style={styles.dragHeader} className="drag-handle">
               <h3 style={{margin:0, fontSize:'16px'}}>📝 Memo</h3>
            </div>
            <div style={styles.contentBody}>
              <ErrorBoundary FallbackComponent={ErrorFallback} onReset={() => window.location.reload()}>
                <MemoWidget />
              </ErrorBoundary>
            </div>
          </div>
        </div>

        {/* 실시간 채팅 (미니 뷰) */}
        <div key="chat">
          <div style={styles.card}>
            <div style={styles.dragHeader} className='drag-handle'>
              <h3 style={{margin:0, fontSize:'16px'}}>💬 Chat</h3>
              <button onClick={() => setIsChatExpanded(true)}
                style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '20px',
                  width: '20px', display: 'flex', alignItems: 'center', padding: 0 // 패딩 제거로 높이 줄임
              }} title='크게 보기'>
                <BiExpand />
              </button>
            </div>
            <div style={styles.contentBody}>
              <ErrorBoundary FallbackComponent={ErrorFallback} onReset={() => window.location.reload()}>
                <ChatWidget myId={myId!} messages={chatMessages} onSendMessage={handleSendMessage} />
              </ErrorBoundary>
            </div>
          </div>
        </div>
      </ResponsiveGridLayout>

      {/* [신규] 채팅 확장 모달 (isChatExpanded가 true일 때만 표시) */}
      {isChatExpanded && (
        <div style={styles.modalOverlay} onClick={() => setIsChatExpanded(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '1px solid #444', paddingBottom: '10px' }}>
              <h2 style={{ margin: 0, color: 'white' }}>💬 Live Chat Room</h2>
              <button onClick={() => setIsChatExpanded(false)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '28px', cursor: 'pointer' }}><BiX /></button>
            </div>
            <div style={{ flex: 1 }}>
              <ErrorBoundary FallbackComponent={ErrorFallback} onReset={() => window.location.reload()}>
                <ChatWidget myId={myId!} messages={chatMessages} onSendMessage={handleSendMessage} />
              </ErrorBoundary>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}