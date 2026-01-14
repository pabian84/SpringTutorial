import { useQuery } from '@tanstack/react-query'; // 임포트 필수
import axios from 'axios';
import type { WeatherDTO } from '../types/dtos';

// 이제 위치 정보는 밖에서 받아옵니다. (위치 추적 로직 삭제됨)
export const useWeather = (lat: number | null, lon: number | null) => {
  const { data: weather, isLoading, error } = useQuery({
    queryKey: ['weather', lat, lon], // 좌표가 바뀌면 캐시 갱신
    queryFn: async () => {
      if (!lat || !lon) return null; 
      const res = await axios.get<WeatherDTO>(`/api/weather?lat=${lat}&lon=${lon}`);
      return res.data;
    },
    enabled: !!lat && !!lon, // 좌표가 있을 때만 실행
    staleTime: 1000 * 60 * 30, // [핵심] 30분간 캐시 유지 (서버 요청 안 함 -> 즉시 로딩)
    gcTime: 1000 * 60 * 60, // 1시간 뒤 메모리 해제
    retry: 1,
  });

  return { 
    weather: weather || null, 
    // 좌표가 있는데 로딩 중일 때만 로딩 상태로 인식
    loading: isLoading && !!lat && !!lon, 
    error: error ? '날씨 정보를 가져오는데 실패했습니다.' : null 
  };
};