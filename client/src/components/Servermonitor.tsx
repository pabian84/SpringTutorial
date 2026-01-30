import { useEffect, useRef, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
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

// 하드코딩된 주소 대신, 현재 브라우저 주소를 기반으로 설정
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_URL = `${protocol}//${window.location.host}`; // host는 도메인+포트 포함

interface ChartProps {
  data: SystemStatusDTO[];
}

// 부모에게 데이터 받아서 렌더링 전용 컴포넌트
export default function ServerMonitor({ data }: ChartProps) {
  return <ServerStatusChart data={data} />;
}

export function StandaloneServerMonitor() {
  const [systemData, setSystemData] = useState<SystemStatusDTO[]>(INITIAL_DATA);
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    // 이미 연결되어 있으면 패스 (중복 연결 방지)
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      return;
    }
    // 1. 웹소켓 연결
    // (이전 소켓이 닫히는 중이거나 닫혀있으면 새로 연결)
    if (!ws.current || ws.current.readyState === WebSocket.CLOSED) {
      ws.current = new WebSocket(`${WS_URL}/ws/dashboard`);
      ws.current.onopen = () => console.log('서버 모니터링 연결 성공');
      ws.current.onmessage = (event) => {
        try {
          // 2. 서버에서 온 데이터 파싱
          const message = JSON.parse(event.data);
          
          // [Type 1] 시스템 상태만 처리 (차트용)
          if (message.type === 'SYSTEM_STATUS') {
            const timeStr = new Date().toLocaleTimeString('en-GB', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: false
            });

            // [수정 2] 확실하게 숫자로 변환 (안전장치)
            const type = message.type;
            const time = message.time ? message.time : timeStr;
            const cpu = Number(message.cpu);
            const cpuPercent = Number(message.cpuPercent);
            const memory = Number(message.memory);
            const memoryPercent = Number(message.memoryPercent);

            // [추가] 위험 상황 발생 시 토스트 알림!
            // (너무 자주 뜨면 시끄러우니까 CPU 80 넘을 때만)
            if (cpuPercent > 80) {
                // 여기서 showToast를 호출하면, 
                // 사용자가 메모 삭제 모달을 보고 있어도 우측 상단에 알림이 "샥" 하고 뜹니다.
                showToast('CPU 과부하 경고!', 'error');
            }

            // 3. 차트 데이터 업데이트 (최근 20개만 유지)
            setSystemData(prev => {
              const newData = { 
                type: type,
                time: time,
                cpu: cpu,
                cpuPercent: cpuPercent,
                memory: memory, 
                memoryPercent: memoryPercent,
              };
              
              // 데이터 밀어내기 (오른쪽 -> 왼쪽 흐름)
              return [...prev.slice(1), newData];
            });
          }
        } catch (error) {
          console.error('메시지 처리 중 오류 발생:', error);
        }
      };
      ws.current.onclose = () => {
        console.log('서버 모니터링 연결 해제');
        ws.current = null;
      };
      ws.current.onerror = (error) => console.error('WebSocket Error:', error);
    }
    // 4. 화면이 꺼질 때 연결 끊기 (필수)
    return () => {
      if (ws.current) {
        if (ws.current.readyState === WebSocket.OPEN) {
          ws.current.onopen = null;
          ws.current.onmessage = null;
          ws.current.onerror = null;
          ws.current.close();
        }
      }
    };
  }, []);

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