import { Gltf, Grid, OrbitControls, Stage, TransformControls, useCursor } from '@react-three/drei';
import { Canvas, type ThreeEvent } from '@react-three/fiber';
import { button, Leva, useControls } from 'leva';
import { useContext, useState } from 'react';
import * as THREE from 'three';
import { WidgetContext } from '../../contexts/CesiumCameraContext';

// [1] 기본 로봇 팔 모델 (인터랙티브 가능하도록 분리)
// forwardRef를 쓰거나 내부에서 onClick 이벤트를 받아야 TransformControls를 붙일 수 있음
const RobotArmParts = ({ onSelect }: { onSelect: (obj: THREE.Object3D) => void }) => {
  // 마우스 호버 시 커서 변경 훅
  const [hovered, setHover] = useState(false);
  useCursor(hovered);

  const handlePointerOver = (e: ThreeEvent<MouseEvent>) => { 
    e.stopPropagation(); 
    setHover(true); 
  };
  const handlePointerOut = () => setHover(false);
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation(); // 뒤에 있는 배경 클릭 방지
    onSelect(e.object);  // 클릭된 객체를 부모에게 알림
  };

  return (
    <group>
      {/* Base */}
      <mesh 
        position={[0, 0.5, 0]} 
        onClick={handleClick} onPointerOver={handlePointerOver} onPointerOut={handlePointerOut}
      >
        <cylinderGeometry args={[1, 1, 1, 32]} />
        <meshStandardMaterial color="#444" />
      </mesh>
      
      {/* Joint 1 */}
      <mesh 
        position={[0, 1.5, 0]} 
        onClick={handleClick} onPointerOver={handlePointerOver} onPointerOut={handlePointerOut}
      >
        <boxGeometry args={[0.5, 2, 0.5]} />
        <meshStandardMaterial color="orange" />
      </mesh>
      
      {/* Joint 2 */}
      <mesh 
        position={[0, 3, 0]} 
        rotation={[0, 0, 0.5]} 
        onClick={handleClick} onPointerOver={handlePointerOver} onPointerOut={handlePointerOut}
      >
        <boxGeometry args={[0.4, 2, 0.4]} />
        <meshStandardMaterial color="#3178c6" />
      </mesh>
    </group>
  );
};

interface SceneProps {
  isDetail?: boolean;
  customModelUrl?: string | null;
}

// Leva의 mode 값 타입 정의
type ControlMode = 'translate' | 'rotate' | 'scale';

export default function RobotArmScene({ isDetail = false, customModelUrl }: SceneProps) {
  // WidgetCard에서 제공하는 애니메이션 상태 구독
  const { isAnimating } = useContext(WidgetContext);
  const [selectedObj, setSelectedObj] = useState<THREE.Object3D | null>(null);
  
  // Leva 설정
  const { mode, showGrid } = useControls('Scene Controls', {
    mode: { 
      options: { Translate: 'translate', Rotate: 'rotate', Scale: 'scale' },
      value: 'translate',
      label: 'Control Mode' 
    },
    showGrid: { value: true, label: 'Show Grid' },
    Reset: button(() => {
      setSelectedObj(null);
    })
  }, { collapsed: !isDetail });

  const onMissed = () => {
    if (isDetail) setSelectedObj(null);
  };

  return (
    <div style={{ width: '100%', height: '100%', background: '#111', position: 'relative' }}>
      {/* Leva 패널의 전역 표시 여부 제어 */}
      {/* isDetail이 false(대시보드)일 때는 Leva 패널을 강제로 숨김 */}
      <Leva hidden={!isDetail} />

      <Canvas
        // [최적화 핵심] 애니메이션 중에는 렌더링 루프를 멈춰 GPU 부하를 없앱니다.
        frameloop={isAnimating ? 'never' : 'always'}
        camera={{ position: [4, 4, 4], fov: 50 }}
        shadows
        dpr={[1, 2]} // 고해상도 대응
        onPointerMissed={onMissed}
      >
        {/* 배경 및 조명 자동 세팅 */}
        <Stage environment="city" intensity={0.5} adjustCamera={false}>
          {customModelUrl ? (
            <Gltf 
              src={customModelUrl} 
              // [수정] any 제거 -> 이벤트 타입 명시
              onClick={(e: ThreeEvent<MouseEvent>) => {
                if(!isDetail) return;
                e.stopPropagation();
                setSelectedObj(e.object);
              }}
            />
          ) : (
            <RobotArmParts onSelect={(obj) => isDetail && setSelectedObj(obj)} />
          )}
        </Stage>

        {showGrid && (
          <Grid infiniteGrid fadeDistance={30} sectionColor="#4facfe" cellColor="#333" />
        )}
        
        {/* 마우스 컨트롤 (애니메이션 중에는 조작 불가하게 막을 수도 있음) */}
        <OrbitControls 
          makeDefault 
          enableDamping={isDetail} 
          enabled={!isAnimating} 
        />

        {selectedObj && isDetail && (
          <TransformControls 
            object={selectedObj} 
            // [수정] any 제거 -> 정확한 Union Type으로 캐스팅
            mode={mode as ControlMode} 
            onMouseDown={() => { if(isDetail) document.body.style.cursor = 'grabbing'; }}
            onMouseUp={() => { if(isDetail) document.body.style.cursor = 'auto'; }}
            //onDragStart={() => { if(isDetail) document.body.style.cursor = 'grabbing'; }}
            //onDragEnd={() => { if(isDetail) document.body.style.cursor = 'auto'; }}
          />
        )}
      </Canvas>
      
      {/* UI 오버레이 (제어 패널 등)가 들어갈 자리 */}
      {!isDetail && (
        <div style={{ position: 'absolute', bottom: 10, left: 10, color: 'white', pointerEvents: 'none' }}>
          <small>Left Click: Rotate / Right Click: Pan</small>
        </div>
      )}
    </div>
  );
}