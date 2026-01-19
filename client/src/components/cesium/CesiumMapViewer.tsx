import { Cartesian3, Viewer as CesiumViewer, Color, UrlTemplateImageryProvider } from 'cesium';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Entity, ImageryLayer, Viewer, type CesiumComponentRef } from 'resium';
import { useCesiumCamera } from '../../contexts/CesiumCameraContext';

const OWM_API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY || 'ca34851ee681091796cf6afb5e3a27ce';

// 외부에서 주입받을 Props (스타일, 추가 UI 등)
interface CesiumMapViewerProps {
  children?: React.ReactNode; // 버튼 같은 추가 UI
  full?: boolean; // 전체 화면 모드 여부
}

export const CesiumMapViewer: React.FC<CesiumMapViewerProps> = ({ children, full = false }) => {
  // 뷰어 인스턴스를 담을 Ref (리렌더링 유발 안 함)
  const viewerRef = useRef<CesiumViewer | null>(null);
  const { saveCameraView, restoreCameraView, cameraView } = useCesiumCamera();

  // 이벤트 핸들러를 미리 정의 (Cleanup에서 제거하기 위함)
  const handleMoveEnd = useCallback(() => {
    const viewer = viewerRef.current;
    if (viewer && !viewer.isDestroyed()) {
      saveCameraView(viewer);
    }
  }, [saveCameraView]);

  // Ref Callback으로 초기화 로직 이동 (onReady 대체)
  // 이 함수는 뷰어가 DOM에 붙을 때 딱 한 번 실행됩니다.
  const initViewer = useCallback(
    (ref: CesiumComponentRef<CesiumViewer> | null) => {
      if (ref?.cesiumElement) {
        const viewer = ref.cesiumElement;
        viewerRef.current = viewer; // Ref에 저장 (상태 업데이트 아님)

        try {
          // 1. 카메라 위치 복구
          if (cameraView.current) {
            restoreCameraView(viewer);
          } else {
            viewer.camera.setView({
              destination: Cartesian3.fromDegrees(126.978, 37.5665, 20000000),
            });
          }

          // 2. 이벤트 리스너 등록 (중복 방지 위해 먼저 제거 시도)
          viewer.camera.moveEnd.removeEventListener(handleMoveEnd);
          viewer.camera.moveEnd.addEventListener(handleMoveEnd);
        } catch (e) {
          console.warn('Viewer Init Error:', e);
        }
      } else {
        // 언마운트 시: Ref 비우기
        // (Cesium이 파괴되면서 리스너도 날아가므로 별도 해제 불필요)
        viewerRef.current = null;
      }
    },
    [cameraView, restoreCameraView, handleMoveEnd]
  );

  // [추가] 컴포넌트가 사라질 때 리스너를 확실하게 제거 (안전장치)
  useEffect(() => {
    return () => {
      const viewer = viewerRef.current;
      if (viewer && !viewer.isDestroyed()) {
        viewer.camera.moveEnd.removeEventListener(handleMoveEnd);
      }
    };
  }, [handleMoveEnd]);

  // 구름 레이어 설정
  const cloudProvider = useMemo(() => {
    if (!OWM_API_KEY) return null;
    return new UrlTemplateImageryProvider({
      url: `https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${OWM_API_KEY}`,
      maximumLevel: 5
    });
  }, []);

  // 마커 데이터 (서울, 뉴욕)
  const landmarks = [
    { name: "Seoul", lon: 126.9780, lat: 37.5665, color: Color.RED },
    { name: "New York", lon: -74.0060, lat: 40.7128, color: Color.BLUE },
  ];

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      
      {/* API 키 경고 */}
      {!OWM_API_KEY && (
        <div style={{ 
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', 
          backgroundColor: 'rgba(0,0,0,0.7)', color: '#fff', zIndex: 10,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' 
        }}>
          <p>API Key Required</p>
        </div>
      )}

      {/* 외부에서 주입된 버튼(상세보기 등) 렌더링 */}
      {children}

      <Viewer
        ref={initViewer} // Ref Callback으로 초기화
        full={full} // 전체화면 모드 전달
        timeline={false}
        animation={false}
        baseLayerPicker={full}
        geocoder={full}
        homeButton={full}
        infoBox={full} // 정보 박스 비활성화 (클릭 시 멈춤 방지)
        navigationHelpButton={full}
        sceneModePicker={full}
        selectionIndicator={full} // 선택 표시기 비활성화
        fullscreenButton={false}
        creditContainer={document.createElement("div")} // 로고 숨김
      >
        {cloudProvider && <ImageryLayer imageryProvider={cloudProvider} alpha={0.8} />}
        
        {landmarks.map((mark, idx) => (
          <Entity
            key={idx}
            name={mark.name}
            description={`
              <div style="padding: 10px; color: black;">
                <h3>${mark.name}</h3>
                <p>Latitude: ${mark.lat}</p>
                <p>Longitude: ${mark.lon}</p>
              </div>
            `}
            // [정석 해결] 고도 0 (지표면) 유지
            position={Cartesian3.fromDegrees(mark.lon, mark.lat, 0)}
            point={{ 
              pixelSize: 15, 
              color: mark.color,
            }}
          />
        ))}
      </Viewer>
    </div>
  );
};