import { useEffect, useState } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// 서버에서 받아올 데이터 타입 정의 (DTO와 일치시킴)
interface StockRes {
  symbol: string;
  name: string;
  price: number;
  change: number;
}

export default function ExchangeWidget() {
  const [data, setData] = useState<StockRes[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 스프링 서버 API 호출
    axios.get<StockRes[]>('/api/finance/dashboard')
      .then(res => {
        setData(res.data);
      })
      .catch(err => {
        console.error("환율 데이터 로딩 실패:", err);
        setLoading(false);
      });
  }, []);

  // 차트 막대 색상 (미국: 파랑, 일본: 빨강, 유럽: 노랑/주황)
  const colors = ['#3b82f6', '#ef4444', '#f59e0b'];

  if (loading) {
    return <div style={{ color: '#aaa', textAlign: 'center', lineHeight: '250px' }}>데이터 로딩 중...</div>;
  }

  return (
    <div style={{ padding: '20px', background: '#fff', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
      <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: 'bold', color: '#333' }}>
        🌍 실시간 주요 환율 (KRW)
      </h3>
      
      <div style={{ width: '100%', height: '250px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <XAxis dataKey="symbol" tick={{ fill: '#666' }} />
            <YAxis tick={{ fill: '#666' }} />
            <Tooltip 
              cursor={{ fill: 'transparent' }}
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}
            />
            <Bar dataKey="price" radius={[8, 8, 0, 0]} barSize={50}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}