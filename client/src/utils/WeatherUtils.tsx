import { WiDaySunny, WiCloudy, WiRain, WiSnow } from 'react-icons/wi';

// [공통] 타입 정의 이동
export interface DailyForecast {
  date: string;
  temp: number;
  sky: string;
}

// [공통] 스타일 함수 이동
export const getWeatherStyle = (sky: string) => {
    switch (sky) {
      case 'Sunny':
        return {
          bg: 'linear-gradient(135deg, #56CCF2 0%, #2F80ED 100%)',
          icon: <WiDaySunny size={80} color="#fff" />,
          smallIcon: <WiDaySunny size={40} color="#fff" />
        };
      case 'Cloudy':
        return {
          bg: 'linear-gradient(135deg, #757F9A 0%, #D7DDE8 100%)',
          icon: <WiCloudy size={80} color="#fff" />,
          smallIcon: <WiCloudy size={40} color="#fff" />
        };
      case 'Rain':
        return {
          bg: 'linear-gradient(135deg, #203A43 0%, #2C5364 100%)',
          icon: <WiRain size={80} color="#fff" />,
          smallIcon: <WiRain size={40} color="#fff" />
        };
      case 'Snow/Storm':
        return {
          bg: 'linear-gradient(135deg, #4B79A1 0%, #283E51 100%)',
          icon: <WiSnow size={80} color="#fff" />,
          smallIcon: <WiSnow size={40} color="#fff" />
        };
      default:
        return {
          bg: 'linear-gradient(135deg, #141E30 0%, #243B55 100%)',
          icon: <WiDaySunny size={80} color="#fff" />,
          smallIcon: <WiDaySunny size={40} color="#fff" />
        };
    }
};