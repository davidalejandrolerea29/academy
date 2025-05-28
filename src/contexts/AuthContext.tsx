import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { User, UserRole } from '../types';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  register: (email: string, password: string, displayName: string, role: UserRole) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const register = async (email: string, password: string, displayName: string, role: UserRole) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: insertError } = await supabase
        .from('user')
        .insert({
          email,
          password, // ⚠️ En producción, ¡nunca almacenes contraseñas sin hash!
          display_name: displayName,
          role,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) throw insertError;

      setCurrentUser({
        id: data.id,
        email: data.email,
        display_name: data.display_name,
        role: data.role,
        photoURL: data.photoURL ?? undefined,
      });
    } catch (err: any) {
      setError(err.message || 'Error during registration');
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: selectError } = await supabase
        .from('user')
        .select('*')
        .eq('email', email)
        .eq('password', password) // ⚠️ ¡No recomendado en producción!
        .maybeSingle();

      if (selectError) throw selectError;

      if (!data) {
        throw new Error('Usuario o contraseña incorrectos');
      }

      setCurrentUser({
        id: data.id,
        email: data.email,
        display_name: data.display_name,
        role: data.role,
        photoURL: data.photoURL ?? undefined,
      });
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión');
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setCurrentUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ currentUser, loading, register, login, logout, error }}
    >
      {children}
    </AuthContext.Provider>
  );
};
