import axios from 'axios';
import { useEffect, useRef, useState } from 'react';
import { FaChartLine, FaMapMarkedAlt } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { useUserLocation } from '../contexts/UserLocationContext';

import { useQuery, useQueryClient } from '@tanstack/react-query'; // 임포트 추가
import { BiExpand, BiX } from 'react-icons/bi';
import { FaCode } from 'react-icons/fa';

//import MapWidget from '../components/MapWidget';
import ChatWidget, { type ChatMessage } from '../components/ChatWidget';
import CodeStatsWidget from '../components/CodeStatsWidget';
import ExchangeWidget from '../components/ExchangeWidget';
import KakaoMapWidget from '../components/KakaoMapWidget';
import MemoWidget from '../components/MemoWidget';
import ServerMonitor from '../components/Servermonitor';
import WeatherWidget from '../components/WeatherWidget';
import { showToast } from '../utils/alert';

interface UserData {
  id: string;
  name: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient(); // [추가] 수동 갱신용 클라이언트
  const myId = localStorage.getItem('myId');

  // [수정] useState로 관리하던 위치 정보 삭제 -> 전역 Context 사용
  // 이제 Dashboard가 위치를 직접 찾지 않고, Context가 찾은 값을 받아오기만 합니다.
  const { lat, lon, loading: locLoading } = useUserLocation();
  const [isChatExpanded, setIsChatExpanded] = useState(false);

  // [1] 채팅 상태를 Dashboard에서 관리 (Lifting State Up)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const ws = useRef<WebSocket | null>(null);

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
      const res = await axios.get('http://localhost:8080/api/user/onlineList');
      return res.data as UserData[];
    },
    // refetchInterval: 5000, // [삭제] 더 이상 5초마다 낭비하지 않음
  });

  // [신규] 대시보드 상태 감지용 WebSocket (User Update 감지)
  useEffect(() => {
    const dashboardWs = new WebSocket('ws://localhost:8080/ws/dashboard');

    dashboardWs.onopen = () => console.log("대시보드 소켓 연결 성공");
    
    dashboardWs.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        // [핵심] 유저 변동 신호(USER_UPDATE)가 오면 목록 새로고침!
        if (message.type === 'USER_UPDATE') {
          queryClient.invalidateQueries({ queryKey: ['onlineUsers'] });
        }
      } catch (error) {
        console.error("Dashboard WS Parsing Error:", error);
      }
    };

    return () => {
      dashboardWs.close();
    };
  }, [queryClient]);

  // 채팅 기록 불러오기 (React Query) -> DB에 저장된 이전 대화 로드
  useQuery({
    queryKey: ['chatHistory'],
    queryFn: async () => {
      try {
        const res = await axios.get('http://localhost:8080/api/chat/history');
        // [핵심] 서버 응답이 배열인지 꼭 확인해야 함! (DB 에러 시 객체가 옴)
        if (Array.isArray(res.data)) {
           setChatMessages(res.data);
        } else {
           console.warn("채팅 기록 형식이 올바르지 않습니다(DB 확인 필요):", res.data);
           setChatMessages([]); // 안전하게 빈 배열로 초기화
        }
        return res.data;
      } catch (e) {
        console.error("채팅 기록 로드 실패", e);
        return [];
      }
    },
    refetchOnWindowFocus: false, // 창 왔다갔다 할 때마다 다시 부르지 않음
  });

  // Chatting WebSocket 연결 (Dashboard가 켜질 때 한 번만 연결)
  useEffect(() => {
    ws.current = new WebSocket('ws://localhost:8080/ws/chat');
    
    ws.current.onopen = () => console.log("채팅 서버 연결 성공");
    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // 메시지가 유효한 객체인지 확인 후 추가
        if (data && typeof data === 'object') {
          // 메시지 오면 리스트에 추가 (작은 창, 큰 창 모두 반영됨)
          setChatMessages(prev => [...prev, data]);
        }
      } catch (e) {
        console.error("메시지 파싱 에러:", e);
      }
    };

    return () => {
      ws.current?.close();
    };
  }, []);

  // 메시지 전송 함수 (ChatWidget에게 전달할 함수)
  const handleSendMessage = (text: string) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN && myId) {
      const msgData = { sender: myId, text: text };
      ws.current.send(JSON.stringify(msgData));
    } else {
        console.error("채팅 서버가 연결되지 않았습니다.");
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
      maxWidth: '1200px',
      margin: '0 auto',
      color: '#eaeaea',
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '20px',
      paddingBottom: '20px',
      borderBottom: '1px solid #333',
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: '2fr 1fr', // 왼쪽 2칸(지도 등), 오른쪽 1칸(정보)
      gridTemplateRows: 'auto auto',  // 높이는 내용물에 따라 자동
      gap: '20px',
    },
    card: {
      backgroundColor: 'var(--card-color)', // index.css에 정의된 색
      borderRadius: '16px',
      padding: '20px',
      boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
    },
    sectionTitle: {
      marginTop: 0,
      marginBottom: '15px',
      fontSize: '18px',
      color: '#ffffff',
      fontWeight: 'bold',
      borderBottom: '1px solid rgba(255,255,255,0.3)',
      paddingBottom: '10px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    },
    placeholderBox: {
      height: '200px',
      backgroundColor: '#252540',
      borderRadius: '8px',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      color: '#555',
      fontSize: '14px',
      flexDirection: 'column' as const,
      gap: '10px'
    },
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
      <div style={styles.grid}>
        
        {/* [왼쪽 위] 날씨 위젯 (스타일 적용됨) */}
        {/* WeatherWidget 자체가 카드 형태이므로 별도 card 스타일 없이 바로 배치 */}
        <div style={{ ...styles.card, padding: 0 }} id="weather-widget-card">
           <WeatherWidget /> 
        </div>
        
        {/* [오른쪽 위] 온라인 접속자 리스트 */}
        <div style={{ ...styles.card, gridRow: 'span 2' }}> {/* 세로로 길게 쓰기 */}
          <h3 style={styles.sectionTitle}>🟢 Online Users ({onlineUsers.length})</h3>
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

        {/* [왼쪽 중간] 지도 기능 KakaoMapWidget */}
        <div style={styles.card}>
          <h3 style={{ ...styles.sectionTitle, justifyContent: 'flex-start', gap: '10px' }}>
            <FaMapMarkedAlt style={{ color: '#00c6ff', fontSize: '24px' }} />
            지도 정보
          </h3>
          {/* 기존 placeholderBox 대신 KakaoMapWidget 사용 */}
          <div style={{ height: '300px', width: '100%' }}>
            {/* Context에서 받은 lat, lon 사용. 로딩중이거나 null이면 처리 */}
            {locLoading || !lat || !lon ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                    위치 정보 찾는 중...
                </div>
            ) : (
                <KakaoMapWidget lat={lat} lon={lon} />
            )}
          </div>
        </div>

        <div style={{ gridColumn: 'span 2', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* 환율 차트 위젯 (지도 아래에 배치) */}
          <div style={styles.card}>
              <h3 style={styles.sectionTitle}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <FaChartLine style={{ color: '#f59e0b', fontSize: '24px' }} />
                      Global Exchange Rates
                  </span>
              </h3>
              {/* 차트 영역 */}
              <div style={{ height: '250px', width: '100%' }}>
                  <ExchangeWidget />
              </div>
          </div>

          {/* 프로젝트 코드 통계 (1/2 사이즈 */}
          <div style={styles.card}>
            <h3 style={styles.sectionTitle}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <FaCode style={{ color: '#3178c6', fontSize: '24px' }} />
                    Project Tech Stack
                </span>
            </h3>
            <div style={{ height: '250px', width: '100%' }}>
                <CodeStatsWidget />
            </div>
          </div>
        </div>

        {/* [하단 영역 수정됨] 3분할: 서버(2) : 메모(1) : 채팅(1) */}
        <div style={{ 
          gridColumn: 'span 2', 
          display: 'grid', 
          // [핵심] 컬럼을 3개로 나눔
          gridTemplateColumns: '2fr 1fr 1fr', 
          gap: '20px' 
        }}>
            
            {/* 1. 서버 모니터링 */}
            <div style={styles.card}>
                <h3 style={styles.sectionTitle}>🖥️ Server Status</h3>
                <div style={{ height: '250px', width: '100%' }}>
                    <ServerMonitor />
                </div>
            </div>

            {/* 2. 관리자 메모 (유지) */}
            <div style={styles.card}>
                <h3 style={styles.sectionTitle}>📝 Memo</h3>
                <div style={{ height: '250px', width: '100%' }}>
                    <MemoWidget />
                </div>
            </div>

            {/* 3. [신규] 실시간 채팅 (미니 뷰) */}
            <div style={styles.card}>
                <h3 style={styles.sectionTitle}>
                  <span>💬 Chat</span>
                  <button onClick={() => setIsChatExpanded(true)}
                    style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '20px',
                      width: '20px', display: 'flex', alignItems: 'center', padding: 0 // 패딩 제거로 높이 줄임
                  }} title='크게 보기'>
                    <BiExpand />
                  </button>
                </h3>
                <div style={{ height: '250px', width: '100%' }}><ChatWidget myId={myId!} messages={chatMessages} onSendMessage={handleSendMessage} /></div>
            </div>
        </div>

      </div>

      {/* [신규] 채팅 확장 모달 (isChatExpanded가 true일 때만 표시) */}
      {isChatExpanded && (
        <div style={styles.modalOverlay} onClick={() => setIsChatExpanded(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '1px solid #444', paddingBottom: '10px' }}>
              <h2 style={{ margin: 0, color: 'white' }}>💬 Live Chat Room</h2>
              <button onClick={() => setIsChatExpanded(false)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '28px', cursor: 'pointer' }}><BiX /></button>
            </div>
            <div style={{ flex: 1 }}><ChatWidget myId={myId!} messages={chatMessages} onSendMessage={handleSendMessage} /></div>
          </div>
        </div>
      )}

    </div>
  );
}