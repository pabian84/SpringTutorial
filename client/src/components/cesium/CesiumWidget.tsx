import React, { memo } from 'react';
import { CesiumMapViewer } from '../cesium/CesiumMapViewer'; // 공통 컴포넌트 임포트

const CesiumWidget: React.FC = memo(() => {
  return (
    <CesiumMapViewer/>
  );
});

export default CesiumWidget;