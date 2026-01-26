import { useCallback, useMemo, useState } from 'react';
import { BiDetail } from 'react-icons/bi';
import { FaChartLine, FaCode, FaComments, FaCube, FaDesktop, FaGlobeAsia, FaMapMarkedAlt, FaServer, FaSignOutAlt, FaStickyNote } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import CesiumWidget from '../components/cesium/CesiumWidget';
import ChatWidget from '../components/ChatWidget';
import CodeStatsWidget from '../components/CodeStatsWidget';
import WidgetGridLayout, { type RGL_Layouts, type WidgetConfig } from '../components/common/WidgetGridLayout';
import ExchangeWidget from '../components/ExchangeWidget';
import KakaoMapWidget from '../components/KakaoMapWidget';
import MemoWidget from '../components/MemoWidget';
import ServerMonitor from '../components/Servermonitor';
import ThreeJsWidget from '../components/threejs/ThreeJsWidget'; // 위젯 임포트
import WeatherWidget from '../components/WeatherWidget';
import { useUserLocation } from '../contexts/UserLocationContext';
import { useDashboardData } from '../hooks/useDashboardData';

// [설정] LocalStorage 키값
const STORAGE_KEY = 'dashboard_layouts_v1';

// [서식 유지] 초기 레이아웃 설정 (Initial Layout Configuration)
const defaultLayouts: RGL_Layouts = {
  lg: [
    { i: 'weather', x: 0, y: 0, w: 9, h: 8 },
    { i: 'online', x: 9, y: 0, w: 3, h: 8 },
    { i: 'map', x: 0, y: 8, w: 6, h: 10 },
    { i: 'cesium', x: 6, y: 8, w: 6, h: 10 },
    { i: 'exchange', x: 0, y: 16, w: 6, h: 8 },
    { i: 'code', x: 6, y: 16, w: 6, h: 8 },
    { i: 'server', x: 0, y: 14, w: 6, h: 8 },
    { i: 'memo', x: 6, y: 14, w: 3, h: 8 },
    { i: 'chat', x: 9, y: 14, w: 3, h: 8 },
    { i: 'three', x: 0, y: 24, w: 12, h: 10 },
  ],
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
    { i: 'three', x: 0, y: 40, w: 10, h: 8 },
  ],
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
    { i: 'three', x: 0, y: 46, w: 6, h: 8 },
  ],
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
    { i: 'three', x: 0, y: 52, w: 4, h: 8 },
  ],
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
    { i: 'three', x: 0, y: 54, w: 2, h: 6 },
  ]
};

export default function Dashboard() {
  const navigate = useNavigate();
  
  // [데이터 Hook] 비즈니스 로직 분리
  const { 
    myId, onlineUsers, exchangeData, codeData, memos, serverData, chatMessages, 
    handleAddMemo, handleDeleteMemo, handleSendMessage, handleLogout 
  } = useDashboardData();
  
  const { lat, lon, loading: locLoading } = useUserLocation();
  // [수정 핵심] 지연 초기화 (Lazy Initialization)
  // 컴포넌트 최초 렌더링 시점에 LocalStorage를 동기적으로 읽어옵니다.
  const [layouts, setLayouts] = useState<RGL_Layouts>(() => {
    try {
      const savedLayouts = localStorage.getItem(STORAGE_KEY);
      if (savedLayouts) {
        // 저장된 값이 있으면 파싱해서 사용
        return JSON.parse(savedLayouts) as RGL_Layouts;
      }
    } catch (e) {
      console.error("Failed to load layouts from storage", e);
    }
    // 없거나 에러나면 기본값 사용
    return defaultLayouts;
  });

  // [핸들러] 레이아웃 변경 시 LocalStorage에 저장
  const handleLayoutChange = useCallback((newLayouts: RGL_Layouts) => {
    console.log('handleLayoutChange!');
    setLayouts(newLayouts);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newLayouts));
  }, []);

  /**
   * [설정] 위젯 구성 목록
   * useMemo를 통해 불필요한 설정 재생성을 방지하며, 각 위젯별 옵션을 정의합니다.
   */
  const widgets: WidgetConfig[] = useMemo(() => {
    // 의존성 문제 해결을 위해 내부 정의
    // 세슘 상세 버튼
    const cesiumDetailButton = (
      <button onClick={() => navigate('/cesium')} title="상세 보기" style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', padding: '4px', display: 'flex', transition: 'color 0.2s', marginRight: '5px' }}>
        <BiDetail size={20} />
      </button>
    );
    // ThreeJS 상세 버튼
    const threeDetailButton = (
      <button onClick={() => navigate('/threejs')} title="상세 보기" style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', padding: '4px', display: 'flex', transition: 'color 0.2s', marginRight: '5px' }}>
        <BiDetail size={20} />
      </button>
    );

    return [
      {
        id: 'weather',
        noHeader: true,
        content: <WeatherWidget />,
        deferred: true, idle: true
      },
      {
        id: 'online',
        title: `Online (${onlineUsers.length})`,
        icon: <div style={{width:10, height:10, background:'#00ff00', borderRadius:'50%'}}/>,
        content: (
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
        ),
        keepMounted: true, deferred: true
      },
      {
        id: 'map',
        title: 'Location',
        icon: <FaMapMarkedAlt style={{ color: '#00c6ff' }} />,
        content: locLoading || !lat || !lon ? <div>위치 정보 찾는 중...</div> : <KakaoMapWidget lat={lat} lon={lon} />,
        keepMounted: true, deferred: true
      },
      {
        id: 'cesium',
        title: '3D Earth',
        icon: <FaGlobeAsia style={{ color: '#4facfe' }} />,
        content: <CesiumWidget />,
        headerAction: cesiumDetailButton,
        keepMounted: true, deferred: true, idle: true
      },
      {
        id: 'exchange',
        title: 'Exchange',
        icon: <FaChartLine style={{ color: '#f59e0b' }} />,
        content: <ExchangeWidget data={exchangeData} />,
        deferred: true, idle: true
      },
      {
        id: 'code',
        title: 'Project Tech Stack',
        icon: <FaCode style={{ color: '#3178c6' }} />,
        content: <CodeStatsWidget data={codeData} />,
        deferred: true, idle: true
      },
      {
        id: 'server',
        title: 'Server Status',
        icon: <FaServer style={{ color: '#e74c3c' }} />,
        content: <ServerMonitor data={serverData} />,
        deferred: true
      },
      {
        id: 'memo',
        title: 'Memo',
        icon: <FaStickyNote style={{ color: '#f1c40f' }} />,
        content: <MemoWidget memos={memos} onAdd={handleAddMemo} onDelete={handleDeleteMemo} />,
        keepMounted: true, deferred: true
      },
      {
        id: 'chat',
        title: 'Live Chat',
        icon: <FaComments style={{ color: '#2ecc71' }} />,
        content: <ChatWidget myId={myId!} messages={chatMessages} onSendMessage={handleSendMessage} />,
        keepMounted: true, deferred: true
      },
      {
        id: 'three',
        title: '3D Robot Control',
        icon: <FaCube style={{ color: '#d946ef' }} />, // 보라색/핑크색 계열
        content: <ThreeJsWidget />,
        headerAction: threeDetailButton,
        // [중요] WebGL 컨텍스트 유지 및 애니메이션 끊김 방지
        keepMounted: true, 
        deferred: true, 
        idle: true
      },
    ];
  }, [
    onlineUsers, locLoading, lat, lon, exchangeData, codeData, serverData, 
    memos, chatMessages, myId, navigate,
    handleAddMemo, handleDeleteMemo, handleSendMessage
  ]);

  // [서식 유지] 스타일 객체
  const styles = {
    container: { padding: '20px', maxWidth: '1400px', margin: '0 auto', color: '#eaeaea' },
    header: { display: 'flex', justifyContent: 'space-between', marginBottom: '20px' },
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px' }}>Smart Dashboard</h1>
          <span style={{ color: 'var(--accent-color)', fontSize: '14px' }}>Logged in as {myId}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button 
            onClick={() => navigate('/devices')} 
            style={{ 
              width: 'auto', 
              height: '75%', 
              padding: '5px 10px', 
              fontSize: '14px', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              backgroundColor: '#214372', // 회색 계열 (구분감)
            }}
            title="로그인된 기기 관리"
          >
            <FaDesktop size={16} />
            기기 관리
          </button>
          <button onClick={handleLogout}
            style={{
              width: 'auto', height: '75%', padding: '5px 10px', fontSize: '14px',
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
            }}
          >
            <FaSignOutAlt size={16} />
            System Logout
          </button>
        </div>
      </header>

      {/* 모듈화된 그리드 사용 */}
      <WidgetGridLayout layouts={layouts} widgets={widgets} onLayoutChange={handleLayoutChange} />
    </div>
  );
}