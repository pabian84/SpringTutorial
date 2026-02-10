import { useCallback, useEffect, useState } from 'react';
import { memoApi } from '../api/widgetApi';
import type { MemoDTO } from '../types/dtos';
import { showConfirm, showToast } from '../utils/Alert';
import { devError } from '../utils/logger';
import { useAuth } from '../contexts/AuthContext';

// 부모(Dashboard)로부터 받을 Props 정의
interface MemoWidgetProps {
  memos: MemoDTO[];
  onAdd: (content: string) => void;
  onDelete: (id: number) => void;
}

// 껍데기 역할: 받은 데이터를 그대로 렌더링 함수에 넘김
export default function MemoWidget(props: MemoWidgetProps) {
  // 껍데기 역할: 받은 데이터를 그대로 렌더링 함수에 넘김
  return <MemoRender {...props} />;
}

// 독립 실행형 메모 위젯 컴포넌트
export function StandaloneMemoWidget() {
  const [memos, setMemos] = useState<MemoDTO[]>([]);
  const { user } = useAuth(); // 인증된 사용자 정보
  const myId = user?.id;

  // 데이터 로딩
  const fetchMemos = useCallback(async () => {
    if (!myId) return;
    try {
      const data = await memoApi.getMemos(myId);
      setMemos(data);
    } catch (e) {
      devError("메모 로딩 실패", e);
    }
  }, [myId]);

  // 초기 로딩은 useEffect 내부에서 단독 처리 (가장 정석적인 방법)
  // 외부 함수(fetchMemos)를 의존성으로 넣지 않고, 로직을 내부에 정의하여 충돌 방지
  useEffect(() => {
    if (!myId) return;

    const initLoad = async () => {
        try {
          const data = await memoApi.getMemos(myId);
          setMemos(data);
        } catch (e) {
          console.error("메모 초기 로딩 실패", e);
        }
    };

    initLoad();
  }, [myId]); // 의존성은 오직 'myId' 값 하나뿐임 (함수 의존성 제거)

  // 메모 추가
  const handleAdd = async (content: string) => {
    try {
      await memoApi.addMemo(myId!, content);
      fetchMemos(); // 재로딩
    } catch (e) {
      devError("메모 추가 실패", e);
      showToast('메모 저장 실패', 'error');
    }
  };

  // 메모 삭제
  const handleDelete = async (id: number) => {
    const result = await showConfirm('메모 삭제', '이 메모를 삭제하시겠습니까?');
    // yes 클릭 시 삭제 진행
    if (result.isConfirmed) {
      try {
        await memoApi.deleteMemo(id);
        // 삭제 성공 후 토스트 알림
        showToast('메모가 삭제되었습니다.', 'success');
        fetchMemos(); // 재로딩
      } catch (e) {
        devError("메모 삭제 실패", e);
        showToast('삭제 중 오류가 발생했습니다.', 'error');
      }
    }
  };

  // 스스로 관리하는 상태와 핸들러를 렌더링 컴포넌트에 주입
  return <MemoRender memos={memos} onAdd={handleAdd} onDelete={handleDelete} />;
}

function MemoRender({ memos, onAdd, onDelete }: MemoWidgetProps) {
  // 입력창 상태는 UI 고유의 것이므로 여기서 관리
  const [input, setInput] = useState('');

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onAdd(input); // 부모가 준 핸들러 실행
    setInput('');
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 입력창 영역 */}
      <form onSubmit={onSubmit} style={{ display: 'flex', gap: '8px', marginBottom: '15px', height: '42px' }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="메모를 입력하세요..."
          style={{ 
            flex: 1, 
            height: '100%', // 부모 높이에 맞춤
            padding: '0 15px', // 위아래 패딩 대신 높이로 제어
            borderRadius: '8px', // 둥글기 일치
            border: '1px solid #444', 
            backgroundColor: '#1f2937',
            color: 'white',
            outline: 'none',
            fontSize: '14px' // 글자 크기 통일
          }}
        />
        <button 
          type="submit" 
          style={{ 
            width: '60px', 
            height: '100%', // 부모 높이에 맞춤
            backgroundColor: '#e94560',
            color: 'white',
            border: 'none',
            borderRadius: '8px', // 둥글기 일치
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '14px',
            transition: 'background 0.2s',
            padding: 0 // 패딩 초기화 (중앙 정렬 위해)
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#c8344c'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#e94560'}
        >
          Add
        </button>
      </form>

      {/* 리스트 영역 */}
      <div style={{ flex: 1, overflowY: 'auto', paddingRight: '5px' }}>
        {memos.length === 0 ? (
          <div style={{ color: '#666', textAlign: 'center', marginTop: '20px' }}>
            작성된 메모가 없습니다.
          </div>
        ) : (
          memos.map((memo) => (
            <div 
              key={memo.id} 
              style={{ 
                backgroundColor: '#252540', 
                padding: '12px 15px', // 안쪽 여백을 넉넉하게
                marginBottom: '10px', 
                borderRadius: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center', // 세로 중앙 정렬
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                border: '1px solid #333'
              }}
            >
              {/* 텍스트 영역: 남은 공간을 꽉 채움 (flex: 1) */}
              <span 
                style={{ 
                  flex: 1, 
                  marginRight: '15px', 
                  lineHeight: '1.5',
                  wordBreak: 'break-all', // 긴 단어 줄바꿈
                  whiteSpace: 'pre-wrap', // 줄바꿈 문자(\n) 반영
                  cursor: 'text', // 텍스트 커서 모양
                  userSelect: 'text' // 드래그 복사 허용
                }}
              >
                {memo.content}
              </span>

              {/* 삭제 버튼: 크기 고정 */}
              <button 
                onClick={(e) => {
                    e.stopPropagation(); // 버튼 클릭이 부모로 전파되는 것 방지
                    onDelete(memo.id);
                }}
                title="삭제"
                style={{ 
                  backgroundColor: 'transparent', 
                  color: '#666', 
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '20px',
                  padding: '5px',
                  flexShrink: 0, // 텍스트가 길어도 버튼이 찌그러지지 않음
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                    e.currentTarget.style.color = '#ff4d4d';
                    e.currentTarget.style.backgroundColor = 'rgba(255, 77, 77, 0.1)';
                }}
                onMouseOut={(e) => {
                    e.currentTarget.style.color = '#666';
                    e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}