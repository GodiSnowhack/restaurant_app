export type UserRole = 'admin' | 'waiter' | 'client';

export interface User {
  id: number;
  email: string;
  role: UserRole;
  full_name: string;
  phone?: string;
  birthday?: string;
  age_group?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
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