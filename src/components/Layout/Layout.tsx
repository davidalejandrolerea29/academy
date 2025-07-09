// src/components/Layout/Layout.tsx

import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useCall } from '../../contexts/CallContext';
import VideoRoom from '../VideoRoom/VideoRoom';
import {
  Video,
  MessageSquare,
  Users,
  LogOut,
  Menu,
  X,
  UserCircle,
  WifiOff,
  Wifi,
  Loader,
  AlertCircle // Icono para alerta de sesión
} from 'lucide-react';
import logo from '../../assets/logo.png';
import axios from 'axios'; // Importa axios
import { createReverbWebSocketService, ReverbWebSocketService } from '../../services/ReverbWebSocketService';

const Layout: React.FC = () => {
  const { currentUser, logout, setAuthToken } = useAuth(); // Agrega setAuthToken si existe en tu contexto
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { activeRoomId, endCall, isCallMinimized, toggleMinimizeCall } = useCall();

  const [isWebSocketConnected, setIsWebSocketConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(true);
  const [webSocketService, setWebSocketService] = useState<ReverbWebSocketService | null>(null);

  // --- NUEVO ESTADO PARA EL MODAL DE SESIÓN EXPIRADA ---
  const [showSessionExpiredModal, setShowSessionExpiredModal] = useState<boolean>(false);
  // ----------------------------------------------------

  useEffect(() => {
    if (currentUser?.token) {
      const service = createReverbWebSocketService(currentUser.token);
      setWebSocketService(service);

      const handleConnected = () => {
        setIsWebSocketConnected(true);
        setIsConnecting(false);
        console.log('UI: WebSocket está CONECTADO.');
      };

      const handleDisconnected = () => {
        setIsWebSocketConnected(false);
        setIsConnecting(true);
        console.log('UI: WebSocket está DESCONECTADO (intentando reconectar...).');
      };

      const handleError = (error: any) => {
        console.error('UI: WebSocket ERROR:', error);
      };

      const handlePermanentlyDisconnected = () => {
        setIsWebSocketConnected(false);
        setIsConnecting(false);
        console.error('UI: WebSocket permanentemente desconectado.');
        // Aquí podrías querer mostrar el modal si la desconexión es por token
        // Sin embargo, es más fiable que el interceptor de Axios lo haga.
      };

      service.on('connected', handleConnected);
      service.on('disconnected', handleDisconnected);
      service.on('error', handleError);
      service.on('permanently_disconnected', handlePermanentlyDisconnected);

      service.connect().then(() => {
        handleConnected();
      }).catch((e) => {
        console.error("Layout: Error inicial al conectar ReverbService:", e);
        setIsWebSocketConnected(false);
        setIsConnecting(false);
      });

      return () => {
        console.log('UI: Limpiando listeners de WebSocket.');
        service.off('connected', handleConnected);
        service.off('disconnected', handleDisconnected);
        service.off('error', handleError);
        service.off('permanently_disconnected', handlePermanentlyDisconnected);
      };
    }
  }, [currentUser?.token]);

  // --- EFECTO PARA CONFIGURAR EL INTERCEPTOR DE AXIOS ---
  useEffect(() => {
    // Solo configurar el interceptor si hay un token
    if (!currentUser?.token) {
      // Si no hay token, limpia el interceptor si existe para evitar llamadas no autenticadas
      axios.interceptors.response.eject(authInterceptor); // Asegúrate de tener una referencia
      return;
    }

    const authInterceptor = axios.interceptors.response.use(
      (response) => response, // Si la respuesta es exitosa, no hacemos nada
      (error) => {
        // Si el error es un 401 (Unauthorized) y el usuario está logueado
        if (error.response && error.response.status === 401 && currentUser) {
          console.warn('API: Sesión expirada (401 Unauthorized). Mostrando modal.');
          setShowSessionExpiredModal(true); // Muestra el modal
          // Opcional: limpiar el token del localStorage y del estado de autenticación
          // para evitar que se sigan haciendo peticiones con un token inválido.
          logout(); // Limpia el token y currentUser del contexto
          if (webSocketService) {
            webSocketService.disconnect(); // Desconecta el WS si el token caducó
          }
        }
        return Promise.reject(error); // Rechaza la promesa del error para que el componente que hizo la llamada lo maneje
      }
    );

    // Limpieza: Retirar el interceptor cuando el componente se desmonte o el token cambie
    return () => {
      axios.interceptors.response.eject(authInterceptor);
    };
  }, [currentUser, logout, webSocketService]); // Dependencias para re-ejecutar el efecto

  // --- Manejador para el botón "Entendido" del modal ---
  const handleModalClose = () => {
    setShowSessionExpiredModal(false);
    navigate('/login'); // Redirige a la página de login
    window.location.reload(); // Recarga la página para asegurar un estado limpio
  };

  const handleLogout = async () => {
    try {
      if (activeRoomId) {
        endCall();
      }
      if (webSocketService) {
        webSocketService.disconnect();
      }
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  const getRoleLabel = () => {
    if (!currentUser) return '';
    switch (currentUser.role_description) {
      case 'Admin': return 'Administrador';
      case 'Teacher': return 'Profesor';
      case 'Student': return 'Alumno';
      default: return currentUser.role_description;
    }
  };

  const getConnectionStatus = () => {
    if (!currentUser) {
      return null;
    }
    if (isConnecting) {
      return (
        <span className="flex items-center text-yellow-500 text-sm font-medium animate-pulse">
          <Loader className="w-4 h-4 mr-1" />
          Conectando...
        </span>
      );
    }
    if (isWebSocketConnected) {
      return (
        <span className="flex items-center text-green-600 text-sm font-medium">
          <Wifi className="w-4 h-4 mr-1" />
          Conectado
        </span>
      );
    }
    return (
      <span className="flex items-center text-red-500 text-sm font-medium">
        <WifiOff className="w-4 h-4 mr-1" />
        Desconectado
      </span>
    );
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* ... (sidebar y header existentes) ... */}

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-gray-900 bg-opacity-50 lg:hidden"
          onClick={closeSidebar}
        ></div>
      )}

      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-30
          w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="flex flex-col h-full">
          <div className="flex flex-col items-center justify-center p-4 border-b text-center relative">
            <img
              src={logo}
              alt="Logo English New Path"
              className="h-16 w-16 object-contain mb-2"
            />
            <h1 className="text-sm font-semibold text-gray-700 leading-tight">
              English New Path<br />Academia de Inglés online
            </h1>
            <button
              className="absolute right-4 top-4 lg:hidden text-gray-500 hover:text-gray-700"
              onClick={closeSidebar}
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {currentUser && (
            <>
              <div className="p-4 border-b">
                <div className="flex items-center">
                  {currentUser.photo_url ? (
                    <img
                      src={currentUser.photo_url}
                      alt={currentUser.name}
                      className="w-10 h-10 rounded-full mr-3"
                    />
                  ) : (
                    <UserCircle className="w-10 h-10 text-gray-400 mr-3" />
                  )}
                  <div>
                    <div className="font-medium text-gray-800">{currentUser.name}</div>
                    <div className="text-sm text-gray-500">{getRoleLabel()}</div>
                  </div>
                </div>
              </div>

              <nav className="flex-1 p-4 space-y-1">
                <NavLink
                  to="/rooms"
                  className={({ isActive }) => `
                    flex items-center px-4 py-2 rounded-md text-sm font-medium
                    ${isActive
                      ? 'bg-blue-50 text-orange-700'
                      : 'text-gray-700 hover:bg-gray-100'}
                  `}
                  onClick={closeSidebar}
                >
                  <Video className="w-5 h-5 mr-3" />
                  Salas de Clase
                </NavLink>

                <NavLink
                  to="/messages"
                  className={({ isActive }) => `
                    flex items-center px-4 py-2 rounded-md text-sm font-medium
                    ${isActive
                      ? 'bg-blue-50 text-orange-700'
                      : 'text-gray-700 hover:bg-gray-100'}
                  `}
                  onClick={closeSidebar}
                >
                  <MessageSquare className="w-5 h-5 mr-3" />
                  Mensajes
                </NavLink>

                {currentUser.role_description === 'Admin' && (
                  <NavLink
                    to="/admin/users"
                    className={({ isActive }) => `
                      flex items-center px-4 py-2 rounded-md text-sm font-medium
                      ${isActive
                        ? 'bg-blue-50 text-orange-700'
                        : 'text-gray-700 hover:bg-gray-100'}
                    `}
                    onClick={closeSidebar}
                  >
                    <Users className="w-5 h-5 mr-3" />
                    Gestión de Usuarios
                  </NavLink>
                )}
              </nav>

              <div className="p-4 border-t mt-auto">
                <button
                  onClick={handleLogout}
                  className="flex items-center w-full px-4 py-2 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-100"
                >
                  <LogOut className="w-5 h-5 mr-3" />
                  Cerrar Sesión
                </button>
              </div>
            </>
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm z-10">
          <div className="px-4 py-3 flex items-center justify-between">
            <button
              className="lg:hidden text-gray-500 focus:outline-none"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>

            <div className="flex-1 flex justify-center lg:justify-start">
              <h2 className="text-lg font-semibold text-gray-800 lg:hidden">English New Path</h2>
            </div>

            <div className="ml-auto mr-4">
              {getConnectionStatus()}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden lg:overflow-y-auto bg-gray-50">
          <div className="container mx-auto p-0 lg:p-4 h-full">
            <Outlet />
          </div>
        </main>
      </div>

      {activeRoomId && (
        <div className={`
          fixed z-40 transition-all duration-300 ease-in-out
          ${isCallMinimized
            ? ''
            : 'inset-0 bg-black bg-opacity-75 flex items-center justify-center pointer-events-auto'
          }
        `}>
          <VideoRoom
            roomId={activeRoomId}
            onCallEnded={endCall}
            isTeacher={currentUser?.role_description === 'Teacher'}
            isCallMinimized={isCallMinimized}
            toggleMinimizeCall={toggleMinimizeCall}
            handleCallCleanup={endCall}
          />
        </div>
      )}

      {/* --- MODAL DE SESIÓN EXPIRADA --- */}
      {showSessionExpiredModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-75">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm mx-auto text-center">
            <div className="flex justify-center mb-4">
              <AlertCircle className="w-12 h-12 text-red-500" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">Sesión Expirada</h3>
            <p className="text-gray-700 mb-6">
              Tu sesión ha expirado. Por favor, vuelve a iniciar sesión para continuar.
            </p>
            <button
              onClick={handleModalClose}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
      {/* ------------------------------- */}
    </div>
  );
};

export default Layout;