import { useEffect, useState, useRef } from 'react';

interface ChatMessage {
  sender: string;
  text: string;
}

interface ChatWidgetProps {
  myId: string;
}

export default function ChatWidget({ myId }: ChatWidgetProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const ws = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // 채팅 서버 연결
    ws.current = new WebSocket('ws://localhost:8080/ws/chat');
    ws.current.onopen = () => console.log('채팅 서버 연결됨');
    
    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      // 서버에서 온 메시지를 리스트에 추가
      setMessages(prev => [...prev, data]);
    };

    return () => {
      ws.current?.close();
    };
  }, []);

  const sendMessage = () => {
    if (ws.current && input.trim()) {
      const msgData = { sender: myId, text: input };
      // 서버로 전송 (JSON 문자열로 변환)
      ws.current.send(JSON.stringify(msgData));
      setInput('');
    }
  };

  // --- 스타일 정의 ---
  const styles = {
    container: {
      display: 'flex',
      flexDirection: 'column' as const,
      height: '100%',
      backgroundColor: '#1f1f35', // 약간 더 어두운 배경
      borderRadius: '12px',
      overflow: 'hidden',
    },
    messageArea: {
      flex: 1,
      overflowY: 'auto' as const,
      padding: '15px',
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '10px',
    },
    myMsg: {
      alignSelf: 'flex-end',
      backgroundColor: '#007bff', // 파란색 말풍선
      color: 'white',
      padding: '8px 12px',
      borderRadius: '12px 12px 0 12px', // 오른쪽 아래 뾰족하게
      maxWidth: '70%',
      wordBreak: 'break-all' as const,
      fontSize: '14px'
    },
    otherMsg: {
      alignSelf: 'flex-start',
      backgroundColor: '#3a3a55', // 회색 말풍선
      color: '#eaeaea',
      padding: '8px 12px',
      borderRadius: '12px 12px 12px 0', // 왼쪽 아래 뾰족하게
      maxWidth: '70%',
      wordBreak: 'break-all' as const,
      fontSize: '14px'
    },
    senderName: {
      fontSize: '11px',
      color: '#aaa',
      marginBottom: '4px',
      display: 'block'
    },
    inputArea: {
      display: 'flex',
      padding: '10px',
      borderTop: '1px solid #333',
      backgroundColor: '#252540',
      gap: '10px' // 입력창과 버튼 사이 간격
    },
    input: {
      flex: 1, // 남은 공간 다 차지하기
      padding: '10px',
      borderRadius: '8px',
      border: '1px solid #444',
      backgroundColor: '#1a1a2e',
      color: 'white',
      outline: 'none'
    },
    button: {
      width: '70px',
      backgroundColor: '#007bff',
      color: 'white',
      border: 'none',
      borderRadius: '8px',
      fontWeight: 'bold',
      cursor: 'pointer',
      transition: 'background 0.2s'
    }
  };

  return (
    <div style={styles.container}>
      {/* 채팅 내용 영역 */}
      <div ref={scrollRef} style={styles.messageArea}>
        {messages.map((msg, idx) => {
          const isMe = msg.sender === myId;
          return (
            <div key={idx} style={isMe ? styles.myMsg : styles.otherMsg}>
              {!isMe && <span style={styles.senderName}>{msg.sender}</span>}
              {msg.text}
            </div>
          );
        })}
      </div>
      
      {/* 입력창 */}
      <div style={styles.inputArea}>
        <input 
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          style={styles.input}
          placeholder="메시지 입력..."
        />
        <button 
          onClick={sendMessage} 
          style={styles.button}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#0056b3'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#007bff'}
        >
          전송
        </button>
      </div>
    </div>
  );
}