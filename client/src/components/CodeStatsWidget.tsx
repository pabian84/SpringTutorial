import { useEffect, useState } from 'react';
import axios from 'axios';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface CodeData {
  name: string;
  value: number;
  [key: string]: string | number;
}

export default function CodeStatsWidget() {
  const [data, setData] = useState<CodeData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get<Record<string, number>>('/api/stats/code')
      .then(res => {
        // Map 데이터를 배열로 변환
        const chartData = Object.entries(res.data).map(([name, value]) => ({
          name,
          value
        }));
        // 값 큰 순서대로 정렬 (보기에 좋음)
        chartData.sort((a, b) => b.value - a.value);
        
        setData(chartData);
        setLoading(false);
      })
      .catch(err => {
        console.error("코드 통계 로드 실패", err);
        setLoading(false);
      });
  }, []);

  // 언어별 브랜드 컬러 (Java:빨강, TS:파랑, CSS:하늘색, 기타:회색)
  const COLORS = ['#ea2d2e', '#3178c6', '#2965f1', '#999999'];

  if (loading) return <div style={{ color: '#aaa', textAlign: 'center', lineHeight: '250px' }}>소스코드 분석 중...</div>;

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="value"
          >
            {data.map((_entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ backgroundColor: '#333', border: 'none', borderRadius: '8px', color: '#fff' }}
            itemStyle={{ color: '#fff' }}
            formatter={(value: number | undefined) => [`${value?.toLocaleString()} Lines`, '코드 라인 수']}
          />
          <Legend 
            verticalAlign="bottom" 
            height={36} 
            iconType="circle"
            wrapperStyle={{ fontSize: '12px', color: '#ccc' }}
          />
          {/* 중앙 텍스트: 가장 많은 언어 표시 */}
          <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" fill="white" style={{ fontSize: '14px', fontWeight: 'bold' }}>
            {data.length > 0 ? data[0].name : ''}
          </text>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}