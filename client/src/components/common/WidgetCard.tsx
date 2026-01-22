import React, { memo, useLayoutEffect, useRef, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { BiCollapse, BiExpand } from 'react-icons/bi';
import ErrorFallback from './ErrorFallback';
import { WidgetContext } from '../../contexts/CesiumCameraContext';

// 공통 카드 컴포넌트 Props 정의
export interface WidgetCardProps {
  id: string;
  title?: string;      // 텍스트 타이틀만 받음
  icon?: React.ReactNode; // 아이콘 따로 받음
  children: React.ReactNode;
  onExpand?: () => void;
  onClose?: () => void;
  isExpanded?: boolean;
  noHeader?: boolean; // 날씨처럼 헤더 없는 경우
  headerAction?: React.ReactNode; // 헤더 우측에 들어갈 커스텀 액션 버튼
  keepMounted?: boolean; // 세슘처럼 리로드되면 안되는 컴포넌트인지 여부
  // 드래그 핸들 (Grid에서 주입)
  dragHandleClass?: string;
}


// React.memo를 사용하여 props가 변하지 않으면 재렌더링 방지
const WidgetCard = memo(({ id, title, icon, children, onExpand, onClose, isExpanded = false, noHeader, headerAction, keepMounted = false, dragHandleClass }: WidgetCardProps) => {
  // 애니메이션 중인지 확인하는 상태
  const [isAnimating, setIsAnimating] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const prevRect = useRef<DOMRect | null>(null);

  // 1. 확장 클릭 시점의 좌표 저장 (First)
    const handleExpand = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (cardRef.current) {
        prevRect.current = cardRef.current.getBoundingClientRect();
      }
      if (onExpand) onExpand();
    };

  // FLIP (First, Last, Invert, Play) 애니메이션 로직
    useLayoutEffect(() => {
      if (!cardRef.current) return;
  
      if (isExpanded) {
        // 확장 시작 (Opening)
        if (prevRect.current) {
          // setIsAnimating을 비동기로 호출하여 'cascading renders' 오류 방지
          requestAnimationFrame(() => setIsAnimating(true));
          const el = cardRef.current;
          // 부모 요소(그리드 아이템, Card의 최상단) 참조
          const parent = el.parentElement?.parentElement;
          
          // 축소 애니메이션 시작 시 부모 요소의 z-index를 강제로 높임
          if (parent) {
            parent.style.zIndex = '10000';
          }
          // Last: 확장된 상태의 크기와 좌표 측정
          const lastRect = el.getBoundingClientRect();
          // 카드 상태의 크기와 좌표 측정
          const firstRect = prevRect.current;
          // 위치와 크기 차이 계산
          const deltaX = firstRect.left - lastRect.left;
          const deltaY = firstRect.top - lastRect.top;
          const deltaW = firstRect.width / lastRect.width;
          const deltaH = firstRect.height / lastRect.height;
  
          // Invert: 애니메이션 없이 즉시 시작 위치로 강제 이동
          el.style.transition = 'none';
          el.style.transformOrigin = 'top left'; 
          el.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(${deltaW}, ${deltaH})`;
  
          // Force Reflow
          el.getBoundingClientRect();
  
          // Play
          requestAnimationFrame(() => {
            el.style.transition = 'all 0.5s cubic-bezier(0.25, 1, 0.25, 1)';
            el.style.transform = 'none';
          });
  
          // 애니메이션 종료 정리
          const timer = setTimeout(() => {
            requestAnimationFrame(() => {
              setIsAnimating(false);
              if (el) {
                  el.style.transition = '';
                  el.style.transform = '';
              }
              prevRect.current = null;
            });
          }, 500);
          return () => clearTimeout(timer);
        }
      } else {
        // 2. 축소 시 (Closing) - 역방향 FLIP 적용하여 스프링 현상 제거
        requestAnimationFrame(() => setIsAnimating(true));
        // DOM은 이미 작아져 있음(isExpanded=false). 이를 JS로 강제로 화면 전체 크기인 척 늘렸다가 줄임.
       
        const el = cardRef.current;
        // 부모 요소(그리드 아이템, Card의 최상단) 참조
        const parent = el.parentElement?.parentElement; 
        // 줄어든 상태의 위치, 크기
        const currentRect = el.getBoundingClientRect(); 
        // 전체 화면 크기
        const screenW = window.innerWidth;
        const screenH = window.innerHeight;
  
        // Invert: 현재 작은 카드를 화면 전체 크기만큼 확대/이동시킴
        const scaleX = (screenW / currentRect.width) * 0.9; // 90 퍼센트 적용
        const scaleY = (screenH / currentRect.height) * 0.9; // 90 퍼센트 적용
        // 0, 0으로 이동
        // TODO: 90퍼센트로 적용했으니 0, 0이 아니라 화면 중앙으로 이동 필요
        // TODO: 확장 버튼 클릭 시 좌표를 저장해두는 것 처럼, 축소 버튼 클릭 시 확장 모달의 크기와 위치를 계산해 저장해 두는게 더 좋지 않나?
        const transX = -currentRect.left; 
        const transY = -currentRect.top;
  
        el.style.transition = 'none';
        el.style.transformOrigin = 'top left';
        el.style.transform = `translate(${transX}px, ${transY}px) scale(${scaleX}, ${scaleY})`;
        
        el.getBoundingClientRect(); // Reflow
  
        // Play
        requestAnimationFrame(() => {
          el.style.transition = 'all 0.5s cubic-bezier(0.25, 1, 0.25, 1)';
          el.style.transform = 'none';
        });
  
        // 애니메이션 종료 처리
        const timer = setTimeout(() => {
          requestAnimationFrame(() => {
            setIsAnimating(false);
            if (el) {
              el.style.transition = '';
              el.style.transform = '';
            }
            if (parent) {
              parent.style.zIndex = '';
            }
          });
        }, 500);
        return () => clearTimeout(timer);
      }
    }, [isExpanded]);

  
  // keepMounted 최적화: 애니메이션 중에는 layout 업데이트를 멈추기 위해 contain 속성 사용
  const shouldRenderContent = keepMounted || !isAnimating;

  return (
      <div
        id={id}
        ref={cardRef}
        style={{
          backgroundColor: 'var(--card-color)',
          borderRadius: isExpanded ? '24px' : '16px',
          boxShadow: isExpanded ? 'none' : '0 4px 15px rgba(0,0,0,0.3)',
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transition: 'none',
          willChange: isAnimating ? 'transform, width, height' : 'auto',
          userSelect: isAnimating ? 'none' : 'auto',
        }}
      >
        {/* 1. 통일된 헤더 영역 */}
        {!noHeader && (
          <div
            className={!isExpanded ? dragHandleClass : ""} 
            style={{
              padding: '15px 20px',
              cursor: isExpanded ? 'default' : 'move',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(255,255,255,0.02)',
              minHeight: '25px', 
              flexShrink: 0,
            }}
          >
            {/* [좌측] 아이콘 + 타이틀 */}
            <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, flex: 1, gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', flexShrink: 0 }}>
                {icon}
              </div>
              <h3 style={{
                margin: 0,
                fontSize: '16px',
                fontWeight: 600,
                color: '#eaeaea',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                lineHeight: 1.2
              }}>
                {title}
              </h3>
            </div>
  
            {/* [우측] 버튼 */}
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
              {headerAction && (
                <div style={{ marginRight: '5px', display: 'flex', alignItems: 'center' }}>
                  {headerAction}
                </div>
              )}
              {/* 확장 버튼 */}
              {onExpand && !isExpanded && (
                <button
                  onClick={handleExpand}
                  style={{
                    background: 'none', border: 'none', color: '#aaa',
                    cursor: 'pointer', padding: '4px', display: 'flex',
                  }}
                  title="확장 하기"
                >
                  <BiExpand size={24} />
                </button>
              )}
              {/* 닫기 버튼 */}
              {onClose && isExpanded && (
                <button
                  onClick={(e) => { e.stopPropagation(); onClose(); }}
                  style={{
                    background: 'none', border: 'none', color: '#fff',
                    cursor: 'pointer', padding: '4px', display: 'flex',
                    transition: 'color 0.2s'
                  }}
                  title="닫기"
                >
                  <BiCollapse size={24} />
                </button>
              )}
            </div>
          </div>
        )}
  
        {/* 2. 컨텐츠 영역 */}
        <div 
          style={{ 
            flex: 1, 
            padding: noHeader ? 0 : '10px', 
            overflow: 'hidden', 
            position: 'relative',
            pointerEvents: isAnimating ? 'none' : 'auto',
            contain: isAnimating ? 'strict' : 'none',
          }}
        >
          <ErrorBoundary FallbackComponent={ErrorFallback}>
            <WidgetContext.Provider value={{ isAnimating, isExpanded }}>
              {shouldRenderContent ? children : (
                <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                  <div style={{ color: '#4facfe', fontSize: '16px', fontWeight: 'bold', marginBottom: '15px' }}>
                    Loading...
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
              )}
            </WidgetContext.Provider>
          </ErrorBoundary>
        </div>
      </div>
    );
  });

export default WidgetCard;