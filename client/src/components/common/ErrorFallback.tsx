import type { FallbackProps } from 'react-error-boundary';
import { BiErrorCircle, BiRefresh } from 'react-icons/bi';

// 에러 바운더리가 에러를 잡으면 이 컴포넌트를 보여줍니다.
// error: 발생한 에러 객체
// resetErrorBoundary: 에러 상태를 초기화하고 다시 시도하게 하는 함수
export default function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#ff6b6b', // 붉은색 계열
      backgroundColor: 'rgba(255, 107, 107, 0.1)', // 살짝 붉은 배경
      borderRadius: '8px',
      padding: '16px',
      textAlign: 'center',
      gap: '12px'
    }}>
      <BiErrorCircle size={40} />
      <div>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>위젯 로딩 실패</h4>
        <p style={{ margin: 0, fontSize: '12px', color: '#e0e0e0', opacity: 0.8 }}>
          {error.message || '알 수 없는 오류가 발생했습니다.'}
        </p>
      </div>
      
      {/* 다시 시도 버튼 */}
      <button 
        onClick={resetErrorBoundary}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          backgroundColor: '#333',
          border: '1px solid #555',
          borderRadius: '4px',
          color: 'white',
          cursor: 'pointer',
          fontSize: '12px',
          transition: 'all 0.2s'
        }}
        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#444'}
        onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#333'}
      >
        <BiRefresh size={16} /> 다시 시도
      </button>
    </div>
  );
}