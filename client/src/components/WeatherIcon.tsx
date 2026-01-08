import React from 'react';
import { motion } from 'framer-motion';
import { getWeatherAsset } from '../utils/WeatherUtils';

interface WeatherIconProps {
  sky: string;
  isNight: boolean;
  size: number;
}

const WeatherIcon: React.FC<WeatherIconProps> = ({ sky, isNight, size }) => {
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

export default WeatherIcon;