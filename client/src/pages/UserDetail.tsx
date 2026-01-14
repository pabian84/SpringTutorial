import axios from 'axios';
import { useEffect, useState } from 'react';
import { FaChrome, FaDesktop, FaEdge, FaFirefox, FaMobileAlt, FaQuestionCircle, FaSafari } from 'react-icons/fa';
import { useNavigate, useParams } from 'react-router-dom';
import type { AccessLogDTO } from '../types/dtos';
import { showAlert } from '../utils/alert';

export default function UserDetail() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<AccessLogDTO[]>([]);

  useEffect(() => {
    // API 호출
    axios.get(`/api/user/logs/${userId}`)
         .then(res => {
            setLogs(res.data);
         })
         .catch(e => {
            console.error(e);
            showAlert('오류 발생', '로그 조회 실패.', 'error');
         });
  }, [userId]);

  // [수정 1] 날짜 포맷팅 함수 (보기 좋은 형태로 변환)
  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    // 날짜가 유효하지 않으면 원본 문자열 반환
    if (isNaN(date.getTime())) return dateString; 
    
    // 예: 2024. 12. 17. 오후 5:30:00
    return date.toLocaleString('ko-KR'); 
  };

  // 아이콘 매핑 헬퍼
  const getBrowserIcon = (browser: string) => {
    const b = browser?.toLowerCase() || '';
    if (b.includes('chrome')) return <FaChrome color="#4285F4" />;
    if (b.includes('edge')) return <FaEdge color="#0078D7" />;
    if (b.includes('safari')) return <FaSafari color="#00A4E0" />;
    if (b.includes('firefox')) return <FaFirefox color="#FF7139" />;
    return <FaQuestionCircle color="#888" />;
  };

  const getOsIcon = (os: string) => {
    const o = os?.toLowerCase() || '';
    if (o.includes('windows') || o.includes('mac')) return <FaDesktop color="#ccc" />;
    if (o.includes('android') || o.includes('iphone')) return <FaMobileAlt color="#ccc" />;
    return <FaQuestionCircle color="#888" />;
  };

  // [수정 2] 스타일 객체로 분리 (다크 모드 디자인 통일)
  const styles = {
    container: {
      padding: '20px',
      color: '#eaeaea', // 기본 글자색 밝게
      maxWidth: '800px',
      margin: '0 auto'
    },
    backButton: {
      marginBottom: '20px',
      padding: '8px 16px',
      backgroundColor: '#333',
      color: 'white',
      border: '1px solid #555',
      borderRadius: '4px',
      cursor: 'pointer'
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse' as const,
      marginTop: '10px',
      backgroundColor: '#1f2937', // 카드 배경색과 통일
      boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
      borderRadius: '8px',
      overflow: 'hidden' // 테두리 둥글게 적용
    },
    th: {
      backgroundColor: '#0f3460', // 헤더를 어두운 남색으로 변경 (개판 해결)
      color: 'white',
      padding: '12px',
      textAlign: 'left' as const,
      borderBottom: '2px solid #444'
    },
    td: {
      padding: '12px',
      borderBottom: '1px solid #333',
      color: '#ddd'
    },
    typeLogin: {
      color: '#4ade80', // 밝은 초록색
      fontWeight: 'bold'
    },
    typeLogout: {
      color: '#f87171', // 밝은 빨간색
      fontWeight: 'bold'
    },
    infoTag: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      marginRight: '10px',
      backgroundColor: '#374151',
      padding: '4px 8px',
      borderRadius: '4px',
      fontSize: '12px'
    }
  };

  return (
    <div style={styles.container}>
      <button onClick={() => navigate(-1)} style={styles.backButton}>
        &lt; Back
      </button>
      
      <h2 style={{ borderBottom: '1px solid #444', paddingBottom: '10px' }}>
        User Activity: <span style={{ color: '#e94560' }}>{userId}</span>
      </h2>
      
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={{ ...styles.th, width: '25%' }}>Time</th>
            <th style={{ ...styles.th, width: '15%' }}>Type</th>
            <th style={styles.th}>Environment (OS / Browser)</th>
            <th style={styles.th}>IP</th>
          </tr>
        </thead>
        <tbody>
          {logs.length === 0 ? (
            <tr>
              <td colSpan={4} style={{ ...styles.td, textAlign: 'center', padding: '30px' }}>
                기록된 활동 로그가 없습니다.
              </td>
            </tr>
          ) : (
            logs.map((log, idx) => (
              <tr key={idx}>
                <td style={styles.td}>
                    {/* [수정] 날짜 포맷 적용 */}
                    {formatDate(log.logTime)}
                </td>
                <td style={styles.td}>
                  {log.type === 'LOGIN' ? (
                    <span style={styles.typeLogin}>🔵 로그인 (Login)</span>
                  ) : (
                    <span style={styles.typeLogout}>🔴 로그아웃 (Logout)</span>
                  )}
                </td>
                <td style={styles.td}>
                  <span style={styles.infoTag}>{getOsIcon(log.os)} {log.os || 'Unknown'}</span>
                  <span style={styles.infoTag}>{getBrowserIcon(log.browser)} {log.browser || 'Unknown'}</span>
                </td>
                <td style={{ ...styles.td, fontFamily: 'monospace', color: '#aaa' }}>{log.ipAddress}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}