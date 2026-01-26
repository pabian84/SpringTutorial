import { useEffect, useState } from 'react';
import { 
  FaDesktop, 
  FaMobileAlt, 
  FaTabletAlt, 
  FaTrashAlt, 
  FaShieldAlt, 
  FaSignOutAlt, 
  FaCheckCircle,
  FaArrowLeft,
  FaMapMarkerAlt,
  FaClock,
  FaExclamationTriangle,
  FaUserShield
} from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { showToast, showConfirm } from '../utils/Alert';

// 데이터 타입
interface DeviceSession {
  id: number;
  deviceType: string;
  userAgent: string;
  ipAddress: string;
  location: string;
  lastActive: string;
}

export default function DeviceManagement() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // 데이터 로드
  const fetchSessions = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/sessions');
      setSessions(res.data);
    } catch (e) {
      console.error(e);
      showToast('기기 목록을 불러오지 못했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  // [기능] 개별 로그아웃
  const handleLogoutOne = async (id: number, isCurrent: boolean) => {
    const result = await showConfirm('로그아웃', '해당 기기의 접속을 해제하시겠습니까?');
    if (!result.isConfirmed) return;

    try {
      await axios.delete(`/api/sessions/${id}`);
      if (isCurrent) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');

        // 약간의 딜레이 후 이동 (토스트 메시지 볼 시간 확보)
        setTimeout(() => {
            window.location.href = '/'; 
        }, 500);
        
      } else {
        setSessions((prev) => prev.filter((s) => s.id !== id));
      }
      showToast('접속이 해제되었습니다.', 'success');
    } catch (e) {
      console.error(e);
      showToast('요청 처리에 실패했습니다.', 'error');
    }
  };

  // [기능] 다른 기기 모두 로그아웃
  const handleLogoutOthers = async () => {
    const result = await showConfirm('다른 기기 해제', '현재 기기를 제외한 모든 기기를 로그아웃 하시겠습니까?');
    if (!result.isConfirmed) return;

    try {
      const refreshToken = localStorage.getItem('refreshToken') || '';
      await axios.delete('/api/sessions/others', {
        headers: { 'Refresh-Token': refreshToken }
      });
      await fetchSessions();
      showToast('다른 기기의 접속이 모두 해제되었습니다.', 'success');
    } catch (e) {
      console.error(e);
      showToast('요청 실패', 'error');
    }
  };

  // [기능] 전체 로그아웃
  const handleLogoutAll = async () => {
    const result = await showConfirm('전체 로그아웃', '모든 기기에서 로그아웃 하시겠습니까?');
    if (!result.isConfirmed) return;

    try {
      await axios.delete('/api/sessions/all');
      localStorage.clear();
      showToast('전체 로그아웃 되었습니다.', 'success');
      navigate('/'); 
    } catch (e) {
      console.error(e);
      showToast('요청 실패', 'error');
    }
  };

  // 아이콘 헬퍼
  const getIcon = (type: string) => {
    const t = type ? type.toLowerCase() : 'desktop';
    if (t.includes('mobile')) return <FaMobileAlt size={28} />;
    if (t.includes('tablet')) return <FaTabletAlt size={28} />;
    return <FaDesktop size={28} />;
  };

  // 시간 포맷
  const formatTime = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const now = new Date();
    const diff = (now.getTime() - date.getTime()) / 1000;
    if (diff < 60) return '방금 전';
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
    return date.toLocaleDateString();
  };

  // --------------------------------------------------------------------------
  // [스타일 정의]
  // --------------------------------------------------------------------------
  const styles = {
    container: {
      padding: '20px',
      maxWidth: '1400px',
      margin: '0 auto',
      color: '#eaeaea',
      fontFamily: 'sans-serif',
      minHeight: '100vh',
      backgroundColor: '#16213e',
    },
    
    // 헤더
    header: {
      display: 'flex',
      alignItems: 'center',
      gap: '20px',
      marginBottom: '30px',
      paddingBottom: '20px',
      borderBottom: '1px solid #333',
    },
    backButton: {
      background: '#333',
      border: '1px solid #444',
      color: '#fff',
      cursor: 'pointer',
      width: '40px',
      height: '40px',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'background 0.2s',
      flexShrink: 0,
    },
    title: {
      margin: 0,
      fontSize: '24px',
      fontWeight: 'bold',
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      lineHeight: '1',
    },
    
    // [수정] 안내 카드 레이아웃
    infoCard: {
      background: 'linear-gradient(90deg, #1f2937 0%, #253043 100%)',
      padding: '25px',
      borderRadius: '12px',
      border: '1px solid #374151',
      marginBottom: '30px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap' as const,
      gap: '20px',
    },
    // [수정] 텍스트 영역: Flex 2 (버튼보다 2배 넓게)
    infoText: {
      flex: '2 1 400px', // Grow: 2, Basis: 400px (넓을 땐 2배, 좁으면 줄바꿈)
      minWidth: '280px',
    },
    infoTitle: {
      fontSize: '18px',
      fontWeight: 'bold',
      marginBottom: '8px',
      color: '#fff',
    },

    // [수정] 버튼 그룹: Flex 1 (텍스트의 절반 크기)
    buttonGroup: {
      display: 'flex',
      gap: '12px',
      flexWrap: 'wrap' as const,
      flex: '1 1 300px', // Grow: 1, Basis: 300px
      justifyContent: 'flex-end',
    },
    
    // 버튼 스타일 (50:50 적용)
    actionButton: {
      flex: '1 1 0px', 
      minWidth: '200px',
      padding: '12px 20px',
      borderRadius: '8px',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: 'bold',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      whiteSpace: 'nowrap' as const,
      transition: 'all 0.2s',
    },

    // 그리드
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
      gap: '25px',
    },

    // 카드 스타일
    card: {
      background: '#1f2937',
      borderRadius: '16px',
      border: '1px solid #374151',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column' as const,
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.2)',
    },
    cardHeader: {
      padding: '20px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
    },
    iconBox: {
      width: '50px',
      height: '50px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: '12px',
      background: 'rgba(55, 65, 81, 0.5)',
      color: '#9ca3af',
    },
    currentBadge: {
      background: 'rgba(16, 185, 129, 0.15)',
      color: '#34d399',
      border: '1px solid rgba(16, 185, 129, 0.3)',
      fontSize: '12px',
      padding: '4px 10px',
      borderRadius: '20px',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      fontWeight: 'bold',
    },
    cardBody: {
      padding: '20px',
      flex: 1,
    },
    // [수정] 기기 이름 (2줄 말줄임 처리)
    deviceName: {
      fontSize: '18px',
      fontWeight: 'bold',
      color: '#fff',
      marginBottom: '15px',
      // Webkit Line Clamp 적용
      display: '-webkit-box',
      WebkitLineClamp: 2,
      WebkitBoxOrient: 'vertical' as const,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      lineHeight: '1.4',
      minHeight: '2.8em', // 2줄 높이 확보로 카드 높이 통일
    },
    infoRow: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      fontSize: '14px',
      color: '#9ca3af',
      marginBottom: '8px',
    },
    labelIP: {
      fontFamily: 'monospace',
      background: '#374151',
      padding: '2px 6px',
      borderRadius: '4px',
      fontSize: '12px',
      color: '#d1d5db',
    },
    cardFooter: {
      padding: '15px 20px',
      background: 'rgba(0, 0, 0, 0.2)',
      borderTop: '1px solid rgba(255,255,255,0.05)',
    },
    logoutOneBtn: {
      width: '100%',
      padding: '10px',
      background: 'transparent',
      border: '1px solid transparent',
      color: '#9ca3af',
      cursor: 'pointer',
      borderRadius: '8px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      fontSize: '14px',
      transition: 'all 0.2s',
    },
    emptyState: {
      gridColumn: '1 / -1',
      padding: '80px',
      textAlign: 'center' as const,
      background: 'rgba(31, 41, 55, 0.3)',
      borderRadius: '16px',
      border: '2px dashed #374151',
      color: '#6b7280',
    }
  };

  return (
    <div style={styles.container}>
      {/* 헤더 */}
      <header style={styles.header}>
        <button 
          onClick={() => navigate(-1)} 
          style={styles.backButton}
          title="뒤로 가기"
          onMouseEnter={(e) => { e.currentTarget.style.background = '#444'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#333'; }}
        >
          <FaArrowLeft size={18} />
        </button>
        
        <h1 style={styles.title}>
          <FaShieldAlt size={28} style={{ color: '#4ade80' }} />
          기기 관리
        </h1>
      </header>

      {/* 안내 카드 */}
      <div style={styles.infoCard}>
        <div style={styles.infoText}>
          <div style={styles.infoTitle}>접속 기기 현황</div>
          <p style={{ margin: 0, fontSize: '14px', color: '#9ca3af', lineHeight: '1.5' }}>
            현재 계정에 로그인된 기기 목록입니다. 본인이 아니라면 즉시 로그아웃 하세요.
          </p>
        </div>
        
        {/* 버튼 그룹 */}
        <div style={styles.buttonGroup}>
          {/* 현재 기기 외 모두 로그아웃 */}
          <button 
            onClick={handleLogoutOthers} 
            style={{
              ...styles.actionButton,
              background: '#374151',
              color: '#fff',
              border: '1px solid #4b5563',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#4b5563'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#374151'; }}
          >
            <FaUserShield size={16} />
            현재 기기 외 모두 로그아웃
          </button>

          {/* 전체 로그아웃 */}
          <button 
            onClick={handleLogoutAll} 
            style={{
              ...styles.actionButton,
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#f87171',
              border: '1px solid rgba(239, 68, 68, 0.3)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'; }}
          >
            <FaSignOutAlt size={16} />
            전체 로그아웃
          </button>
        </div>
      </div>

      {/* 기기 리스트 그리드 */}
      <div style={styles.grid}>
        {loading ? (
          <div style={{ ...styles.emptyState, border: 'none' }}>
            <p>기기 정보를 불러오는 중...</p>
          </div>
        ) : sessions.length > 0 ? (
          sessions.map((session, idx) => {
            const isCurrent = idx === 0; 
            
            const cardStyle = isCurrent 
              ? { ...styles.card, border: '1px solid rgba(16, 185, 129, 0.4)', boxShadow: '0 0 15px rgba(16, 185, 129, 0.1)' }
              : styles.card;

            return (
              <div key={session.id} style={cardStyle}>
                <div style={styles.cardHeader}>
                  <div style={{ 
                    ...styles.iconBox, 
                    ...(isCurrent ? { background: 'rgba(16, 185, 129, 0.1)', color: '#34d399' } : {}) 
                  }}>
                    {getIcon(session.deviceType)}
                  </div>
                  {isCurrent && (
                    <div style={styles.currentBadge}>
                      <FaCheckCircle size={10} /> 현재 기기
                    </div>
                  )}
                </div>

                <div style={styles.cardBody}>
                  {/* 기기 이름 (userAgent) */}
                  <h3 style={styles.deviceName} title={session.userAgent}>
                    {session.userAgent}
                  </h3>
                  
                  <div style={styles.infoRow}>
                    <FaMapMarkerAlt size={14} /> {session.location}
                  </div>
                  
                  <div style={styles.infoRow}>
                    <span style={styles.labelIP}>IP</span>
                    {session.ipAddress}
                  </div>

                  <div style={{ ...styles.infoRow, marginTop: '12px' }}>
                    <FaClock size={14} />
                    <span style={{ color: isCurrent ? '#4ade80' : '#9ca3af', fontWeight: isCurrent ? 'bold' : 'normal' }}>
                      {isCurrent ? '활동 중' : formatTime(session.lastActive)}
                    </span>
                  </div>
                </div>

                <div style={styles.cardFooter}>
                  <button 
                    onClick={() => handleLogoutOne(session.id, isCurrent)}
                    style={styles.logoutOneBtn}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = '#f87171';
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = '#9ca3af';
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <FaTrashAlt size={14} /> 로그아웃
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div style={styles.emptyState}>
            <FaExclamationTriangle size={40} style={{ marginBottom: '15px', opacity: 0.5 }} />
            <p>로그인된 기기 정보가 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
}