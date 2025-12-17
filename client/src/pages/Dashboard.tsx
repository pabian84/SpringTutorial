import { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import MapWidget from '../components/MapWidget';
import ServerMonitor from '../components/Servermonitor';
import MemoWidget from '../components/MemoWidget';
import { getWeatherStyle, type DailyForecast } from '../utils/WeatherUtils';

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
  const [onlineUsers, setOnlineUsers] = useState<UserData[]>([]);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  // [추가됨] 내 위치 상태 관리 (기본값: 용인시청)
  const [myLocation, setMyLocation] = useState<{lat: number, lon: number}>({
    lat: 37.241086,
    lon: 127.177553
  });

  useEffect(() => {
    if (!myId) {
      navigate('/');
      return;
    }

    // 1. 접속 중인 유저 리스트 가져오기
    axios.get('http://localhost:8080/api/user/list')
      .then(res => setOnlineUsers(res.data));

    // [수정됨] 2. 브라우저 위치 정보 가져오기 -> 성공하면 날씨 갱신
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                
                // 내 위치 상태 업데이트 (지도 이동용)
                setMyLocation({ lat: latitude, lon: longitude });

                // 서버에 내 위치 날씨 요청
                axios.get(`http://localhost:8080/api/weather?lat=${latitude}&lon=${longitude}`)
                     .then(res => setWeather(res.data));
            },
            (err) => {
                console.error("위치 권한 차단됨:", err);
                // 실패 시 기본 위치(용인)로 날씨 요청
                axios.get('http://localhost:8080/api/weather').then(res => setWeather(res.data));
            }
        );
    } else {
        // 브라우저가 위치 기능을 지원 안 할 때
        axios.get('http://localhost:8080/api/weather').then(res => setWeather(res.data));
    }
  }, [myId, navigate]);

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

        {/* [하단 영역] 왼쪽: 서버 모니터링 / 오른쪽: 메모장 */}
        <div style={{ gridColumn: 'span 2', display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
            
            {/* 서버 모니터링 */}
            <div style={styles.card}>
                <h3 style={styles.sectionTitle}>🖥️ Server Status</h3>
                <div style={{ height: '250px', width: '100%' }}>
                    <ServerMonitor />
                </div>
            </div>

            {/* [신규] 관리자 메모장 */}
            <div style={styles.card}>
                <h3 style={styles.sectionTitle}>📝 Admin Memo</h3>
                <div style={{ height: '250px', width: '100%' }}>
                    <MemoWidget />
                </div>
            </div>

        </div>

      </div>
    </div>
  );
}