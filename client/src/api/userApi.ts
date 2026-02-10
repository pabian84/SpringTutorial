import axios from 'axios';
import type { AccessLogDTO, LoginResDTO, UserDTO } from '../types/dtos';

export const userApi = {
  // 로그인
  login: async (id: string, password: string, isRememberMe: boolean) => {
    const { data } = await axios.post<LoginResDTO>('/api/user/login', { 
      id, 
      password,
      isRememberMe 
    });
    return data;
  },

  // 로그아웃 (서버 세션 삭제 + 쿠키 삭제)
  // userId: 토큰 만료 시 body로 전달
  logout: async (userId?: string) => {
    const body = userId ? { userId } : {};
    const { data } = await axios.post('/api/user/logout', body);
    return data;
  },

  // 유저 목록 (관리자/테스트용)
  getUserList: async () => {
    const { data } = await axios.get<UserDTO[]>('/api/user/list');
    return data;
  },

  logs: async () => {
    const { data } = await axios.get<AccessLogDTO[]>('/api/users/logs');
    return data;
  }
};