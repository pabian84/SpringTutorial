import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import type {  WeatherData } from '../types/weather';

// 이제 위치 정보는 밖에서 받아옵니다. (위치 추적 로직 삭제됨)
export const useWeather = (lat: number | null, lon: number | null) => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  // [변경] 초기값 false. API 호출 시작할 때 true로 변환됨.
  // 이렇게 해야 좌표가 없을 때 무한 로딩 상태에 빠지는 논리적 모순을 방지함.
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // API 호출 함수
  const fetchAPI = useCallback(async (latitude: number, longitude: number) => {
    try {
      setLoading(true); 
      setError(null);
      // 실버 API 호출
      const url = `http://localhost:8080/api/weather?lat=${latitude}&lon=${longitude}`;
      const res = await axios.get<WeatherData>(url);
      setWeather(res.data);
      setError(null);
    } catch (e) {
      console.error(e);
      setError('날씨 정보를 가져오는데 실패했습니다.');
    } finally {
      setLoading(false); 
    }
  }, []);

  // 좌표가 들어오면 자동으로 날씨 갱신
  useEffect(() => {
    if (lat && lon) {
      fetchAPI(lat, lon);
    }
  }, [lat, lon, fetchAPI]);

  return { weather, loading, error };
};