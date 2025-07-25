import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  register: (email: string, password: string, displayName: string, role: UserRole) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  error: string | null;
  clearError: () => void; // ✅ NUEVO
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const API_URL = import.meta.env.VITE_API_URL;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => setError(null); // ✅ FUNCIÓN PARA LIMPIAR ERROR

  const register = async (email: string, password: string, displayName: string, role: UserRole) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          name: displayName,
          role,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Error al registrarse');
      }

      const { access_token, user } = data;
      localStorage.setItem('token', access_token);

      setCurrentUser({
        token: access_token,
        id: user.id,
        email: user.email,
        name: user.name ?? '',
        role_id: user.role_id,
        role: {
          id: user.role_id,
          description: user.role_description as UserRole,
          created_at: user.role_created_at ?? '',
          updated_at: user.role_updated_at ?? ''
        },
        role_description: user.role_description,
      });

    } catch (err: any) {
      setError(err.message || 'Error al registrarse');
    } finally {
      setLoading(false);
    }
  };

const login = async (email: string, password: string) => {
  setLoading(true);
  setError(null);
  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      let message = 'Error al iniciar sesión';
      if (data && typeof data === 'object') {
        if ('message' in data && data.message) {
          message = data.message;
        } else if ('error' in data && data.error) {
          message = data.error; // ✅ Captura mensaje de error
        } else if ('errors' in data && data.errors) {
          message = Object.values(data.errors).flat().join(' ');
        }
      } else if (typeof data === 'string' && data.length > 0) {
        message = data;
      }
      throw new Error(message);
    }

    const { access_token, user } = data;
    localStorage.setItem('token', access_token);

    setCurrentUser({
      token: access_token,
      id: user.id,
      email: user.email,
      name: user.name ?? '',
      role_id: user.role_id,
      role: {
        id: user.role_id,
        description: user.role_description,
        created_at: '',
        updated_at: '',
      },
      role_description: user.role_description,
      must_change_password: user.must_change_password,
    });

  } catch (err: any) {
    setError(err.message || 'Error al iniciar sesión');
    setCurrentUser(null);
  } finally {
    setLoading(false);
  }
};


  const logout = async () => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        await fetch(`${API_URL}/auth/logout`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        });
      } catch (e) {
        console.warn('Error al cerrar sesión en el servidor', e);
      }
    }

    localStorage.removeItem('token');
    setCurrentUser(null);
  };

  const fetchCurrentUser = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Sesión inválida');
      }

      setCurrentUser({
        token,
        id: data.id,
        email: data.email,
        name: data.name ?? '',
        role_id: data.role_id,
        role: {
          id: data.role_id,
          description: data.role_description as UserRole,
          created_at: data.role_created_at ?? '',
          updated_at: data.role_updated_at ?? ''
        },
        role_description: data.role_description,
      });

    } catch (e) {
      console.error('Error al obtener el usuario actual:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  return (
    <AuthContext.Provider
      value={{ currentUser, loading, register, login, logout, error, clearError }}
    >
      {children}
    </AuthContext.Provider>
  );
};
