import { create } from 'zustand';

interface User {
  number: string;
  name: string;
  userType: 'admin' | 'user';
  isActive: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  initialized: boolean;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  init: () => void;
}

const getInitialState = () => {
  if (typeof window === 'undefined') return { user: null, token: null, initialized: false };

  const token = localStorage.getItem('auth_token');
  const userData = localStorage.getItem('user_data');

  if (token && userData) {
    try {
      return { user: JSON.parse(userData), token, initialized: true };
    } catch (e) {
      return { user: null, token: null, initialized: true };
    }
  }

  return { user: null, token: null, initialized: false };
};

export const useAuthStore = create<AuthState>((set) => ({
  ...getInitialState(),
  setAuth: (user, token) => {
    localStorage.setItem('auth_token', token);
    localStorage.setItem('user_data', JSON.stringify(user));
    set({ user, token, initialized: true });
  },
  logout: () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    set({ user: null, token: null, initialized: true });
  },
  init: () => {
    const state = getInitialState();
    set({ ...state, initialized: true });
  },
}));
