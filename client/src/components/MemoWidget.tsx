import { useEffect, useState } from 'react';
import axios from 'axios';
import { showConfirm, showToast } from '../utils/Alert';

interface Memo {
  id: number;
  userId: string;
  content: string;
}

export default function MemoWidget() {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [input, setInput] = useState('');
  
  // 로그인한 내 아이디 가져오기
  const myId = localStorage.getItem('myId') || sessionStorage.getItem('myId');

  useEffect(() => {
    if (!myId) {
        return;
    }
    // 메모 추가
    const fetchMemos = async () => {
      try {
        const res = await axios.get(`http://localhost:8080/api/memo/${myId}`);
        setMemos(res.data);
      } catch (e) {
        console.error("메모 로딩 실패", e);
      }
    };

    fetchMemos();
  }, [myId]);

  // 메모 추가
  const addMemo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !myId) return;
    
    // [수정] userId를 같이 전송
    await axios.post('http://localhost:8080/api/memo', { 
      userId: myId,
      content: input 
    });
    
    setInput('');
    // 목록 갱신 (코드가 중복되지만, 안전을 위해 직접 호출)
    // 간단하게 목록만 다시 불러오기 위해 axios를 한번 더 씁니다.
    const res = await axios.get(`http://localhost:8080/api/memo/${myId}`);
    setMemos(res.data);
  };

  const deleteMemo = async (id: number) => {
    const result = await showConfirm('메모 삭제', '이 메모를 삭제하시겠습니까?');
    // yes 클릭 시 삭제 진행
    if (result.isConfirmed) {
      try {
        await axios.delete(`http://localhost:8080/api/memo/${id}`);

        // 삭제 성공 후 토스트 알림
        showToast('메모가 삭제되었습니다.', 'success');
        
        // 목록 갱신
        if (myId) {
            const res = await axios.get(`http://localhost:8080/api/memo/${myId}`);
            setMemos(res.data);
        }
      } catch (e) {
        console.error("메모 삭제 실패", e);
        showToast('삭제 중 오류가 발생했습니다.', 'error');
      }
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 입력창 영역 */}
      <form onSubmit={addMemo} style={{ display: 'flex', gap: '8px', marginBottom: '15px', height: '42px' }}>
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
                    deleteMemo(memo.id);
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