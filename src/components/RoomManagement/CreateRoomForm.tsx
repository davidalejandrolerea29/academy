// src/components/CreateRoomForm.tsx

import React, { useState, useEffect, useCallback, useMemo } from 'react'; // Añadido useMemo
import { useAuth } from '../../contexts/AuthContext';
import { User } from '../../types';
import { Calendar, Clock, Users, Info, Search } from 'lucide-react'; // Añadimos Search para el buscador

const API_URL = import.meta.env.VITE_API_URL;

const CreateRoomForm: React.FC<{ onRoomCreated: () => void }> = ({ onRoomCreated }) => {
  const { currentUser } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<number[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Nuevos estados para el filtro y buscador
  const [roleFilter, setRoleFilter] = useState<'All' | 'Admin' | 'Teacher' | 'Student'>('All');
  const [searchTerm, setSearchTerm] = useState('');


  const fetchAllUsers = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Token de autenticación no encontrado. Por favor, inicia sesión.');
        return;
      }

      const response = await fetch(`${API_URL}/auth/users`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Error al obtener los usuarios');
      }

      const users = await response.json();

      // FILTRADO INICIAL: Excluir al usuario actual
      const filteredUsers = users.filter((user: User) => user.id !== currentUser?.id);

      if (currentUser?.role?.description === 'Admin') {
        setAllUsers(filteredUsers);
      } else if (currentUser?.role?.description === 'Teacher') {
        const students = filteredUsers.filter((user: any) =>
          user.role?.description === 'Student' &&
          user.assigned_teacher_ids && // Asegúrate de que `assigned_teacher_ids` se esté enviando desde el backend para alumnos
          user.assigned_teacher_ids.includes(currentUser.id)
        );
        setAllUsers(students);
      } else {
        setAllUsers([]);
      }

    } catch (error: any) {
      console.error('Error fetching users:', error.message);
      setError('Error al cargar los usuarios');
    }
  }, [API_URL, currentUser]);

  useEffect(() => {
    fetchAllUsers();
  }, [fetchAllUsers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('token');

    if (!currentUser || (currentUser.role?.description !== 'Admin' && currentUser.role?.description !== 'Teacher')) {
      setError('No tienes permisos para crear salas');
      return;
    }

    if (!name || !description || !date || !startTime || !endTime) {
      setError('Por favor completa todos los campos requeridos');
      return;
    }

    const startDateTime = new Date(`${date}T${startTime}`);
    const endDateTime = new Date(`${date}T${endTime}`);

    if (startDateTime >= endDateTime) {
      setError('La hora de inicio debe ser anterior a la hora de finalización');
      return;
    }

    if (startDateTime < new Date()) {
      setError('No puedes crear salas en el pasado');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_URL}/auth/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name,
          description,
          teacher_id: currentUser.id,
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          is_active: true,
          is_recording: false,
          participants: selectedParticipants,
          created_at: new Date().toISOString(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('Error al crear sala:', result);
        setError(result.message || 'Error al crear la sala');
        return;
      }

      setSuccess(true);
      setName('');
      setDescription('');
      setDate('');
      setStartTime('');
      setEndTime('');
      setSelectedParticipants([]);

      setTimeout(() => {
        setSuccess(false);
        onRoomCreated();
      }, 2000);
    } catch (error) {
      console.error('Unexpected error:', error);
      setError('Error inesperado al crear la sala');
    } finally {
      setLoading(false);
    }
  };

  const handleParticipantToggle = (userId: number) => {
    setSelectedParticipants((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const getRoleTagClass = (roleDescription: string) => {
    switch (roleDescription) {
      case 'Admin':
        return 'bg-purple-100 text-purple-800';
      case 'Teacher':
        return 'bg-blue-100 text-blue-800';
      case 'Student':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Lógica para filtrar y buscar usuarios
  const displayedUsers = useMemo(() => {
    let filtered = allUsers;

    // 1. Filtrar por rol
    if (roleFilter !== 'All') {
      filtered = filtered.filter(user => user.role?.description === roleFilter);
    }

    // 2. Filtrar por término de búsqueda (nombre)
    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(user =>
        user.name?.toLowerCase().includes(lowerCaseSearchTerm) ||
        user.email?.toLowerCase().includes(lowerCaseSearchTerm) // Opcional: buscar también por email
      );
    }
    return filtered;
  }, [allUsers, roleFilter, searchTerm]);


  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-4 sm:p-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-4 sm:mb-6">Crear Nueva Sala</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md flex items-start text-sm">
          <Info className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-md text-sm">
          Sala creada exitosamente
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Nombre de la Sala *
          </label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            required
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            Descripción *
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            rows={3}
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div>
            <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
              Fecha *
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
              <input
                type="date"
                id="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full pl-10 px-3 py-2 border border-gray-300 rounded-md text-sm"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="startTime" className="block text-sm font-medium text-gray-700 mb-1">
              Hora de Inicio *
            </label>
            <div className="relative">
              <Clock className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
              <input
                type="time"
                id="startTime"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full pl-10 px-3 py-2 border border-gray-300 rounded-md text-sm"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="endTime" className="block text-sm font-medium text-gray-700 mb-1">
              Hora de Finalización *
            </label>
            <div className="relative">
              <Clock className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
              <input
                type="time"
                id="endTime"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full pl-10 px-3 py-2 border border-gray-300 rounded-md text-sm"
                required
              />
            </div>
          </div>
        </div>

        {/* Selección de Usuarios (Participantes) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <div className="flex items-center">
              <Users className="w-5 h-5 mr-1 text-gray-500" />
              Seleccionar Participantes
            </div>
          </label>

          {/* Filtros de rol y buscador */}
          <div className="mb-3 flex flex-col sm:flex-row gap-2 sm:gap-3 items-center">
            {/* Filtro por Rol */}
            <div className="flex-grow w-full sm:w-auto">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as 'All' | 'Admin' | 'Teacher' | 'Student')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="All">Todos los Roles</option>
                <option value="Admin">Administradores</option>
                <option value="Teacher">Profesores</option>
                <option value="Student">Alumnos</option>
              </select>
            </div>

            {/* Buscador por Nombre/Email */}
            <div className="relative flex-grow w-full sm:w-auto">
              <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nombre o email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto border border-gray-300 rounded-md p-2">
            {displayedUsers.length === 0 ? (
              <p className="text-gray-500 text-sm p-2 text-center">No hay usuarios que coincidan con los filtros.</p>
            ) : (
              displayedUsers.map((user) => (
                <div key={user.id} className="flex items-center p-2 hover:bg-gray-50">
                  <input
                    type="checkbox"
                    id={`user-${user.id}`}
                    checked={selectedParticipants.includes(user.id)}
                    onChange={() => handleParticipantToggle(user.id)}
                    className="h-4 w-4 text-orange-600 focus:ring-orange-500"
                  />
                  <label
                    htmlFor={`user-${user.id}`}
                    className="ml-2 flex items-center text-sm text-gray-700 cursor-pointer w-full" // Añadimos justify-between
                  >
                    <span>{user.name || 'Usuario sin nombre'}</span>
                    {user.role && (
                      <span
                        className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${getRoleTagClass(user.role.description)}`}
                      >
                        {user.role.description}
                      </span>
                    )}
                  </label>
                </div>
              ))
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Seleccionados: {selectedParticipants.length} usuario{selectedParticipants.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div className="mt-6">
        <button
          type="submit"
          disabled={loading}
          className={`w-full py-2 px-4 rounded-md text-white font-medium text-base
            ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-orange-500 hover:bg-orange-600'}
            transition-colors`}
        >
          {loading ? 'Creando...' : 'Crear Sala'}
        </button>
      </div>
    </form>
  );
};

export default CreateRoomForm;