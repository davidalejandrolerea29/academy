import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Video, 
  MessageSquare, 
  Users, 
  LogOut, 
  Menu, 
  X,
  UserCircle
} from 'lucide-react';

const Layout: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    try {
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
    switch (currentUser.role) {
      case 'admin': return 'Administrador';
      case 'teacher': return 'Profesor';
      case 'alumno': return 'Alumno';
      default: return currentUser.role;
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
          <div className="flex items-center justify-between p-4 border-b">
            <h1 className="text-xl font-bold text-blue-600">EduVídeo</h1>
            <button 
              className="lg:hidden text-gray-500 hover:text-gray-700"
              onClick={closeSidebar}
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          
          {currentUser && (
            <>
              <div className="p-4 border-b">
                <div className="flex items-center">
                  {currentUser.photoURL ? (
                    <img 
                      src={currentUser.photoURL} 
                      alt={currentUser.displayName}
                      className="w-10 h-10 rounded-full mr-3"
                    />
                  ) : (
                    <UserCircle className="w-10 h-10 text-gray-400 mr-3" />
                  )}
                  <div>
                    <div className="font-medium text-gray-800">{currentUser.displayName}</div>
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
                
                {currentUser.role === 'admin' && (
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
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50">
          <div className="container mx-auto p-4">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;