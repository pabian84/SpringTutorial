import { useEffect, useState } from 'react';
import { FaSave, FaArrowLeft, FaGoogle, FaRobot } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { userApi } from '../api/userApi';
import type { UserSettingsDTO } from '../types/dtos';
import { showAlert, showToast } from '../utils/Alert';

export default function Settings() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<Partial<UserSettingsDTO>>({
    defaultAiEngine: 'google'
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // 마운트 시 설정 불러오기
    userApi.getSettings()
      .then(data => {
        if (data) setSettings(data);
      })
      .catch(() => {
        showToast('설정을 불러오지 못했습니다.', 'warning');
      });
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await userApi.updateSettings(settings);
      showToast('설정이 안전하게 저장되었습니다.', 'success');
      navigate('/dashboard'); // 저장 후 대시보드로 복귀
    } catch {
      showAlert('오류', '설정 저장에 실패했습니다.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const styles = {
    container: {
      padding: '40px 20px',
      color: '#eaeaea',
      maxWidth: '600px',
      margin: '0 auto',
      minHeight: '100vh',
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      gap: '15px',
      marginBottom: '30px',
      borderBottom: '1px solid #444',
      paddingBottom: '20px',
    },
    title: { margin: 0, fontSize: '28px', color: '#00c6ff' },
    card: {
      backgroundColor: '#1f2937',
      padding: '30px',
      borderRadius: '12px',
      boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
      marginBottom: '20px',
    },
    formGroup: { marginBottom: '25px' },
    label: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '15px', fontWeight: 'bold' as const },
    input: {
      width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #555',
      backgroundColor: '#374151', color: '#fff', fontSize: '15px', outline: 'none'
    },
    helperText: { fontSize: '12px', color: '#888', marginTop: '6px' },
    btnPrimary: {
      backgroundColor: '#00c6ff', color: '#000', padding: '12px 24px', borderRadius: '6px',
      border: 'none', fontWeight: 'bold' as const, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
      width: '100%', justifyContent: 'center', fontSize: '16px'
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
          <FaArrowLeft size={24} />
        </button>
        <h1 style={styles.title}>비서 환경 설정 (My Page)</h1>
      </div>

      <form onSubmit={handleSave}>
        {/* 구글 캘린더 연동 섹션 */}
        <div style={styles.card}>
          <h2 style={{ fontSize: '18px', marginBottom: '20px', borderBottom: '1px solid #444', paddingBottom: '10px' }}>
            📅 구글 캘린더 연동 (읽기 전용)
          </h2>
          
          <div style={styles.formGroup}>
            <label style={styles.label}><FaGoogle color="#4285F4" /> 캘린더 ID (이메일 주소)</label>
            <input
              type="text" name="googleCalendarId"
              value={settings.googleCalendarId || ''} onChange={handleChange}
              placeholder="예: user@gmail.com" style={styles.input}
            />
            <div style={styles.helperText}>구글 캘린더 설정에서 '공개'로 설정된 캘린더 ID를 입력하세요.</div>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>🔑 구글 API Key (Google Cloud Console)</label>
            <input
              type="password" name="googleApiKey"
              value={settings.googleApiKey || ''} onChange={handleChange}
              placeholder="AIzaSyB..." style={styles.input}
            />
            <div style={styles.helperText}>GCP에서 발급받은 'Calendar API' 접근 권한이 있는 API Key를 입력하세요. (서버에 안전하게 보관됩니다)</div>
          </div>
        </div>

        {/* AI 검색 위젯 기본값 설정 */}
        <div style={styles.card}>
          <h2 style={{ fontSize: '18px', marginBottom: '20px', borderBottom: '1px solid #444', paddingBottom: '10px' }}>
            🤖 기본 검색 / AI 엔진
          </h2>
          <div style={styles.formGroup}>
            <label style={styles.label}><FaRobot color="#8E44AD" /> AI Search Hub 기본값</label>
            <select
              name="defaultAiEngine"
              value={settings.defaultAiEngine || 'google'} onChange={handleChange}
              style={{ ...styles.input, appearance: 'auto' }}
            >
              <option value="google">Google 검색</option>
              <option value="naver">Naver 검색</option>
              <option value="chatgpt">ChatGPT</option>
              <option value="perplexity">Perplexity</option>
              <option value="gemini">Gemini</option>
            </select>
          </div>
        </div>

        <button type="submit" disabled={isSaving} style={{ ...styles.btnPrimary, opacity: isSaving ? 0.7 : 1 }}>
          <FaSave size={18} /> {isSaving ? '저장 중...' : '모든 설정 저장하기'}
        </button>
      </form>
    </div>
  );
}
