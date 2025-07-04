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
    <div className="container mx-auto py-4 px-4 sm:px-6 lg:px-8"> {/* Ajuste de padding */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div className="flex items-center mb-4 md:mb-0">
          <Video className="w-7 h-7 sm:w-8 sm:h-8 text-orange-500 mr-2 sm:mr-3" /> {/* Tamaño de icono responsivo */}
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Gestión de Salas</h1> {/* Tamaño de texto responsivo */}
        </div>
        
        {canCreateRooms && (
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 w-full sm:w-auto"> {/* Apila en móvil, luego en fila */}
            <button
              onClick={() => setView('list')}
              className={`w-full sm:w-auto px-4 py-2 rounded-md text-sm font-medium flex items-center justify-center
                ${view === 'list' 
                  ? 'bg-orange-500 text-white' 
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'}
              `}
            >
              <List className="w-4 h-4 mr-2" />
              Ver Salas
            </button>
            
            <button
              onClick={() => setView('create')}
              className={`w-full sm:w-auto px-4 py-2 rounded-md text-sm font-medium flex items-center justify-center
                ${view === 'create' 
                  ? 'bg-orange-500 text-white' 
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
        <div className="max-w-full md:max-w-2xl mx-auto"> {/* Eliminar mx-auto para que ocupe todo el ancho en móviles */}
          <CreateRoomForm onRoomCreated={handleRoomCreated} />
        </div>
      )}
    </div>
  );
};

export default RoomManagementPage;