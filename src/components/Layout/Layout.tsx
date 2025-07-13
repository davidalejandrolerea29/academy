// src/components/Layout/Layout.tsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/Auth/AuthContext'; // Updated path just in case
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
  Loader
} from 'lucide-react';
import logo from '../../assets/logo.png';

import { createReverbWebSocketService, ReverbWebSocketService } from '../../services/ReverbWebSocketService';

const Layout: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { activeRoomId, endCall, isCallMinimized, toggleMinimizeCall } = useCall();

  // Estados locales para la conexión del WebSocket, manejados en Layout
  const [isWebSocketConnected, setIsWebSocketConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(true); // Inicia como conectando para mostrar "Conectando..." al cargar
  const webSocketServiceRef = useRef<ReverbWebSocketService | null>(null);

  // Callbacks memoizados para los eventos del servicio WebSocket
  // These callbacks are stable and won't cause unnecessary re-renders of the effect
  // unless their dependencies change.
  const handleConnected = useCallback(() => {
    setIsWebSocketConnected(true);
    setIsConnecting(false);
    console.log('--- CONEXIÓN WEBSTOCKET: ¡Recuperada! ---');
    console.log('[UI Listener] WebSocketService: Estado CONECTADO. UI actualizado.');
  }, []); // Dependencies are empty because they don't rely on Layout's state directly

  const handleDisconnected = useCallback((event?: CloseEvent) => {
    setIsWebSocketConnected(false);
    if (event?.code !== 1000) {
      setIsConnecting(true); // Indicate that the service will try to reconnect
      console.log(`--- CONEXIÓN WEBSTOCKET: PERDIDA (${event?.reason || 'Sin razón'}). ---`);
      console.log(`[UI Listener] WebSocketService: Estado DESCONECTADO (intentando reconectar). Code: ${event?.code}, Reason: ${event?.reason}. UI actualizado.`);
    } else {
      setIsConnecting(false); // Normal closure (e.g., logout), no reconnection attempt
      console.log(`[UI Listener] WebSocketService: Estado DESCONECTADO (cierre normal). Code: ${event?.code}, Reason: ${event?.reason}. UI actualizado.`);
    }
  }, []);

  const handleError = useCallback((error: any) => {
    console.error('[UI Listener] WebSocketService: ERROR inesperado. ', error);
    setIsWebSocketConnected(false);
    setIsConnecting(true); // Assume an error might lead to a reconnection attempt
  }, []);

  const handlePermanentlyDisconnected = useCallback(() => {
    setIsWebSocketConnected(false);
    setIsConnecting(false); // No more reconnection attempts
    console.error('--- CONEXIÓN WEBSTOCKET: DESCONEXIÓN PERMANENTE. Máximos reintentos alcanzados. ---');
    console.error('[UI Listener] WebSocketService: Estado PERMANENTEMENTE DESCONECTADO. UI actualizado.');
  }, []);

  // This useEffect listens to browser's online/offline events.
  // It's kept for robustness, even if navigator.onLine isn't always reliable in your environment.
  useEffect(() => {
    console.log(`[Browser Network Status] Initial check: navigator.onLine = ${navigator.onLine}`);
    
    const handleOnline = () => {
      console.log('--- NAVEGADOR: Conectado a la red (online). ---');
      if (webSocketServiceRef.current && !webSocketServiceRef.current.getIsConnected() && !webSocketServiceRef.current.getIsConnecting()) {
        console.log('[Browser Network Status] Navegador online. Intentando reconectar WebSocket si está inactivo.');
        webSocketServiceRef.current.connect().catch(e => console.error("Error al reconectar WS desde handler de online:", e));
      }
    };

    const handleOffline = () => {
      console.warn('--- NAVEGADOR: SIN CONEXIÓN a la red (offline). ---');
      if (webSocketServiceRef.current && webSocketServiceRef.current.getIsConnected()) {
        console.warn('[Browser Network Status] Navegador offline. Forzando desconexión del WebSocket para activar reconexión.');
        webSocketServiceRef.current.disconnect(); 
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []); 

  // --- THE ONLY AND MAIN useEffect for WebSocket connection logic ---
  useEffect(() => {
    console.log(`[Layout Effect Lifecycle] Ejecutando useEffect. currentUser token: ${currentUser?.token ? 'presente' : 'ausente'}.`);

    if (!currentUser?.token) {
      console.log("[Layout Effect Lifecycle] No currentUser token detectado. Iniciando limpieza del servicio WebSocket.");
      if (webSocketServiceRef.current) {
        console.log("[Layout Effect Lifecycle] Desconectando instancia existente de WebSocketService.");
        // Explicitly remove listeners before disconnecting an old service instance
        webSocketServiceRef.current.off('connected', handleConnected);
        webSocketServiceRef.current.off('disconnected', handleDisconnected);
        webSocketServiceRef.current.off('error', handleError);
        webSocketServiceRef.current.off('permanently_disconnected', handlePermanentlyDisconnected);
        webSocketServiceRef.current.disconnect(); 
        webSocketServiceRef.current = null;
      }
      setIsWebSocketConnected(false);
      setIsConnecting(false);
      console.log("[Layout Effect Lifecycle] Estados de UI actualizados: Conectado=false, Conectando=false.");
      return;
    }

    // Get or create the service instance. This is a singleton.
    const service = createReverbWebSocketService(currentUser.token);

    // If the ref currently holds an instance AND it's a DIFFERENT instance (shouldn't happen with singleton, but for safety)
    // or if we are in StrictMode and it's an old instance being cleaned up.
    if (webSocketServiceRef.current && webSocketServiceRef.current !== service) {
      console.log("[Layout Effect Lifecycle] Detectada instancia de servicio ANTERIOR o diferente. Limpiando sus listeners.");
      webSocketServiceRef.current.off('connected', handleConnected);
      webSocketServiceRef.current.off('disconnected', handleDisconnected);
      webSocketServiceRef.current.off('error', handleError);
      webSocketServiceRef.current.off('permanently_disconnected', handlePermanentlyDisconnected);
    }
    
    // Always set the current service instance to the ref
    webSocketServiceRef.current = service;

    // Register listeners on the CURRENT service instance.
    console.log("[Layout Effect Lifecycle] Registrando listeners de UI en la instancia actual del servicio.");
    service.on('connected', handleConnected);
    service.on('disconnected', handleDisconnected);
    service.on('error', handleError);
    service.on('permanently_disconnected', handlePermanentlyDisconnected);

    // Initialize UI state immediately from the service's current state.
    // This is crucial to show the correct status right away without waiting for an event.
    // Use an immediate update from the service's current internal state.
    const currentServiceIsConnected = service.getIsConnected();
    const currentServiceIsConnecting = service.getIsConnecting();
    setIsWebSocketConnected(currentServiceIsConnected);
    setIsConnecting(currentServiceIsConnecting);
    console.log(`[Layout Effect Lifecycle] Estado inicial de UI establecido: isWebSocketConnected=${currentServiceIsConnected}, isConnecting=${currentServiceIsConnecting}.`);

    // Ensure the service connects (idempotent: if already connected, resolves immediately).
    console.log("[Layout Effect Lifecycle] Llamando a service.connect() para asegurar la conexión.");
    service.connect().then(() => {
      console.log("[Layout Effect Lifecycle] service.connect() Promise resuelta exitosamente.");
    }).catch((e) => {
      console.error("[Layout Effect Lifecycle] service.connect() Promise fallida durante la inicialización:", e);
      // If initial connection fails, ensure UI reflects disconnected state
      setIsWebSocketConnected(false);
      setIsConnecting(false);
    });

    // Cleanup function for the useEffect.
    // Runs before re-execution (due to dependency change) or component unmount.
    return () => {
      console.log('[Layout Effect Lifecycle] Ejecutando función de limpieza (cleanup).');
      if (webSocketServiceRef.current) {
        console.log('[Layout Effect Lifecycle] Limpiando listeners de WebSocket en la instancia actual (cleanup).');
        // It's crucial to remove listeners to prevent memory leaks and unexpected behavior.
        // DO NOT call webSocketServiceRef.current.disconnect() here unless logging out.
        webSocketServiceRef.current.off('connected', handleConnected);
        webSocketServiceRef.current.off('disconnected', handleDisconnected);
        webSocketServiceRef.current.off('error', handleError);
        webSocketServiceRef.current.off('permanently_disconnected', handlePermanentlyDisconnected);
      }
    };
  }, [currentUser?.token, handleConnected, handleDisconnected, handleError, handlePermanentlyDisconnected]); // Dependencies

  const handleLogout = async () => {
    console.log("[Logout] Iniciando proceso de cierre de sesión.");
    try {
      if (activeRoomId) {
        console.log("[Logout] Hay una llamada activa, finalizándola.");
        endCall();
      }
      if (webSocketServiceRef.current) {
        console.log("[Logout] Desconectando explícitamente ReverbWebSocketService debido a logout.");
        webSocketServiceRef.current.disconnect(); // This will close the actual connection with code 1000
        webSocketServiceRef.current = null; // Clear the ref
      }
      await logout();
      console.log("[Logout] Redirigiendo a /login.");
      navigate('/login');
    } catch (error) {
      console.error('[Logout] Error al cerrar sesión:', error);
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

  // --- Logic to display connection status in the UI ---
  const getConnectionStatus = () => {
    if (!currentUser) {
      return null;
    }
    // Only use the WebSocket service's states
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
    // If not connecting and not connected
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
            <div className="ml-auto mr-4">
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
            reverbServiceInstance={webSocketServiceRef.current}
            // Pass the derived states from Layout directly to VideoRoom!
            isWebSocketConnected={isWebSocketConnected}
            isConnectingWebSocket={isConnecting}
          />
        </div>
      )}
    </div>
  );
};

export default Layout;