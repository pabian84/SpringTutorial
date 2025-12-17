import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { showToast } from '../utils/Alert';

interface SystemData {
  time: string;
  cpu: number;
  memory: number;
}

export default function ServerMonitor() {
  const [data, setData] = useState<SystemData[]>([]);

  useEffect(() => {
    // 1. 웹소켓 연결
    const ws = new WebSocket('ws://localhost:8080/ws/system');

    ws.onopen = () => {
      console.log('서버 모니터링 연결 성공');
    };

    ws.onmessage = (event) => {
      // 2. 서버에서 온 데이터 파싱
      const message = JSON.parse(event.data);
      
      if (message.type === 'STATUS') {
        const now = new Date();
        const timeStr = `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;

        // [추가] 위험 상황 발생 시 토스트 알림!
        // (너무 자주 뜨면 시끄러우니까 CPU 80 넘을 때만)
        if (message.cpu > 80) {
             // 여기서 showToast를 호출하면, 
             // 사용자가 메모 삭제 모달을 보고 있어도 우측 상단에 알림이 "샥" 하고 뜹니다.
             showToast('CPU 과부하 경고!', 'error'); 
        }

        // 3. 차트 데이터 업데이트 (최근 20개만 유지)
        setData(prev => {
          const newData = [...prev, { 
            time: timeStr, 
            cpu: message.cpu, 
            memory: message.memory 
          }];
          
          if (newData.length > 20) {
            return newData.slice(newData.length - 20);
          }
          return newData;
        });
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket Error:', error);
    };

    // 4. 화면이 꺼질 때 연결 끊기 (필수)
    return () => {
      ws.close();
    };
  }, []);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      {/* 반응형 차트 컨테이너 */}
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#444" />
          <XAxis dataKey="time" stroke="#aaa" fontSize={12} tick={{fill: '#aaa'}} />
          <YAxis domain={[0, 100]} stroke="#aaa" fontSize={12} tick={{fill: '#aaa'}} />
          <Tooltip 
            contentStyle={{ backgroundColor: '#16213e', border: '1px solid #444' }} 
            itemStyle={{ color: '#fff' }}
          />
          {/* CPU 라인 (빨간색) */}
          <Line type="monotone" dataKey="cpu" stroke="#e94560" strokeWidth={2} dot={false} name="CPU (%)" />
          {/* 메모리 라인 (파란색) */}
          <Line type="monotone" dataKey="memory" stroke="#0f3460" strokeWidth={2} dot={false} name="RAM (GB)" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}