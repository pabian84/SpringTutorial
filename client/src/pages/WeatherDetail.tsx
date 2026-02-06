import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IoIosArrowBack, IoMdClose } from 'react-icons/io';
import { IoWater, IoSpeedometer, IoThermometer, IoUmbrella, IoTime, IoSunny, IoMoon } from 'react-icons/io5';
import { 
  WiCloudy, WiRain, WiSnow, WiDayCloudy, WiFog, 
  WiNightAltCloudy, WiNightFog, WiNightAltRain, WiNightAltSnow, WiNightAltShowers, WiNightAltThunderstorm,
  WiSunrise, WiSunset, WiThunderstorm, WiShowers 
} from 'react-icons/wi';
import { motion, AnimatePresence } from 'framer-motion';

// [변경] 공통 훅 임포트
import { useUserLocation } from '../contexts/UserLocationContext';
import { useWeather } from '../hooks/useWeather';
import { useWeatherFormatter } from '../hooks/useWeatherFormatter';
import type { WeatherDTO } from '../types/dtos';
import type { IconType } from 'react-icons/lib';

// --- 인터페이스 정의 ---
interface DetailBoxProps {
  id: string;
  title: string;
  icon: React.ReactNode;
  value: string | number;
  unit?: string;
  desc: string;
  onClick: (id: string) => void;
}

// 날씨 타입 정의 (애니메이션 그룹핑용)
type WeatherType = 'sun' | 'moon' | 'cloud' | 'rain' | 'snow' | 'fog' | 'storm' | 'sunrise' | 'sunset';

// 분석 결과 인터페이스
interface WeatherAsset {
  type: WeatherType;
  Icon: IconType;
  color?: string;
}

const containerStyle: React.CSSProperties = {
  backgroundColor: 'rgba(0, 0, 0, 0.2)',
  backdropFilter: 'blur(20px)',
  borderRadius: '16px',
  padding: '16px',
  marginBottom: '12px',
  boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
  overflow: 'hidden',
  position: 'relative',
  zIndex: 10
};

const headerStyle: React.CSSProperties = {
  fontSize: '12px', fontWeight: 600, opacity: 0.7, 
  marginBottom: '12px', textTransform: 'uppercase', display:'flex', alignItems:'center', gap:'5px',
  borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom:'8px'
};

// --- 헬퍼 함수 ---
const getMinutes = (timeStr: string) => {
  if (!timeStr || !timeStr.includes(':')) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

const DetailBox = ({ id, title, icon, value, unit = "", desc, onClick }: DetailBoxProps) => (
  <motion.div layoutId={id} onClick={() => onClick(id)} whileTap={{ scale: 0.95 }}
    style={{ ...containerStyle, marginBottom: 0, height: '150px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', cursor: 'pointer' }}>
    <motion.div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', opacity: 0.8, fontWeight: 600 }}>
      {icon} {title}
    </motion.div>
    <motion.div>
      <div style={{ fontSize: '32px', fontWeight: 500 }}>
        {value}<span style={{ fontSize: '20px', opacity: 0.8 }}>{unit}</span>
      </div>
    </motion.div>
    <motion.div style={{ fontSize: '13px', opacity: 0.9 }}>{desc}</motion.div>
  </motion.div>
);

// 날씨 상태 분석 공통 함수
const getWeatherAsset = (sky: string, isNight: boolean): WeatherAsset => {
  // 특수 케이스
  if (sky.includes('일출')) return { type: 'sunrise', Icon: WiSunrise, color: '#FFD700' };
  if (sky.includes('일몰')) return { type: 'sunset', Icon: WiSunset, color: '#FFA500' };

  // 밤
  if (isNight) {
    if (sky.includes('구름조금')) return { type: 'cloud', Icon: WiNightAltCloudy };
    if (sky.includes('흐림') || sky.includes('구름')) return { type: 'cloud', Icon: WiCloudy };
    if (sky.includes('비')) return { type: 'rain', Icon: WiNightAltRain };
    if (sky.includes('소나기')) return { type: 'rain', Icon: WiNightAltShowers };
    if (sky.includes('눈')) return { type: 'snow', Icon: WiNightAltSnow };
    if (sky.includes('안개')) return { type: 'fog', Icon: WiNightFog };
    if (sky.includes('폭풍우')) return { type: 'storm', Icon: WiNightAltThunderstorm };
    // 기본 맑은 밤 -> 달(IoMoon)
    return { type: 'moon', Icon: IoMoon }; // 기본값
  } 
  
  // 낮
  if (sky.includes('구름조금')) return { type: 'cloud', Icon: WiDayCloudy };
  if (sky.includes('흐림') || sky.includes('구름')) return { type: 'cloud', Icon: WiCloudy };
  if (sky.includes('비')) return { type: 'rain', Icon: WiRain };
  if (sky.includes('소나기')) return { type: 'rain', Icon: WiShowers };
  if (sky.includes('눈')) return { type: 'snow', Icon: WiSnow };
  if (sky.includes('안개')) return { type: 'fog', Icon: WiFog };
  if (sky.includes('폭풍우')) return { type: 'storm', Icon: WiThunderstorm };
  // 기본 맑은 날 -> 태양(IoSunny)
  return { type: 'sun', Icon: IoSunny }; // 기본값
};

// 배경 그라데이션 함수
const getDynamicBackground = (sky: string, isNight: boolean) => {
  // 1. 공통 분석 로직 사용 (중복 if문 제거)
  const { type } = getWeatherAsset(sky, isNight);

  // 2. 타입별 배경색 매핑
  switch (type) {
    case 'sunrise':
      // 일출: 새벽의 푸른빛에서 아침의 붉은빛으로
      return 'linear-gradient(180deg, #667db6 0%, #0082c8 0%, #0082c8 0%, #0082c8 0%, #fc4a1a 0%, #f7b733 100%)';
    
    case 'sunset':
      // 일몰: 보랏빛과 주황빛의 조화
      return 'linear-gradient(180deg, #355C7D 0%, #6C5B7B 50%, #C06C84 100%)';

    case 'sun': // 맑은 낮
      return 'linear-gradient(180deg, #5CA0F2 0%, #87CEFA 100%)';

    case 'moon': // 맑은 밤
      return 'linear-gradient(180deg, #0f2027 0%, #203a43 50%, #2c5364 100%)';

    case 'cloud':
      // 구름: 밤에는 짙은 회색, 낮에는 흐린 하늘색
      return isNight 
        ? 'linear-gradient(180deg, #2c3e50 0%, #3498db 100%)' 
        : 'linear-gradient(180deg, #6b7280 0%, #374151 100%)';

    case 'rain':
      // 비: 밤에는 아주 어두움, 낮에는 짙은 먹구름
      return isNight
        ? 'linear-gradient(180deg, #000000 0%, #434343 100%)'
        : 'linear-gradient(180deg, #373B44 0%, #4286f4 100%)';

    case 'snow':
      // 눈: 차가운 느낌
      return isNight
        ? 'linear-gradient(180deg, #232526 0%, #414345 100%)'
        : 'linear-gradient(180deg, #83a4d4 0%, #b6fbff 100%)';

    case 'fog':
      // 안개: 몽환적인 회색 톤
      return isNight
        ? 'linear-gradient(180deg, #1e130c 0%, #9a8478 100%)'
        : 'linear-gradient(180deg, #bdc3c7 0%, #2c3e50 100%)';

    case 'storm':
      // 폭풍우: 매우 어둡고 강렬함
      return 'linear-gradient(180deg, #141E30 0%, #243B55 100%)';

    default:
      // 기본값
      return isNight
        ? 'linear-gradient(180deg, #0f2027 0%, #203a43 50%, #2c5364 100%)'
        : 'linear-gradient(180deg, #5CA0F2 0%, #87CEFA 100%)';
  }
};

const getIcon = (sky: string, size: number, isNight: boolean = false) => {
  // 공통 로직 사용
  const { type, Icon, color } = getWeatherAsset(sky, isNight);
  const props = { size, color: color || "#fff" };

  switch (type) {
    case 'sunrise':
      return <motion.div animate={{ y: [3, -3, 3], opacity: [0.7, 1, 0.7] }} transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}><Icon {...props} /></motion.div>;
    case 'sunset':
      return <motion.div animate={{ y: [-3, 3, -3], opacity: [1, 0.7, 1] }} transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}><Icon {...props} /></motion.div>;
    case 'sun':
      return <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 12, ease: "linear" }}><Icon {...props} /></motion.div>;
    case 'moon':
      return <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}><Icon {...props} /></motion.div>;
    case 'cloud':
      return <motion.div animate={{ y: [0, -3, 0], scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}><Icon {...props} /></motion.div>;
    case 'rain':
      return <motion.div animate={{ y: [0, 5, 0] }} transition={{ repeat: Infinity, duration: 1.2 }}><Icon {...props} /></motion.div>;
    case 'snow':
      return <motion.div animate={{ rotate: [0, 10, -10, 0], y: [0, 3, 0] }} transition={{ repeat: Infinity, duration: 3 }}><Icon {...props} /></motion.div>;
    case 'fog':
      return <motion.div animate={{ opacity: [0.5, 0.8, 0.5] }} transition={{ repeat: Infinity, duration: 4 }}><Icon {...props} /></motion.div>;
    case 'storm':
      return <motion.div animate={{ opacity: [1, 0.5, 1] }} transition={{ repeat: Infinity, duration: 0.5 }}><Icon {...props} /></motion.div>;
    default:
      return <Icon {...props} />;
  }
};

// 시간 흐름에 따른 태양/달 위치 계산 함수
const calculateCelestialPosition = (sunrise: string, sunset: string) => {
  // 기본값 (데이터 없을 때 우측 상단)
  if (!sunrise || !sunset) return { top: '2%', left: '70%' };

  // --- [설정] 여기서 위치 범위를 마음대로 수정하세요 ---
  const xStart = 20;  // 시작 위치 (왼쪽 %) -> 20%
  const xEnd = 80;    // 끝 위치 (오른쪽 %) -> 80%
  const yLow = 10;    // 가장 낮을 때 높이 (일출/일몰 시점) (%) -> 60%
  const yHigh = 2;    // 가장 높을 때 높이 (한낮/자정) (%) -> 5%
  // ---------------------------------------------------

  const now = new Date();
  const currentM = now.getHours() * 60 + now.getMinutes();
  const sunriseM = getMinutes(sunrise);
  const sunsetM = getMinutes(sunset);

  let progress = 0; // 0.0 ~ 1.0 (0% ~ 100%)

  // 낮 시간대 (일출 ~ 일몰)
  if (currentM >= sunriseM && currentM < sunsetM) {
    const totalDay = sunsetM - sunriseM;
    progress = (currentM - sunriseM) / totalDay;
  } 
  // 밤 시간대 (일몰 ~ 다음날 일출)
  else {
    const totalDay = 1440; // 24시간
    let elapsed = 0;
    let totalNight = 0;

    if (currentM >= sunsetM) {
      // 자정 전 (예: 23시)
      elapsed = currentM - sunsetM;
      totalNight = (totalDay - sunsetM) + sunriseM;
    } else {
      // 자정 후 (예: 04시)
      elapsed = (totalDay - sunsetM) + currentM;
      totalNight = (totalDay - sunsetM) + sunriseM;
    }
    progress = elapsed / totalNight;
  }

  // 위치 계산 (호 모양 그리기)
  // 1. X축 계산 (선형 이동: xStart -> xEnd)
  const leftPos = xStart + (progress * (xEnd - xStart));
  
  // 2. Y축 계산 (곡선 이동: 사인파 사용)
  // Math.sin(0) = 0, Math.sin(0.5 * PI) = 1, Math.sin(PI) = 0
  // 즉, 시작과 끝은 yLow, 중간(50%)은 yHigh가 됨
  const heightDiff = yLow - yHigh;
  const topPos = yLow - (Math.sin(progress * Math.PI) * heightDiff);

  return { top: `${topPos}%`, left: `${leftPos}%` };
};

// 배경 아이콘 함수 (위에서 만든 함수 사용)
const getBackgroundIcon = (sky: string, isNight: boolean, sunrise: string, sunset: string) => { // 인자 추가됨
  // 공통 로직 사용
  const { type, Icon } = getWeatherAsset(sky, isNight);

  // 동적 위치 계산
  const pos = calculateCelestialPosition(sunrise, sunset);
  const size = 300;  

  // 움직이는 아이콘 스타일
  const celestialStyle: React.CSSProperties = { 
    position: 'absolute', 
    top: pos.top, 
    left: pos.left, 
    opacity: 0.15, 
    zIndex: 0,
    transition: 'top 1s, left 1s' // 위치 바뀔 때 부드럽게
  };
  // 고정된 아이콘 스타일 (구름, 비 등) - 우측 고정
  const staticStyle: React.CSSProperties = { 
    position: 'absolute', top: '10%', right: '-20px', opacity: 0.15, zIndex: 0 
  };

  switch (type) {
    case 'sun':
      return <motion.div style={celestialStyle} animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 60, ease: "linear" }}><Icon size={size} /></motion.div>;
    case 'moon':
      return <motion.div style={celestialStyle} animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 5 }}><Icon size={size} /></motion.div>;
    
    // 나머지 날씨는 고정 위치 + 배경 애니메이션
    case 'cloud':
      return <motion.div style={staticStyle} animate={{ x: [-10, 10, -10] }} transition={{ repeat: Infinity, duration: 8, ease: "easeInOut" }}><Icon size={size} /></motion.div>;
    case 'rain':
      return <motion.div style={staticStyle} animate={{ y: [0, 20, 0] }} transition={{ repeat: Infinity, duration: 2 }}><Icon size={size} /></motion.div>;
    case 'snow':
      return <motion.div style={staticStyle} animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 30 }}><Icon size={size} /></motion.div>;
    case 'fog':
      return <motion.div style={staticStyle} animate={{ opacity: [0.1, 0.25, 0.1] }} transition={{ repeat: Infinity, duration: 5 }}><Icon size={size} /></motion.div>;
    case 'storm':
      return <motion.div style={staticStyle} animate={{ opacity: [0.15, 0.4, 0.15] }} transition={{ repeat: Infinity, duration: 0.5 }}><Icon size={size} /></motion.div>;
    
    default:
       // 기본 해
       return <motion.div style={celestialStyle} animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 60, ease: "linear" }}><IoSunny size={size} /></motion.div>;
  }
};

const getDetailContent = (id: string, w: WeatherDTO) => {
    switch (id) {
      case 'uv': return { title: '자외선 지수', val: w.uvIndex, desc: '오늘 자외선 수치입니다.', icon: <IoSunny /> };
      case 'sunset': return { title: '일몰', val: w.sunset, desc: `일출 시간은 ${w.sunrise}입니다.`, icon: <IoTime /> };
      case 'wind': return { title: '바람', val: `${w.windSpeed}`, unit: 'm/s', desc: '현재 풍속입니다.', icon: <IoSpeedometer /> };
      case 'rain': return { title: '강수확률', val: `${w.rainChance}`, unit: '%', desc: '오늘 예상 강수확률입니다.', icon: <IoUmbrella /> };
      case 'feels': return { title: '체감 온도', val: `${Math.round(w.feelsLike)}`, unit: '°', desc: '바람에 따라 달라집니다.', icon: <IoThermometer /> };
      case 'humid': return { title: '습도', val: `${w.humidity}`, unit: '%', desc: '현재 습도입니다.', icon: <IoWater /> };
      case 'pressure': return { title: '기압', val: `${Math.round(w.pressure)}`, unit: 'hPa', desc: '현재 대기압입니다.', icon: <IoSpeedometer /> };
      case 'visibility': return { title: '가시거리', val: '24', unit: 'km', desc: '가시거리가 좋습니다.', icon: <WiCloudy /> };
      default: return null;
    }
  };

export default function WeatherDetail() {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragConstraint, setDragConstraint] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // 1. [변경] 전역 위치 정보 구독 (Context 사용)
  const { lat, lon, loading: locLoading } = useUserLocation();
  // 2. [변경] 해당 위치로 날씨 데이터 조회 (Hook 사용)
  const { weather, loading: weatherLoading } = useWeather(lat, lon);
  // 3. [변경] UI 표시용 데이터 가공 (Hook 사용 - 중복 로직 제거됨!)
  // 기존에는 useMemo로 직접 구현했던 부분을 훅 한 줄로 대체
  const { isCurrentNight, processedHourly } = useWeatherFormatter(weather, 24); // 상세페이지니까 24개 보여줌

  // 스크롤 제약 계산 (기존 로직 유지)
  useEffect(() => {
    if (processedHourly.length > 0 && scrollRef.current) {
      const width = scrollRef.current.scrollWidth - scrollRef.current.offsetWidth;
      setDragConstraint(-width - 20);
    }
  }, [processedHourly]);

  if (locLoading || weatherLoading || !weather) return <div style={{ background: '#000', height: '100vh', color: '#fff', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>Loading...</div>;

  const selectedContent = selectedId ? getDetailContent(selectedId, weather) : null;
  const weeklyMin = Math.min(...weather.weeklyForecast.map(d => d.minTemp));
  const weeklyMax = Math.max(...weather.weeklyForecast.map(d => d.maxTemp));

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}
      style={{
        minHeight: '100vh',
        background: getDynamicBackground(weather.currentSky, isCurrentNight),
        color: 'white', padding: '20px', fontFamily: '-apple-system, sans-serif',
        position: 'relative', overflow: 'hidden'
      }}
    >
      {/* 배경 애니메이션 */}
      {getBackgroundIcon(weather.currentSky, isCurrentNight, weather.sunrise, weather.sunset)}

      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px', cursor: 'pointer', position: 'relative', zIndex: 10 }} onClick={() => navigate(-1)}>
        <IoIosArrowBack size={24} /> <span style={{ fontSize: '16px', marginLeft: 5 }}>뒤로가기</span>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', paddingBottom: '40px', position: 'relative', zIndex: 10 }}>
        
        {/* 메인 정보 */}
        <div style={{ textAlign: 'center', marginTop: '10px', marginBottom: '30px' }}>
          <h2 style={{ fontSize: '32px', fontWeight: 500, margin: 0, textShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>{weather.location}</h2>
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 100 }}
            style={{ fontSize: '96px', fontWeight: 200, margin: '0' }}
          >
            {Math.round(weather.currentTemp)}°
          </motion.div>
          <div style={{ fontSize: '20px', fontWeight: 500 }}>{weather.currentSky}</div>
          <div style={{ fontSize: '18px', fontWeight: 500, marginTop: '5px' }}>
             최고:{Math.round(weather.weeklyForecast[0]?.maxTemp)}°  최저:{Math.round(weather.weeklyForecast[0]?.minTemp)}°
          </div>
        </div>

        {/* 2. 시간대별 예보 */}
        <div style={containerStyle}>
          <div style={headerStyle}>🕒 시간대별 예보</div>
          <motion.div
            ref={scrollRef} drag="x" dragConstraints={{ right: 0, left: dragConstraint }}
            style={{ display: 'flex', gap: '25px', cursor: 'grab', paddingBottom: '10px' }}
          >
            {processedHourly.map((hour, idx) => (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '55px' }}>
                <span style={{ fontSize: '14px', marginBottom: '8px', fontWeight: 500 }}>
                    {hour.time}
                </span>
                <div style={{ marginBottom: '8px' }}>
                    {getIcon(hour.sky, 30, hour.isNight)}
                </div>
                <span style={{ fontSize: '16px', fontWeight: 'bold' }}>
                    {hour.type === 'special' ? hour.sky : `${Math.round(hour.temp)}°`}
                </span>
              </div>
            ))}
          </motion.div>
        </div>

        {/* 3. 주간 예보 */}
        <div style={containerStyle}>
          <div style={headerStyle}>📅 7일간의 예보</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {weather.weeklyForecast.map((day, idx) => {
              const date = new Date(day.date);
              const dayName = idx === 0 ? '오늘' : date.toLocaleDateString('ko-KR', { weekday: 'short' });
              const totalRange = weeklyMax - weeklyMin;
              const leftPos = ((day.minTemp - weeklyMin) / totalRange) * 100;
              const widthLen = ((day.maxTemp - day.minTemp) / totalRange) * 100;

              return (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', fontSize: '16px', height: '35px' }}>
                  <div style={{ width: '50px', fontWeight: 600 }}>{dayName}</div>
                  <div style={{ width: '40px', textAlign: 'center' }}>{getIcon(day.sky, 24, false)}</div>
                  <div style={{ width: '40px', fontSize: '12px', color: '#73d2de', fontWeight: 'bold', textAlign: 'left' }}>
                    {day.rainChance > 0 ? `${day.rainChance}%` : ''}
                  </div>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ opacity: 0.8, width: '30px', textAlign: 'right', fontWeight: 500 }}>{Math.round(day.minTemp)}°</span>
                    <div style={{ flex: 1, height: '4px', background: 'rgba(0,0,0,0.2)', borderRadius: '2px', position: 'relative' }}>
                      <div style={{
                        position: 'absolute', left: `${leftPos}%`, width: `${widthLen}%`, height: '100%',
                        background: 'linear-gradient(90deg, #89f7fe 0%, #66a6ff 100%)', borderRadius: '2px', minWidth: '5px'
                      }}></div>
                    </div>
                    <span style={{ fontWeight: 600, width: '30px', textAlign: 'left' }}>{Math.round(day.maxTemp)}°</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 4. 상세 그리드 & 팝업 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <DetailBox id="uv" title="자외선 지수" icon={<IoSunny />} value={weather.uvIndex} desc={weather.uvIndex > 5 ? "높음" : "낮음"} onClick={setSelectedId} />
          <DetailBox id="sunset" title="일몰" icon={<IoTime />} value={weather.sunset} desc={`일출: ${weather.sunrise}`} onClick={setSelectedId} />
          <DetailBox id="wind" title="바람" icon={<IoSpeedometer />} value={`${weather.windSpeed}`} unit="m/s" desc="바람이 다소 붑니다" onClick={setSelectedId} />
          <DetailBox id="rain" title="강수확률" icon={<IoUmbrella />} value={`${weather.rainChance}`} unit="%" desc="오늘 예상 확률" onClick={setSelectedId} />
          <DetailBox id="feels" title="체감 온도" icon={<IoThermometer />} value={`${Math.round(weather.feelsLike)}`} unit="°" desc="실제와 비슷" onClick={setSelectedId} />
          <DetailBox id="humid" title="습도" icon={<IoWater />} value={`${weather.humidity}`} unit="%" desc={`이슬점: ${Math.round(weather.currentTemp - (100 - weather.humidity) / 5)}°`} onClick={setSelectedId} />
          <DetailBox id="pressure" title="기압" icon={<IoSpeedometer />} value={`${Math.round(weather.pressure)}`} unit="hPa" desc="안정적" onClick={setSelectedId} />
          <DetailBox id="visibility" title="가시거리" icon={<WiCloudy />} value="24" unit="km" desc="매우 좋음" onClick={setSelectedId} />
        </div>
      </div>

      <AnimatePresence>
        {selectedId && selectedContent && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedId(null)}
              style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', zIndex: 99 }}
            />
            <motion.div
              layoutId={selectedId}
              style={{
                position: 'fixed', top: '50%', left: '50%', x: '-50%', y: '-50%',
                width: '300px', height: '300px', background: 'rgba(30, 30, 40, 0.95)', backdropFilter: 'blur(30px)',
                borderRadius: '24px', padding: '25px', zIndex: 100, color: 'white',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 20px 40px rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.1)'
              }}
            >
              <div onClick={() => setSelectedId(null)} style={{ position: 'absolute', top: 20, right: 20, cursor: 'pointer' }}>
                <IoMdClose size={28} />
              </div>
              <div style={{ fontSize: '16px', opacity: 0.8, marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {selectedContent.icon} {selectedContent.title}
              </div>
              <div style={{ fontSize: '56px', fontWeight: 'bold', marginBottom: '20px' }}>
                {selectedContent.val} <span style={{ fontSize: '30px', opacity: 0.6 }}>{selectedContent.unit}</span>
              </div>
              <div style={{ textAlign: 'center', lineHeight: '1.6', fontSize: '16px', opacity: 0.9 }}>
                {selectedContent.desc}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}