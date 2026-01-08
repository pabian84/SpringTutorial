export interface HourlyData {
  time: string;
  temp: number;
  sky: string;
  type?: string; 
  isNight?: boolean;
}

export interface DailyData {
  date: string;
  maxTemp: number;
  minTemp: number;
  sky: string;
  rainChance: number;
}

export interface WeatherData {
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