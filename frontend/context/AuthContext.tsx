import React, { createContext, useContext, ReactNode } from 'react';
import useAuthStore from '../lib/auth-store';

// Тип для контекста авторизации
type AuthContextType = ReturnType<typeof useAuthStore>;

// Создаем контекст авторизации
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Провайдер контекста авторизации
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Получаем состояние и методы из хранилища Zustand
  const authState = useAuthStore();

  return (
    <AuthContext.Provider value={authState}>
      {children}
    </AuthContext.Provider>
  );
};

// Хук для использования контекста авторизации
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext; 