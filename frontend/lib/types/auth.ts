export type UserRole = 'admin' | 'waiter' | 'guest' | 'user';

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: 'admin' | 'waiter' | 'guest' | 'user';
  is_active: boolean;
  phone?: string;
  created_at?: string;
  updated_at?: string;
  last_login?: string;
  orders_count?: number;
  reservations_count?: number;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
  detail?: string;
  message?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  error: string | null;
  isLoading: boolean;
  fetchUserProfile?: () => Promise<void>;
  isMobileDevice?: () => boolean;
  setInitialAuthState?: () => void;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials extends LoginCredentials {
  full_name: string;
  phone?: string;
} 