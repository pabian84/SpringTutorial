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
    inputArea: {
      display: 'flex',
      padding: '8px', 
      borderTop: '1px solid #333',
      backgroundColor: '#252540',
      gap: '8px',
      alignItems: 'center' 
    },
    // [입력 필드]
    input: {
      flex: 1,
      height: '36px', 
      boxSizing: 'border-box' as const,
      padding: '0 15px', 
      borderRadius: '18px', 
      border: '1px solid #444',
      backgroundColor: '#1a1a2e',
      color: 'white',
      outline: 'none',
      fontSize: '14px'
    },
    // [전송 버튼 - 강력 고정]
    button: {
      height: '36px',         
      width: 'auto',          // [추가] 너비 자동
      minWidth: '60px',       // [추가] 최소 너비 확보
      flexShrink: 0,          // [추가] 절대 찌그러지지 않음
      margin: 0,              // [추가] 브라우저 기본 마진 제거
      boxSizing: 'border-box' as const,
      padding: '0 20px',      
      backgroundColor: '#007bff',
      color: 'white',
      border: 'none',
      borderRadius: '18px',   
      fontWeight: 'bold',
      fontSize: '13px',
      cursor: 'pointer',
      whiteSpace: 'nowrap' as const,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
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
      <div style={styles.inputArea}>
        <input 
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          style={styles.input}
          placeholder="메시지 입력..."
        />
        <button onClick={handleSend} style={styles.button}>전송</button>
      </div>
    </div>
  );
}