import React, { useCallback, useRef } from 'react';
import type { Viewer } from 'cesium';
import { Cartesian3, Math as CesiumMath } from 'cesium';
import { CesiumCameraContext, type CameraView } from './CesiumCameraContext';

export const CesiumCameraProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const cameraView = useRef<CameraView | null>(null);
  const viewerRef = useRef<Viewer | null>(null);

  // 카메라 상태 저장
  const saveCameraView = useCallback((viewer: Viewer) => {
    if (!viewer || !viewer.camera) return;

    // 좌표가 (0,0,0) 근처거나 정상이 아니면 저장하지 않음
    // 이 코드가 없으면 'Matrix is not invertible' 에러가 발생합니다.
    const pos = viewer.camera.position;
    if (Cartesian3.magnitude(pos) < 1000 || isNaN(pos.x)) {
      return; 
    }

    cameraView.current = {
      destination: viewer.camera.position.clone(),
      orientation: {
        heading: viewer.camera.heading,
        pitch: viewer.camera.pitch,
        roll: viewer.camera.roll,
      },
    };
  }, []);

  // 카메라 상태 복구
  const restoreCameraView = useCallback((viewer: Viewer) => {
    if (!viewer || !viewer.camera || !cameraView.current) return;

    // 저장된 좌표가 오염되었는지 확인 후 복구
    const dest = cameraView.current.destination;
    if (Cartesian3.magnitude(dest) < 1000 || isNaN(dest.x)) {
      return;
    }

    viewer.camera.setView({
      destination: cameraView.current.destination,
      orientation: cameraView.current.orientation,
    });
  }, []);

  //  Viewer 인스턴스 설정 함수
  const setViewer = useCallback((viewer: Viewer) => {
    viewerRef.current = viewer;
  }, []);

  // 특정 좌표로 이동하는 flyTo 함수 구현
  const flyTo = useCallback((lat: number, lon: number, height: number, pitch: number = -45) => {
    if (viewerRef.current && viewerRef.current.camera) {
      viewerRef.current.camera.flyTo({
        destination: Cartesian3.fromDegrees(lon, lat, height),
        orientation: {
          heading: 0.0,
          pitch: CesiumMath.toRadians(pitch),
          roll: 0.0,
        },
        duration: 2.0, // 이동 시간 2초
      });
    } else {
        console.warn("Cesium Viewer instance is not set.");
    }
  }, []);

  return (
    <CesiumCameraContext.Provider value={{ cameraView, saveCameraView, restoreCameraView, setViewer, flyTo }}>
      {children}
    </CesiumCameraContext.Provider>
  );
};