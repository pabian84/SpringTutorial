import { memo, useEffect, useState } from 'react';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { statsApi } from '../api/widgetApi';
import type { CodeData } from '../types/dtos';

// 언어별 브랜드 컬러 (Java:빨강, TS:파랑, CSS:하늘색, 기타:회색)
const COLORS = ['#ea2d2e', '#3178c6', '#2965f1', '#999999'];

interface ChartProps {
  data: CodeData[];
}

// React.memo 적용
// 부모 컴포넌트(Dashboard)가 리렌더링(예: 서버 모니터링 업데이트)되어도,
// codeData가 변경되지 않았다면 이 컴포넌트는 리렌더링을 방지합니다.
const CodeStatsWidget = memo(({ data }: ChartProps) => {
  return <CodeStatsChart data={data} />;
}, (prevProps, nextProps) => {
  // [최적화] 데이터 참조가 같으면 리렌더링 하지 않음
  // React Query를 사용하므로 데이터가 변하지 않으면 참조값(Reference)도 유지됩니다.
  return prevProps.data === nextProps.data;
});

export default CodeStatsWidget;

// [독립 실행형] 자체적으로 데이터 로딩 후 렌더링 (Standalone Component)
export function StrandaloneCodeStatsWidget() {
  const [data, setData] = useState<CodeData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    statsApi.getCodeStats()
      .then(data => {
        // Map 데이터를 배열로 변환
        const chartData = Object.entries(data).map(([name, value]) => ({
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

  if (loading) return <div style={{ color: '#aaa', textAlign: 'center', lineHeight: '250px' }}>소스코드 분석 중...</div>;

  return <CodeStatsChart data={data} />;
}

// [공통] 차트 렌더링 전용 컴포넌트
// 메모이제이션된 상위 컴포넌트에서 호출되므로, 불필요한 호출이 차단됨.
function CodeStatsChart({ data }: ChartProps) {
  // 데이터가 없을 경우 처리
  if (!data || data.length === 0) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
        No Data
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius="60%" // 고정 픽셀(60) -> 퍼센트("60%")로 변경하여 반응형 적용
            outerRadius="80%" // 고정 픽셀(80) -> 퍼센트("80%")로 변경하여 반응형 적용
            paddingAngle={5}
            dataKey="value"
            isAnimationActive={true}
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