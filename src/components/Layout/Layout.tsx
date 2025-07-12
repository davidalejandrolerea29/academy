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
  WifiOff, // Icono para desconectado
  Wifi,    // Icono para conectado
  Loader // Icono para conectando
} from 'lucide-react';
import logo from '../../assets/logo.png';

// Importa tu servicio WebSocket
import { createReverbWebSocketService, ReverbWebSocketService } from '../../services/ReverbWebSocketService';

const Layout: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { activeRoomId, endCall, isCallMinimized, toggleMinimizeCall } = useCall();

  // --- NUEVOS ESTADOS PARA EL INDICADOR DE CONEXIÓN ---
  const [isWebSocketConnected, setIsWebSocketConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(true); // Empezamos como conectando
  const [webSocketService, setWebSocketService] = useState<ReverbWebSocketService | null>(null);
  // ---------------------------------------------------

  useEffect(() => {
    if (currentUser?.token) {
      const service = createReverbWebSocketService(currentUser.token);
      setWebSocketService(service);

      // --- SUSCRIBIRSE A EVENTOS GLOBALES DE CONEXIÓN ---
      const handleConnected = () => {
        setIsWebSocketConnected(true);
        setIsConnecting(false);
        console.log('UI: WebSocket está CONECTADO.');
      };

      const handleDisconnected = () => {
        setIsWebSocketConnected(false);
        // Cuando se desconecta, volvemos a 'conectando' hasta que se reestablezca o falle
        setIsConnecting(true);
        console.log('UI: WebSocket está DESCONECTADO (intentando reconectar...).');
      };

      const handleError = (error: any) => {
        console.error('UI: WebSocket ERROR:', error);
        // Podrías poner isConnecting en false y mostrar un error crítico si es persistente
      };

      const handlePermanentlyDisconnected = () => {
        setIsWebSocketConnected(false);
        setIsConnecting(false);
        console.error('UI: WebSocket permanentemente desconectado.');
        // Aquí podrías mostrar un mensaje grande al usuario para que recargue la página o revise su conexión
      };

      service.on('connected', handleConnected);
      service.on('disconnected', handleDisconnected);
      service.on('error', handleError);
      service.on('permanently_disconnected', handlePermanentlyDisconnected);

      // Intentar conectar el servicio al montar el Layout
      // Si ya estaba conectado, el `connect()` resolverá de inmediato.
      // Si no, iniciará la conexión.
      service.connect().then(() => {
        handleConnected(); // Si la conexión ya estaba abierta al montar
      }).catch((e) => {
        console.error("Layout: Error inicial al conectar ReverbService:", e);
        // Si hay un error inicial, también marcamos como no conectado.
        setIsWebSocketConnected(false);
        setIsConnecting(false);
      });

      // --- LIMPIEZA AL DESMONTAR ---
      return () => {
        console.log('UI: Limpiando listeners de WebSocket.');
        service.off('connected', handleConnected);
        service.off('disconnected', handleDisconnected);
        service.off('error', handleError);
        service.off('permanently_disconnected', handlePermanentlyDisconnected);
        // NO desconectes el servicio global aquí, ya que otros componentes lo usarán.
        // Solo limpia los listeners de este componente.
      };
    }
  }, [currentUser?.token]); // Re-ejecutar si el token del usuario cambia

  const handleLogout = async () => {
    try {
      if (activeRoomId) {
        endCall();
      }
      // Antes de hacer logout, desconecta el servicio WebSocket
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

  // --- Lógica para mostrar el estado de la conexión ---
  const getConnectionStatus = () => {
    if (!currentUser) {
      return null; // No mostrar si no hay usuario logueado
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
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-gray-900 bg-opacity-50 lg:hidden"
          onClick={closeSidebar}
        ></div>
      )}

      {/* Sidebar */}
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

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top header */}
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

            {/* --- INDICADOR DE CONEXIÓN AÑADIDO AQUÍ --- */}
            <div className="ml-auto mr-4"> {/* Alinea a la derecha y añade margen */}
              {getConnectionStatus()}
            </div>
            {/* ------------------------------------------- */}

          </div>
        </header>

        {/* Content area */}
        <main className="flex-1 overflow-x-hidden lg:overflow-y-auto bg-gray-50">
          <div className="container mx-auto p-0 lg:p-4 h-full">
            <Outlet />
          </div>
        </main>
      </div>

      {/* VideoRoom container - Updated to support draggable widget */}
      {activeRoomId && (
        <div className={`
          fixed z-40 transition-all duration-300 ease-in-out
          ${isCallMinimized
            ? '' // Mantén esto si no quieres que el video flotante sea interactivo cuando minimizado
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
            reverbService={webSocketService}
          />
        </div>
      )}
    </div>
  );
};

export default Layout;