import React, { useEffect, useState, useMemo, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { IoWater, IoMoon, IoSunny } from "react-icons/io5";
import {
  WiDaySunny,
  WiCloudy,
  WiRain,
  WiSnow,
  WiDayCloudy,
  WiFog,
  WiNightClear,
  WiNightAltCloudy,
  WiNightAltRain,
  WiNightAltSnow,
  WiNightAltShowers,
  WiNightAltThunderstorm,
  WiSunrise,
  WiSunset,
  WiThunderstorm,
  WiShowers,
} from "react-icons/wi";
import { motion } from "framer-motion";

// --- 인터페이스 ---
interface HourlyData {
  time: string;
  temp: number;
  sky: string;
  type?: string;
  isNight?: boolean;
}

interface DailyData {
  date: string;
  maxTemp: number;
  minTemp: number;
  sky: string;
  rainChance: number;
}

interface WeatherData {
  location: string;
  currentTemp: number;
  currentSky: string;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  uvIndex: number;
  rainChance: number;
  pressure: number;
  sunrise: string;
  sunset: string;
  hourlyForecast: HourlyData[];
  weeklyForecast: DailyData[];
}

// --- 헬퍼 함수 ---
const getMinutes = (timeStr: string) => {
  if (!timeStr || !timeStr.includes(":")) return 0;
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
};

const checkIsNight = (
  targetTimeStr: string,
  sunrise: string,
  sunset: string
) => {
  if (!targetTimeStr || !sunrise || !sunset) return false;
  let targetM = 0;
  if (targetTimeStr.includes(":")) targetM = getMinutes(targetTimeStr);
  else return false;
  const sunriseM = getMinutes(sunrise);
  const sunsetM = getMinutes(sunset);
  return targetM >= sunsetM || targetM < sunriseM;
};

const getDynamicBackground = (sky: string, isNight: boolean) => {
  if (isNight) {
    if (sky.includes("비") || sky.includes("소나기"))
      return "linear-gradient(180deg, #000000 0%, #434343 100%)";
    if (sky.includes("눈"))
      return "linear-gradient(180deg, #232526 0%, #414345 100%)";
    if (sky.includes("흐림") || sky.includes("구름"))
      return "linear-gradient(180deg, #2c3e50 0%, #3498db 100%)";
    return "linear-gradient(180deg, #0f2027 0%, #203a43 50%, #2c5364 100%)";
  }
  if (sky.includes("맑음"))
    return "linear-gradient(180deg, #5CA0F2 0%, #87CEFA 100%)";
  if (sky.includes("비") || sky.includes("소나기"))
    return "linear-gradient(180deg, #374151 0%, #111827 100%)";
  if (sky.includes("흐림") || sky.includes("구름"))
    return "linear-gradient(180deg, #6b7280 0%, #374151 100%)";
  if (sky.includes("눈"))
    return "linear-gradient(180deg, #9ca3af 0%, #4b5563 100%)";
  if (sky.includes("폭풍우"))
    return "linear-gradient(180deg, #1f2937 0%, #000000 100%)";
  return "linear-gradient(180deg, #5CA0F2 0%, #87CEFA 100%)";
};

const getIcon = (sky: string, size: number, isNight: boolean = false) => {
  const props = { size, color: "#fff" };
  if (sky === "일출")
    return (
      <motion.div
        animate={{ y: [3, -3, 3], opacity: [0.7, 1, 0.7] }}
        transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
      >
        <WiSunrise {...props} color="#FFD700" />
      </motion.div>
    );
  if (sky === "일몰")
    return (
      <motion.div
        animate={{ y: [-3, 3, -3], opacity: [1, 0.7, 1] }}
        transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
      >
        <WiSunset {...props} color="#FFA500" />
      </motion.div>
    );

  if (isNight) {
    if (sky.includes("맑음") || sky === "맑은밤")
      return (
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
        >
          <WiNightClear {...props} />
        </motion.div>
      );
    if (sky.includes("구름조금"))
      return (
        <motion.div
          animate={{ x: [-2, 2, -2] }}
          transition={{ repeat: Infinity, duration: 4 }}
        >
          <WiNightAltCloudy {...props} />
        </motion.div>
      );
    if (sky.includes("비"))
      return (
        <motion.div
          animate={{ y: [0, 5, 0] }}
          transition={{ repeat: Infinity, duration: 1.2 }}
        >
          <WiNightAltRain {...props} />
        </motion.div>
      );
    if (sky.includes("소나기"))
      return (
        <motion.div
          animate={{ y: [0, 5, 0] }}
          transition={{ repeat: Infinity, duration: 0.8 }}
        >
          <WiNightAltShowers {...props} />
        </motion.div>
      );
    if (sky.includes("눈"))
      return (
        <motion.div
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ repeat: Infinity, duration: 3 }}
        >
          <WiNightAltSnow {...props} />
        </motion.div>
      );
    if (sky.includes("폭풍우"))
      return (
        <motion.div
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ repeat: Infinity, duration: 0.5 }}
        >
          <WiNightAltThunderstorm {...props} />
        </motion.div>
      );
    if (sky.includes("흐림") || sky.includes("구름"))
      return (
        <motion.div
          animate={{ x: [-3, 3, -3] }}
          transition={{ repeat: Infinity, duration: 5 }}
        >
          <WiCloudy {...props} />
        </motion.div>
      );
    return <WiNightClear {...props} />;
  }

  if (sky.includes("맑음"))
    return (
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 12, ease: "linear" }}
      >
        <WiDaySunny {...props} />
      </motion.div>
    );
  if (sky.includes("구름조금"))
    return (
      <motion.div
        animate={{ y: [0, -4, 0], scale: [1, 1.05, 1] }}
        transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
      >
        <WiDayCloudy {...props} />
      </motion.div>
    );
  if (sky.includes("흐림") || sky.includes("구름"))
    return (
      <motion.div
        animate={{ x: [-3, 3, -3] }}
        transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
      >
        <WiCloudy {...props} />
      </motion.div>
    );
  if (sky.includes("소나기"))
    return (
      <motion.div
        animate={{ y: [0, 5, 0] }}
        transition={{ repeat: Infinity, duration: 0.8 }}
      >
        <WiShowers {...props} />
      </motion.div>
    );
  if (sky.includes("비"))
    return (
      <motion.div
        animate={{ y: [0, 5, 0] }}
        transition={{ repeat: Infinity, duration: 1.2 }}
      >
        <WiRain {...props} />
      </motion.div>
    );
  if (sky.includes("눈"))
    return (
      <motion.div
        animate={{ rotate: [0, 10, -10, 0], y: [0, 3, 0] }}
        transition={{ repeat: Infinity, duration: 3 }}
      >
        <WiSnow {...props} />
      </motion.div>
    );
  if (sky.includes("안개"))
    return (
      <motion.div
        animate={{ opacity: [0.5, 0.8, 0.5] }}
        transition={{ repeat: Infinity, duration: 4 }}
      >
        <WiFog {...props} />
      </motion.div>
    );
  if (sky.includes("폭풍우"))
    return (
      <motion.div
        animate={{ opacity: [1, 0.5, 1] }}
        transition={{ repeat: Infinity, duration: 0.5 }}
      >
        <WiThunderstorm {...props} />
      </motion.div>
    );

  return <WiDayCloudy {...props} />;
};

const getBackgroundIcon = (sky: string, isNight: boolean) => {
  const style: React.CSSProperties = {
    position: "absolute",
    top: "10%",
    right: "-30px",
    opacity: 0.15,
    zIndex: 0,
  };
  const size = 200;

  if (isNight) {
    if (sky.includes("비") || sky.includes("소나기"))
      return (
        <motion.div
          style={style}
          animate={{ y: [0, 20, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
        >
          <IoWater size={size} />
        </motion.div>
      );
    return (
      <motion.div
        style={style}
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ repeat: Infinity, duration: 5 }}
      >
        <IoMoon size={size} />
      </motion.div>
    );
  }
  if (sky.includes("맑음"))
    return (
      <motion.div
        style={style}
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 60, ease: "linear" }}
      >
        <IoSunny size={size} />
      </motion.div>
    );
  if (sky.includes("비") || sky.includes("소나기"))
    return (
      <motion.div
        style={style}
        animate={{ y: [0, 20, 0] }}
        transition={{ repeat: Infinity, duration: 2 }}
      >
        <IoWater size={size} />
      </motion.div>
    );
  if (sky.includes("눈"))
    return (
      <motion.div
        style={style}
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 30 }}
      >
        <WiSnow size={size} />
      </motion.div>
    );
  return (
    <motion.div
      style={style}
      animate={{ x: [0, 20, 0] }}
      transition={{ repeat: Infinity, duration: 10 }}
    >
      <WiCloudy size={size} />
    </motion.div>
  );
};

// --- 메인 위젯 컴포넌트 ---
export default function WeatherWidget() {
  const navigate = useNavigate();
  const [weather, setWeather] = useState<WeatherData | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(8); // 기본값 8개로 증가

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const url = navigator.geolocation
          ? await new Promise<string>((resolve) => {
            navigator.geolocation.getCurrentPosition(
              (pos) =>
                resolve(
                  `http://localhost:8080/api/weather?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`
                ),
              () => resolve("http://localhost:8080/api/weather")
            );
          })
          : "http://localhost:8080/api/weather";

        const res = await axios.get(url);
        setWeather(res.data);
      } catch (e) {
        console.error(e);
      }
    };
    fetchWeather();
  }, []);

  // [수정] 반응형 개수 조절 로직 수정
  useEffect(() => {
    if (!containerRef.current) return;

    const updateCount = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        // [수정] 아이템 너비 기준을 65 -> 50으로 줄여서 더 촘촘하게 배치
        const itemWidth = 50;
        const count = Math.floor(width / itemWidth);
        // 최소 5개, 최대 12개 정도로 제한
        setVisibleCount(Math.max(5, Math.min(count, 12)));
      }
    };

    updateCount();
    const observer = new ResizeObserver(() => updateCount());
    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, []);

  const isCurrentNight = useMemo(() => {
    if (!weather) return false;
    const now = new Date();
    const h = String(now.getHours()).padStart(2, "0");
    const m = String(now.getMinutes()).padStart(2, "0");
    return checkIsNight(`${h}:${m}`, weather.sunrise, weather.sunset);
  }, [weather]);

  const processedHourly = useMemo(() => {
    if (!weather) return [];

    // 계산된 visibleCount 사용
    const limitedData = weather.hourlyForecast.slice(0, visibleCount);

    return limitedData.map((hour) => {
      if (hour.type === "special") return { ...hour, isNight: false };
      const isNight = checkIsNight(hour.time, weather.sunrise, weather.sunset);
      let displaySky = hour.sky;
      if (isNight && hour.sky === "맑음") displaySky = "맑은밤";
      return { ...hour, sky: displaySky, isNight };
    });
  }, [weather, visibleCount]);

  if (!weather)
    return (
      <div style={{ padding: "20px", color: "#fff" }}>날씨 로딩 중...</div>
    );

  return (
    <motion.div
      onClick={() => navigate("/weather")}
      whileHover={{ scale: 1.01 }}
      style={{
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        background: getDynamicBackground(weather.currentSky, isCurrentNight),
        borderRadius: "24px",
        color: "white",
        padding: "24px",
        fontFamily: "-apple-system, sans-serif",
        position: "relative",
        overflow: "hidden",
        cursor: "pointer",
        boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      {/* 배경 애니메이션 */}
      {getBackgroundIcon(weather.currentSky, isCurrentNight)}

      {/* 1. 상단 정보 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          position: "relative",
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <h3 style={{ fontSize: "18px", fontWeight: 600, margin: 0 }}>
            {weather.location}
          </h3>

          <div
            style={{
              fontSize: "64px",
              fontWeight: 300,
              lineHeight: "1.1",
              marginLeft: "-2px",
            }}
          >
            {Math.round(weather.currentTemp)}°
          </div>

          <div
            style={{
              fontSize: "18px",
              fontWeight: 500,
              opacity: 0.95,
              marginBottom: "2px",
            }}
          >
            {weather.currentSky}
          </div>

          <div style={{ fontSize: "14px", opacity: 0.85 }}>
            최고: {Math.round(weather.weeklyForecast[0]?.maxTemp)}° &nbsp; 최저:{" "}
            {Math.round(weather.weeklyForecast[0]?.minTemp)}°
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            paddingRight: "10px",
          }}
        >
          {getIcon(weather.currentSky, 80, isCurrentNight)}
        </div>
      </div>

      {/* 2. 하단 예보 (자동 개수 조절) */}
      <div
        ref={containerRef}
        style={{
          marginTop: "15px",
          position: "relative",
          zIndex: 10,
          borderTop: "1px solid rgba(255,255,255,0.2)",
          paddingTop: "15px",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        {processedHourly.map((hour, idx) => (
          <div
            key={idx}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              minWidth: "40px",
            }}
          >
            <span
              style={{
                fontSize: "12px",
                marginBottom: "6px",
                fontWeight: 500,
                whiteSpace: "nowrap",
                opacity: 0.9,
              }}
            >
              {hour.type === "special"
                ? hour.time
                : idx === 0
                  ? "지금"
                  : hour.time}
            </span>
            <div style={{ marginBottom: "6px" }}>
              {getIcon(hour.sky, 26, hour.isNight)}
            </div>
            <span style={{ fontSize: "15px", fontWeight: "bold" }}>
              {hour.type === "special" ? hour.sky : `${Math.round(hour.temp)}°`}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
