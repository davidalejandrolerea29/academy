import React, { useState } from 'react';
import RoomList from './RoomList';
import CreateRoomForm from './CreateRoomForm';
import RecordingsList from './RecordingsList';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, List, Video } from 'lucide-react';

const RoomManagementPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [view, setView] = useState<'list' | 'create' | 'recordings'>('list');

  const canCreateRooms = currentUser?.role_description === 'Admin' || currentUser?.role_description === 'Teacher';
  // Todos pueden ver Grabaciones; la API filtra por rol (alumno ve solo las de sus salas).
  const canViewRecordings = true;

  const handleRoomCreated = () => {
    setView('list');
  };

  return (
    <div className="ui-page-enter container mx-auto py-4 px-4 sm:px-6 lg:px-8"> {/* Ajuste de padding */}
      <div className="ui-page-heading flex flex-col xl:flex-row justify-between items-start xl:items-center gap-5 mb-6 p-5 sm:p-6">
        <div className="flex items-start gap-3 sm:gap-4 min-w-0">
          <span className="ui-heading-icon flex-shrink-0" aria-hidden="true">
            <Video className="w-6 h-6 sm:w-7 sm:h-7" />
          </span>
          <div className="min-w-0">
            <p className="ui-eyebrow mb-1.5">Aula virtual</p>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">Gestión de Salas</h1>
            <p className="mt-2 text-sm text-gray-600 leading-relaxed">Consulta tus clases, accede a las salas y revisa las grabaciones.</p>
          </div>
        </div>

        {(canCreateRooms || canViewRecordings) && (
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 w-full sm:w-auto"> {/* Apila en móvil, luego en fila */}
            <button
              onClick={() => setView('list')}
              aria-pressed={view === 'list'}
              className={`ui-tab ui-interactive w-full sm:w-auto px-4 py-2 rounded-xl text-sm font-medium flex items-center justify-center shadow-sm
                ${view === 'list'
                  ? 'bg-orange-500 text-white shadow-orange-100'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-orange-50 hover:border-orange-200'}
              `}
            >
              <List className="w-4 h-4 mr-2" />
              Ver Salas
            </button>

            {canViewRecordings && (
              <button
                onClick={() => setView('recordings')}
                aria-pressed={view === 'recordings'}
                className={`ui-tab ui-interactive w-full sm:w-auto px-4 py-2 rounded-xl text-sm font-medium flex items-center justify-center shadow-sm
                  ${view === 'recordings'
                    ? 'bg-orange-500 text-white shadow-orange-100'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-orange-50 hover:border-orange-200'}
                `}
              >
                <Video className="w-4 h-4 mr-2" />
                Grabaciones
              </button>
            )}

            {canCreateRooms && (
              <button
                onClick={() => setView('create')}
                aria-pressed={view === 'create'}
                className={`ui-tab ui-interactive w-full sm:w-auto px-4 py-2 rounded-xl text-sm font-medium flex items-center justify-center shadow-sm
                  ${view === 'create'
                    ? 'bg-orange-500 text-white shadow-orange-100'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-orange-50 hover:border-orange-200'}
                `}
              >
                <Plus className="w-4 h-4 mr-2" />
                Crear Sala
              </button>
            )}
          </div>
        )}
      </div>

      {view === 'list' && <RoomList />}
      {view === 'create' && (
        <div className="max-w-full md:max-w-2xl mx-auto">
          <CreateRoomForm onRoomCreated={handleRoomCreated} />
        </div>
      )}
      {view === 'recordings' && canViewRecordings && <RecordingsList />}
    </div>
  );
};

export default RoomManagementPage;
