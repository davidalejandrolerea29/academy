import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Loader
} from 'lucide-react';
import logo from '../../assets/logo.png';

// Asegúrate de que ReverbWebSocketService.ts incluye los logs y la lógica de setToken revisada
import { createReverbWebSocketService, ReverbWebSocketService } from '../../services/ReverbWebSocketService';

const Layout: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { activeRoomId, endCall, isCallMinimized, toggleMinimizeCall } = useCall();
const [isBrowserOnline, setIsBrowserOnline] = useState(navigator.onLine);
  // Estados locales para la conexión del WebSocket, manejados en Layout
  const [isWebSocketConnected, setIsWebSocketConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(true); // Inicia como conectando para mostrar "Conectando..." al cargar
  const webSocketServiceRef = useRef<ReverbWebSocketService | null>(null);

  // Callbacks memoizados para los eventos del servicio WebSocket
  // Estos callbacks son cruciales para actualizar el estado de la UI
  // y para loguear lo que el servicio WebSocket nos está reportando.
  useEffect(() => {
    console.log(`[Browser Network Status] Initial check: navigator.onLine = ${navigator.onLine}`);
    setIsBrowserOnline(navigator.onLine); // Establece el estado inicial

    const handleOnline = () => {
      console.log('--- NAVEGADOR: Conectado a la red (online). ---');
      setIsBrowserOnline(true);
      // Cuando el navegador vuelve a estar online, si nuestro servicio está desconectado,
      // podemos forzar un intento de conexión o reconexión aquí.
      // El servicio ya tiene lógica de reconexión, pero esto asegura que se dispare si
      // la pérdida de conexión del navegador fue el factor clave.
      if (webSocketServiceRef.current && !webSocketServiceRef.current.getIsConnected() && !webSocketServiceRef.current.getIsConnecting()) {
        console.log('[Browser Network Status] Navegador online. Intentando reconectar WebSocket si está inactivo.');
        webSocketServiceRef.current.connect().catch(e => console.error("Error al reconectar WS desde handler de online:", e));
      }
    };

    const handleOffline = () => {
      console.warn('--- NAVEGADOR: SIN CONEXIÓN a la red (offline). ---');
      setIsBrowserOnline(false);
      // Cuando el navegador se desconecta, forzamos un cierre del WebSocket.
      // Esto debería disparar el `onclose` en el servicio con un código de error,
      // lo que a su vez activará la lógica de reconexión de tu servicio.
      if (webSocketServiceRef.current && webSocketServiceRef.current.getIsConnected()) {
        console.warn('[Browser Network Status] Navegador offline. Forzando desconexión del WebSocket para activar reconexión.');
        webSocketServiceRef.current.disconnect(); // Esto debería llevar al onclose con un código anormal
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []); 
  const handleConnected = useCallback(() => {
    setIsWebSocketConnected(true);
    setIsConnecting(false);
    console.log('--- CONEXIÓN WEBSTOCKET: ¡Recuperada! ---'); // Log claro de recuperación
    console.log('[UI Listener] WebSocketService: Estado CONECTADO. UI actualizado.');
  }, []);

  const handleDisconnected = useCallback((event?: CloseEvent) => {
    setIsWebSocketConnected(false);
    // El servicio Reverb ya maneja la lógica de reconexión.
    // Aquí solo actualizamos el estado de la UI.
    // Si el código no es 1000 (cierre normal), asumimos que intenta reconectar.
    if (event?.code !== 1000) {
      setIsConnecting(true); // Indica que el servicio intentará reconectar
      console.log(`--- CONEXIÓN WEBSTOCKET: PERDIDA (${event?.reason || 'Sin razón'}). ---`); // Log claro de pérdida
      console.log(`[UI Listener] WebSocketService: Estado DESCONECTADO (intentando reconectar). Code: ${event?.code}, Reason: ${event?.reason}. UI actualizado.`);
    } else {
      setIsConnecting(false); // Es un cierre normal (ej. logout), no intentamos reconectar
      console.log(`[UI Listener] WebSocketService: Estado DESCONECTADO (cierre normal). Code: ${event?.code}, Reason: ${event?.reason}. UI actualizado.`);
    }
  }, []);

  const handleError = useCallback((error: any) => {
    console.error('[UI Listener] WebSocketService: ERROR inesperado. ', error);
    setIsWebSocketConnected(false);
    setIsConnecting(true); // Asumimos que un error podría llevar a intentar reconectar
  }, []);

  const handlePermanentlyDisconnected = useCallback(() => {
    setIsWebSocketConnected(false);
    setIsConnecting(false); // No se intentará reconectar más
    console.error('--- CONEXIÓN WEBSTOCKET: DESCONEXIÓN PERMANENTE. Máximos reintentos alcanzados. ---'); // Log claro de desconexión permanente
    console.error('[UI Listener] WebSocketService: Estado PERMANENTEMENTE DESCONECTADO. UI actualizado.');
  }, []);

  // --- EL ÚNICO Y PRINCIPAL useEffect para la lógica de conexión ---
  useEffect(() => {
    console.log(`[Layout Effect Lifecycle] Ejecutando useEffect. currentUser token: ${currentUser?.token ? 'presente' : 'ausente'}.`);

    // 1. Manejo cuando no hay token (usuario no autenticado/logout)
    if (!currentUser?.token) {
      console.log("[Layout Effect Lifecycle] No currentUser token detectado. Iniciando limpieza del servicio WebSocket.");
      if (webSocketServiceRef.current) {
        // Llama a disconnect() para cerrar la conexión de manera limpia.
        // Esto también actualizará los estados internos del servicio y emitirá 'disconnected'.
        console.log("[Layout Effect Lifecycle] Desconectando instancia existente de WebSocketService.");
        webSocketServiceRef.current.disconnect(); 
        webSocketServiceRef.current = null; // Limpiar la referencia
      }
      // Asegurarse de que el estado de la UI refleje la desconexión
      setIsWebSocketConnected(false);
      setIsConnecting(false);
      console.log("[Layout Effect Lifecycle] Estados de UI actualizados: Conectado=false, Conectando=false.");
      return; // Salir del efecto, no hay más que hacer sin token
    }

    // 2. Obtener/Crear la instancia del servicio singleton.
    // `createReverbWebSocketService` manejará si es una nueva instancia o si se debe actualizar el token.
    console.log("[Layout Effect Lifecycle] currentUser token presente. Obteniendo/Creando instancia de ReverbWebSocketService.");
    const service = createReverbWebSocketService(currentUser.token);

    // 3. Limpiar listeners de una posible instancia anterior o si se re-renderiza en Strict Mode.
    // Esto previene que se acumulen múltiples listeners en la misma instancia de servicio.
    if (webSocketServiceRef.current && webSocketServiceRef.current !== service) {
      console.log("[Layout Effect Lifecycle] Detectada instancia de servicio ANTERIOR o diferente. Limpiando sus listeners.");
      webSocketServiceRef.current.off('connected', handleConnected);
      webSocketServiceRef.current.off('disconnected', handleDisconnected);
      webSocketServiceRef.current.off('error', handleError);
      webSocketServiceRef.current.off('permanently_disconnected', handlePermanentlyDisconnected);
    }
    
    // 4. Establecer la instancia actual del servicio en la ref
    webSocketServiceRef.current = service;

    // 5. Registrar los listeners en la INSTANCIA ACTUAL del servicio.
    // Los Callbacks handleConnected, handleDisconnected, etc., son memoizados, por lo que son estables.
    console.log("[Layout Effect Lifecycle] Registrando listeners de UI en la instancia actual del servicio.");
    service.on('connected', handleConnected);
    service.on('disconnected', handleDisconnected);
    service.on('error', handleError);
    service.on('permanently_disconnected', handlePermanentlyDisconnected);

    // 6. Actualizar el estado inicial de la UI basado en el estado ACTUAL del servicio.
    // Esto es crucial para que la UI muestre el estado correcto inmediatamente al montar/re-renderizar
    // sin esperar a que ocurran eventos.
    const currentServiceIsConnected = service.getIsConnected();
    const currentServiceIsConnecting = service.getIsConnecting();
    setIsWebSocketConnected(currentServiceIsConnected);
    setIsConnecting(currentServiceIsConnecting);
    console.log(`[Layout Effect Lifecycle] Estado inicial de UI establecido: isWebSocketConnected=${currentServiceIsConnected}, isConnecting=${currentServiceIsConnecting}.`);

    // 7. Iniciar o asegurar la conexión del servicio.
    // `service.connect()` es idempotente: si ya está conectado, resolverá inmediatamente.
    // Si no, iniciará el proceso de conexión/reconexión.
    console.log("[Layout Effect Lifecycle] Llamando a service.connect() para asegurar la conexión.");
    service.connect().then(() => {
      console.log("[Layout Effect Lifecycle] service.connect() Promise resuelta exitosamente.");
    }).catch((e) => {
      console.error("[Layout Effect Lifecycle] service.connect() Promise fallida durante la inicialización:", e);
      // Si la promesa de conexión inicial falla por alguna razón (ej. credenciales inválidas)
      setIsWebSocketConnected(false);
      setIsConnecting(false);
    });

    // --- 8. Función de limpieza del useEffect (cleanup) ---
    // Se ejecuta ANTES de que el efecto se re-ejecute (debido a un cambio en dependencias)
    // o cuando el componente se desmonta.
    return () => {
      console.log('[Layout Effect Lifecycle] Ejecutando función de limpieza (cleanup).');
      if (webSocketServiceRef.current) {
        // Es crucial remover los listeners para evitar fugas de memoria y comportamientos inesperados.
        console.log('[Layout Effect Lifecycle] Limpiando listeners de WebSocket en la instancia actual (cleanup).');
        webSocketServiceRef.current.off('connected', handleConnected);
        webSocketServiceRef.current.off('disconnected', handleDisconnected);
        webSocketServiceRef.current.off('error', handleError);
        webSocketServiceRef.current.off('permanently_disconnected', handlePermanentlyDisconnected);
        // NOTA IMPORTANTE: NO LLAMES webSocketServiceRef.current.disconnect() AQUÍ.
        // El servicio es un singleton y debe permanecer vivo si el token sigue siendo válido
        // y el usuario permanece logueado. `createReverbWebSocketService` ya maneja la reconexión
        // cuando el token cambia o el usuario hace logout.
      }
    };
  }, [currentUser?.token, handleConnected, handleDisconnected, handleError, handlePermanentlyDisconnected]); // Dependencias del useEffect

  const handleLogout = async () => {
    console.log("[Logout] Iniciando proceso de cierre de sesión.");
    try {
      if (activeRoomId) {
        console.log("[Logout] Hay una llamada activa, finalizándola.");
        endCall();
      }
      // Cuando se hace logout, desconectamos explícitamente el servicio WebSocket
      // para asegurar que la conexión se cierra y el servidor lo registra.
      if (webSocketServiceRef.current) {
        console.log("[Logout] Desconectando explícitamente ReverbWebSocketService debido a logout.");
        webSocketServiceRef.current.disconnect(); // Esto cerrará la conexión real con código 1000
        webSocketServiceRef.current = null; // Limpiar la referencia también
      }
      await logout(); // Esto limpiará el token en AuthContext, lo que disparará el useEffect
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
    // Si el navegador está offline, muestra un mensaje específico
    if (!isBrowserOnline) {
      return (
        <span className="flex items-center text-red-700 text-sm font-medium">
          <WifiOff className="w-4 h-4 mr-1" />
          Sin conexión a Internet (Navegador)
        </span>
      );
    }
    // Si el navegador está online, procede con el estado de WebSocket
    if (isConnecting) {
      return (
        <span className="flex items-center text-yellow-500 text-sm font-medium animate-pulse">
          <Loader className="w-4 h-4 mr-1" />
          Conectando WebSocket...
        </span>
      );
    }
    if (isWebSocketConnected) {
      return (
        <span className="flex items-center text-green-600 text-sm font-medium">
          <Wifi className="w-4 h-4 mr-1" />
          WebSocket Conectado
        </span>
      );
    }
    // Si no está conectando y no está conectado (pero el navegador está online)
    return (
      <span className="flex items-center text-red-500 text-sm font-medium">
        <WifiOff className="w-4 h-4 mr-1" />
        WebSocket Desconectado
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
            // ¡Pasamos los estados derivados del Layout directamente a VideoRoom!
            isWebSocketConnected={isWebSocketConnected}
            isConnectingWebSocket={isConnecting}
          />
        </div>
      )}
    </div>
  );
};

export default Layout;