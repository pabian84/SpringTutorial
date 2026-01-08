import {  useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useUserLocation } from '../contexts/UserLocationContext'; // [변경] 전역 위치 사용
import { useWeather } from '../hooks/useWeather';
import { useWeatherFormatter } from '../hooks/useWeatherFormatter'; // [변경] 포매터 사용
import { getDynamicBackground } from '../utils/WeatherUtils';
import WeatherBackground from './WeatherBackground';
import WeatherIcon from './WeatherIcon';

export default function WeatherWidget() {
  const navigate = useNavigate();
  // 반응형 처리용 ref 및 상태
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(6);

  // 1. Context에서 위치 가져오기
  const { lat, lon, loading: locLoading, error: locError } = useUserLocation();
  // 2. 날씨 데이터 가져오기 (위치 정보가 있을 때만 동작)
  const { weather, loading: weatherLoading, error: weatherError } = useWeather(lat, lon);
  // 3. UI 데이터 가공 (중복 로직 제거됨)
  const { isCurrentNight, processedHourly } = useWeatherFormatter(weather, visibleCount);

  // 반응형 개수 조절
  useEffect(() => {
    if (!containerRef.current) return;
    const updateCount = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        const itemWidth = 50; 
        const count = Math.floor(width / itemWidth);
        setVisibleCount(Math.max(5, Math.min(count, 12)));
      }
    };
    updateCount();
    const observer = new ResizeObserver(updateCount);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // 1. 진짜 로딩 중일 때만 로딩 표시
  if (locLoading || weatherLoading) {
    return <div style={{ padding: '20px', color: '#fff' }}>날씨 로딩 중...</div>;
  }
  // 2. 위치 정보를 못 가져왔을 때 (예: GPS 차단)
  if (locError || !lat || !lon) {
    return (
      <div style={{ padding: '20px', color: '#ff6b6b' }}>
        ⚠️ 위치 오류: {locError || "위치 정보 없음"}
        <br/><span style={{fontSize: '12px'}}>GPS 권한을 확인해주세요.</span>
      </div>
    );
  }
  // 3. 서버 통신 실패했을 때 (예: 백엔드 꺼짐)
  if (weatherError) {
    return (
      <div style={{ padding: '20px', color: '#ff6b6b' }}>
        ⚠️ 날씨 오류: {weatherError}
        <br/><span style={{fontSize: '12px'}}>서버 연결을 확인해주세요.</span>
      </div>
    );
  }
  // 4. 로딩도 끝났고 에러도 없는데 데이터가 비어있을 때 (예외 상황)
  if (!weather) {
     return <div style={{ padding: '20px', color: '#fff' }}>날씨 정보가 없습니다.</div>;
  }

  return (
    <motion.div
      onClick={() => navigate('/weather')}
      whileHover={{ scale: 1.01 }}
      style={{
        width: '100%', height: '100%',
        position: 'relative', overflow: 'hidden',
        borderRadius: '24px', color: 'white', padding: '24px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        cursor: 'pointer', fontFamily: '-apple-system, sans-serif',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        boxSizing: 'border-box',
        isolation: 'isolate'
      }}
    >
      {/* 1. 배경 컴포넌트 (깔끔!) */}
      <WeatherBackground 
        sky={weather.currentSky} 
        isNight={isCurrentNight} 
        sunrise={weather.sunrise} 
        sunset={weather.sunset} 
      />
      
      {/* 2. 배경 그라데이션 (배경 컴포넌트 뒤에 깔거나, 부모 div 스타일로 처리 가능하지만 여기선 오버레이 방식 사용) */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1,
        background: getDynamicBackground(weather.currentSky, isCurrentNight)
      }} />

      {/* 상단 정보 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>{weather.location}</h3>
          <div style={{ fontSize: '64px', fontWeight: 300, lineHeight: '1.1', marginLeft: '-2px' }}>
            {Math.round(weather.currentTemp)}°
          </div>
          <div style={{ fontSize: '18px', fontWeight: 500, opacity: 0.95 }}>{weather.currentSky}</div>
          <div style={{ fontSize: '14px', opacity: 0.85 }}>
            최고: {Math.round(weather.weeklyForecast[0]?.maxTemp)}° &nbsp; 최저: {Math.round(weather.weeklyForecast[0]?.minTemp)}°
          </div>
        </div>
        <div style={{ paddingRight: '10px' }}>
          {/* 3. 아이콘 컴포넌트 (깔끔!) */}
          <WeatherIcon sky={weather.currentSky} isNight={isCurrentNight} size={80} />
        </div>
      </div>

      {/* 하단 예보 */}
      <div ref={containerRef} style={{ marginTop: '15px', zIndex: 10, borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '15px', display: 'flex', justifyContent: 'space-between' }}>
        {processedHourly.map((hour, idx) => (
          <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '40px' }}>
            <span style={{ fontSize: '12px', marginBottom: '6px', opacity: 0.9 }}>
              {hour.type === 'special' ? hour.time : (idx === 0 ? '지금' : hour.time)}
            </span>
            <div style={{ marginBottom: '6px' }}>
              <WeatherIcon sky={hour.sky} isNight={hour.isNight || false} size={26} />
            </div>
            <span style={{ fontSize: '15px', fontWeight: 'bold' }}>
              {hour.type === 'special' ? hour.sky : `${Math.round(hour.temp)}°`}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}