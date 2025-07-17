import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Lock, Mail, AlertCircle, Eye, EyeOff } from 'lucide-react';
import logo from '../../assets/logo.png';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const { login, currentUser, error, clearError } = useAuth();
  const navigate = useNavigate();

  // Limpia errores cuando el usuario cambia email o password
  useEffect(() => {
    if (error) clearError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, password]);

  // Redirige según el rol una vez logueado
  useEffect(() => {
    if (!currentUser || !currentUser.role) return;

    if (currentUser.must_change_password) {
      navigate('/cambiar-password');
      return;
    }

    const role = currentUser.role.description;
    switch (role) {
      case 'Admin':
        navigate('/admin');
        break;
      case 'Teacher':
      case 'Student':
        navigate('/rooms');
        break;
      default:
        navigate('/');
    }
  }, [currentUser, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      alert('Por favor completa todos los campos');
      return;
    }

    try {
      setLoading(true);
      await login(email, password);
    } catch (err) {
      console.error('Login fallido', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow">
        <div className="text-center">
          <div className="flex justify-center">
            <img src={logo} alt="Logo English New Path" className="h-20 w-20 object-contain" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Iniciar sesión</h2>
          <p className="mt-2 text-sm text-gray-600">
            English New Path Academia de Inglés online
          </p>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">{error}</h3>
              </div>
            </div>
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email" className="sr-only">Correo electrónico</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none rounded-none relative block w-full px-3 py-3 pl-10 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-orange-500 focus:border-orange-500 focus:z-10 sm:text-sm"
                  placeholder="Correo electrónico"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="sr-only">Contraseña</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none rounded-none relative block w-full px-3 py-3 pl-10 pr-10 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-orange-500 focus:border-orange-500 focus:z-10 sm:text-sm"
                  placeholder="Contraseña"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className={`group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white ${
                loading ? 'bg-blue-400' : 'bg-orange-600 hover:bg-orange-700'
              } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors`}
            >
              {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
