import { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom'; // [복구] 페이지 이동 훅 사용
import { showAlert } from '../utils/Alert';

// [로직 유지] Dashboard.tsx에서 import 하므로 export 필수 유지
export interface DailyForecast {
  date: string;
  temp: number;
  sky: string;
}

interface WeatherDetailData {
  location: string;
  // [로직 유지] 선생님 코드의 변수명 weeklyForecast 절대 유지
  weeklyForecast: DailyForecast[];
}

export default function WeatherDetail() {
  const navigate = useNavigate(); // [복구]
  const [weather, setWeather] = useState<WeatherDetailData | null>(null);

  useEffect(() => {
    // [로직 유지] API 호출 로직 100% 동일
    axios.get('http://localhost:8080/api/weather')
         .then(res => {
            setWeather(res.data);
         })
         .catch(e => {
            console.error(e);
            showAlert('오류 발생', '날씨 정보 로딩 실패', 'error');
         });
  }, []);

  if (!weather) {
    return <div style={{ padding: 20, minHeight: '100vh', backgroundColor: '#16213e', color: 'white' }}>Loading...</div>;
  }

  return (
    // [디자인] 전체 화면 다크 모드
    <div style={{ padding: '20px', minHeight: '100vh', backgroundColor: '#16213e', color: 'white', display: 'flex', flexDirection: 'column' }}>
      
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px' }}>{weather.location} Weekly Forecast</h1>
        </div>
        {/* [복구] navigate(-1)로 닫기(뒤로가기) */}
        <button 
          onClick={() => navigate(-1)} 
          style={{ 
            backgroundColor: '#e94560', color: 'white', border: 'none', 
            padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' 
          }}
        >
          Close
        </button>
      </div>

      {/* 컨텐츠: 가로 스크롤 카드 UI */}
      <div style={{ display: 'flex', overflowX: 'auto', gap: '15px', paddingBottom: '20px' }}>
        <style>{`div::-webkit-scrollbar { display: none; }`}</style>
        
        {/* [로직 유지] weeklyForecast 매핑 로직 그대로 사용 */}
        {weather.weeklyForecast.map((day, idx) => (
          <div key={idx} style={{ 
            flex: '0 0 auto', width: '120px', height: '180px', 
            backgroundColor: '#1f2937', borderRadius: '16px', padding: '20px', 
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', 
            border: '1px solid #333', boxShadow: '0 4px 6px rgba(0,0,0,0.2)' 
          }}>
            <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#ddd' }}>
              {day.date.substring(5)}
            </span>
            <span style={{ fontSize: '14px', color: '#aaa' }}>
              {day.sky}
            </span>
            <span style={{ fontSize: '24px', fontWeight: 'bold', color: 'white' }}>
              {day.temp}°C
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}