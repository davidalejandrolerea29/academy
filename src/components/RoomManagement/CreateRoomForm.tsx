import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase'; // Asegúrate de tener esto configurado
import { useAuth } from '../../contexts/AuthContext';
import { User } from '../../types';
import { Calendar, Clock, Users, Info } from 'lucide-react';

const CreateRoomForm: React.FC<{ onRoomCreated: () => void }> = ({ onRoomCreated }) => {
  const { currentUser } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [allStudents, setAllStudents] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchStudents = async () => {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('role', 'alumno');

      if (error) {
        console.error('Error fetching students:', error.message);
        setError('Error al cargar los estudiantes');
      } else {
        setAllStudents(data as User[]);
      }
    };

    fetchStudents();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'teacher')) {
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

      const response = await fetch('http://127.0.0.1:8000/api/v1/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Si usás auth con token, agregalo acá:
          // 'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          description,
          teacher_id: currentUser.id,
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          is_active: true,
          is_recording: false,
          participants: selectedStudents,
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
      setSelectedStudents([]);

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

  const handleStudentToggle = (studentId: string) => {
    setSelectedStudents((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId]
    );
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-6">Crear Nueva Sala</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md flex items-start">
          <Info className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-md">
          Sala creada exitosamente
        </div>
      )}

      <div className="space-y-4">
        {/* Nombre y descripción */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Nombre de la Sala *
          </label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
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
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            rows={3}
            required
          />
        </div>

        {/* Fecha y horario */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                className="w-full pl-10 px-3 py-2 border border-gray-300 rounded-md"
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
                className="w-full pl-10 px-3 py-2 border border-gray-300 rounded-md"
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
                className="w-full pl-10 px-3 py-2 border border-gray-300 rounded-md"
                required
              />
            </div>
          </div>
        </div>

        {/* Selección de alumnos */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <div className="flex items-center">
              <Users className="w-5 h-5 mr-1 text-gray-500" />
              Seleccionar Alumnos
            </div>
          </label>
          <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-md p-2">
            {allStudents.length === 0 ? (
              <p className="text-gray-500 text-sm p-2">No hay alumnos disponibles</p>
            ) : (
              allStudents.map((student) => (
                <div key={student.id} className="flex items-center p-2 hover:bg-gray-50">
                  <input
                    type="checkbox"
                    id={`student-${student.id}`}
                    checked={selectedStudents.includes(student.id)}
                    onChange={() => handleStudentToggle(student.id)}
                    className="h-4 w-4 text-blue-600"
                  />
                  <label
                    htmlFor={`student-${student.id}`}
                    className="ml-2 block text-sm text-gray-700 cursor-pointer"
                  >
                    {student.display_name} ({student.email})
                  </label>
                </div>
              ))
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Seleccionados: {selectedStudents.length} alumnos
          </p>
        </div>
      </div>

      <div className="mt-6">
        <button
          type="submit"
          disabled={loading}
          className={`w-full py-2 px-4 rounded-md text-white font-medium 
            ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'}
            transition-colors`}
        >
          {loading ? 'Creando...' : 'Crear Sala'}
        </button>
      </div>
    </form>
  );
};

export default CreateRoomForm;
