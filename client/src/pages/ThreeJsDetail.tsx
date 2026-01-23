import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BiArrowBack, BiUpload } from 'react-icons/bi';
import RobotArmScene from '../components/threejs/RobotArmScene';

export default function ThreeJsDetail() {
  const navigate = useNavigate();
  const [modelUrl, setModelUrl] = useState<string | null>(null);

  // 파일 업로드 핸들러
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // 기존 URL 메모리 해제 (메모리 누수 방지)
      if (modelUrl) URL.revokeObjectURL(modelUrl);
      
      // Blob URL 생성
      const url = URL.createObjectURL(file);
      setModelUrl(url);
    }
  };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#000' }}>
      {/* Header UI Layer */}
      <div style={{
        position: 'absolute', top: 20, left: 20, zIndex: 10,
        display: 'flex', gap: '10px', alignItems: 'center'
      }}>
        <button
          onClick={() => navigate('/dashboard')}
          style={{
            background: 'rgba(30,30,30,0.8)', border: '1px solid #555', color: 'white',
            padding: '10px 15px', borderRadius: '8px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '5px',
            backdropFilter: 'blur(4px)'
          }}
        >
          <BiArrowBack /> Back
        </button>

        {/* 모델 업로드 버튼 */}
        <label style={{
          background: 'rgba(30,30,30,0.8)', border: '1px solid #3178c6', color: '#3178c6',
          padding: '10px 15px', borderRadius: '8px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '5px',
          backdropFilter: 'blur(4px)', fontWeight: 'bold'
        }}>
          <BiUpload /> Load .GLB / .GLTF
          <input 
            type="file" 
            accept=".glb,.gltf" 
            onChange={handleFileUpload} 
            style={{ display: 'none' }} 
          />
        </label>
        
        {modelUrl && (
          <span style={{ color: '#aaa', fontSize: '12px', background: 'rgba(0,0,0,0.5)', padding: '5px 10px', borderRadius: '4px' }}>
            Custom Model Loaded
          </span>
        )}
      </div>

      {/* 3D Scene with Detail Mode ON */}
      <RobotArmScene isDetail={true} customModelUrl={modelUrl} />
    </div>
  );
}