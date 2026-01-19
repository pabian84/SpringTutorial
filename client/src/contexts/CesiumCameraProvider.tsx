import React, { useCallback, useRef } from 'react';
import type { Viewer } from 'cesium';
import { Cartesian3 } from 'cesium';
// 위에서 만든 로직 파일 임포트
import { CesiumCameraContext, type CameraView } from './CesiumCameraContext';

export const CesiumCameraProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const cameraView = useRef<CameraView | null>(null);

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

  return (
    <CesiumCameraContext.Provider value={{ cameraView, saveCameraView, restoreCameraView }}>
      {children}
    </CesiumCameraContext.Provider>
  );
};