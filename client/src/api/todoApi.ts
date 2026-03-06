import axios from 'axios';
import type { TodoDTO } from '../types/dtos';

export const todoApi = {
  getTodos: async (): Promise<TodoDTO[]> => {
    const { data } = await axios.get<TodoDTO[]>('/api/todos');
    return data;
  },

  createTodo: async (todo: Partial<TodoDTO>): Promise<TodoDTO> => {
    const { data } = await axios.post<TodoDTO>('/api/todos', todo);
    return data;
  },

  updateTodo: async (id: number, todo: Partial<TodoDTO>): Promise<TodoDTO> => {
    const { data } = await axios.put<TodoDTO>(`/api/todos/${id}`, todo);
    return data;
  },

  deleteTodo: async (id: number): Promise<void> => {
    await axios.delete(`/api/todos/${id}`);
  }
};
