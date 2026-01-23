import React, { memo } from 'react';
import RobotArmScene from './RobotArmScene';

const ThreeJsWidget: React.FC = memo(() => {
  // 위젯 모드: 상세 컨트롤 없음, 기본 모델 표시
  return (
    <RobotArmScene isDetail={false} />
  );
});

export default ThreeJsWidget;