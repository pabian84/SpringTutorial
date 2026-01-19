import React from 'react';
import { BiArrowBack } from 'react-icons/bi';
import { useNavigate } from 'react-router-dom';
import { CesiumMapViewer } from '../components/cesium/CesiumMapViewer'; // 공통 컴포넌트 임포트

const CesiumDetail: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* 상세 페이지 전용 헤더 */}
      <div style={{ 
        height: '60px', backgroundColor: '#1e1e1e', display: 'flex', alignItems: 'center', 
        padding: '0 20px', borderBottom: '1px solid #333', zIndex: 10 
      }}>
        <button 
          onClick={() => navigate(-1)} 
          style={{ 
            background: 'none', border: 'none', color: '#fff', fontSize: '1.2rem', 
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' 
          }}
        >
          <BiArrowBack /> 뒤로가기
        </button>
        <h2 style={{ marginLeft: '20px', color: '#fff', fontSize: '1.2rem' }}>위성 관제 상세 모드</h2>
      </div>

      {/* 뷰어 영역 */}
      <div style={{ flex: 1, position: 'relative' }}>
        <CesiumMapViewer full>
            {/* 필요하다면 여기에 추가 UI 넣을 수 있음 */}
        </CesiumMapViewer>
      </div>
    </div>
  );
};

export default CesiumDetail;