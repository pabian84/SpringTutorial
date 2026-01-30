import axios from 'axios';
import type { DeviceSessionDTO, UserDTO } from '../types/dtos';

export const sessionApi = {
  // 내 기기 목록 조회
  getMySessions: async () => {
    const { data } = await axios.get<DeviceSessionDTO[]>('/api/sessions');
    return data;
  },

  refreshToken: async () => {
    const {data} = await axios.post('/api/sessions/refresh');
    return data;
  },

  // 특정 기기 강제 로그아웃 (Kick)
  revokeSession: async (targetSessionId: number) => {
    const {data} = await axios.post('/api/sessions/revoke', { targetSessionId });
    return data;
  },

  // 나를 제외한 다른 기기 모두 로그아웃
  revokeOthers: async () => {
    const {data} = await axios.delete('/api/sessions/others');
    return data;
  },

  // 모든 기기 로그아웃
  revokeAll: async () => {
    const {data} = await axios.delete('/api/sessions/all');
    return data;
  },
  
  // 현재 접속자 목록 (온라인 리스트)
  getOnlineUsers: async () => {
    const { data } = await axios.get<UserDTO[]>('/api/sessions/onlineList');
    return data;
  }
};