import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

export interface AuthUser {
  redditUsername: string;
  redditId: string;
  avatarUrl?: string;
  userId: string; // Supabase user ID
}

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthUser | null;
  error: string | null;
}

interface MeResponse {
  authenticated: boolean;
  me?: {
    name: string;
    id: string;
    icon_img?: string;
  };
  userId?: string;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    user: null,
    error: null,
  });

  const checkAuth = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const { data } = await axios.get<MeResponse>('/api/me');
      
      if (data.authenticated && data.me) {
        setState({
          isAuthenticated: true,
          isLoading: false,
          user: {
            redditUsername: data.me.name,
            redditId: data.me.id,
            avatarUrl: data.me.icon_img,
            userId: data.userId || '',
          },
          error: null,
        });
      } else {
        setState({
          isAuthenticated: false,
          isLoading: false,
          user: null,
          error: null,
        });
      }
    } catch (error) {
      setState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: error instanceof Error ? error.message : 'Authentication check failed',
      });
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = useCallback(() => {
    window.location.href = '/api/auth/login';
  }, []);

  const logout = useCallback(async () => {
    try {
      await axios.post('/api/auth/logout');
      setState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: null,
      });
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }, []);

  return {
    ...state,
    login,
    logout,
    refresh: checkAuth,
  };
}
