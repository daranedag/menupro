'use client';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';

const AuthContext = createContext(null);
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthProvider is required');
  return value;
}
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const loadSession = useCallback(async () => {
    try { const { data } = await api.get('/api/auth/session'); setUser(data.user); return data.user; }
    catch { setUser(null); return null; }
    finally { setIsLoading(false); }
  }, []);
  useEffect(() => { loadSession(); }, [loadSession]);
  const login = async (email, password) => {
    const { data } = await api.post('/api/auth/login', { email, password });
    setUser(data.user); return data.user;
  };
  const register = async input => {
    const { data } = await api.post('/api/auth/register', input);
    if (data.requiresEmailConfirmation) return data;
    setUser(data.user); return data.user;
  };
  const createRestaurant = async input => {
    const payload = { name: input.name, ...(input.slug ? { slug: input.slug } : {}) };
    const { data } = await api.post('/api/restaurants', payload);
    await api.post('/api/auth/restaurant', { id: data.id });
    await loadSession(); return data;
  };
  const selectRestaurant = async id => { await api.post('/api/auth/restaurant', { id }); await loadSession(); };
  const logout = async () => { await api.post('/api/auth/logout'); setUser(null); };
  return <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, register, createRestaurant, selectRestaurant, logout, reloadSession: loadSession }}>{children}</AuthContext.Provider>;
}
