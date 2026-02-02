import { AnimatePresence, motion } from 'framer-motion';
import { useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserLocation } from '../contexts/UserLocationContext'; // [변경] 전역 위치 사용
import { useWeather } from '../hooks/useWeather';
import { useWeatherFormatter } from '../hooks/useWeatherFormatter'; // [변경] 포매터 사용
import { getDynamicBackground } from '../utils/WeatherUtils';
import WeatherBackground from './WeatherBackground';
import WeatherIcon from './WeatherIcon';

/**
 * [신규] 스켈레톤 로딩 컴포넌트
 */
function WeatherSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        width: '100%', height: '100%', borderRadius: '24px',
        background: 'linear-gradient(135deg, #2b2b3b 0%, #1e1e2a 100%)',
        padding: '16px', boxSizing: 'border-box', display: 'flex',
        flexDirection: 'column', justifyContent: 'space-between',
        overflow: 'hidden', position: 'relative'
      }}
    >
      <motion.div
        animate={{ x: ['-100%', '100%'] }}
        transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
        style={{
          position: 'absolute', top: 0, left: 0, width: '50%', height: '100%',
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)',
          skewX: -20
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ width: '80px', height: '20px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '4px' }} />
          <div style={{ width: '120px', height: '60px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }} />
        </div>
        <div style={{ width: '80px', height: '80px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '50%' }} />
      </div>
      <div style={{ width: '100%', height: '1px', backgroundColor: 'rgba(255,255,255,0.1)', marginTop: '20px' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '15px' }}>
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} style={{ width: '30px', height: '50px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '4px' }} />
        ))}
      </div>
    </motion.div>
  );
}

export default function WeatherWidget() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(8);
  const [isReady, setIsReady] = useState(false);

  const { lat, lon, loading: locLoading, error: locError } = useUserLocation();
  const { weather, loading: weatherLoading, error: weatherError } = useWeather(lat, lon, 16, true);
  const { isCurrentNight, processedHourly } = useWeatherFormatter(weather, visibleCount);

  useLayoutEffect(() => {
    if (!weather) return;

    const updateCount = () => {
      requestAnimationFrame(() => {
        if (containerRef.current) {
          const width = containerRef.current.clientWidth;
          const itemWidth = 65; 
          const count = Math.floor(width / itemWidth);
          setVisibleCount(Math.max(4, Math.min(count, 8)));
          setIsReady(true);
        }
      });
    };

    updateCount();
    const observer = new ResizeObserver(updateCount);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [weather]);

  // [핵심 해결] 위젯의 전체 영역을 담당하는 Wrapper를 두어 레이아웃 시프트를 원천 봉쇄합니다.
  return (
    <div style={{ width: '100%', height: '100%', minHeight: '300px', position: 'relative' }}>
      <AnimatePresence>
        {/* 1. 로딩/계산 중일 때는 스켈레톤을 absolute로 띄움 (레이아웃에 영향 X) */}
        {(!weather || weatherLoading || locLoading || !isReady) && (
          <div key="skeleton-overlay" style={{ position: 'absolute', inset: 0, zIndex: 20 }}>
            <WeatherSkeleton />
          </div>
        )}
      </AnimatePresence>

      {/* 2. 실제 위젯 본체: 데이터 유무와 상관없이 구조는 유지하여 자리를 차지하게 함 */}
      <motion.div
        onClick={() => weather && navigate('/weather')}
        whileHover={{ scale: weather ? 1.01 : 1 }}
        animate={{ opacity: isReady ? 1 : 0 }}
        transition={{ duration: 0.5 }}
        style={{
          width: '100%', height: '100%',
          position: 'relative', overflow: 'hidden',
          borderRadius: '24px', color: 'white', padding: '26px 20px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          cursor: weather ? 'pointer' : 'default', 
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          boxSizing: 'border-box', isolation: 'isolate',
          background: weather ? 'transparent' : '#1e1e2a' // 데이터 없을 때 기본 배경색
        }}
      >
        {weather && (
          <>
            <WeatherBackground sky={weather.currentSky} isNight={isCurrentNight} sunrise={weather.sunrise} sunset={weather.sunset} />
            <div style={{ position: 'absolute', inset: 0, zIndex: -1, background: getDynamicBackground(weather.currentSky, isCurrentNight) }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>{weather.location}</h3>
                <div style={{ fontSize: '64px', fontWeight: 300, lineHeight: '1.1' }}>{Math.round(weather.currentTemp)}°</div>
                <div style={{ fontSize: '18px', fontWeight: 500, opacity: 0.95 }}>{weather.currentSky}</div>
                <div style={{ fontSize: '14px', opacity: 0.85 }}>
                  최고: {Math.round(weather.weeklyForecast[0]?.maxTemp)}° &nbsp; 최저: {Math.round(weather.weeklyForecast[0]?.minTemp)}°
                </div>
              </div>
              <WeatherIcon sky={weather.currentSky} isNight={isCurrentNight} size={80} />
            </div>

            <div ref={containerRef} style={{ marginTop: '10px', zIndex: 10, borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', minHeight: '60px' }}>
              <AnimatePresence>
                {processedHourly.map((hour, idx) => (
                  <motion.div key={`${hour.time}-${idx}`} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '40px' }}>
                    <span style={{ fontSize: '12px', marginBottom: '6px', opacity: 0.9 }}>{ hour.time }</span>
                    <WeatherIcon sky={hour.sky} isNight={hour.isNight || false} size={26} />

                    <span style={{ fontSize: '15px', fontWeight: 'bold' }}>{ hour.type === 'special' ? hour.sky : Math.round(hour.temp) + '°' }</span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </>
        )}

        {/* 에러 메시지는 위젯 내부에서 작게 표시 (레이아웃 유지) */}
        {(locError || weatherError) && (
           <div style={{ position: 'absolute', inset: 0, zIndex: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: '24px', color: '#ff6b6b', textAlign: 'center', padding: '20px' }}>
             ⚠️ 날씨 정보를 불러올 수 없습니다.
           </div>
        )}
      </motion.div>
    </div>
  );
}