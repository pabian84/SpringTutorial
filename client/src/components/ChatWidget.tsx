import { useEffect, useState, useRef } from 'react';

export interface ChatMessage {
  sender: string;
  text: string;
}

interface ChatWidgetProps {
  myId: string;
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
}

export default function ChatWidget({ myId, messages, onSendMessage }: ChatWidgetProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (input.trim()) {
      onSendMessage(input);
      setInput('');
    }
  };

  const styles = {
    container: {
      display: 'flex', flexDirection: 'column' as const, height: '100%',
      backgroundColor: '#1f1f35', borderRadius: '12px', overflow: 'hidden',
    },
    messageArea: {
      flex: 1, overflowY: 'auto' as const, padding: '15px',
      display: 'flex', flexDirection: 'column' as const, gap: '10px',
    },
    myMsg: { alignSelf: 'flex-end', backgroundColor: '#007bff', color: 'white', padding: '8px 12px', borderRadius: '12px 12px 0 12px', maxWidth: '70%', wordBreak: 'break-all' as const, fontSize: '14px' },
    otherMsg: { alignSelf: 'flex-start', backgroundColor: '#3a3a55', color: '#eaeaea', padding: '8px 12px', borderRadius: '12px 12px 12px 0', maxWidth: '70%', wordBreak: 'break-all' as const, fontSize: '14px' },
    senderName: { fontSize: '11px', color: '#aaa', marginBottom: '4px', display: 'block' },
    
    // [입력창 영역]
    // [MemoWidget과 스타일 통일]
    inputArea: {
      display: 'flex',
      height: '50px',
      padding: '7px 10px',      // 여백을 넉넉하게
      //alignItems: 'center',
      borderTop: '1px solid #333',
      backgroundColor: '#252540',
      gap: '8px',           // 입력창과 버튼 사이 간격
      alignItems: 'center',
      boxSizing: 'border-box' as const
    },
    // [입력 필드 - MemoWidget 스타일 적용]
    input: {
      flex: 1,
      height: '100%',       // 부모(inputArea) 높이에 꽉 차게 (패딩 제외)
      boxSizing: 'border-box' as const,
      padding: '0 12px',
      margin: 0, 
      borderRadius: '8px',  // [수정] 18px -> 8px (Memo와 통일)
      border: '1px solid #444',
      backgroundColor: '#1a1a2e', // Memo와 색상은 맞춤
      color: 'white',
      outline: 'none',
      fontSize: '14px'
    },
    // [전송 버튼 - MemoWidget 스타일 적용]
    button: {
      height: '100%',       // 부모 높이에 맞춤
      width: '60px',        // Memo와 동일하게 60px 고정
      flexShrink: 0,
      margin: 0,
      boxSizing: 'border-box' as const,
      padding: 0,           // 텍스트 중앙 정렬을 위해 패딩 제거
      backgroundColor: '#007bff', // 색상은 채팅 테마 유지 (Memo는 빨강)
      color: 'white',
      border: 'none',
      borderRadius: '8px',  // [수정] 18px -> 8px (Memo와 통일)
      fontWeight: 'bold',
      fontSize: '14px',     // 13px -> 14px
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'background 0.2s'
    }
  };

  // messages가 유효한지 확인하고 렌더링 (방어 코드)
  const safeMessages = Array.isArray(messages) ? messages : [];

  return (
    <div style={styles.container}>
      <div ref={scrollRef} style={styles.messageArea}>
        {safeMessages.map((msg, idx) => {
          const isMe = msg.sender === myId;
          return (
            <div key={idx} style={isMe ? styles.myMsg : styles.otherMsg}>
              {!isMe && <span style={styles.senderName}>{msg.sender}</span>}
              {msg.text}
            </div>
          );
        })}
      </div>
      {/* 폼 태그로 감싸서 엔터키 전송 자연스럽게 처리 */}
      <div style={styles.inputArea}>
        <input
          name="chat-input"
          id="chat-input"
          autoComplete="off"
          spellCheck={false}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          style={styles.input}
          placeholder="메시지 입력..."
        />
        <button
            onClick={handleSend} style={styles.button}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#0056b3' }
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#007bff'}
        >
            전송
        </button>
      </div>
    </div>
  );
}