import { createContext } from 'react';
import type { Role, UserProfile } from '../types';

export interface LoginOptions {
  password?: string;
  name?: string;
  businessName?: string;
  mode?: 'signin' | 'signup';
}

export interface AuthContextValue {
  user: UserProfile | null;
  login: (email: string, role: Role, options?: LoginOptions) => Promise<void> | void;
  logout: () => void;
  canManage: boolean;
  hasFinancialAccess: boolean;
  usingSupabase: boolean;
  authLoading: boolean;
  authError: string | null;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
