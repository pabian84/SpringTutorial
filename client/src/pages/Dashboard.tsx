import { useEffect, useMemo, useState } from 'react';
import 'react-grid-layout/css/styles.css';
import { Responsive, WidthProvider } from 'react-grid-layout/legacy'; // React Grid Layout 관련
import { BiDetail } from 'react-icons/bi';
import { FaChartLine, FaCode, FaComments, FaGlobeAsia, FaMapMarkedAlt, FaServer, FaStickyNote } from 'react-icons/fa';
import 'react-resizable/css/styles.css';
import { useNavigate } from 'react-router-dom';
import CesiumWidget from '../components/cesium/CesiumWidget'; // 세슘 위젯
import ChatWidget from '../components/ChatWidget';
import CodeStatsWidget from '../components/CodeStatsWidget';
import DashboardCard from '../components/common/DashboardCard';
import DeferredComponent from '../components/common/DefferredComponent';
import ExchangeWidget from '../components/ExchangeWidget';
import KakaoMapWidget from '../components/KakaoMapWidget';
import MemoWidget from '../components/MemoWidget';
import ServerMonitor from '../components/Servermonitor';
import WeatherWidget from '../components/WeatherWidget';
import { useUserLocation } from '../contexts/UserLocationContext';
import { useDashboardData } from '../hooks/useDashboardData';

const ResponsiveGridLayout = WidthProvider(Responsive);

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

// 대시보드 페이지 본체
export default function Dashboard() {
  const navigate = useNavigate();
  // useState로 관리하던 위치 정보 삭제 -> 전역 Context 사용
  // 이제 Dashboard가 위치를 직접 찾지 않고, Context가 찾은 값을 받아오기만 합니다.
  const { lat, lon, loading: locLoading } = useUserLocation();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // 초기 마운트 애니메이션용 상태
  const [isMounted, setIsMounted] = useState(false);
  const { 
    myId, onlineUsers, exchangeData, codeData, memos, serverData, chatMessages,
    handleAddMemo, handleDeleteMemo, handleSendMessage, handleLogout 
  } = useDashboardData();

  useEffect(() => {
    const initMounted = () => {
      setIsMounted(true);
    };
    initMounted();
  }, []);

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
    /* 드래그 잔상 스타일 */
    .react-grid-placeholder {
      background: rgba(255, 255, 255, 0.05) !important;
      opacity: 0.3 !important;
      border-radius: 16px !important;
    }
    
    /* 확장된 래퍼 (화면 전체를 덮는 검은 배경 역할) */
    .grid-item-expanded {
      position: fixed !important;
      inset: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      
      /* [중요] RGL의 transform 좌표계를 해제하여 뷰포트 기준으로 배치 */
      transform: none !important;
      
      margin: 0 !important;
      
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      
      box-sizing: border-box !important;
      
      /* FLIP 애니메이션을 위해 transition 제거 (JS가 제어) */
      transition: all 0.5s cubic-bezier(0.25, 1, 0.25, 1) !important;

      /* 배경색 (백드롭) */
      background-color: rgba(0, 0, 0, 0.7) !important;
      /* 모달이 떴을 때 뒤쪽 컨텐츠의 스크롤 동작 방지 (최신 브라우저 지원) */
      overscroll-behavior: contain;
    }

    /* 3. 실제 확장된 카드 (내부 div) - 여기서 90% 크기를 제어합니다 */
    .grid-item-expanded > div {
      /* 래퍼(100%) 내에서 90% 크기 차지 */
      width: 90% !important;
      height: 90% !important;
      
      /* Flex 부모(.grid-item-expanded) 덕분에 자동으로 중앙 정렬됨 */
      box-sizing: border-box !important;
    }

    /* 평소 상태 (축소 시 부드러운 복귀를 위한 트랜지션) */
    .react-grid-item:not(.grid-item-expanded) {
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