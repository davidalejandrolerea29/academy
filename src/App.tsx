import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Components
import Layout from './components/Layout/Layout';
import LoginPage from './components/Auth/LoginPage';
import RoomManagementPage from './components/RoomManagement/RoomManagementPage';
import VideoRoom from './components/VideoRoom/VideoRoom';
import MessagingPage from './components/Messaging/MessagingPage';
import UserManagement from './components/Admin/UserManagement';
import RegisterPage from './components/Auth/RegisterPage';
import ChangePasswordPage from './components/Auth/ChangePasswordPage';

// Protected route component
const ProtectedRoute: React.FC<{ 
  children: React.ReactNode;
  allowedRoles?: string[];
}> = ({ children, allowedRoles }) => {
  const { currentUser, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }
  
if (allowedRoles) {
  const userRole = currentUser.role?.description?.toLowerCase();
  if (!userRole || !allowedRoles.map(r => r.toLowerCase()).includes(userRole)) {
    return <Navigate to="/rooms" replace />;
  }
}


  
  return <>{children}</>;
};

// Main App component
function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
           <Route path="/register" element={<RegisterPage />} />
           <Route path="/cambiar-password" element={<ChangePasswordPage />} />
          
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
           <Route index element={<Navigate to="/rooms" replace />} />
            
            <Route 
              path="rooms" 
              element={<RoomManagementPage />} 
            />
            
            <Route 
              path="rooms/:roomId" 
              element={<VideoRoom />} 
            />
            
            <Route 
              path="messages" 
              element={<MessagingPage />} 
            />
            
            <Route 
              path="admin/users" 
              element={
                <ProtectedRoute allowedRoles={['Admin']}>
                  <UserManagement />
                </ProtectedRoute>
              } 
            />
          </Route>
          
          <Route path="*" element={<Navigate to="/rooms" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App