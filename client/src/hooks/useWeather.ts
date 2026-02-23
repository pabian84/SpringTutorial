import { useQuery } from '@tanstack/react-query';
import { weatherApi } from '../api/widgetApi';

export const useWeather = (lat: number | null, lon: number | null, hourlyLimit: number = 26, includeWeekly: boolean = true) => {
  const { data: weather, isLoading, error } = useQuery({
    queryKey: ['weather', lat, lon], // 좌표가 바뀌면 캐시 갱신
    queryFn: async () => {
      if (!lat || !lon) return null;
      return await weatherApi.getWeather(lat, lon, hourlyLimit, includeWeekly);
    },
    enabled: !!lat && !!lon, // 좌표가 있을 때만 실행
    staleTime: 1000 * 60 * 30, // 30분간 캐시 유지 (서버 요청 안 함 -> 즉시 로딩)
    gcTime: 1000 * 60 * 60, // 1시간 뒤 메모리 해제
    retry: false, // 401 처리는 axiosConfig에 위임
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });

  return { 
    weather: weather || null, 
    // 좌표가 있는데 로딩 중일 때만 로딩 상태로 인식
    loading: isLoading && !!lat && !!lon, 
    error: error ? '날씨 정보를 가져오는데 실패했습니다.' : null 
  };
};