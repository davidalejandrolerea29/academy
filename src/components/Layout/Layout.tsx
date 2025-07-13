// src/components/Layout/Layout.tsx

import React, { useState, useEffect, useRef } from 'react'; // ¡Importa useRef!
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
    const handleConnected = () => {
      setIsWebSocketConnected(true);
      setIsConnecting(false);
      console.log('UI: WebSocket está CONECTADO. (Estado UI actualizado)');
    };

    // Ajustamos handleDisconnected para ser más preciso con el estado de reconexión
    const handleDisconnected = (event?: CloseEvent) => {
        setIsWebSocketConnected(false);
        // Si el código de cierre NO es 1000 (cierre normal), entonces asumimos reconexión.
        // ReverbWebSocketService ya maneja los intentos de reconexión internos.
        if (event?.code !== 1000) {
            setIsConnecting(true); // Estamos en proceso de intentar reconectar
            console.log(`UI: WebSocket DESCONECTADO (reconexión automática). Code: ${event?.code}, Reason: ${event?.reason}.`);
        } else {
            // Cierre normal (ej. logout, navegación que cierra la app). No estamos "conectando".
            setIsConnecting(false);
            console.log(`UI: WebSocket DESCONECTADO (cierre normal). Code: ${event?.code}, Reason: ${event?.reason}.`);
        }
    };

    const handleError = (error: any) => {
      console.error('UI: WebSocket ERROR recibido:', error);
      setIsConnected(false); // Un error significa que no está conectado
      setIsConnecting(false); // Y no está intentando conectar activamente (por ahora)
    };

    const handlePermanentlyDisconnected = () => {
      setIsWebSocketConnected(false);
      setIsConnecting(false);
      console.error('UI: WebSocket permanentemente desconectado. (Estado UI actualizado)');
      // Aquí podrías mostrar un mensaje crítico al usuario para que recargue la página.
    };

    // Registrar los listeners en la instancia del servicio
    service.on('connected', handleConnected);
    service.on('disconnected', handleDisconnected);
    service.on('error', handleError);
    service.on('permanently_disconnected', handlePermanentlyDisconnected);

    // --- ACTUALIZAR EL ESTADO INICIAL DEL UI BASADO EN EL SERVICIO ---
    // Esto es CRUCIAL para que el UI muestre el estado correcto al montar.
    setIsWebSocketConnected(service.getIsConnected());
    setIsConnecting(service.getIsConnecting());
    console.log(`[Layout Init] Estado inicial del servicio: Conectado=${service.getIsConnected()}, Conectando=${service.getIsConnecting()}`);


    // Intentar conectar el servicio. Si ya está conectado, resolverá de inmediato.
    // Si no, iniciará la conexión. Los listeners 'connected'/'disconnected' se encargarán
    // de actualizar los estados de React cuando los eventos reales del WebSocket ocurran.
    service.connect().then(() => {
        // La promesa se resuelve cuando la conexión se establece.
        // Los `handleConnected` ya deberían haberse disparado.
        console.log("Layout: connect() Promise resuelta.");
    }).catch((e) => {
        console.error("Layout: Error inicial al conectar ReverbService:", e);
        // Si hay un error *al intentar la conexión inicial*, marcamos como no conectado.
        setIsWebSocketConnected(false);
        setIsConnecting(false);
    });

    // --- LIMPIEZA AL DESMONTAR O RE-EJECUTAR EL EFECTO ---
    return () => {
      console.log('UI: Limpiando listeners de WebSocket en Layout.');
      // Asegurarse de que la referencia al servicio exista antes de desregistrar
      if (webSocketServiceRef.current) {
        webSocketServiceRef.current.off('connected', handleConnected);
        webSocketServiceRef.current.off('disconnected', handleDisconnected);
        webSocketServiceRef.current.off('error', handleError);
        webSocketServiceRef.current.off('permanently_disconnected', handlePermanentlyDisconnected);
      }
      // NOTA: NO LLAMAR webSocketServiceRef.current.disconnect() AQUÍ.
      // El servicio singleton maneja su propia vida. Layout solo lo usa.
    };
  }, [currentUser?.token]); // Re-ejecutar si el token del usuario cambia

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