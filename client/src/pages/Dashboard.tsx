import { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import MapWidget from '../components/MapWidget';
import ServerMonitor from '../components/Servermonitor';
import MemoWidget from '../components/MemoWidget';
import { getWeatherStyle, type DailyForecast } from '../utils/WeatherUtils';
import { useQuery } from '@tanstack/react-query'; // 임포트 추가
import { showAlert } from '../utils/Alert';
import ChatWidget from '../components/ChatWidget';
import { BiExpand, BiX } from 'react-icons/bi';

interface UserData {
  id: string;
  name: string;
}

interface WeatherData {
  location: string;
  currentTemp: number;
  currentSky: string;
  weeklyForecast: DailyForecast[]; 
}

export default function Dashboard() {
  const navigate = useNavigate();
  const myId = localStorage.getItem('myId') || sessionStorage.getItem('myId');
  // 내 위치 상태 관리, 추적 (기본값: 용인시청)
  const [myLocation, setMyLocation] = useState<{lat: number, lon: number}>({
    lat: 37.241086,
    lon: 127.177553
  });
  const [isChatExpanded, setIsChatExpanded] = useState(false);

  useEffect(() => {
    if (!myId) {
      navigate('/');
      return;
    }

    // 브라우저를 통해 위치 정보 가져오기 -> 성공하면 위치 정보 업데이트
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                // 내 위치 상태 업데이트 (지도 이동용)
                setMyLocation({ lat: latitude, lon: longitude });
            },
            (err) => {
                showAlert('위치 정보 오류', '위치 정보를 가져오지 못했습니다. 기본 위치로 설정됩니다.', 'warning');
                console.error("위치 권한 차단됨:", err);
            }
        );
    } else {
        // 브라우저가 위치 기능을 지원 안 할 때
        showAlert('지원 불가', '이 브라우저는 위치 정보를 지원하지 않습니다.', 'error');
    }
  }, [myId, navigate]);

  // --- [수정 1] 접속자 리스트 (React Query 적용) ---
  const { data: onlineUsers = [] } = useQuery({
    queryKey: ['onlineUsers'], // 캐싱을 위한 고유 키
    queryFn: async () => {
      const res = await axios.get('http://localhost:8080/api/user/list');
      return res.data as UserData[];
    },
    refetchInterval: 5000, // 5초마다 자동 갱신 (실시간 효과)
  });

  // --- [수정 2] 날씨 정보 (React Query 적용) ---
  // queryKey에 좌표(lat, lon)를 포함시켜, 위치가 바뀌면 자동으로 데이터를 다시 가져옵니다.
  const { data: weather } = useQuery({
    queryKey: ['weather', myLocation.lat, myLocation.lon], 
    queryFn: async () => {
      const res = await axios.get(`http://localhost:8080/api/weather?lat=${myLocation.lat}&lon=${myLocation.lon}`);
      return res.data as WeatherData;
    }
  });

  const logout = async () => {
    // 로그아웃 시 DB 상태 업데이트 요청
    await axios.post('http://localhost:8080/api/user/logout', { userId: myId });
    localStorage.clear();
    sessionStorage.clear();
    navigate('/');
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
        <button onClick={logout} style={{ width: 'auto', padding: '10px 20px', fontSize: '14px' }}>
          System Logout
        </button>
      </header>

      {/* 2. 메인 그리드 영역 */}
      <div style={styles.grid}>
        
        {/* [왼쪽 위] 날씨 위젯 (스타일 적용됨) */}
        {weather ? (
            <div 
                onClick={() => navigate('/weather')}
                style={{ 
                    ...styles.card, 
                    cursor: 'pointer', 
                    // [핵심] 날씨에 따라 배경색 변경
                    background: getWeatherStyle(weather.currentSky).bg,
                    position: 'relative',
                    overflow: 'hidden'
                }} 
            >
              {/* 타이틀: 아이콘도 동적으로 변경 */}
              <h3 style={styles.sectionTitle}>
                {/* 작은 아이콘 적용 */}
                {getWeatherStyle(weather.currentSky).smallIcon} 
                Local Weather
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ fontSize: '48px', fontWeight: 'bold' }}>{Math.round(weather.currentTemp)}°C</span>
                  <div style={{ fontSize: '18px', color: '#fff',opacity: 0.9 }}>{weather.currentSky}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{weather.location}</div>
                  {/* [수정] 안내 문구 색상 밝게 조정 */}
                  <small style={{ color: 'rgba(255,255,255,0.7)' }}>클릭하여 주간 예보 확인 &rarr;</small>
                </div>
              </div>
            </div>
          ) : (
            <div style={styles.card}>Loading Weather...</div>
        )}

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

        {/* [왼쪽 중간] 지도 기능 (준비중) */}
        <div style={styles.card}>
          <h3 style={styles.sectionTitle}>🗺 City Map</h3>
          {/* 기존 placeholderBox 대신 MapWidget 사용 */}
          <div style={{ height: '300px', width: '100%' }}>
            <MapWidget lat={myLocation.lat} lon={myLocation.lon} />
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
                    💬 Chat
                    {/* 확장 버튼 */}
                    <button 
                      onClick={() => setIsChatExpanded(true)}
                      style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '20px' }}
                      title="크게 보기"
                    >
                      <BiExpand /> {/* 아이콘이 없으면 'ㅁ' 같은 텍스트로 대체 가능 */}
                    </button>
                </h3>
                <div style={{ height: '250px', width: '100%' }}>
                    {/* myId는 반드시 넘겨줘야 합니다 */}
                    <ChatWidget myId={myId!} />
                </div>
            </div>
        </div>

      </div>

      {/* [신규] 채팅 확장 모달 (isChatExpanded가 true일 때만 표시) */}
      {isChatExpanded && (
        <div style={styles.modalOverlay} onClick={() => setIsChatExpanded(false)}>
          {/* 모달 내용 (클릭 시 닫히지 않도록 stopPropagation) */}
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '1px solid #444', paddingBottom: '10px' }}>
              <h2 style={{ margin: 0, color: 'white' }}>💬 Live Chat Room</h2>
              <button 
                onClick={() => setIsChatExpanded(false)}
                style={{ background: 'none', border: 'none', color: 'white', fontSize: '28px', cursor: 'pointer' }}
              >
                <BiX /> {/* 닫기 아이콘 */}
              </button>
            </div>
            {/* 크게 보이는 채팅 위젯 */}
            <div style={{ flex: 1 }}>
              <ChatWidget myId={myId!} />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}