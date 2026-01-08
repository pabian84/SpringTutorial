import { useMemo } from 'react';
import type { WeatherData } from '../types/weather';
import { checkIsNight } from '../utils/WeatherUtils'; // 기존 utils 활용

export const useWeatherFormatter = (weather: WeatherData | null, visibleCount: number = 6) => {
  
  // 1. 현재 밤/낮 여부 계산
  const isCurrentNight = useMemo(() => {
    if (!weather) return false;
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    return checkIsNight(`${h}:${m}`, weather.sunrise, weather.sunset);
  }, [weather]);

  // 2. 시간별 예보 포매팅 (화면에 뿌리기 좋은 형태로 가공)
  const processedHourly = useMemo(() => {
    if (!weather) return [];
    
    return weather.hourlyForecast.slice(0, visibleCount).map((hour) => {
      // 특수 타입(일출/일몰)은 밤낮 계산 제외
      if (hour.type === 'special') return { ...hour, isNight: false };
      
      const isNight = checkIsNight(hour.time, weather.sunrise, weather.sunset);
      
      // 밤인데 '맑음'이면 '맑은밤'으로 텍스트 변경 (아이콘 매핑용)
      let displaySky = hour.sky;
      if (isNight && hour.sky === '맑음') displaySky = '맑은밤'; 
      
      return { ...hour, sky: displaySky, isNight }; 
    });
  }, [weather, visibleCount]);

  return { isCurrentNight, processedHourly };
};