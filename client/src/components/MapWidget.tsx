import { useEffect } from 'react'; // 추가
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'; // useMap 추가
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// [추가됨] 지도의 중심을 강제로 이동시키는 도우미 컴포넌트
function RecenterAutomatically({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng]); // 좌표가 바뀌면 지도 시점을 이동시킴
  }, [lat, lng, map]);
  return null;
}

// [수정됨] 부모(Dashboard)에게서 좌표를 받아옴
interface MapProps {
  lat: number;
  lon: number;
}

export default function MapWidget({ lat, lon }: MapProps) {
  const position: [number, number] = [lat, lon];

  return (
    <MapContainer 
      center={position} 
      zoom={13} 
      style={{ height: '100%', width: '100%', borderRadius: '12px' }}
    >
      {/* 이 한 줄이 지도를 움직이게 만듭니다 */}
      <RecenterAutomatically lat={lat} lng={lon} />

      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={position}>
        <Popup>
          현재 위치입니다. <br />
          ({lat.toFixed(4)}, {lon.toFixed(4)})
        </Popup>
      </Marker>
    </MapContainer>
  );
}