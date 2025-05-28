import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Room, User } from '../../types';
import { supabase } from '../../lib/supabase';
import {
  Calendar,
  Clock,
  User as UserIcon,
  Video,
  Play,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';

const RoomList: React.FC = () => {
  const { currentUser } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [teachers, setTeachers] = useState<Record<string, User>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('upcoming');

  useEffect(() => {
    if (!currentUser) return;

    const fetchRooms = async () => {
      setLoading(true);
      let query = supabase.from('rooms').select('*').order('start_time', { ascending: true });

      if (currentUser.role === 'teacher') {
        query = query.eq('teacherId', currentUser.id);
      } else if (currentUser.role === 'alumno') {
        query = query.contains('participants', [currentUser.id]);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching rooms:', error);
        setLoading(false);
        return;
      }

      const mappedRooms = data.map((room: any) => ({
        ...room,
        start_time: new Date(room.start_time),
        end_time: new Date(room.end_time),
      }));

      setRooms(mappedRooms);
      setLoading(false);

      const teacherIds = [...new Set(mappedRooms.map((r) => r.teacherId))];
      fetchTeachers(teacherIds);
    };

    fetchRooms();

    const channel = supabase
      .channel('rooms-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, (payload) => {
        fetchRooms();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser]);

  const fetchTeachers = async (ids: string[]) => {
    if (ids.length === 0) return;

    const { data, error } = await supabase
      .from('user')
      .select('id, displayName, email, role, photoURL')
      .in('id', ids);

    if (error) {
      console.error('Error fetching teachers:', error);
      return;
    }

    const result: Record<string, User> = {};
    data.forEach((u) => {
      result[u.id] = u;
    });

    setTeachers(result);
  };

  const toggleRoomActive = async (roomId: string, currentStatus: boolean) => {
    if (currentUser?.role !== 'admin' && currentUser?.role !== 'teacher') return;

    const { error } = await supabase
      .from('rooms')
      .update({
        is_active: !currentStatus,
        lastUpdated: new Date()
      })
      .eq('id', roomId);

    if (error) console.error('Error updating room:', error);
  };

  const formatDate = (date: Date) =>
    date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const formatTime = (date: Date) =>
    date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  const getRoomStatus = (room: Room) => {
    const now = new Date();
    if (room.end_time < now) return { label: 'Finalizada', color: 'gray', icon: CheckCircle };
    if (room.start_time > now) return { label: 'Programada', color: 'blue', icon: Calendar };
    if (room.is_active) return { label: 'En curso', color: 'green', icon: Play };
    return { label: 'Inactiva', color: 'red', icon: XCircle };
  };

  const filteredRooms = rooms.filter((room) => {
    const now = new Date();
    if (filter === 'upcoming') return room.start_time >= now || (room.start_time <= now && room.end_time >= now);
    if (filter === 'past') return room.end_time < now;
    return true;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-800">Salas de Videollamada</h1>
        <div className="flex space-x-2">
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
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-medium text-gray-700 mb-2">No hay salas disponibles</h2>
          <p className="text-gray-500">
            {filter === 'upcoming' 
              ? 'No hay salas programadas próximamente.' 
              : filter === 'past' 
              ? 'No hay salas pasadas.' 
              : 'No hay salas creadas.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRooms.map((room) => {
            const status = getRoomStatus(room);
            const StatusIcon = status.icon;
            const now = new Date();
            const isLive = room.start_time <= now && room.end_time >= now && room.is_active;
            const teacher = teachers[room.teacherId];
            
            return (
              <div key={room.id} className="bg-white rounded-lg shadow overflow-hidden">
                <div className="p-5">
                  <div className="flex justify-between items-start mb-3">
                    <h2 className="text-lg font-semibold text-gray-800 flex-1">{room.name}</h2>
                    <span 
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-${status.color}-100 text-${status.color}-800`}
                    >
                      <StatusIcon className={`w-3 h-3 mr-1 text-${status.color}-500`} />
                      {status.label}
                    </span>
                  </div>
                  
                  <p className="text-gray-600 text-sm mb-4">{room.description}</p>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center text-sm text-gray-500">
                      <Calendar className="w-4 h-4 mr-2" />
                      {formatDate(room.start_time)}
                    </div>
                    <div className="flex items-center text-sm text-gray-500">
                      <Clock className="w-4 h-4 mr-2" />
                      {formatTime(room.start_time)} - {formatTime(room.end_time)}
                    </div>
                    {teacher && (
                      <div className="flex items-center text-sm text-gray-500">
                        <UserIcon className="w-4 h-4 mr-2" />
                        {teacher.display_name}
                      </div>
                    )}
                    <div className="flex items-center text-sm text-gray-500">
                      <UserIcon className="w-4 h-4 mr-2" />
                      {room.participants.length} participantes
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    {isLive ? (
                      <Link
                        to={`/rooms/${room.id}`}
                        className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md flex items-center transition-colors"
                      >
                        <Video className="w-4 h-4 mr-2" />
                        Unirse ahora
                      </Link>
                    ) : room.start_time <= now && room.end_time >= now ? (
                      <Link
                        to={`/rooms/${room.id}`}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md flex items-center transition-colors"
                      >
                        <Video className="w-4 h-4 mr-2" />
                        Ver sala
                      </Link>
                    ) : (
                      <span className="text-sm text-gray-500">
                        {room.start_time > now ? 'Próximamente' : 'Finalizada'}
                      </span>
                    )}
                    
                    {(currentUser?.role === 'admin' || (currentUser?.role === 'teacher' && room.teacherId === currentUser.id)) && (
                      <button
                        onClick={() => toggleRoomActive(room.id, room.is_active)}
                        className={`ml-2 px-3 py-1 rounded-md text-sm ${
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
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RoomList;