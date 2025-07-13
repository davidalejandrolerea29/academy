// src/components/Layout/Layout.tsx

import React, { useState, useEffect, useRef, useCallback } from 'react'; // ¡Importa useRef!
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

  // --- ESTADOS PARA EL INDICADOR DE CONEXIÓN ---
  const [isWebSocketConnected, setIsWebSocketConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(true); // Empezamos como conectando
  // Usamos useRef para mantener la instancia del servicio y evitar re-renders innecesarios
  const webSocketServiceRef = useRef<ReverbWebSocketService | null>(null);
  // ---------------------------------------------

  useEffect(() => {
    console.log(`[Layout Effect] currentUser token: ${currentUser?.token ? 'present' : 'absent'}`);

    // Si no hay token de usuario, aseguramos que el servicio se "desconecte" a nivel UI
    if (!currentUser?.token) {
      console.log("[Layout Effect] No current user token. Disconnecting service (if exists) and cleaning UI states.");
      // Si la referencia al servicio existe, podemos llamar a un método de desconexión si tu servicio lo tiene
      // o simplemente limpiar la referencia localmente y los estados de UI.
      // ¡Importante! No llamas a .disconnect() si no quieres cerrar la conexión real.
      // Solo limpiamos los estados de UI y la referencia local del componente Layout.
      // El singleton de ReverbWebSocketService ya maneja la vida de la conexión.
      if (webSocketServiceRef.current) {
          // Si tienes un método `webSocketServiceRef.current.disconnectClientSide()`
          // que solo limpia el socketId y los estados, puedes llamarlo aquí.
          // Para esta solución, simplemente limpiamos los listeners.
      }
      webSocketServiceRef.current = null; // Limpiamos la referencia para un futuro login
      setIsWebSocketConnected(false);
      setIsConnecting(false);
      return; // Salir si no hay token
    }

    // --- OBTENER O CREAR LA INSTANCIA DEL SERVICIO ---
    // createReverbWebSocketService maneja el patrón Singleton.
    // Siempre obtendremos la misma instancia si ya fue creada.
    const service = createReverbWebSocketService(currentUser.token);
    webSocketServiceRef.current = service; // Guardamos la instancia en la ref

    // --- SUSCRIBIRSE A EVENTOS GLOBALES DE CONEXIÓN ---
    const handleConnected = useCallback(() => {
        setIsWebSocketConnected(true);
        setIsConnecting(false);
        console.log('UI: WebSocket está CONECTADO. (Estado UI actualizado)');
      }, []); // Dependencias vacías, no dependen de props ni estado


    // Ajustamos handleDisconnected para ser más preciso con el estado de reconexión
      const handleDisconnected = useCallback((event?: CloseEvent) => {
        setIsWebSocketConnected(false);
        if (event?.code !== 1000) {
          setIsConnecting(true);
          console.log(`UI: WebSocket DESCONECTADO (reconexión automática). Code: ${event?.code}, Reason: ${event?.reason}.`);
        } else {
          setIsConnecting(false);
          console.log(`UI: WebSocket DESCONECTADO (cierre normal). Code: ${event?.code}, Reason: ${event?.reason}.`);
        }
      }, []);
const handleError = useCallback((error: any) => {
    console.error('UI: WebSocket ERROR recibido:', error);
    setIsWebSocketConnected(false);
    setIsConnecting(false);
  }, []);

  const handlePermanentlyDisconnected = useCallback(() => {
    setIsWebSocketConnected(false);
    setIsConnecting(false);
    console.error('UI: WebSocket permanentemente desconectado. (Estado UI actualizado)');
  }, []);

useEffect(() => {
    console.log(`[Layout Effect] currentUser token: ${currentUser?.token ? 'present' : 'absent'}`);

    if (!currentUser?.token) {
      console.log("[Layout Effect] No current user token. Cleaning UI states.");
      // NO LLAMES A disconnect() aquí si no quieres cerrar la conexión real.
      // Solo limpiamos los estados de UI y la referencia local del componente Layout.
      // La instancia singleton del servicio maneja su propia vida.
      if (webSocketServiceRef.current) {
          // Desregistrar los listeners actuales si el token desaparece
          webSocketServiceRef.current.off('connected', handleConnected);
          webSocketServiceRef.current.off('disconnected', handleDisconnected);
          webSocketServiceRef.current.off('error', handleError);
          webSocketServiceRef.current.off('permanently_disconnected', handlePermanentlyDisconnected);
      }
      webSocketServiceRef.current = null;
      setIsWebSocketConnected(false);
      setIsConnecting(false);
      return;
    }

    const service = createReverbWebSocketService(currentUser.token);
    // Verificar si la instancia del servicio ha cambiado (solo debería pasar la primera vez)
    // Esto es importante para que NO volvamos a registrar listeners si ya están registrados en la misma instancia.
    if (webSocketServiceRef.current !== service) {
        console.log("[Layout Effect] Nueva instancia de servicio o primera inicialización. Registrando listeners.");
        // Si el servicio ya existe y es el mismo, no re-registramos.
        // Si es una nueva instancia (la primera vez), la guardamos y registramos.
        webSocketServiceRef.current = service;

        // Registrar los listeners en la instancia del servicio
        service.on('connected', handleConnected);
        service.on('disconnected', handleDisconnected);
        service.on('error', handleError);
        service.on('permanently_disconnected', handlePermanentlyDisconnected);

        // --- ACTUALIZAR EL ESTADO INICIAL DEL UI BASADO EN EL SERVICIO ---
        setIsWebSocketConnected(service.getIsConnected());
        setIsConnecting(service.getIsConnecting());
        console.log(`[Layout Init] Estado inicial del servicio: Conectado=${service.getIsConnected()}, Conectando=${service.getIsConnecting()}`);

        // Intentar conectar el servicio.
        service.connect().then(() => {
            console.log("Layout: connect() Promise resuelta.");
        }).catch((e) => {
            console.error("Layout: Error inicial al conectar ReverbService:", e);
            setIsWebSocketConnected(false);
            setIsConnecting(false);
        });
    } else {
        console.log("[Layout Effect] Misma instancia de servicio. Re-evaluando estado UI.");
        // Si es la misma instancia (por re-render), solo actualizamos el estado UI
        // basándonos en el estado actual del servicio, no re-registramos listeners.
        setIsWebSocketConnected(service.getIsConnected());
        setIsConnecting(service.getIsConnecting());
        console.log(`[Layout Re-render] Estado actual del servicio: Conectado=${service.getIsConnected()}, Conectando=${service.getIsConnecting()}`);
    }

    // --- LIMPIEZA AL DESMONTAR O ANTES DE RE-EJECUTAR CON TOKEN DIFERENTE ---
    return () => {
      console.log('UI: Limpiando listeners de WebSocket en Layout.');
      if (webSocketServiceRef.current) {
        webSocketServiceRef.current.off('connected', handleConnected);
        webSocketServiceRef.current.off('disconnected', handleDisconnected);
        webSocketServiceRef.current.off('error', handleError);
        webSocketServiceRef.current.off('permanently_disconnected', handlePermanentlyDisconnected);
      }
    };
  }, [currentUser?.token, handleConnected, handleDisconnected, handleError, handlePermanentlyDisconnected]); // ¡Añade los callbacks a las dependencias!

  const handleLogout = async () => {
    try {
      if (activeRoomId) {
        endCall();
      }
      // Cuando se hace logout, se desconecta el servicio WebSocket
      // Aquí sí es apropiado llamar al método `disconnect` del servicio singleton,
      // ya que el usuario está saliendo de la aplicación.
      if (webSocketServiceRef.current) {
        webSocketServiceRef.current.disconnect(); // Esto cerrará la conexión real
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
            reverbService={webSocketServiceRef.current} // Pasamos la instancia de la ref
            isWebSocketConnected={isWebSocketConnected}
            isConnectingWebSocket={isConnecting}
          />
        </div>
      )}
    </div>
  );
};

export default Layout;