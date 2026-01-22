import React, { useState, useEffect } from 'react';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

// [원본 Dashboard.tsx 호환성] legacy 경로의 WidthProvider 사용
// 원본 파일이 이 방식을 사용하여 잘 작동했으므로, 똑같이 유지합니다.
import { Responsive, WidthProvider } from 'react-grid-layout/legacy';

import DeferredComponent from './DeferredComponent';
import WidgetCard from './WidgetCard';

// HOC 적용
const ResponsiveGridLayout = WidthProvider(Responsive);

// [Type Safety] 라이브러리 타입 추출 (Any 방지)
type ResponsiveProps = React.ComponentProps<typeof ResponsiveGridLayout>;
type RGL_Layouts = ResponsiveProps['layouts'];

/**
 * 대시보드 위젯 설정 인터페이스
 */
export interface DashboardWidgetConfig {
  id: string;
  title?: string;
  icon?: React.ReactNode;
  content: React.ReactNode;
  
  // 옵션들
  noHeader?: boolean;
  headerAction?: React.ReactNode;
  keepMounted?: boolean;
  deferred?: boolean;
  idle?: boolean;
  delay?: number;
}

interface DashboardGridProps {
  layouts: RGL_Layouts;
  widgets: DashboardWidgetConfig[];
}

/**
 * [DashboardGrid]
 * react-grid-layout 설정을 캡슐화하여 DashboardNew.tsx를 깔끔하게 유지합니다.
 */
export default function DashboardGrid({ layouts, widgets }: DashboardGridProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const init = () => setIsMounted(true);
    init();
  }, []);

  // [중요] 확장 애니메이션을 위한 스타일 오버라이드
  // 원본 Dashboard.tsx의 동작(전체 화면 덮기)을 CSS로 구현
  const expansionStyle = `
    /* 드래그 잔상 스타일 */
    .react-grid-placeholder {
      background: rgba(255, 255, 255, 0.05) !important;
      opacity: 0.3 !important;
      border-radius: 16px !important;
    }
    
    /* 확장된 래퍼 (화면 전체를 덮는 검은 배경 역할) */
    .grid-item-expanded {
      position: fixed !important;
      inset: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      
      /* [중요] RGL의 transform 좌표계를 해제하여 뷰포트 기준으로 배치 */
      transform: none !important;
      
      margin: 0 !important;
      
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      
      box-sizing: border-box !important;
      
      /* FLIP 애니메이션을 위해 transition 제거 (JS가 제어) */
      transition: all 0.5s cubic-bezier(0.25, 1, 0.25, 1) !important;

      /* 배경색 (백드롭) */
      background-color: rgba(0, 0, 0, 0.7) !important;
      /* 모달이 떴을 때 뒤쪽 컨텐츠의 스크롤 동작 방지 (최신 브라우저 지원) */
      overscroll-behavior: contain;
    }

    /* 3. 실제 확장된 카드 (내부 div) - 여기서 90% 크기를 제어합니다 */
    .grid-item-expanded > div {
      /* 래퍼(100%) 내에서 90% 크기 차지 */
      width: 90% !important;
      height: 90% !important;
      
      /* Flex 부모(.grid-item-expanded) 덕분에 자동으로 중앙 정렬됨 */
      box-sizing: border-box !important;
    }

    /* 평소 상태 (축소 시 부드러운 복귀를 위한 트랜지션) */
    .react-grid-item:not(.grid-item-expanded) {
      transition: none !important;
    }
  `;

  return (
    <>
      <style>{expansionStyle}</style>
      <div style={{ 
        opacity: isMounted ? 1 : 0, 
        transform: isMounted ? 'none' : 'translateY(20px)',
        transition: 'opacity 0.6s ease-out, transform 0.6s ease-out'
      }}>
        <ResponsiveGridLayout
          className="layout"
          layouts={layouts}
          // 반응형 설정 (화면 크기에 따라 12컬럼 -> 10 -> ... -> 2)
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={30} // 그리드 한 칸의 높이 (px)
          // WidgetCard에 dragHandleClass를 전달하여 드래그 핸들 지정
          draggableHandle=".widget-drag-handle"
          useCSSTransforms={true} // 성능 향상
          isBounded={true} // 그리드 밖으로 못 나가게
          measureBeforeMount={false} // 미리 측정하지 않음
        >
          {widgets.map((widget) => (
            // [구조 유지] Grid Item -> Wrapper -> Card 구조 유지
            <div key={widget.id} className={expandedId === widget.id ? "grid-item-expanded" : ""}>
              <div style={{ height: '100%', width: '100%' }}>
                <WidgetCard
                  id={widget.id}
                  title={widget.title}
                  icon={widget.icon}
                  noHeader={widget.noHeader}
                  headerAction={widget.headerAction}
                  keepMounted={widget.keepMounted}
                  isExpanded={expandedId === widget.id}
                  onExpand={() => setExpandedId(widget.id)}
                  onClose={() => setExpandedId(null)}
                  dragHandleClass="widget-drag-handle"
                >
                  {/* 지연 로딩 컴포넌트 처리 */}
                  {widget.deferred ? (
                    <DeferredComponent idle={widget.idle} delay={widget.delay}>
                      {widget.content}
                    </DeferredComponent>
                  ) : (
                    widget.content
                  )}
                </WidgetCard>
              </div>
            </div>
          ))}
        </ResponsiveGridLayout>
      </div>
    </>
  );
}