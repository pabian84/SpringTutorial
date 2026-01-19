import React, { useEffect, useRef, useState } from 'react';
import { UserLocationContext, type LocationState } from './UserLocationContext';

// [유틸] 캐시된 위치 가져오기 (내부 사용)
const getCachedLocation = () => {
  try {
    const lat = localStorage.getItem('my_lat');
    const lon = localStorage.getItem('my_lon');
    if (lat && lon) {
      return { lat: parseFloat(lat), lon: parseFloat(lon) };
    }
  } catch (e) {
    console.error("Local Storage Error", e);
  }
  return null;
};

// [유틸] 거리 계산 함수 (내부 사용, export 안함)
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; 
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Provider 컴포넌트
export const UserLocationProvider = ({ children }: { children: React.ReactNode }) => {
  
  // 1. 초기화 시점에 GPS 지원 여부와 캐시를 모두 확인 (렌더링 충돌 방지 정석)
  const [location, setLocation] = useState<LocationState>(() => {
    // GPS 미지원 체크
    if (!navigator.geolocation) {
      return { lat: null, lon: null, loading: false, error: 'GPS 미지원 브라우저' };
    }

    // 캐시 확인 (있으면 로딩 없이 바로 표시)
    const cached = getCachedLocation();
    if (cached) {
      return { lat: cached.lat, lon: cached.lon, loading: false, error: null };
    }

    // 기본값 (로딩중)
    return { lat: null, lon: null, loading: true, error: null };
  });

  // Ref 초기화 (중복 업데이트 방지용)
  const lastCoords = useRef<{ lat: number; lon: number } | null>(getCachedLocation());

  useEffect(() => {
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const newLat = pos.coords.latitude;
        const newLon = pos.coords.longitude;

        // 1km 이내 이동 시 업데이트 스킵 (성능 최적화)
        if (lastCoords.current) {
            const dist = getDistanceFromLatLonInKm(lastCoords.current.lat, lastCoords.current.lon, newLat, newLon);
            if (dist < 1.0) return; 
        }

        console.log("📍 [Context] 전역 위치 업데이트됨:", newLat, newLon);
        
        // 상태 및 캐시 업데이트
        lastCoords.current = { lat: newLat, lon: newLon };
        localStorage.setItem('my_lat', newLat.toString());
        localStorage.setItem('my_lon', newLon.toString());

        setLocation({ lat: newLat, lon: newLon, loading: false, error: null });
      },
      (err) => {
        console.error("GPS Error:", err);
        // 캐시 데이터가 없는데 에러가 난 경우에만 상태 업데이트
        if (!lastCoords.current) {
             setLocation(prev => ({ ...prev, loading: false, error: '위치 정보 수신 실패' }));
        }
      },
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  return (
    <UserLocationContext.Provider value={location}>
      {children}
    </UserLocationContext.Provider>
  );
};