import { useEffect, useRef, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useWebSocket } from '../contexts/WebSocketContext';
import type { SystemStatusDTO } from '../types/dtos';
import { showToast } from '../utils/Alert';

const MAX_DATA_POINTS = 20;
const INITIAL_DATA = Array(MAX_DATA_POINTS).fill({ 
  type: 'SYSTEM_STATUS',
  time: '', 
  cpu: 0, 
  cpuPercent: 0, 
  memory: 0, 
  memoryPercent: 0 
});

interface ChartProps {
  data: SystemStatusDTO[];
}

// 부모에게 데이터 받아서 렌더링 전용 컴포넌트
export default function ServerMonitor({ data }: ChartProps) {
  return <ServerStatusChart data={data} />;
}

export function StandaloneServerMonitor() {
  const [systemData, setSystemData] = useState<SystemStatusDTO[]>(INITIAL_DATA);
  // new WebSocket() 대신 통합 훅 사용
  const { lastMessage } = useWebSocket();
  // 토스트 알림 쿨타임 관리용 Ref (재렌더링 없이 값 저장)
  const lastToastTimeRef = useRef<number>(0);

  useEffect(() => {
    // 로직을 내부 함수로 분리하여 useEffect의 역할을 명확히 함
    const processSystemStatus = () => {
      // 1. 데이터 유효성 검사 (타입 가드)
      if (!lastMessage || lastMessage.type !== 'SYSTEM_STATUS') return;

      const newData = lastMessage as SystemStatusDTO;
      const timeStr = new Date().toLocaleTimeString('en-GB', {
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
      });

      // 2. 데이터 정제 (숫자 변환)
      const type = newData.type;
      const time = newData.time ? newData.time : timeStr;
      const cpu = Number(newData.cpu);
      const cpuPercent = Number(newData.cpuPercent);
      const memory = Number(newData.memory);
      const memoryPercent = Number(newData.memoryPercent);

      // 3. [보완] CPU 과부하 경고 (쿨타임 적용)
      if (cpuPercent > 80) {
        const now = Date.now();
        // 마지막 알림 후 3초(3000ms)가 지났는지 확인
        if (now - lastToastTimeRef.current > 3000) {
          showToast(`CPU 과부하 경고! (${cpuPercent.toFixed(1)}%)`, 'error');
          lastToastTimeRef.current = now; // 알림 보낸 시간 갱신
        }
      }
      
      // 4. 차트 데이터 업데이트
      setSystemData(prev => {
        const newEntry = { 
          type, time, cpu, cpuPercent, memory, memoryPercent
        };
        // 배열의 앞부분(오래된 데이터) 하나 자르고, 새 데이터 뒤에 붙임
        return [...prev.slice(1), newEntry];
      });
    };

    // 함수 실행
    processSystemStatus();
  }, [lastMessage]);

  // UI는 공통 컴포넌트에 위임
  return <ServerStatusChart data={systemData} />;
}

// 차트 렌더링 전용 컴포넌트
function ServerStatusChart({ data }: ChartProps) {
  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#444" />
          <XAxis
            stroke="#aaa"
            fontSize={12}
            tick={{ fill: '#aaa' }}
            tickFormatter={(index) => data[index]?.time ?? ''}
            interval="preserveStartEnd"
          />
          <YAxis domain={[0, 100]} stroke="#aaa" fontSize={12} tick={{ fill: '#aaa' }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#16213e', border: '1px solid #444' }}
            itemStyle={{ color: '#fff' }}
            formatter={(value: number | undefined) => value?.toFixed(2)}
          />
          <Line 
            type="monotone" 
            dataKey="cpuPercent" 
            stroke="#e94560" 
            strokeWidth={2} 
            dot={false} 
            isAnimationActive={false} 
            name="CPU (%)" 
          />
          <Line 
            type="monotone" 
            dataKey="memoryPercent" 
            stroke="#0f3460" 
            strokeWidth={2} 
            dot={false} 
            isAnimationActive={false} 
            name="RAM (%)" 
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}