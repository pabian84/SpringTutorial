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

  // 로그아웃
  logout: async () => {
    const { data } = await axios.post('/api/user/logout');
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