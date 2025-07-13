// src/components/Layout/Layout.tsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext'; // Assuming AuthContext is here
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
  // Estas callbacks son estables y no causarán re-renders innecesarios del efecto
  const handleConnected = useCallback(() => {
    setIsWebSocketConnected(true);
    setIsConnecting(false);
    console.log('--- CONEXIÓN WEBSTOCKET (LAYOUT): ¡Recuperada! ---');
    console.log('[UI Listener Layout] WebSocketService: Estado CONECTADO. UI actualizado.');
  }, []); // No dependen de nada del estado del Layout, solo actualizan su propio estado

  const handleDisconnected = useCallback((event?: CloseEvent) => {
    setIsWebSocketConnected(false);
    if (event?.code !== 1000) { // Code 1000 is a normal closure
      setIsConnecting(true); // Indica que el servicio intentará reconectar
      console.log(`--- CONEXIÓN WEBSTOCKET (LAYOUT): PERDIDA (${event?.reason || 'Sin razón'}). ---`);
      console.log(`[UI Listener Layout] WebSocketService: Estado DESCONECTADO (intentando reconectar). Code: ${event?.code}, Reason: ${event?.reason}. UI actualizado.`);
    } else {
      setIsConnecting(false); // Es un cierre normal (ej. logout), no intentamos reconectar
      console.log(`[UI Listener Layout] WebSocketService: Estado DESCONECTADO (cierre normal). Code: ${event?.code}, Reason: ${event?.reason}. UI actualizado.`);
    }
  }, []);

  const handleError = useCallback((error: any) => {
    console.error('[UI Listener Layout] WebSocketService: ERROR inesperado. ', error);
    setIsWebSocketConnected(false);
    // Si hay un error, el servicio intentará reconectar, así que ponemos isConnecting en true
    setIsConnecting(true); 
  }, []);

  const handlePermanentlyDisconnected = useCallback(() => {
    setIsWebSocketConnected(false);
    setIsConnecting(false); // No se intentará reconectar más
    console.error('--- CONEXIÓN WEBSTOCKET (LAYOUT): DESCONEXIÓN PERMANENTE. Máximos reintentos alcanzados. ---');
    console.error('[UI Listener Layout] WebSocketService: Estado PERMANENTEMENTE DESCONECTADO. UI actualizado.');
  }, []);

  // --- MANTENER ESTE useEffect para la API de conexión/desconexión del navegador ---
  useEffect(() => {
    console.log(`[Browser Network Status Layout] Initial check: navigator.onLine = ${navigator.onLine}`);
    
    const handleOnline = () => {
      console.log('--- NAVEGADOR (LAYOUT): Conectado a la red (online). ---');
      if (webSocketServiceRef.current && !webSocketServiceRef.current.getIsConnected() && !webSocketServiceRef.current.getIsConnecting()) {
        console.log('[Browser Network Status Layout] Navegador online. Intentando reconectar WebSocket si está inactivo.');
        webSocketServiceRef.current.connect().catch(e => console.error("Error al reconectar WS desde handler de online en Layout:", e));
      }
    };

    const handleOffline = () => {
      console.warn('--- NAVEGADOR (LAYOUT): SIN CONEXIÓN a la red (offline). ---');
      // Forzamos la desconexión del WS para que el onclose se dispare y active la reconexión.
      if (webSocketServiceRef.current && webSocketServiceRef.current.getIsConnected()) {
        console.warn('[Browser Network Status Layout] Navegador offline. Forzando desconexión del WebSocket para activar reconexión.');
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

  // --- EL ÚNICO Y PRINCIPAL useEffect para la lógica de conexión del WebSocket ---
  useEffect(() => {
    console.log(`[Layout Effect Lifecycle] Ejecutando useEffect para WebSocket. currentUser token: ${currentUser?.token ? 'presente' : 'ausente'}.`);

    if (!currentUser?.token) {
      console.log("[Layout Effect Lifecycle] No currentUser token detectado. Iniciando limpieza del servicio WebSocket.");
      if (webSocketServiceRef.current) {
        console.log("[Layout Effect Lifecycle] Desconectando instancia existente de WebSocketService y limpiando listeners.");
        // Remueve explícitamente los listeners antes de desconectar
        webSocketServiceRef.current.off('connected', handleConnected);
        webSocketServiceRef.current.off('disconnected', handleDisconnected);
        webSocketServiceRef.current.off('error', handleError);
        webSocketServiceRef.current.off('permanently_disconnected', handlePermanentlyDisconnected);
        webSocketServiceRef.current.disconnect(); 
        webSocketServiceRef.current = null;
      }
      setIsWebSocketConnected(false);
      setIsConnecting(false);
      console.log("[Layout Effect Lifecycle] Estados de UI de Layout actualizados: Conectado=false, Conectando=false.");
      return;
    }

    console.log("[Layout Effect Lifecycle] currentUser token presente. Obteniendo/Creando instancia de ReverbWebSocketService.");
    // Obtiene la instancia Singleton del servicio.
    const service = createReverbWebSocketService(currentUser.token);

    // Importante: Si la referencia actual no es la misma que la instancia obtenida (ej. en StrictMode),
    // primero limpiamos los listeners de la instancia antigua.
    if (webSocketServiceRef.current && webSocketServiceRef.current !== service) {
      console.log("[Layout Effect Lifecycle] Detectada instancia de servicio ANTERIOR o diferente. Limpiando sus listeners ANTES de reasignar.");
      webSocketServiceRef.current.off('connected', handleConnected);
      webSocketServiceRef.current.off('disconnected', handleDisconnected);
      webSocketServiceRef.current.off('error', handleError);
      webSocketServiceRef.current.off('permanently_disconnected', handlePermanentlyDisconnected);
    }
    
    // Asegura que webSocketServiceRef.current siempre apunte a la instancia actual del servicio.
    webSocketServiceRef.current = service;

    console.log("[Layout Effect Lifecycle] Registrando listeners de UI en la instancia ACTUAL del servicio.");
    service.on('connected', handleConnected);
    service.on('disconnected', handleDisconnected);
    service.on('error', handleError);
    service.on('permanently_disconnected', handlePermanentlyDisconnected);

    // *** INICIALIZA EL ESTADO DE LAYOUT BASADO EN EL ESTADO ACTUAL DEL SERVICIO ***
    // Esto es CRUCIAL para que la UI refleje el estado correcto al cargar o re-renderizar.
    const currentServiceIsConnected = service.getIsConnected();
    const currentServiceIsConnecting = service.getIsConnecting();
    setIsWebSocketConnected(currentServiceIsConnected);
    setIsConnecting(currentServiceIsConnecting);
    console.log(`[Layout Effect Lifecycle] Estado inicial de UI de Layout establecido: isWebSocketConnected=${currentServiceIsConnected}, isConnecting=${currentServiceIsConnecting}.`);

    console.log("[Layout Effect Lifecycle] Llamando a service.connect() para asegurar la conexión (es idempotente).");
    service.connect().then(() => {
      console.log("[Layout Effect Lifecycle] service.connect() Promise resuelta exitosamente.");
      // Opcional: Reconfirmar el estado después de la conexión, aunque los listeners deberían manejarlo.
      setIsWebSocketConnected(service.getIsConnected());
      setIsConnecting(service.getIsConnecting());
    }).catch((e) => {
      console.error("[Layout Effect Lifecycle] service.connect() Promise fallida durante la inicialización:", e);
      setIsWebSocketConnected(false);
      setIsConnecting(false);
    });

    return () => {
      console.log('[Layout Effect Lifecycle] Ejecutando función de limpieza (cleanup) para WebSocket.');
      // Al desmontar o antes de un nuevo efecto, limpia los listeners para evitar fugas de memoria.
      if (webSocketServiceRef.current) {
        console.log('[Layout Effect Lifecycle] Limpiando listeners de WebSocket en la instancia actual (cleanup).');
        webSocketServiceRef.current.off('connected', handleConnected);
        webSocketServiceRef.current.off('disconnected', handleDisconnected);
        webSocketServiceRef.current.off('error', handleError);
        webSocketServiceRef.current.off('permanently_disconnected', handlePermanentlyDisconnected);
      }
      // NOTA: No llamar a `disconnect()` aquí a menos que sea un logout explícito,
      // porque el servicio es un singleton y podría estar en uso por `VideoRoom`.
    };
  }, [currentUser?.token, handleConnected, handleDisconnected, handleError, handlePermanentlyDisconnected]);

  const handleLogout = async () => {
    console.log("[Logout] Iniciando proceso de cierre de sesión.");
    try {
      if (activeRoomId) {
        console.log("[Logout] Hay una llamada activa, finalizándola.");
        endCall();
      }
      if (webSocketServiceRef.current) {
        console.log("[Logout] Desconectando explícitamente ReverbWebSocketService debido a logout.");
        // Al hacer logout, SI desconectamos el servicio explícitamente.
        webSocketServiceRef.current.disconnect();
        webSocketServiceRef.current = null; // Limpiar la referencia
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

  // --- Lógica para mostrar el estado de la conexión en la UI ---
  const getConnectionStatus = () => {
    if (!currentUser) {
      return null;
    }
    // Solo usamos los estados del servicio WS directamente.
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
    // Si no está conectando y no está conectado
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
            // Los estados de conexión de WebSocket ahora se derivan directamente de reverbServiceInstance
            // y no se pasan como props separadas, ya que VideoRoom tiene acceso a la misma instancia.
            // Esto es más coherente y evita pasar props redundantes.
            // isWebSocketConnected={isWebSocketConnected} // Ya no es necesario pasar esto
            // isConnectingWebSocket={isConnecting} // Ya no es necesario pasar esto
          />
        </div>
      )}
    </div>
  );
};

export default Layout;