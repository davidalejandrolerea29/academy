import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useCall } from '../../contexts/CallContext';
// Asegúrate de que los tipos estén definidos como arriba
import { Room, User } from '../../types'; // O definir Participant, Message, RoomFrontend en este mismo archivo si no tienes types.ts
import {
  Calendar,
  Clock,
  User as UserIcon,
  Users,
  Video,
  Play,
  CheckCircle,
  XCircle,
  AlertCircle,
  MessageSquare // ¡Nuevo icono para mensajes!
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL;

// (Coloca las interfaces Message, Participant, RoomFrontend aquí si no están en types.ts)
interface Message {
  id: number;
  content: string;
  timestamp: string; // O Date, si lo parseas en el frontend
  read: boolean;
  banned: boolean;
  room_participant_id: number;
  sender_name: string; // Nuevo campo para el nombre del remitente
}

interface Participant {
  id: number;
  user_id: number;
  room_id: number;
  user: {
    id: number;
    name: string;
  } | null;
}

interface RoomFrontend extends Omit<Room, 'start_time' | 'end_time' | 'participants' | 'teacher'> {
  start_time: Date;
  end_time: Date;
  teacher: {
    id: number;
    name: string;
  } | null;
  participants: Participant[];
  messages?: Message[]; // Campo opcional para los administradores
}


const RoomList: React.FC = () => {
  const { currentUser } = useAuth();
  const { startCall } = useCall();
  const [rooms, setRooms] = useState<RoomFrontend[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('upcoming');

  // Estado para el modal de mensajes
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [currentRoomMessages, setCurrentRoomMessages] = useState<Message[]>([]);
  const [currentRoomName, setCurrentRoomName] = useState('');

  const fetchRooms = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      // Ya no es necesario enviar user_id en el query, el backend lo obtiene del token
      console.log('Fetching rooms for current user role:', currentUser.role?.description);
      const response = await fetch(`${API_URL}/auth/rooms`, { // URL sin ?user_id
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      });

      if (!response.ok) throw new Error('Error al obtener las salas');

      const data = await response.json();

      const mappedRooms: RoomFrontend[] = data.map((room: any) => ({
        ...room,
        start_time: new Date(room.start_time),
        end_time: new Date(room.end_time),
        // Los mensajes ya vienen listos en el campo 'messages' si el usuario es admin
      }));
      console.log('Mapped Rooms:', mappedRooms);
      setRooms(mappedRooms);
    } catch (error) {
      console.error('Error fetching rooms:', error);
    } finally {
      setLoading(false);
    }
  }, [currentUser, API_URL]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  const toggleRoomActive = async (roomId: number, currentStatus: boolean) => {
    if (!currentUser || (currentUser.role?.description !== 'Admin' && currentUser.role?.description !== 'Teacher')) {
      console.warn('No tienes permisos para cambiar el estado de la sala.');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
        console.error('Token de autenticación no encontrado.');
        return;
    }

    try {
      const response = await fetch(`${API_URL}/auth/rooms/${roomId}/toggle`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          is_active: !currentStatus,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al actualizar la sala');
      }

      console.log(`Sala ${roomId} actualizada con éxito.`);
      fetchRooms(); // Refrescar la lista de salas después de la actualización
    } catch (error) {
      console.error('Error actualizando la sala:', error);
    }
  };

  const formatDate = (date: Date) =>
    date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const formatTime = (date: Date) =>
    date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  const getRoomStatus = (room: RoomFrontend) => {
    const now = new Date();
    if (room.end_time < now) return { label: 'Finalizada', color: 'gray', icon: CheckCircle };
    if (room.start_time > now && room.is_active) return { label: 'Programada', color: 'blue', icon: Calendar };
    if (room.start_time > now && !room.is_active) return { label: 'Inactiva', color: 'red', icon: XCircle };
    if (room.start_time <= now && room.end_time >= now && room.is_active) return { label: 'En curso', color: 'green', icon: Play };
    if (room.start_time <= now && room.end_time >= now && !room.is_active) return { label: 'Inactiva (ahora)', color: 'red', icon: XCircle };
    return { label: 'Estado Desconocido', color: 'yellow', icon: AlertCircle };
  };

  const filteredRooms = rooms.filter((room) => {
    const now = new Date();
    if (filter === 'upcoming') {
      return room.end_time >= now;
    }
    if (filter === 'past') {
      return room.end_time < now;
    }
    return true;
  });

  // Función para abrir el modal de mensajes
  const openMessageModal = (room: RoomFrontend) => {
    setCurrentRoomMessages(room.messages || []);
    setCurrentRoomName(room.name);
    setIsMessageModalOpen(true);
  };

  // Función para cerrar el modal de mensajes
  const closeMessageModal = () => {
    setIsMessageModalOpen(false);
    setCurrentRoomMessages([]);
    setCurrentRoomName('');
  };


  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-800 mb-4 sm:mb-0">Salas de Videollamada</h1>
        <div className="flex flex-wrap justify-center sm:justify-start gap-2 w-full sm:w-auto">
          <button
            onClick={() => setFilter('upcoming')}
            className={`px-3 py-1 rounded-md text-sm ${
              filter === 'upcoming'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Próximas
          </button>
          <button
            onClick={() => setFilter('past')}
            className={`px-3 py-1 rounded-md text-sm ${
              filter === 'past'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Pasadas
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-md text-sm ${
              filter === 'all'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Todas
          </button>
        </div>
      </div>

      {filteredRooms.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-6 sm:p-8 text-center mx-auto max-w-lg">
          <AlertCircle className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-3 sm:mb-4" />
          <h2 className="text-lg sm:text-xl font-medium text-gray-700 mb-1 sm:mb-2">No hay salas disponibles</h2>
          <p className="text-sm text-gray-500">
            {filter === 'upcoming'
              ? 'No hay salas programadas próximamente.'
              : filter === 'past'
              ? 'No hay salas pasadas.'
              : 'No hay salas creadas.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredRooms.map((room) => {
            const status = getRoomStatus(room);
            const StatusIcon = status.icon;
            const now = new Date();
            const isLive = room.start_time <= now && room.end_time >= now && room.is_active;

            const uniqueParticipants = new Set(room.participants.map(p => p.user_id)).size;

             return (
              <div key={room.id} className="bg-white rounded-lg shadow overflow-hidden flex flex-col"> {/* Añade flex-col aquí */}
                <div className="p-4 sm:p-5 flex-grow"> {/* Añade flex-grow para que el contenido ocupe el espacio disponible */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3">
                    <h2 className="text-base sm:text-lg font-semibold text-gray-800 flex-1 mb-2 sm:mb-0">{room.name}</h2>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-${status.color}-100 text-${status.color}-800`}
                    >
                      <StatusIcon className={`w-3 h-3 mr-1 text-${status.color}-500`} />
                      {status.label}
                    </span>
                  </div>

                  <p className="text-gray-600 text-sm mb-3 sm:mb-4">{room.description}</p>

                  <div className="space-y-1 sm:space-y-2 mb-3 sm:mb-4 text-xs sm:text-sm">
                    <div className="flex items-center text-gray-500">
                      <Calendar className="w-4 h-4 mr-2" />
                      {formatDate(room.start_time)}
                    </div>
                    <div className="flex items-center text-gray-500">
                      <Clock className="w-4 h-4 mr-2" />
                      {formatTime(room.start_time)} - {formatTime(room.end_time)}
                    </div>
                    {room.teacher && (
                      <div className="flex items-center text-sm text-gray-500">
                        <UserIcon className="w-4 h-4 mr-2" />
                        <span className="font-semibold">Profesor:&nbsp;</span> {room.teacher.name}
                      </div>
                    )}
                    <div className="flex items-center text-sm text-gray-500">
                      <Users className="w-4 h-4 mr-2" />
                      <span className="font-semibold">Participantes:&nbsp;</span> {uniqueParticipants}
                    </div>
                  </div>

                  {/* PRIMERA FILA DE BOTONES: Unirse/Ver Sala y Activar/Desactivar */}
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-2"> {/* Reduce el margen inferior si el botón de mensajes va justo debajo */}
                    {isLive ? (
                      <button
                        onClick={() => startCall(String(room.id))}
                        className="bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-md flex items-center justify-center text-sm transition-colors w-full flex-grow"
                      >
                        <Video className="w-4 h-4 mr-2" />
                        Unirse
                      </button>
                    ) : room.start_time <= now && room.end_time >= now ? (
                      <button
                        onClick={() => startCall(String(room.id))}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-md flex items-center justify-center text-sm transition-colors w-full flex-grow"
                      >
                        <Video className="w-4 h-4 mr-2" />
                        Ver sala
                      </button>
                    ) : (
                      <span className="text-sm text-gray-500 px-3 py-2 w-full text-center sm:text-left flex-grow">
                        {room.start_time > now ? 'Próximamente' : 'Finalizada'}
                      </span>
                    )}

                    {(currentUser?.role?.description === 'Admin' || (currentUser?.role?.description === 'Teacher' && room.teacher_id === currentUser.id)) && (
                      <button
                        onClick={() => toggleRoomActive(room.id, room.is_active)}
                        className={`px-3 py-2 rounded-md text-sm w-full flex-grow ${
                          room.is_active
                            ? 'bg-red-100 text-red-700 hover:bg-red-200'
                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                        }`}
                        disabled={room.end_time < now}
                      >
                        {room.is_active ? 'Desactivar' : 'Activar'}
                      </button>
                    )}
                  </div>
                </div> {/* Cierre del div flex-grow */}

                {/* SEGUNDA FILA (INFERIOR): Botón de Ver Mensajes (solo para administradores) */}
                {(currentUser?.role?.description === 'Admin') && ( // Muestra la sección solo si es admin
                  <div className="p-4 sm:p-5 border-t border-gray-200"> {/* Un padding diferente y un borde superior para separarlo */}
                    {room.messages && room.messages.length > 0 ? (
                      <button
                        onClick={() => openMessageModal(room)}
                        className="bg-purple-100 text-purple-700 hover:bg-purple-200 px-3 py-2 rounded-md flex items-center justify-center text-sm transition-colors w-full"
                      >
                        <MessageSquare className="w-4 h-4 mr-2" />
                        Ver Mensajes ({room.messages.length})
                      </button>
                    ) : (
                      <span className="text-sm text-gray-400 text-center block"> {/* block para que ocupe todo el ancho */}
                        No hay mensajes para esta sala.
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal para mostrar mensajes */}
      {isMessageModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex justify-center items-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md md:max-w-lg lg:max-w-xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-800">Mensajes de "{currentRoomName}"</h2>
              <button onClick={closeMessageModal} className="text-gray-500 hover:text-gray-700">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4 flex-grow overflow-y-auto custom-scrollbar">
              {currentRoomMessages.length === 0 ? (
                <p className="text-gray-600 text-center">No hay mensajes para esta sala.</p>
              ) : (
                <div className="space-y-3">
                  {currentRoomMessages.map((msg) => (
                    <div key={msg.id} className={`p-3 rounded-lg ${msg.banned ? 'bg-red-100' : 'bg-gray-100'}`}>
                      <p className="text-xs text-gray-500 mb-1">
                        <span className="font-semibold">{msg.sender_name}</span> el {new Date(msg.timestamp).toLocaleString('es-ES')}
                      </p>
                      <p className={`text-gray-800 ${msg.banned ? 'line-through text-red-700 italic' : ''}`}>
                        {msg.content}
                      </p>
                      {msg.banned && <p className="text-red-500 text-xs mt-1">Mensaje censurado</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t">
              <button
                onClick={closeMessageModal}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-md text-sm transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoomList;