'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

export function useAuth(options = {}) {
  const { requireAuth = false, redirectTo = '/login' } = options;
  const [user, setUser] = useState(null);
  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const checkSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/session');
      const data = await res.json();

      if (data.authenticated) {
        setUser(data.user);
        setAgent(data.agent);
      } else {
        setUser(null);
        setAgent(null);
        if (requireAuth) {
          router.push(redirectTo);
        }
      }
    } catch {
      setUser(null);
      setAgent(null);
      if (requireAuth) {
        router.push(redirectTo);
      }
    } finally {
      setLoading(false);
    }
  }, [requireAuth, redirectTo, router]);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const login = async (email, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Login failed');
    }

    setUser(data.user);
    return data;
  };

  const signup = async (email, password, name) => {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Signup failed');
    }

    setUser(data.user);
    return data;
  };

  const logout = async () => {
    await fetch('/api/auth/session', { method: 'DELETE' });
    setUser(null);
    setAgent(null);
    router.push('/login');
  };

  const refreshAgent = async () => {
    const res = await fetch('/api/agent/settings');
    const data = await res.json();
    if (data.agent) {
      setAgent(data.agent);
    }
  };

  return {
    user,
    agent,
    loading,
    isAuthenticated: !!user,
    login,
    signup,
    logout,
    refreshAgent,
    checkSession,
  };
}

export default useAuth;
