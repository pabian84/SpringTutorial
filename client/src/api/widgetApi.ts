import axios from 'axios';
import type { ChatHistoryDTO, MemoDTO, StockDTO, WeatherDTO } from '../types/dtos';

export const weatherApi = {
  getWeather: async (lat: number, lon: number, hourlyLimit = 26, includeWeekly = true) => {
    const { data } = await axios.get<WeatherDTO>(`/api/weather`, {
      params: { lat, lon, hourlyLimit, includeWeekly }
    });
    return data;
  }
};

export const statsApi = {
  getCodeStats: async () => {
    const { data } = await axios.get<Record<string, number>>('/api/stats/code');
    return data;
  }
};

export const financeApi = {
  getExchangeRates: async () => {
    const { data } = await axios.get<StockDTO[]>('/api/finance/dashboard');
    return data;
  }
};

export const memoApi = {
  getMemos: async (userId: string) => {
    const { data } = await axios.get<MemoDTO[]>(`/api/memo/${userId}`);
    return data;
  },
  
  addMemo: async (userId: string, content: string) => {
    const {data} = await axios.post('/api/memo', { userId, content });
    return data;
  },

  deleteMemo: async (id: number) => {
    const {data} = await axios.delete(`/api/memo/${id}`);
    return data;
  }
};

export const chatApi = {
  getHistory: async () => {
    const { data } = await axios.get<ChatHistoryDTO[]>('/api/chat/history');
    return data;
  }
};