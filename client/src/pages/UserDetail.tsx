import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { showAlert } from '../utils/Alert';

interface LogData {
  seq: number;
  type: string;
  logTime: string;
}

export default function UserDetail() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<LogData[]>([]);

  useEffect(() => {
    // [수정됨] 서버 경로 변경 반영: /api/logs -> /api/user/logs
    axios.get(`http://localhost:8080/api/user/logs/${userId}`)
         .then(res => {
            setLogs(res.data);
         })
         .catch(e => {
            console.error(e);
            // [변경] 서버 에러
            showAlert('오류 발생', '로그 조회 실패.', 'error');
         });
  }, [userId]);

  return (
    <div style={{ padding: 20 }}>
      <button onClick={() => { navigate(-1); }} style={{ marginBottom: 20 }}>&lt; Back</button>
      <h2>User Activity: {userId}</h2>
      
      <table border={1} cellPadding={10} style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr style={{ background: '#f0f0f0' }}>
            <th>Time</th>
            <th>Activity</th>
          </tr>
        </thead>
        <tbody>
          {logs.map(log => {
            return (
              <tr key={log.seq}>
                <td>{log.logTime}</td>
                <td>{log.type === 'LOGIN' ? '🔵 로그인' : '🔴 로그아웃'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}