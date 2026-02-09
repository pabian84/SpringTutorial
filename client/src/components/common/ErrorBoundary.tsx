import type { ReactNode } from 'react';
import { Component, type ErrorInfo } from 'react';
import { showAlert } from '../../utils/Alert';
import { devError } from '../../utils/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    devError('[ErrorBoundary] Caught error:', error);
    devError('[ErrorBoundary] Component stack:', errorInfo.componentStack);
    
    // 운영 환경에서는 사용자에게 친화적인 메시지만 표시
    if (import.meta.env.PROD) {
      showAlert('오류 발생', '일시적인 문제가 발생했습니다. 페이지를 새로고침해 주세요.', 'error');
    }
  }

  public render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '200px',
          padding: '20px',
          textAlign: 'center',
          color: '#fff',
        }}>
          <h2 style={{ marginBottom: '16px', color: '#ff6b6b' }}>
            ⚠️ 오류가 발생했습니다
          </h2>
          <p style={{ marginBottom: '20px', color: '#aaa' }}>
            일시적인 문제가 발생했습니다.
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            style={{
              padding: '10px 20px',
              backgroundColor: '#4a90d9',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
            }}
          >
            페이지 새로고침
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
