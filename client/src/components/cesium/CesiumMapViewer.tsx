import { Cartesian3, Viewer as CesiumViewer, Color, createWorldTerrainAsync, HeightReference, Ion, IonResource, TerrainProvider, UrlTemplateImageryProvider } from 'cesium';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BiTargetLock } from 'react-icons/bi';
import { Cesium3DTileset, Entity, ImageryLayer, Viewer, type CesiumComponentRef } from 'resium';
import { useCesiumCamera } from '../../contexts/CesiumCameraContext';
import { useUserLocation } from '../../contexts/UserLocationContext';
import { showToast } from '../../utils/alert';

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
  // 지형 프로바이더 상태
  const [terrainProvider, setTerrainProvider] = useState<TerrainProvider | undefined>(undefined);
  // 3D 건물 리소스
  const buildingResource = useMemo(() => IonResource.fromAssetId(96188), []);
  // creditContainer를 메모제이션하여 뷰어 재생성(파괴) 방지
  // 이걸 안 하면 렌더링될 때마다 새로운 div가 생성되어 뷰어가 계속 터집니다.
  const creditContainer = useMemo(() => document.createElement("div"), []);
  // 구름 레이어 설정
  const [cloudProvider] = useState(() => {
    if (!OWM_API_KEY) return null;
    return new UrlTemplateImageryProvider({
      url: `https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${OWM_API_KEY}`,
      maximumLevel: 5
    });
  });
  // 생성 확인 로그
  // Strict Mode 중복 로그 방지용 Ref
  const hasLoggedCloud = useRef(false);
  useEffect(() => {
    if (cloudProvider && !hasLoggedCloud.current) {
      console.log("Cloud Provider Initialized");
      hasLoggedCloud.current = true;
    }
  }, [cloudProvider]);

  // 랜드마크: 내 위치 + 서울
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

  // 지형 로드 (3D 건물을 위해 필수)
  useEffect(() => {
    let isMounted = true;
    const loadTerrain = async () => {
      try {
        const terrain = await createWorldTerrainAsync({
            requestWaterMask: true,
            requestVertexNormals: true
        });
        if (!isMounted) return; // 언마운트 되었으면 중단

        console.log("지형 로드 성공");
        setTerrainProvider(terrain);

        // 리액트 상태 업데이트와 별개로, 뷰어 엔진에 직접 지형을 꽂아넣음
        if (viewerRef.current && !viewerRef.current.isDestroyed()) {
          viewerRef.current.scene.terrainProvider = terrain;
          console.log("✅ 뷰어에 지형 강제 주입 완료");
        }
      } catch (e) {
        console.warn("지형 로드 실패:", e);
      }
    };
    loadTerrain();
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

  // 내 위치로 이동하는 공통 함수 (버튼 및 홈 버튼용)
  const flyToUser = useCallback(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    
    // 타입 가드: null이 아닐 때만 실행
    if (userLat !== null && userLon !== null) {
      viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(userLon, userLat, 3000),
        duration: 1,
      });
    } else {
      showToast("위치 정보를 불러오는 중입니다.");
    }
  }, [userLat, userLon]);

  // Ref Callback으로 초기화 로직 이동 (onReady 대체)
  // 이 함수는 뷰어가 DOM에 붙을 때 딱 한 번 실행됩니다.
  const initViewer = useCallback(
    (ref: CesiumComponentRef<CesiumViewer> | null) => {
      if (ref?.cesiumElement) {
        const viewer = ref.cesiumElement;
        viewerRef.current = viewer; // Ref에 저장 (상태 업데이트 아님)

        try {
          // 지형에 파묻힘 방지 (마커가 땅속에 있어도 보이게 함)
          viewer.scene.globe.depthTestAgainstTerrain = false;

          // [핵심 수정] 홈 버튼의 동작을 근본적으로 교체 (Override)
          // 이벤트 리스너 방식이 아니라, 홈 버튼이 호출하는 함수 자체를 덮어씁니다.
          // 이것이 Cesium에서 홈 동작을 바꾸는 가장 확실한 정석(Global Override)입니다.
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

          // [핵심 수정] 홈 버튼 오버라이딩을 initViewer 내부로 이동
          // 뷰어가 생성되자마자 리스너를 붙여야 동작이 확실합니다.
          if (viewer.homeButton) {
            const viewModel = viewer.homeButton.viewModel;
            // 기존 리스너가 있다면 정리 (안전장치)
            if (viewModel.command.beforeExecute) {
               // beforeExecute에 직접 함수를 연결하여 가로챕니다.
               viewModel.command.beforeExecute.addEventListener((e) => {
                  e.cancel = true; // 기본 동작(북미 이동) 취소
                  flyToUser();  // 내 위치로 이동
               });
            }
          }

          // 1. 카메라 위치 복구
          // 카드 <-> 확장 전환 시 여기서 저장된 위치를 즉시 복구하여 끊김 없는 경험 제공
          if (cameraView.current) {
            restoreCameraView(viewer);
            hasFlownToUser.current = true; // 저장된 뷰가 있으면 자동 이동 스킵
          } else if (userLat && userLon) {
            // 초기화 시점에 이미 내 위치가 있으면 바로 이동
            flyToUser();
            hasFlownToUser.current = true;
          } else {
            // 위치 로딩 전 기본값 (서울)
            viewer.camera.setView({
              destination: Cartesian3.fromDegrees(126.978, 37.5665, 20000000),
            });
          }

          // 이벤트 리스너 등록 (중복 방지 위해 먼저 제거 시도)
          viewer.camera.moveEnd.removeEventListener(handleMoveEnd);
          viewer.camera.moveEnd.addEventListener(handleMoveEnd);

          console.log("Viewer Init Success");
        } catch (e) {
          console.warn('Viewer Init Error:', e);
        }
      } else {
        // 언마운트 시: Ref 비우기
        // (Cesium이 파괴되면서 리스너도 날아가므로 별도 해제 불필요)
        viewerRef.current = null;
      }
    },
    [cameraView, restoreCameraView, handleMoveEnd, userLat, userLon, flyToUser]
  );

  // 위치 정보가 나중에 로드되었을 때 자동으로 이동 (초기 1회, 위치 정보가 늦게 들어올 경우 대비)
  useEffect(() => {
    const viewer = viewerRef.current;
    if (viewer && !viewer.isDestroyed() && userLat !== null && userLon !== null) {
      // 저장된 뷰가 없고, 아직 이동한 적이 없다면 내 위치로 비행
      if (!cameraView.current && !hasFlownToUser.current) {
        flyToUser();
        hasFlownToUser.current = true;
      }
    }
  }, [userLat, userLon, cameraView, flyToUser]);

  // Home 버튼 클릭 시 '내 위치'로 돌아오도록 동작 오버라이딩
  useEffect(() => {
    const viewer = viewerRef.current;
    if (viewer && !viewer.isDestroyed() && userLat !== null && userLon !== null) {
      // 위치 정보가 업데이트되면 flyHome 함수도 최신 좌표를 쓰도록 갱신
      viewer.camera.flyHome = () => {
        flyToUser();
      };
    }
  }, [userLat, userLon, flyToUser]); // 위치가 바뀌면 홈 버튼 동작도 갱신

  // 컴포넌트가 사라질 때 리스너를 확실하게 제거 (안전장치)
  useEffect(() => {
    return () => {
      const viewer = viewerRef.current;
      if (viewer && !viewer.isDestroyed()) {
        // [UX 개선] 컴포넌트가 Unmount 될 때(카드 -> 확장 전환 시) 현재 카메라 위치를 강제로 저장
        // 이렇게 해야 다시 Mount 될 때 initViewer에서 restoreCameraView가 정확한 최신 위치를 잡습니다.
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

      {/* 외부에서 주입된 버튼(상세보기 등) 렌더링 */}
      {children}

      {/* 내 위치 이동 버튼(홈 버튼 대체) */}
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
          boxShadow: '0 2px 5px rgba(0,0,0,0.5)'
        }}
      >
        <BiTargetLock />
      </button>
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
        creditContainer={creditContainer} // 로고 숨김
        terrainProvider={terrainProvider}
        requestRenderMode={true}
        maximumRenderTimeChange={ Infinity }
      >
        {/* 3. 순차 로드 구현: terrainProvider가 있을 때만 아래 요소들을 렌더링함 */}
        {terrainProvider && (
          <>
            {/* 구름 */}
            {cloudProvider && <ImageryLayer imageryProvider={cloudProvider} alpha={0.8} />}
            
            {/* 3D 건물 */}
            <Cesium3DTileset url={buildingResource}
              skipLevelOfDetail={true}     // 뷰에 안 보이는 디테일 건너뜀 (로딩 속도 향상)
              maximumScreenSpaceError={16}
             />

            {/* 마커 */}
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
  );
};