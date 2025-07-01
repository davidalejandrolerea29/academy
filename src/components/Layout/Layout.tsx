// src/components/Layout.tsx

import React, { useState } from 'react';
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
  UserCircle
} from 'lucide-react';
import logo from '../../assets/logo.png';

const Layout: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { activeRoomId, endCall, isCallMinimized } = useCall();

  const handleLogout = async () => {
    try {
      if (activeRoomId) {
        endCall();
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
                      ? 'bg-blue-50 text-blue-700'
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
                      ? 'bg-blue-50 text-blue-700'
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
                        ? 'bg-blue-50 text-blue-700'
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
              <h1 className="text-lg font-semibold text-gray-800 lg:hidden">EduVídeo</h1>
            </div>
          </div>
        </header>

        {/* Content area */}
        {/*
          El 'main' sigue gestionando su propio overflow para pantallas grandes.
          En móviles, el overflow lo gestionarán los componentes internos si es necesario.
        */}
        <main className="flex-1 overflow-x-hidden lg:overflow-y-auto bg-gray-50">
          {/*
            CAMBIO CLAVE AQUÍ:
            - Eliminamos el 'overflow-hidden' y 'md:overflow-visible' de este div.
            - Lo dejamos con 'h-full' para que ocupe todo el espacio vertical disponible por 'main'.
            - Los componentes hijos del Outlet ahora son responsables de su propio 'overflow'.
          */}
          <div className="container mx-auto p-0 lg:p-4 h-full">
            <Outlet />
          </div>
        </main>
      </div>

      {/* VideoRoom rendered here, outside the Outlet */}
      {activeRoomId && (
        <div className={`
          fixed bg-black bg-opacity-75 z-40
          transition-all duration-300 ease-in-out
          ${isCallMinimized
            ? 'bottom-4 right-4 w-[320px] h-[400px] rounded-lg shadow-xl overflow-hidden'
            : 'inset-0 flex items-center justify-center'
          }
        `}>
          <VideoRoom
            roomId={activeRoomId}
            onCallEnded={endCall}
          />
        </div>
      )}
    </div>
  );
};

export default Layout;