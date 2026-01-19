import { Cartesian3, type Viewer } from 'cesium';
import React, { createContext, useContext } from 'react';

// 저장할 카메라 상태 타입 정의
export interface CameraView {
  destination: Cartesian3;
  orientation: { heading: number; pitch: number; roll: number };
}

// Context 타입 정의
export interface CesiumCameraContextType {
  cameraView: React.RefObject<CameraView | null>;
  saveCameraView: (viewer: Viewer) => void;
  restoreCameraView: (viewer: Viewer) => void;
}

// Context 생성
export const CesiumCameraContext = createContext<CesiumCameraContextType | null>(null);

// Hook을 여기서 정의해서 내보냅니다. (컴포넌트가 없으므로 OK)
export const useCesiumCamera = (): CesiumCameraContextType => {
  const context = useContext(CesiumCameraContext);
  if (!context) {
    throw new Error('useCesiumCamera must be used within a CesiumCameraProvider');
  }
  return context;
};