import axios from 'axios';
import { useEffect, useState } from 'react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { StockDTO } from '../types/dtos';

// 차트 색상 (미국: 파랑, 일본: 빨강, 유럽: 노랑/주황)
const COLORS = ['#3b82f6', '#ef4444', '#f59e0b'];

interface ChartProps {
  data: StockDTO[];
}

export default function ExchangeWidget({ data }: ChartProps) {
  return <ExchangeChart data={data} />;
}

export function StandaloneExchangeWidget() {
  const [data, setData] = useState<StockDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 스프링 서버 API 호출
    axios.get<StockDTO[]>('/api/finance/dashboard')
      .then(res => {
        setData(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error("환율 데이터 로딩 실패:", err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div style={{ color: '#aaa', textAlign: 'center', lineHeight: '250px' }}>데이터 로딩 중...</div>;
  }

  return <ExchangeChart data={data} />;
}

// 3. [공통] 차트 렌더링 전용 컴포넌트
function ExchangeChart({ data }: ChartProps) {
  return (
    <div style={{ width: '100%', height: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 30, left: -20, bottom: 0 }}>
            {/* 다크 테마라 글씨가 안 보일 수 있어서 밝은 색(#ccc)으로 변경 */}
            <XAxis dataKey="symbol" tick={{ fill: '#ccc', fontSize: 12 }} />
            <YAxis tick={{ fill: '#ccc', fontSize: 12 }} />
            <Tooltip 
              cursor={{ fill: 'transparent' }}
              contentStyle={{ 
              borderRadius: '8px', 
              border: 'none', 
              boxShadow: '0 2px 8px rgba(0,0,0,0.5)', 
              backgroundColor: '#333', // 툴팁 배경도 어둡게
              color: '#fff' 
            }}
            itemStyle={{ color: '#fff' }}
            // [1] 타이틀 변경: symbol(USD) 대신 name(미국 달러)을 보여줌
            // label은 현재 X축 값(symbol)이 들어오는데, 이걸로 data 배열에서 name을 찾아서 보여줍니다.
            labelFormatter={(label) => {
              const item = data.find(d => d.symbol === label);
              return item ? item.name : label;
            }}
            // [2] 값 포맷 변경: 소수점 2자리 + 천단위 콤마 + 단위(원) 추가
            formatter={(value: number | undefined) => [
              `${value?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 원`, 
              "환율" // 'price' 대신 보여줄 라벨 이름
            ]}
            />
            <Bar dataKey="price" radius={[4, 4, 0, 0]} barSize={40}>
              {data.map((_entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
  );
}
