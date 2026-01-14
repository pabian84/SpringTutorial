import { useState } from 'react';
import { Map, CustomOverlayMap, useMap, useKakaoLoader, MapMarker } from 'react-kakao-maps-sdk';
import { FaMapMarkerAlt, FaPlus, FaMinus, FaCrosshairs, FaTimes } from 'react-icons/fa';

// [스타일] 공통 버튼 스타일
const buttonStyle: React.CSSProperties = {
  backgroundColor: 'rgba(30, 30, 40, 0.9)',
  backdropFilter: 'blur(4px)',
  border: '1px solid rgba(255, 255, 255, 0.2)',
  borderRadius: '8px',
  color: '#fff',
  width: '36px',
  height: '36px',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  cursor: 'pointer',
  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
  transition: 'all 0.2s ease',
  fontSize: '14px',
};

// [컴포넌트] 지도 컨트롤러
function MapControls({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap();
  return (
    <div style={{ position: 'absolute', right: '16px', bottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px', zIndex: 10 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <button onClick={() => map.setLevel(map.getLevel() - 1)} title="확대" style={{ ...buttonStyle, borderRadius: '8px 8px 0 0', borderBottom: 'none' }}><FaPlus /></button>
        <button onClick={() => map.setLevel(map.getLevel() + 1)} title="축소" style={{ ...buttonStyle, borderRadius: '0 0 8px 8px' }}><FaMinus /></button>
      </div>
      <button onClick={() => map.panTo(new window.kakao.maps.LatLng(lat, lon))} title="내 위치로 이동" style={buttonStyle}><FaCrosshairs /></button>
    </div>
  );
}

// [컴포넌트] 개선된 커스텀 마커 (색상 분리 + 투명도 + 거리 조절)
function CustomMarker({ lat, lon }: { lat: number; lon: number }) {
  return (
    <CustomOverlayMap position={{ lat, lng: lon }} yAnchor={1} zIndex={30}>
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'flex-end', width: '50px', height: '50px' }}>
        
        {/* 1. 파동 애니메이션 (투명한 사이버 블루) */}
        <style>
          {`
            @keyframes pulseCyber {
              0% { box-shadow: 0 0 0 0 rgba(77, 144, 254, 0.6); } /* 시작: 진한 파랑 (반투명) */
              70% { box-shadow: 0 0 0 15px rgba(77, 144, 254, 0); } /* 끝: 투명 */
              100% { box-shadow: 0 0 0 0 rgba(77, 144, 254, 0); }
            }
            @keyframes float {
              0% { transform: translateY(0px); }
              50% { transform: translateY(-5px); }
              100% { transform: translateY(0px); }
            }
          `}
        </style>
        
        {/* 2. 마커 본체 (투명한 코랄 레드) */}
        <div style={{
          fontSize: '36px',
          color: 'rgba(255, 107, 107, 0.85)', // [변경] 마커 자체를 반투명하게 설정
          filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.2))', // 그림자도 부드럽게
          animation: 'float 2s ease-in-out infinite',
          zIndex: 20,
          marginBottom: '8px' // [변경] 거리 좁힘 (15px -> 8px)
        }}>
          <FaMapMarkerAlt />
        </div>

        {/* 3. 바닥 점 (색상 다르게: 사이버 블루) */}
        <div style={{
          position: 'absolute',
          bottom: '5px',
          width: '12px',
          height: '12px',
          backgroundColor: 'rgba(77, 144, 254, 0.8)', // [변경] 마커와 다른 파란색 계열
          borderRadius: '50%',
          animation: 'pulseCyber 2s infinite', // [변경] 파란색 파동
          zIndex: 10
        }} />
      </div>
    </CustomOverlayMap>
  );
}

// [컴포넌트] 클릭한 위치 정보 표시 (말풍선)
function LocationInfoWindow({ position, address, onClose }: { position: { lat: number, lng: number }, address: string, onClose: () => void }) {
  return (
    <CustomOverlayMap position={position} yAnchor={1.4} zIndex={40}>
      <div style={{
        backgroundColor: 'rgba(30, 30, 40, 0.85)', // [변경] 배경 더 투명하게 (Glassmorphism 강화)
        backdropFilter: 'blur(8px)',
        padding: '12px 16px',
        borderRadius: '12px',
        border: '1px solid rgba(255,255,255,0.15)',
        boxShadow: '0 8px 20px rgba(0,0,0,0.3)',
        color: 'white',
        minWidth: '200px',
        maxWidth: '280px',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <span style={{ fontSize: '11px', color: '#aaa', fontWeight: 600 }}>ADDRESS</span>
          <button onClick={(e) => { e.stopPropagation(); onClose(); }} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0 }}><FaTimes /></button>
        </div>
        <div style={{ fontSize: '14px', fontWeight: 500, lineHeight: '1.4' }}>{address}</div>
        
        {/* 말풍선 꼬리 */}
        <div style={{
          position: 'absolute', bottom: '-8px', left: '50%', transform: 'translateX(-50%)',
          width: 0, height: 0,
          borderLeft: '8px solid transparent',
          borderRight: '8px solid transparent',
          borderTop: '8px solid rgba(30, 30, 40, 0.85)'
        }} />
      </div>
    </CustomOverlayMap>
  );
}

interface MapProps {
  lat: number;
  lon: number;
}

export default function KakaoMapWidget({ lat, lon }: MapProps) {
  //throw new Error("테스트용 강제 에러 발생 - 대시보드에서 에러 경계 컴포넌트 작동 확인");
  const [loading, error] = useKakaoLoader({
    appkey: "6262d94b2fbdda55d1e6cbc1b4c3b4c6", 
    libraries: ["services", "clusterer"],
  });

  const [selectedInfo, setSelectedInfo] = useState<{ position: { lat: number, lng: number }, address: string } | null>(null);

  // [수정] 타입 명시: 첫 번째 인자는 지도 객체(kakao.maps.Map)입니다.
  const handleMapClick = (_map: kakao.maps.Map, mouseEvent: kakao.maps.event.MouseEvent) => {
    const latlng = mouseEvent.latLng;
    const geocoder = new window.kakao.maps.services.Geocoder();
    
    geocoder.coord2Address(latlng.getLat(), latlng.getLng(), (result, status) => {
      if (status === window.kakao.maps.services.Status.OK) {
        const addr = result[0].road_address ? result[0].road_address.address_name : result[0].address.address_name;
        setSelectedInfo({
          position: { lat: latlng.getLat(), lng: latlng.getLng() },
          address: addr
        });
      }
    });
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#888' }}>지도 로딩 중...</div>;
  if (error) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#ff6b6b' }}>지도 로드 실패</div>;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
      {/* [수정] zoomControl 속성 제거 (Map 컴포넌트에 존재하지 않음) */}
      <Map
        center={{ lat, lng: lon }}
        style={{ width: '100%', height: '100%' }}
        level={3}
        onClick={handleMapClick}
      >
        {lat && lon && <CustomMarker lat={lat} lon={lon} />}

        {selectedInfo && (
          <>
            <MapMarker 
              position={selectedInfo.position}
              image={{
                src: "https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/marker_red.png",
                size: { width: 24, height: 35 },
                options: { offset: { x: 12, y: 35 } }
              }}
            />
            <LocationInfoWindow 
              position={selectedInfo.position} 
              address={selectedInfo.address} 
              onClose={() => setSelectedInfo(null)} 
            />
          </>
        )}

        {lat && lon && <MapControls lat={lat} lon={lon} />}
      </Map>
    </div>
  );
}