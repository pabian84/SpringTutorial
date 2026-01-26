import { Cartesian3, Viewer as CesiumViewer, Color, createWorldTerrainAsync, HeightReference, Ion, IonResource, TerrainProvider, UrlTemplateImageryProvider } from 'cesium';
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { BiTargetLock } from 'react-icons/bi';
import { Cesium3DTileset, Entity, ImageryLayer, Viewer, type CesiumComponentRef } from 'resium';
import { useCesiumCamera, WidgetContext } from '../../contexts/CesiumCameraContext';
import { useUserLocation } from '../../contexts/UserLocationContext';
import { showToast } from '../../utils/Alert';

const OWM_API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY || 'ca34851ee681091796cf6afb5e3a27ce';
// Cesium ion 토큰 설정 (여기에 발급받은 토큰을 넣으세요)
const CESIUM_ION_TOKEN = import.meta.env.VITE_CESIUM_ION_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI4ZTQzMzc3Ni0zYTVmLTQ4ZDUtYmJhMi0xMmYzNzQyMzdmMDUiLCJpZCI6MzgwNjA2LCJpYXQiOjE3Njg4MDc5Mzh9.sqQVp50vQ01IfXdySVphwXLdeFT9lNugtec-ux_Fkyo';
// 토큰 적용
Ion.defaultAccessToken = CESIUM_ION_TOKEN;

// 외부에서 주입받을 Props (스타일, 추가 UI 등)
interface CesiumMapViewerProps {
  children?: React.ReactNode; // 버튼 같은 추가 UI
  full?: boolean; // 전체 화면 모드 여부
}

export const CesiumMapViewer: React.FC<CesiumMapViewerProps> = ({ children, full = false }) => {
  // 뷰어 인스턴스를 담을 Ref (리렌더링 유발 안 함)
  const viewerRef = useRef<CesiumViewer | null>(null);
  const { saveCameraView, restoreCameraView, cameraView } = useCesiumCamera();
  const { lat: userLat, lon: userLon } = useUserLocation(); // 내 위치 정보 가져오기
  const hasFlownToUser = useRef(false); // 초기 자동 이동 여부 체크
  const { isAnimating } = useContext(WidgetContext);
  // 로딩 상태 관리
  const [isLoaded, setIsLoaded] = useState(false);

  // 리소스 상태 (병렬 로딩 결과 저장용)
  const [terrainProvider, setTerrainProvider] = useState<TerrainProvider | undefined>(undefined);
  const [buildingResource, setBuildingResource] = useState<IonResource | null>(null);
  const [cloudProvider, setCloudProvider] = useState<UrlTemplateImageryProvider | null>(null);

  // creditContainer를 메모제이션하여 뷰어 재생성(파괴) 방지
  const creditContainer = useMemo(() => document.createElement("div"), []);

  // 랜드마크: 내 위치 + 서울 (원본 로직 복구)
  const landmarks = useMemo(() => {
    const list = [
      { name: "Seoul", lon: 126.9780, lat: 37.5665, color: Color.RED },
    ];
    // 내 위치가 있으면 추가
    if (userLat !== null && userLon !== null) {
      list.unshift({ name: "My Location",  lon: userLon,  lat: userLat,  color: Color.CORNFLOWERBLUE });
    }
    return list;
  }, [userLat, userLon]);

  // 리소스 병렬 로딩 (Promise.all 적용)
  useEffect(() => {
    let isMounted = true;

    const loadResources = async () => {
      try {
        // [핵심] 지형, 건물, 구름을 동시에 로드하여 속도 향상 및 덜컥거림 방지
        const [terrain, buildings, clouds] = await Promise.all([
          createWorldTerrainAsync({
            requestWaterMask: true,
            requestVertexNormals: true
          }),
          IonResource.fromAssetId(96188),
          new UrlTemplateImageryProvider({
            url: `https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${OWM_API_KEY}`,
            maximumLevel: 5
          })
        ]);

        if (!isMounted) return;

        // 상태 일괄 업데이트
        setTerrainProvider(terrain);
        setBuildingResource(buildings);
        setCloudProvider(clouds);
        
        // [중요] 뷰어 엔진에 지형 직접 주입 (이게 없으면 지형 로드 안됨)
        if (viewerRef.current && !viewerRef.current.isDestroyed()) {
          viewerRef.current.scene.terrainProvider = terrain;
          console.log("✅ 뷰어에 지형 강제 주입 완료");
        }

        // [추가] 자연스러운 전환 (안정화 대기 후 로딩 해제)
        setTimeout(() => {
          if (isMounted) setIsLoaded(true);
        }, 1200);

      } catch (e) {
        console.warn("리소스 로드 실패:", e);
        // 에러가 나더라도 화면은 보여줘야 함
        if (isMounted) setIsLoaded(true);
      }
    };

    loadResources();

    return () => {
      isMounted = false;
    }
  }, []);

  // 이벤트 핸들러를 미리 정의 (Cleanup에서 제거하기 위함)
  const handleMoveEnd = useCallback(() => {
    const viewer = viewerRef.current;
    if (viewer && !viewer.isDestroyed()) {
      saveCameraView(viewer);
    }
  }, [saveCameraView]);

  // 내 위치로 이동하는 공통 함수 (버튼 및 홈 버튼용) - [복구]
  const flyToUser = useCallback(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    
    if (userLat !== null && userLon !== null) {
      viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(userLon, userLat, 3000),
        duration: 1,
      });
    } else {
      showToast("위치 정보를 불러오는 중입니다.");
    }
  }, [userLat, userLon]);

  // Ref Callback으로 초기화 로직 (onReady 대체)
  const initViewer = useCallback(
    (ref: CesiumComponentRef<CesiumViewer> | null) => {
      if (ref?.cesiumElement) {
        const viewer = ref.cesiumElement;
        viewerRef.current = viewer; 

        try {
          // 지형에 파묻힘 방지
          viewer.scene.globe.depthTestAgainstTerrain = false;

          // 홈 버튼 동작 오버라이딩 (내 위치로 이동)
          if (viewer.camera) {
            viewer.camera.flyHome = (duration) => {
              if (userLat !== null && userLon !== null) {
                viewer.camera.flyTo({
                  destination: Cartesian3.fromDegrees(userLon, userLat, 3000),
                  duration: duration
                });
              } else {
                console.warn("Home location not ready yet");
              }
            };
          }

          // 홈 버튼 리스너 등록
          if (viewer.homeButton) {
            const viewModel = viewer.homeButton.viewModel;
            if (viewModel.command.beforeExecute) {
               viewModel.command.beforeExecute.addEventListener((e) => {
                  e.cancel = true; 
                  flyToUser();  
               });
            }
          }

          // 카메라 위치 복구 또는 초기 이동
          if (cameraView.current) {
            restoreCameraView(viewer);
            hasFlownToUser.current = true; 
          } else if (userLat && userLon) {
            flyToUser();
            hasFlownToUser.current = true;
          } else {
            // 기본 위치 (서울)
            viewer.camera.setView({
              destination: Cartesian3.fromDegrees(126.978, 37.5665, 20000000),
            });
          }

          // 이동 종료 이벤트 등록
          viewer.camera.moveEnd.removeEventListener(handleMoveEnd);
          viewer.camera.moveEnd.addEventListener(handleMoveEnd);

          console.log("Viewer Init Success");
        } catch (e) {
          console.warn('Viewer Init Error:', e);
        }
      } else {
        viewerRef.current = null;
      }
    },
    [cameraView, restoreCameraView, handleMoveEnd, userLat, userLon, flyToUser]
  );

  // 위치 정보 로드 시 자동 이동 (초기 1회)
  useEffect(() => {
    const viewer = viewerRef.current;
    if (viewer && !viewer.isDestroyed() && userLat !== null && userLon !== null) {
      if (!cameraView.current && !hasFlownToUser.current) {
        flyToUser();
        hasFlownToUser.current = true;
      }
    }
  }, [userLat, userLon, cameraView, flyToUser]);

  // Home 버튼 동작 갱신
  useEffect(() => {
    const viewer = viewerRef.current;
    if (viewer && !viewer.isDestroyed() && userLat !== null && userLon !== null) {
      viewer.camera.flyHome = () => {
        flyToUser();
      };
    }
  }, [userLat, userLon, flyToUser]);

  // 언마운트 시 정리
  useEffect(() => {
    return () => {
      const viewer = viewerRef.current;
      if (viewer && !viewer.isDestroyed()) {
        saveCameraView(viewer);
        viewer.camera.moveEnd.removeEventListener(handleMoveEnd);
      }
    };
  }, [handleMoveEnd, saveCameraView]);

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

      {/* 스켈레톤 UI (로딩 화면) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: '#1e1e1e', // 대시보드 테마와 일치
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 20,
          opacity: isLoaded ? 0 : 1, // 로딩 완료 시 투명화
          transition: 'opacity 0.8s ease-out', // 자연스러운 전환
          pointerEvents: isLoaded ? 'none' : 'auto',
        }}
      >
        <div style={{ color: '#4facfe', fontSize: '16px', fontWeight: 'bold', marginBottom: '15px' }}>
          Loading 3D Earth...
        </div>
        <div style={{
          width: '30px', height: '30px',
          border: '3px solid rgba(255,255,255,0.1)',
          borderTop: '3px solid #4facfe',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>

      {/* 외부 버튼 */}
      {children}

      {/* 내 위치 이동 버튼(로딩 중에는 숨김 처리 추가) */}
      <button
        onClick={flyToUser}
        title="내 위치로 이동"
        style={{
          position: 'absolute',
          bottom: full ? '30px' : '10px',
          right: full ? '30px' : '10px',
          zIndex: 5,
          backgroundColor: '#303030',
          color: 'white',
          border: '1px solid #444',
          borderRadius: '50%',
          width: '40px',
          height: '40px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '20px',
          boxShadow: '0 2px 5px rgba(0,0,0,0.5)',
          // 로딩 중에는 버튼도 숨김
          opacity: isLoaded ? 1 : 0,
          transition: 'opacity 0.8s ease-in',
          pointerEvents: isLoaded ? 'auto' : 'none'
        }}
      >
        <BiTargetLock />
      </button>

      {/* 뷰어 래퍼 (Fade In 효과 추가) */}
      <div style={{ 
        width: '100%', 
        height: '100%', 
        opacity: isLoaded ? 1 : 0, 
        transition: 'opacity 0.8s ease-in' 
      }}>
        {/* 원본 Viewer 속성 및 순서 100% 유지 */}
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
          selectionIndicator={full} // 선택 표시기 활성화
          fullscreenButton={false}
          creditContainer={creditContainer} // 로고 숨김
          terrainProvider={terrainProvider} // 로드된 지형 적용
          requestRenderMode={true}
          maximumRenderTimeChange={Infinity}
          useDefaultRenderLoop={!isAnimating}
        >
          {/* 리소스 로드 완료 후에만 내부 요소 렌더링 (깜빡임 방지) */}
          {isLoaded && terrainProvider && (
            <>
              {/* 구름 */}
              {cloudProvider && <ImageryLayer imageryProvider={cloudProvider} alpha={0.8} />}
              
              {/* 3D 건물 */}
              {buildingResource && (
                <Cesium3DTileset 
                  url={buildingResource}
                  skipLevelOfDetail={true}
                  maximumScreenSpaceError={16}
                />
              )}

              {/* 마커 - [복구] 원본 로직(서울+내위치) 적용 */}
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
                  position={Cartesian3.fromDegrees(mark.lon, mark.lat)}
                  point={{ 
                    pixelSize: 15, 
                    color: mark.color,
                    heightReference: HeightReference.CLAMP_TO_GROUND,
                    disableDepthTestDistance: 2000000,
                  }}
                />
              ))}
            </>
          )}
        </Viewer>
      </div>
    </div>
  );
};