import { createContext, useContext } from 'react';
import { type UserDTO } from '../types/dtos';

// 인증 상태 타입 정의
export interface AuthContextType {
  authState: {
    authenticated: boolean;
    user: UserDTO | null;
    loading: boolean;
  };
  isAuthenticated: boolean;
  isLoading: boolean;
  user: UserDTO | null;
  login: (id: string, password: string, keepLogin: boolean) => Promise<void>;
  logout: (reason?: string, force?: boolean) => void;
  checkAuth: () => Promise<boolean>;
}

// Context 객체 생성
export const AuthContext = createContext<AuthContextType | null>(null);

// Hook 정의
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
