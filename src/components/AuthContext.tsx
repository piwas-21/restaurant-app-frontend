'use client';

import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { refreshToken } from '@/services/authService';

interface User {
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  accessToken: string;
}

interface AuthContextType {
  user: User | null;
  login: (userData: User) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const validateSession = async () => {
      try {
        const storedUser = localStorage.getItem('user');
        const authToken = localStorage.getItem('auth_token');
        const refreshTokenValue = localStorage.getItem('refresh_token');

        if (storedUser && authToken && refreshTokenValue) {
          // Validate the stored session by attempting a refresh (single-flighted
          // in authService, so this shares any concurrent refresh).
          const refreshResponse = await refreshToken();

          if (refreshResponse.success || refreshResponse.transient) {
            // Valid/refreshed — or a transient (rate-limit/offline) blip at
            // startup, in which case keep the stored session rather than logging
            // the user out; the next API call will re-validate.
            setUser(JSON.parse(storedUser));
          } else {
            // Genuine invalid session - clear auth state.
            localStorage.removeItem('auth_token');
            localStorage.removeItem('refresh_token');
            localStorage.removeItem('user');
            setUser(null);
          }
        }
      } catch (error) {
        console.error('Failed to validate session', error);
      } finally {
        setIsLoading(false);
      }
    };

    // validateSession has its own try/catch (logs and clears auth); fire-and-forget.
    void validateSession();
  }, []);

  const login = (userData: User) => {
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    // Clear per-user PII / state that would otherwise leak to the next person
    // on the same browser. Keep `rumi_session_id` — that's a guest-cart
    // identifier, intentionally preserved so the now-anonymous user keeps
    // their basket.
    localStorage.removeItem('rumi_saved_customer_info');
    localStorage.removeItem('rumi_checkout_state');
    setUser(null);
    router.push('/');
  };

  return <AuthContext.Provider value={{ user, login, logout, isLoading }}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
