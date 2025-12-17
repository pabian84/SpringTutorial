import { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { IoIosArrowBack } from 'react-icons/io';
import { getWeatherStyle, type DailyForecast } from '../utils/WeatherUtils';


interface WeatherData {
  location: string;
  currentTemp: number;
  currentSky: string;
  weeklyForecast: DailyForecast[]; 
}

export default function WeatherDetail() {
  const navigate = useNavigate();
  const [weather, setWeather] = useState<WeatherData | null>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          axios.get(`http://localhost:8080/api/weather?lat=${latitude}&lon=${longitude}`)
               .then(res => setWeather(res.data));
        },
        () => axios.get('http://localhost:8080/api/weather').then(res => setWeather(res.data))
      );
    } else {
      axios.get('http://localhost:8080/api/weather').then(res => setWeather(res.data));
    }
  }, []);

  if (!weather) {
    return <div style={{ color: 'white', textAlign: 'center', marginTop: 100 }}>Loading...</div>;
  }

  const currentStyle = getWeatherStyle(weather.currentSky);

  return (
    // [1] 전체 배경: 대시보드와 통일 (검은색 계열)
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#1a1a2e', // Dashboard와 통일감 있는 색상
      color: '#eaeaea',
      padding: '20px'
    }}>
      
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
        <button 
          onClick={() => navigate(-1)} 
          style={{ background: 'none', border: 'none', color: '#eaeaea', cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: '18px' }}
        >
          <IoIosArrowBack size={24} /> Back
        </button>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        
        {/* [2] 현재 날씨 카드 (iOS 스타일 패널) */}
        <div style={{
            background: currentStyle.bg,
            borderRadius: '24px',
            padding: '30px',
            textAlign: 'center',
            boxShadow: '0 10px 20px rgba(0,0,0,0.3)',
            marginBottom: '30px',
            color: 'white'
        }}>
            <h2 style={{ fontSize: '28px', fontWeight: 'bold', margin: '0 0 10px 0' }}>{weather.location}</h2>
            <div style={{ marginBottom: '10px' }}>{currentStyle.icon}</div>
            <div style={{ fontSize: '64px', fontWeight: '300' }}>{Math.round(weather.currentTemp)}°</div>
            <div style={{ fontSize: '20px', opacity: 0.9 }}>{weather.currentSky}</div>
        </div>

        {/* [3] 주간 예보 (각 요일별 카드 분리) */}
        <h3 style={{ fontSize: '18px', color: '#aaa', marginBottom: '15px', paddingLeft: '5px' }}>
            📅 주간 예보 (Weekly)
        </h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {weather.weeklyForecast.map((day, idx) => {
                // [중요] 각 날씨에 맞는 스타일 개별 적용
                const dayStyle = getWeatherStyle(day.sky); 
                
                return (
                    <div key={idx} style={{ 
                        background: dayStyle.bg, // 각 카드의 배경색이 다름
                        borderRadius: '16px',
                        padding: '15px 25px',
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.2)',
                        color: 'white'
                    }}>
                        {/* 요일 */}
                        <div style={{ width: '100px', fontWeight: 'bold', fontSize: '16px' }}>
                            {new Date(day.date).toLocaleDateString('ko-KR', { weekday: 'long' })}
                        </div>

                        {/* 아이콘 */}
                        <div style={{ flex: 1, textAlign: 'center' }}>
                            {dayStyle.smallIcon}
                        </div>

                        {/* 온도 */}
                        <div style={{ width: '60px', textAlign: 'right', fontWeight: 'bold', fontSize: '20px' }}>
                            {Math.round(day.temp)}°
                        </div>
                    </div>
                );
            })}
        </div>
      </div>
    </div>
  );
}