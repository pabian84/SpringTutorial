import React, { useEffect, useState } from 'react';

export interface DeferredComponentProps { 
  children: React.ReactNode;
  idle?: boolean;
  delay?: number;
}

// 비동기 렌더링 컴포넌트 (초기 로딩 렉 방지)
// 브라우저의 메인 스레드가 바쁠 때는 렌더링을 미루고, 여유가 있을 때(Idle) 처리하여 버벅임을 없앱니다.
const DeferredComponent: React.FC<DeferredComponentProps> = ({ children, idle = false, delay = 0 }) => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const run = () => {
      // delay가 있으면 setTimeout으로 지연
      if (delay > 0) {
        setTimeout(() => setIsMounted(true), delay);
      } else {
        setIsMounted(true);
      }
    };

    // idle=true면 브라우저가 쉴 때 렌더링 (지도, 차트 등 무거운 위젯용)
    if (idle && 'requestIdleCallback' in window) {
      const handle = window.requestIdleCallback(run);
      return () => window.cancelIdleCallback(handle);
    } else {
      // 일반 위젯은 다음 프레임에 렌더링
      const handle = requestAnimationFrame(run);
      return () => cancelAnimationFrame(handle);
    }
  }, [idle, delay]);

  // 로딩 전에는 공간만 차지하는 빈 div 반환 (Layout Shift 방지)
  if (!isMounted) return <div style={{ width: '100%', height: '100%' }} />; 
  return <>{children}</>;
};

export default DeferredComponent;