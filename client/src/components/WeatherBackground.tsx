import React from 'react';
import { motion } from 'framer-motion';
import { getWeatherAsset, calculateCelestialPosition } from '../utils/WeatherUtils';
import { IoMoon, IoSunny } from 'react-icons/io5';

interface WeatherBackgroundProps {
  sky: string;
  isNight: boolean;
  sunrise: string;
  sunset: string;
}

const WeatherBackground: React.FC<WeatherBackgroundProps> = ({ sky, isNight, sunrise, sunset }) => {
  const { type, Icon } = getWeatherAsset(sky, isNight);
  const pos = calculateCelestialPosition(sunrise, sunset);
  const size = 300; // 배경 아이콘 크기

  const celestialStyle: React.CSSProperties = { 
    position: 'absolute', top: pos.top, left: pos.left, 
    opacity: 0.15, zIndex: 0, transition: 'top 1s, left 1s' 
  };
  const staticStyle: React.CSSProperties = { 
    position: 'absolute', top: '10%', right: '-20px', 
    opacity: 0.15, zIndex: 0 
  };

  // 배경 전용으로 사용할 아이콘 매핑 (getWeatherAsset은 전경용이라 일부 다를 수 있음)
  // 편의상 여기서 일부 직접 매핑하거나, getWeatherAsset을 그대로 쓰되 스타일만 다르게 적용
  
  switch (type) {
    case 'sun':
      return <motion.div style={celestialStyle} animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 60, ease: "linear" }}><IoSunny size={size} /></motion.div>;
    case 'moon':
      return <motion.div style={celestialStyle} animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 5 }}><IoMoon size={size} /></motion.div>;
    
    // 나머지 날씨는 고정 위치
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
       // 기본 해 처리
       return <motion.div style={celestialStyle} animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 60, ease: "linear" }}><IoSunny size={size} /></motion.div>;
  }
};

export default WeatherBackground;