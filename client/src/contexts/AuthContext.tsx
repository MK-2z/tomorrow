import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

import { authApi } from '@client/src/api';
import type { QualityEvalUser, UserRole } from '@shared/api.interface';

const USER_KEY = 'quality_eval_user';
const TOKEN_KEY = 'quality_eval_token';
const PORTAL_KEY = 'quality_eval_login_portal';

interface AuthContextValue {
  currentUser: QualityEvalUser | null;
  isLoading: boolean;
  login: (studentId: string, password: string, portal: 'student' | 'teacher') => Promise<QualityEvalUser>;
  logout: () => void;
  updateProfile: (displayName: string, className: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<QualityEvalUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(USER_KEY);
    if (stored) {
      try {
        const user: QualityEvalUser = JSON.parse(stored);
        setCurrentUser(user);
      } catch {
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(TOKEN_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (studentId: string, password: string, portal: 'student' | 'teacher'): Promise<QualityEvalUser> => {
    const res = await authApi.login(studentId, password);
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    localStorage.setItem(TOKEN_KEY, res.token);
    localStorage.setItem(PORTAL_KEY, portal);
    setCurrentUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback((): void => {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(PORTAL_KEY);
    setCurrentUser(null);
  }, []);

  const updateProfile = useCallback(async (displayName: string, className: string): Promise<void> => {
    const updatedUser = await authApi.updateProfile(displayName, className);
    localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
    setCurrentUser(updatedUser);
  }, []);

  const value: AuthContextValue = {
    currentUser,
    isLoading,
    login,
    logout,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function getStoredUser(): QualityEvalUser | null {
  const stored = localStorage.getItem(USER_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as QualityEvalUser;
  } catch {
    return null;
  }
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getLoginPortal(): 'student' | 'teacher' | null {
  const v = localStorage.getItem(PORTAL_KEY);
  return v === 'student' || v === 'teacher' ? v : null;
}

export function hasRole(user: QualityEvalUser | null, roles: UserRole[]): boolean {
  if (!user) return false;
  return roles.includes(user.role);
}
