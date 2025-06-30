import React, { useState } from 'react';
import RoomList from './RoomList';
import CreateRoomForm from './CreateRoomForm';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, List, Video } from 'lucide-react';

const RoomManagementPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [view, setView] = useState<'list' | 'create'>('list');

  const canCreateRooms = currentUser?.role_description === 'Admin' || currentUser?.role_description === 'Teacher';

  const handleRoomCreated = () => {
    setView('list');
  };

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div className="flex items-center mb-4 md:mb-0">
          <Video className="w-8 h-8 text-blue-500 mr-3" />
          <h1 className="text-2xl font-bold text-gray-800">Gestión de Salas</h1>
        </div>
        
        {canCreateRooms && (
          <div className="flex space-x-2">
            <button
              onClick={() => setView('list')}
              className={`px-4 py-2 rounded-md text-sm font-medium flex items-center
                ${view === 'list' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'}
              `}
            >
              <List className="w-4 h-4 mr-2" />
              Ver Salas
            </button>
            
            <button
              onClick={() => setView('create')}
              className={`px-4 py-2 rounded-md text-sm font-medium flex items-center
                ${view === 'create' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'}
              `}
            >
              <Plus className="w-4 h-4 mr-2" />
              Crear Sala
            </button>
          </div>
        )}
      </div>
      
      {view === 'list' ? (
        <RoomList />
      ) : (
        <div className="max-w-2xl mx-auto">
          <CreateRoomForm onRoomCreated={handleRoomCreated} />
        </div>
      )}
    </div>
  );
};

export default RoomManagementPage;