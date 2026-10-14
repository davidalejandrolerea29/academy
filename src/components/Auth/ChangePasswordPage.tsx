import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import BrandLoader from '../UI/BrandLoader';
import { apiFetch as fetch } from '../../services/apiFetch';

const ChangePasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const token = localStorage.getItem('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!newPassword || !confirmPassword) {
      setError('Por favor completa todos los campos.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ new_password: newPassword })

      });

      if (!response.ok) {
        throw new Error('Error al cambiar la contraseña.');
      }

      setSuccess(true);
      setTimeout(() => {
        navigate('/'); // Redirige después de cambiar la contraseña
      }, 1500);
    } catch (err) {
      console.error(err);
      setError('No se pudo cambiar la contraseña. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page min-h-screen flex items-center justify-center p-4">
      <div className="auth-card max-w-md w-full space-y-6 bg-white p-6 sm:p-8">
        <h2 className="text-2xl font-bold text-center text-gray-800">Cambiar Contraseña</h2>

        {error && (
          <div className="ui-feedback flex items-center border border-red-100 bg-red-50 text-red-700 p-3 rounded-xl">
            <AlertCircle className="w-5 h-5 mr-2" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="ui-feedback flex items-center border border-green-100 bg-green-50 text-green-700 p-3 rounded-xl">
            <CheckCircle className="w-5 h-5 mr-2" />
            <span>Contraseña cambiada correctamente</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <input
              type="password"
              placeholder="Nueva contraseña"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border rounded focus:outline-none focus:ring focus:ring-orange-500"
              required
              minLength={6}
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <input
              type="password"
              placeholder="Confirmar nueva contraseña"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border rounded focus:outline-none focus:ring focus:ring-orange-500"
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`ui-interactive w-full min-h-12 flex items-center justify-center py-3 px-4 rounded-xl text-white font-semibold shadow-sm ${
              loading ? 'bg-orange-400' : 'bg-orange-600 hover:bg-orange-700 hover:shadow-md'
            }`}
          >
            {loading ? <BrandLoader inline size="sm" label="Guardando..." /> : 'Cambiar Contraseña'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordPage;
