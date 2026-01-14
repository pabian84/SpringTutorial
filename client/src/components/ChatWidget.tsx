import { useEffect, useState, useRef } from 'react';
import type { ChatHistoryDTO } from '../types/dtos';

interface ChatWidgetProps {
  myId: string;
  messages: ChatHistoryDTO[];
  onSendMessage: (text: string) => void;
}

// [추가] 유저 ID에 따라 고정된 색상을 반환하는 함수 (텔레그램 스타일)
const getUserColor = (username: string) => {
  const colors = [
    '#FF5B5B', // Red
    '#33A6FF', // Blue
    '#33D765', // Green
    '#A85BFF', // Purple
    '#FF9F43', // Orange
    '#FF63D6'  // Pink
  ];
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

// 스마트 시간 변환 함수
const formatSmartTime = (dateString?: string) => {
  if (!dateString) return '';

  const date = new Date(dateString);
  const now = new Date();

  // 1. 유효하지 않은 날짜면 원본 반환 (Just in case)
  if (isNaN(date.getTime())) return dateString;

  // 2. 시간 표시 옵션 (오후 3:15)
  const timeOption: Intl.DateTimeFormatOptions = { 
    hour: 'numeric', 
    minute: '2-digit', 
    hour12: true 
  };

  // 3. 같은 날(오늘)인지 확인
  const isToday = date.getDate() === now.getDate() &&
                  date.getMonth() === now.getMonth() &&
                  date.getFullYear() === now.getFullYear();

  // 4. 같은 연도인지 확인
  const isSameYear = date.getFullYear() === now.getFullYear();

  if (isToday) {
    // 오늘이면: "오후 3:15"
    return new Intl.DateTimeFormat('ko-KR', timeOption).format(date);
  } else if (isSameYear) {
    // 올해지만 오늘이 아니면: "1월 7일 오후 3:15"
    return new Intl.DateTimeFormat('ko-KR', { 
        month: 'short', day: 'numeric', ...timeOption 
    }).format(date);
  } else {
    // 다른 연도면: "2023년 12월 31일 오후 3:15"
    return new Intl.DateTimeFormat('ko-KR', { 
        year: 'numeric', month: 'short', day: 'numeric', ...timeOption 
    }).format(date);
  }
};

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

  // 텔레그램 다크모드 스타일 정의
  const styles = {
    container: {
      display: 'flex', flexDirection: 'column' as const, height: '100%',
      backgroundColor: '#0e1621', borderRadius: '12px', overflow: 'hidden',
      border: '1px solid #1c242f'
    },
    messageArea: {
      flex: 1, overflowY: 'auto' as const, padding: '10px 15px',
      display: 'flex', flexDirection: 'column' as const, gap: '6px',
    },
    // 공통 말풍선 스타일
    bubbleBase: {
      maxWidth: '75%',
      padding: '6px 10px 6px 10px',
      borderRadius: '12px',
      position: 'relative' as const,
      fontSize: '14px',
      lineHeight: '1.4',
      wordBreak: 'break-word' as const,
      boxShadow: '0 1px 2px rgba(0,0,0,0.3)'
    },
    // 내 메시지 (파란/초록 계열)
    myBubble: {
      alignSelf: 'flex-end',
      backgroundColor: '#2b5278', // 텔레그램 내 메시지 색
      color: '#fff',
      borderBottomRightRadius: '2px', // 말풍선 꼬리 느낌
    },
    // 남의 메시지 (어두운 회색)
    otherBubble: {
      alignSelf: 'flex-start',
      backgroundColor: '#182533', // 텔레그램 상대방 메시지 색
      color: '#fff',
      borderBottomLeftRadius: '2px', // 말풍선 꼬리 느낌
    },
    // 이름 텍스트
    senderName: {
      fontSize: '12px',
      fontWeight: 'bold',
      marginBottom: '4px',
      display: 'block',
      cursor: 'pointer'
    },
    // 타임스탬프 (말풍선 안 우측 하단)
    timestamp: {
      fontSize: '10px',
      color: 'rgba(255,255,255,0.5)',
      float: 'right' as const, // 텍스트 흐름에서 오른쪽으로
      marginLeft: '8px',
      marginTop: '6px',
      verticalAlign: 'bottom'
    },
    
    // [입력창 영역]
    // [MemoWidget과 스타일 통일]
    inputArea: {
      display: 'flex',
      minHeight: '50px',
      padding: '8px',      // 여백을 넉넉하게
      backgroundColor: '#17212b',
      gap: '8px',           // 입력창과 버튼 사이 간격
      alignItems: 'center',
      //boxSizing: 'border-box' as const
    },
    // [입력 필드 - MemoWidget 스타일 적용]
    input: {
      flex: 1,
      height: '36px',
      padding: '0 12px',
      borderRadius: '18px',
      border: 'none',
      backgroundColor: '#242f3d',
      color: '#fff',
      outline: 'none',
      fontSize: '14px',
      margin: 0, 
    },
    // [전송 버튼 - MemoWidget 스타일 적용]
    button: {
      height: '40px',       // 부모 높이에 맞춤
      width: '40px',        // Memo와 동일하게 60px 고정
      margin: 0,
      borderRadius: '50%',
      backgroundColor: '#2b5278', // 색상은 채팅 테마 유지 (Memo는 빨강)
      color: '#5ea6f5',
      border: 'none',
      cursor: 'pointer',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      fontSize: '18px',
      transition: '0.2s'
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
            <div 
              key={idx} 
              style={{
                ...styles.bubbleBase,
                ...(isMe ? styles.myBubble : styles.otherBubble)
              }}
            >
              {/* 남의 메시지일 때만 이름 표시 (색상 자동 부여) */}
              {!isMe && (
                <span style={{ ...styles.senderName, color: getUserColor(msg.sender) }}>
                  {msg.sender}
                </span>
              )}
              
              {/* 메시지 내용 */}
              {msg.text}
              
              {/* 시간 표시 (오른쪽 아래) */}
              <span style={styles.timestamp}>
                {formatSmartTime(msg.createdAt) || 'Just now'}
              </span>
            </div>
          );
        })}
      </div>

      <div style={styles.inputArea}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          style={styles.input}
          placeholder="Message..."
        />
        <button 
            onClick={handleSend} 
            style={styles.button}
            onMouseOver={e => e.currentTarget.style.backgroundColor = '#34628f'}
            onMouseOut={e => e.currentTarget.style.backgroundColor = '#2b5278'}
        >
          ➤
        </button>
      </div>
    </div>
  );
}