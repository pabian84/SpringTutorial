import { IoMoon, IoSunny } from 'react-icons/io5';
import { 
  WiCloudy, WiRain, WiSnow, WiDayCloudy, WiFog, 
  WiNightAltCloudy, WiNightAltRain, WiNightAltSnow, WiNightAltShowers, WiNightAltThunderstorm,
  WiSunrise, WiSunset, WiThunderstorm, WiShowers 
} from 'react-icons/wi';

// 타입 정의
export type WeatherType = 'sun' | 'moon' | 'cloud' | 'rain' | 'snow' | 'fog' | 'storm' | 'sunrise' | 'sunset';

export interface WeatherAsset {
  type: WeatherType;
  Icon: React.ElementType;
  color?: string;
}

// 시간 분 변환 헬퍼
export const getMinutes = (timeStr: string) => {
  if (!timeStr || !timeStr.includes(':')) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

// 밤/낮 체크 로직
export const checkIsNight = (targetTimeStr: string, sunrise: string, sunset: string) => {
  if (!targetTimeStr || !sunrise || !sunset) return false;
  let targetM = 0;
  // targetTimeStr가 "HH:mm" 형식이 아닐 경우(예: 현재시간 계산 시) 처리
  if (targetTimeStr.includes(':')) {
    targetM = getMinutes(targetTimeStr);
  } else {
    // 그냥 숫자로 들어온 경우 등 예외처리 (필요 시)
    return false;
  }
  
  const sunriseM = getMinutes(sunrise);
  const sunsetM = getMinutes(sunset);
  return targetM >= sunsetM || targetM < sunriseM;
};

// 해/달 위치 계산 로직
export const calculateCelestialPosition = (sunrise: string, sunset: string) => {
  if (!sunrise || !sunset) return { top: '10%', left: '80%' }; 

  const xStart = 20;  
  const xEnd = 80;    
  const yLow = 40;    
  const yHigh = 5;    

  const now = new Date();
  const currentM = now.getHours() * 60 + now.getMinutes();
  const sunriseM = getMinutes(sunrise);
  const sunsetM = getMinutes(sunset);

  let progress = 0; 

  if (currentM >= sunriseM && currentM < sunsetM) {
    const totalDay = sunsetM - sunriseM;
    progress = (currentM - sunriseM) / totalDay;
  } else {
    const totalDay = 1440; 
    let elapsed = 0;
    let totalNight = 0;

    if (currentM >= sunsetM) {
      elapsed = currentM - sunsetM;
      totalNight = (totalDay - sunsetM) + sunriseM;
    } else {
      elapsed = (totalDay - sunsetM) + currentM;
      totalNight = (totalDay - sunsetM) + sunriseM;
    }
    progress = elapsed / totalNight;
  }

  const leftPos = xStart + (progress * (xEnd - xStart));
  const heightDiff = yLow - yHigh;
  const topPos = yLow - (Math.sin(progress * Math.PI) * heightDiff);

  return { top: `${topPos}%`, left: `${leftPos}%` };
};

// 날씨 에셋 분석 로직
export const getWeatherAsset = (sky: string, isNight: boolean): WeatherAsset => {
  if (sky.includes('일출')) return { type: 'sunrise', Icon: WiSunrise, color: '#FFD700' };
  if (sky.includes('일몰')) return { type: 'sunset', Icon: WiSunset, color: '#FFA500' };

  if (isNight) {
    if (sky.includes('구름조금')) return { type: 'cloud', Icon: WiNightAltCloudy };
    if (sky.includes('흐림') || sky.includes('구름')) return { type: 'cloud', Icon: WiCloudy };
    if (sky.includes('비')) return { type: 'rain', Icon: WiNightAltRain };
    if (sky.includes('소나기')) return { type: 'rain', Icon: WiNightAltShowers };
    if (sky.includes('눈')) return { type: 'snow', Icon: WiNightAltSnow };
    if (sky.includes('안개')) return { type: 'fog', Icon: WiFog };
    if (sky.includes('폭풍우')) return { type: 'storm', Icon: WiNightAltThunderstorm };
    return { type: 'moon', Icon: IoMoon }; 
  } else {
    if (sky.includes('구름조금')) return { type: 'cloud', Icon: WiDayCloudy };
    if (sky.includes('흐림') || sky.includes('구름')) return { type: 'cloud', Icon: WiCloudy };
    if (sky.includes('비')) return { type: 'rain', Icon: WiRain }; 
    if (sky.includes('소나기')) return { type: 'rain', Icon: WiShowers };
    if (sky.includes('눈')) return { type: 'snow', Icon: WiSnow };
    if (sky.includes('안개')) return { type: 'fog', Icon: WiFog };
    if (sky.includes('폭풍우')) return { type: 'storm', Icon: WiThunderstorm };
    return { type: 'sun', Icon: IoSunny }; 
  }
};

// 동적 배경 로직
export const getDynamicBackground = (sky: string, isNight: boolean) => {
  const { type } = getWeatherAsset(sky, isNight);

  switch (type) {
    case 'sunrise': return 'linear-gradient(180deg, #667db6 0%, #0082c8 0%, #0082c8 0%, #0082c8 0%, #fc4a1a 0%, #f7b733 100%)';
    case 'sunset': return 'linear-gradient(180deg, #355C7D 0%, #6C5B7B 50%, #C06C84 100%)';
    case 'sun': return 'linear-gradient(180deg, #5CA0F2 0%, #87CEFA 100%)';
    case 'moon': return 'linear-gradient(180deg, #0f2027 0%, #203a43 50%, #2c5364 100%)';
    case 'cloud': return isNight ? 'linear-gradient(180deg, #2c3e50 0%, #3498db 100%)' : 'linear-gradient(180deg, #6b7280 0%, #374151 100%)';
    case 'rain': return isNight ? 'linear-gradient(180deg, #000000 0%, #434343 100%)' : 'linear-gradient(180deg, #373B44 0%, #4286f4 100%)';
    case 'snow': return isNight ? 'linear-gradient(180deg, #232526 0%, #414345 100%)' : 'linear-gradient(180deg, #83a4d4 0%, #b6fbff 100%)';
    case 'fog': return isNight ? 'linear-gradient(180deg, #1e130c 0%, #9a8478 100%)' : 'linear-gradient(180deg, #bdc3c7 0%, #2c3e50 100%)';
    case 'storm': return 'linear-gradient(180deg, #141E30 0%, #243B55 100%)';
    default: return isNight ? 'linear-gradient(180deg, #0f2027 0%, #203a43 50%, #2c5364 100%)' : 'linear-gradient(180deg, #5CA0F2 0%, #87CEFA 100%)';
  }
};