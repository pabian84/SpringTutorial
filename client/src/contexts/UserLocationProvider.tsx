import React, { useEffect, useRef, useState } from 'react';
import { UserLocationContext, type LocationState } from './UserLocationContext';
import { showToast } from '../utils/Alert';
import { useLocation } from 'react-router-dom';
import { devError, devLog, devWarn } from '../utils/logger';

// [유틸] 캐시된 위치 가져오기 (내부 사용)
const getCachedLocation = () => {
  try {
    const lat = localStorage.getItem('my_lat');
    const lon = localStorage.getItem('my_lon');
    if (lat && lon) {
      return { lat: parseFloat(lat), lon: parseFloat(lon) };
    }
  } catch (e) {
    devError("Local Storage Error", e);
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
  const { pathname } = useLocation(); // 현재 경로 가져오기
  
  // 1. 초기화 시점에 GPS 지원 여부와 캐시를 모두 확인 (렌더링 충돌 방지 정석)
  const [location, setLocation] = useState<LocationState>(() => {
    // 로그인 페이지면 무조건 null 상태로 시작 (권한 체크도 안 함)
    if (pathname === '/') {
      return { lat: null, lon: null, loading: false, error: null };
    }
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
  // 위치 감시 시작
  useEffect(() => {
    const setloca = () => {
      setLocation({ lat: null, lon: null, loading: false, error: 'GPS 미지원' });
    };
    // 1. 로그인 페이지면 중단
    if (pathname === '/') {
      return;
    } 

    // 2. [핵심 해결] 대시보드 진입 시 데이터가 없다면 로딩 상태 강제 적용
    // setTimeout(..., 0)으로 감싸서 렌더링 충돌(Warning)을 원천 차단합니다.
    if (!lastCoords.current) {
      setTimeout(() => {
          setLocation(prev => ({ ...prev, loading: true, error: null }));
      }, 0);
    } else {
      // 이미 데이터가 있으면 로딩 해제 (혹시 모를 상태 동기화)
      setTimeout(() => {
          setLocation(prev => ({ ...prev, loading: false }));
      }, 0);
    }

    // 3. 위치 추적 시작 로직
    if (!navigator.geolocation) {
      setloca();
      return;
    }

    let watchId: number | null = null;

    // 위치 추적 시작 함수
    const startWatching = () => {    
      // 브라우저 기본 권한 처리에 위임
      // 권한이 없으면 브라우저가 자동으로 상단에 허용/차단 팝업을 띄웁니다.
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const newLat = pos.coords.latitude;
          const newLon = pos.coords.longitude;

          // 1km 이내 이동 시 업데이트 스킵 (성능 최적화)
          if (lastCoords.current && location.lat !== null && location.lon !== null) {
            const dist = getDistanceFromLatLonInKm(lastCoords.current.lat, lastCoords.current.lon, newLat, newLon);
            if (dist < 1.0) return; 
          }

          devLog("📍 [Context] 전역 위치 업데이트됨:", newLat, newLon);
          
          // 상태 및 캐시 업데이트
          lastCoords.current = { lat: newLat, lon: newLon };
          localStorage.setItem('my_lat', newLat.toString());
          localStorage.setItem('my_lon', newLon.toString());

          setLocation({ lat: newLat, lon: newLon, loading: false, error: null });
        },
        (err) => {
          devError("GPS Error:", err);
          // 캐시 데이터가 없는데 에러가 난 경우에만 상태 업데이트
          if (!lastCoords.current) {
            setLocation(prev => ({ ...prev, loading: false, error: '위치 정보 수신 실패' }));
          }
        },
        // [옵션] 고정밀도, 타임아웃 30초, 캐시 안씀
        { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
      );
    };

    // [Violation 경고 해결 로직]
    // Permissions API를 사용하여 권한 상태를 먼저 확인합니다.
    // 'granted'(허용됨) 상태일 때만 startWatching을 즉시 호출하여 경고를 방지합니다.
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        // granted(허용됨) 또는 prompt(대기중): 즉시 실행
        // prompt 상태일 때 실행하면 브라우저가 자동으로 권한 요청 팝업을 띄웁니다.
        // (콘솔에 Violation 경고가 뜨지만, 사용자 경험을 위해 감수합니다)
        if (result.state === 'granted') {
          // 이미 허용된 상태 -> 바로 실행 (경고 안 뜸)
          startWatching();
        } else if (result.state === 'denied') {
          showToast('위치 권한이 차단되었습니다', 'error');
          devWarn("⚠️ 위치 권한이 차단되어 있습니다.");
          if (!lastCoords.current) {
            setLocation(prev => ({ ...prev, loading: false, error: '위치 권한이 차단되었습니다.' }));
          }
        } else if (result.state === 'prompt') {
          // 허용되지 않은 상태 -> 실행하지 않음 (경고 방지)
          // 대신 사용자가 브라우저 UI에서 '허용'으로 바꾸는 순간 실행되도록 이벤트를 겁니다.
          devLog("⚠️ 위치 권한 대기 중 (브라우저 주소창에서 허용해주세요)");
          startWatching();
        }

        result.onchange = () => {
          if (result.state === 'granted') {
            devLog("✅ 사용자가 위치 권한을 허용했습니다. 추적 시작.");
            startWatching();
          } else if (result.state === 'denied') {
            devWarn("❌ 사용자가 위치 권한을 거부했습니다.");
            if (!lastCoords.current) {
              setLocation(prev => ({ ...prev, loading: false, error: '위치 권한이 차단되었습니다.' }));
            }
          }
        };
      })
      .catch((error) => {
        // [핵심] HTTP 환경 등에서 Permission API가 실패할 경우 여기로 진입
        devWarn("⚠️ Permissions API 에러 (HTTP 환경일 가능성 높음), 강제 실행 시도:", error);
        // API 확인이 실패해도 startWatching을 실행해야 watchPosition의 에러 콜백이라도 터져서 로딩이 끝남
        startWatching();
      });
    } else {
      // 구형 브라우저 등 Permissions API가 없는 경우 그냥 실행
      startWatching();
    }

    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      };
    };
  }, [pathname, location.lat, location.lon]);

  return (
    <UserLocationContext.Provider value={location}>
      {children}
    </UserLocationContext.Provider>
  );
};
