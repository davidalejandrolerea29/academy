import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  UserCircle,
  Edit,
  Trash2,
  Search,
  FilterX,
  UserPlus,
  Lock,
  Mail,
  User as UserIcon,
  GraduationCap,
  Briefcase,
  X,
} from 'lucide-react';
import { User, UserRole, UserFormData, Option } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

const API_URL = import.meta.env.VITE_API_URL;

const UserRoleEnum = {
  Admin: 1,
  Teacher: 2,
  Student: 3,
};

// --- Componente de Modal Genérico ---
interface ModalWrapperProps {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
}

const ModalWrapper: React.FC<ModalWrapperProps> = ({ children, onClose, title }) => {
  return (
    // Ajustado para que el modal ocupe más espacio en móviles y tenga un padding responsive
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm sm:max-w-2xl transform transition-all my-auto mx-2 sm:mx-auto"> {/* Ajustado max-w y mx */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-200 flex justify-between items-center"> {/* Padding responsive */}
          <h3 className="text-lg sm:text-xl font-semibold text-gray-900">{title}</h3> {/* Tamaño de texto responsive */}
          <button
            type="button"
            className="text-gray-400 hover:text-gray-600 focus:outline-none"
            onClick={onClose}
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" /> {/* Tamaño de ícono responsive */}
          </button>
        </div>
        <div className="p-4 sm:p-6"> {/* Padding responsive */}
          {children}
        </div>
      </div>
    </div>
  );
};

// --- Componente de Formulario de Usuario (para Crear y Editar) ---
interface UserFormModalProps {
  initialUserData: UserFormData & { assigned_student_ids?: number[], assigned_teacher_ids?: number[] };
  isEditMode: boolean;
  onSave: (data: UserFormData) => void;
  onCancel: () => void;
  availableStudents: Option[];
  availableTeachers: Option[];
  fetchingAssignments: boolean;
  error: string | null;
  currentUserId: number | null;
}

const UserFormModal: React.FC<UserFormModalProps> = ({
  initialUserData,
  isEditMode,
  onSave,
  onCancel,
  availableStudents,
  availableTeachers,
  fetchingAssignments,
  error,
  currentUserId,
}) => {
  const [formData, setFormData] = useState(initialUserData);
  const [password, setPassword] = useState('');

  useEffect(() => {
    setFormData(initialUserData);
    setPassword('');
  }, [initialUserData]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRoleId = parseInt(e.target.value);
    const newRoleDesc = Object.keys(UserRoleEnum).find(key => UserRoleEnum[key as keyof typeof UserRoleEnum] === newRoleId) as UserRole;

    setFormData(prev => ({
      ...prev,
      role_id: newRoleId,
      role: newRoleDesc || 'Student',
      assigned_student_ids: newRoleId === UserRoleEnum.Teacher ? (prev.assigned_student_ids || []) : [],
      assigned_teacher_ids: newRoleId === UserRoleEnum.Student ? (prev.assigned_teacher_ids || []) : [],
    }));
  };

  const handleAssignmentToggle = (id: number, type: 'student' | 'teacher') => {
    if (type === 'student') {
      setFormData(prev => {
        const currentSelections = prev.assigned_student_ids || [];
        if (currentSelections.includes(id)) {
          return { ...prev, assigned_student_ids: currentSelections.filter(sId => sId !== id) };
        } else {
          return { ...prev, assigned_student_ids: [...currentSelections, id] };
        }
      });
    } else { // type === 'teacher'
      setFormData(prev => {
        const currentSelections = prev.assigned_teacher_ids || [];
        if (currentSelections.includes(id)) {
          return { ...prev, assigned_teacher_ids: currentSelections.filter(tId => tId !== id) };
        } else {
          return { ...prev, assigned_teacher_ids: [...currentSelections, id] };
        }
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const dataToSave: UserFormData = { ...formData };

    if (password) {
      dataToSave.password = password;
    }

    if (!isEditMode) {
      if (currentUserId === null) {
        console.error("currentUserId es null, no se puede crear usuario.");
        return;
      }
      (dataToSave as any).assigned_by = currentUserId;
    }

    onSave(dataToSave);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Nombre</label>
        <input
          type="text"
          name="name"
          className="mt-1 block w-full border px-3 py-2 rounded-md shadow-sm focus:ring-orange-500 focus:border-orange-500 text-sm sm:text-base" // Responsive text size
          value={formData.name}
          onChange={handleInputChange}
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Correo Electrónico</label>
        <input
          type="email"
          name="email"
          className="mt-1 block w-full border px-3 py-2 rounded-md shadow-sm focus:ring-orange-500 focus:border-orange-500 text-sm sm:text-base" // Responsive text size
          value={formData.email}
          onChange={handleInputChange}
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Contraseña {isEditMode ? '(dejar vacío para no cambiar)' : ''}
        </label>
        <input
          type="password"
          name="password"
          className="mt-1 block w-full border px-3 py-2 rounded-md shadow-sm focus:ring-orange-500 focus:border-orange-500 text-sm sm:text-base" // Responsive text size
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required={!isEditMode}
          minLength={6}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Rol</label>
        <select
          name="role_id"
          className="mt-1 block w-full border px-3 py-2 rounded-md shadow-sm focus:ring-orange-500 focus:border-orange-500 text-sm sm:text-base" // Responsive text size
          value={formData.role_id}
          onChange={handleRoleChange}
        >
          <option value={UserRoleEnum.Student}>Alumno</option>
          <option value={UserRoleEnum.Teacher}>Profesor</option>
          <option value={UserRoleEnum.Admin}>Administrador</option>
        </select>
      </div>

      {formData.role_id === UserRoleEnum.Teacher && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <div className="flex items-center">
              <GraduationCap className="w-4 h-4 sm:w-5 sm:h-5 mr-1 text-gray-500" />
              Seleccionar Alumnos a Asignar
            </div>
          </label>
          <div className="max-h-32 sm:max-h-40 overflow-y-auto border border-gray-300 rounded-md p-2 bg-gray-50"> 
            {fetchingAssignments ? (
              <p className="text-gray-500 text-xs sm:text-sm p-2">Cargando alumnos...</p> 
            ) : availableStudents.length === 0 ? (
              <p className="text-gray-500 text-xs sm:text-sm p-2">No hay alumnos disponibles para asignar.</p> 
            ) : (
              availableStudents.map((student) => (
                <div key={student.id} className="flex items-center p-1 sm:p-2 hover:bg-gray-100 cursor-pointer"> 
                  <input
                    type="checkbox"
                    id={`assign-student-${student.id}`}
                    checked={formData.assigned_student_ids?.includes(student.id) || false}
                    onChange={() => handleAssignmentToggle(student.id, 'student')}
                    className="h-3 w-3 sm:h-4 sm:w-4 text-orange-600 rounded focus:ring-orange-500" // Responsive checkbox size
                  />
                  <label
                    htmlFor={`assign-student-${student.id}`}
                    className="ml-2 block text-xs sm:text-sm text-gray-700 cursor-pointer" // Responsive text size
                  >
                    {student.name || `Alumno ID: ${student.id}`}
                  </label>
                </div>
              ))
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Alumnos seleccionados: {(formData.assigned_student_ids || []).length}
          </p>
        </div>
      )}

      {formData.role_id === UserRoleEnum.Student && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <div className="flex items-center">
              <Briefcase className="w-4 h-4 sm:w-5 sm:h-5 mr-1 text-gray-500" /> 
              Seleccionar Profesores a Asignar
            </div>
          </label>
          <div className="max-h-32 sm:max-h-40 overflow-y-auto border border-gray-300 rounded-md p-2 bg-gray-50"> 
            {fetchingAssignments ? (
              <p className="text-gray-500 text-xs sm:text-sm p-2">Cargando profesores...</p> 
            ) : availableTeachers.length === 0 ? (
              <p className="text-gray-500 text-xs sm:text-sm p-2">No hay profesores disponibles para asignar.</p> 
            ) : (
              availableTeachers.map((teacher) => (
                <div key={teacher.id} className="flex items-center p-1 sm:p-2 hover:bg-gray-100 cursor-pointer"> 
                  <input
                    type="checkbox"
                    id={`assign-teacher-${teacher.id}`}
                    checked={formData.assigned_teacher_ids?.includes(teacher.id) || false}
                    onChange={() => handleAssignmentToggle(teacher.id, 'teacher')}
                    className="h-3 w-3 sm:h-4 sm:w-4 text-orange-600 rounded focus:ring-orange-500" // Responsive checkbox size
                  />
                  <label
                    htmlFor={`assign-teacher-${teacher.id}`}
                    className="ml-2 block text-xs sm:text-sm text-gray-700 cursor-pointer" // Responsive text size
                  >
                    {teacher.name || `Profesor ID: ${teacher.id}`}
                  </label>
                </div>
              ))
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Profesores seleccionados: {(formData.assigned_teacher_ids || []).length}
          </p>
        </div>
      )}

      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}

      <div className="flex justify-end space-x-2 mt-6">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100 text-sm sm:text-base" // Responsive padding and text size
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-md bg-orange-600 text-white hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 text-sm sm:text-base" // Responsive padding and text size
        >
          {isEditMode ? 'Guardar Cambios' : 'Crear Usuario'}
        </button>
      </div>
    </form>
  );
};


// --- Componente Principal UserManagement ---
const UserManagement: React.FC = () => {
  const { currentUser, loading: authLoading } = useAuth();
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string } | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string | 'all'>('all');

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showCreateFormModal, setShowCreateFormModal] = useState(false);

  const [createError, setCreateError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const token = localStorage.getItem('token');

  const currentUserId = currentUser ? currentUser.id : null;

  const [availableStudents, setAvailableStudents] = useState<Option[]>([]);
  const [availableTeachers, setAvailableTeachers] = useState<Option[]>([]);
  const [fetchingAssignments, setFetchingAssignments] = useState(false);

  const fetchAvailableStudents = useCallback(async () => {
    setFetchingAssignments(true);
    try {
      const response = await fetch(`${API_URL}/auth/admin/available-students-for-assignment`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(errorBody.error || 'Error al obtener la lista de estudiantes disponibles');
      }
      const result = await response.json();
      setAvailableStudents(result.students?.map((student: any) => ({
        id: student.id,
        name: student.name,
      })) || []);
    } catch (error) {
      console.error('Error fetching available students:', error);
    } finally {
      setFetchingAssignments(false);
    }
  }, [token]);

  const fetchAvailableTeachers = useCallback(async () => {
    setFetchingAssignments(true);
    try {
      const response = await fetch(`${API_URL}/auth/admin/teachers`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(errorBody.error || 'Error al obtener la lista de profesores');
      }
      const result = await response.json();
      setAvailableTeachers(result.teachers?.map((teacher: any) => ({
        id: teacher.id,
        name: teacher.name,
      })) || []);
    } catch (error) {
      console.error('Error fetching teachers:', error);
    } finally {
      setFetchingAssignments(false);
    }
  }, [token]);


  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/users`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Error al obtener los usuarios');
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (currentUser && !authLoading) {
      fetchUsers();
      fetchAvailableStudents();
      fetchAvailableTeachers();
    }
  }, [currentUser, authLoading, fetchUsers, fetchAvailableStudents, fetchAvailableTeachers]);


  const handleEditClick = (user: User) => {
    setEditingUser(user);
    setEditError(null);
  };

  const handleSaveEdit = async (updatedData: UserFormData) => {
    if (!editingUser) return;

    setEditError(null);
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/users/${editingUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updatedData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setEditError(errorData.message || errorData.error || 'Error al actualizar el usuario');
        throw new Error(errorData.message || 'Error al actualizar el usuario');
      }

      await fetchUsers();
      await fetchAvailableStudents();
      await fetchAvailableTeachers();

      setEditingUser(null);
    } catch (error) {
      console.error('Error saving user edit:', error);
      if (!editError) {
        setEditError('Error al guardar los cambios del usuario.');
      }
    } finally {
      setLoading(false);
    }
  };

 const handleCreateUser = async (newUserData: UserFormData) => {
  setCreateError(null);
  setLoading(true);

  if (currentUserId === null) {
    setCreateError("No se pudo obtener el ID del usuario actual para asignar. Intente recargar la página o iniciar sesión nuevamente.");
    setLoading(false);
    return;
  }

  const userDataToSend = {
    ...newUserData,
    assigned_by: currentUserId,
  };

  try {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(userDataToSend),
    });

    if (!response.ok) {
      const errorData = await response.json();
      const errorMessage = errorData.error && typeof errorData.error === 'object' ?
        Object.values(errorData.error).flat().join(', ') :
        errorData.message || 'Error al crear el usuario';
      setCreateError(errorMessage);
      return;
    }

    await fetchUsers();
    await fetchAvailableStudents();
    await fetchAvailableTeachers();

    setShowCreateFormModal(false);

    // Mostrar modal con las credenciales
    setCreatedCredentials({
      email: newUserData.email,
      password: newUserData.password || '',
    });
    setShowCredentialsModal(true);

  } catch (error) {
    console.error('Error creating user:', error);
    setCreateError('Error al crear el usuario');
  } finally {
    setLoading(false);
  }
};

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este usuario? Esta acción es irreversible.')) return;

    try {
      const response = await fetch(`${API_URL}/auth/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Error al eliminar el usuario');

      await fetchUsers();
      await fetchAvailableStudents();
      await fetchAvailableTeachers();

    }
    catch (error) {
      console.error('Error deleting user:', error);
      alert('Hubo un error al intentar eliminar el usuario. Es posible que tenga relaciones activas (ej. habitaciones, contactos).');
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'Admin':
        return 'Administrador';
      case 'Teacher':
        return 'Profesor';
      case 'Student':
        return 'Alumno';
      default:
        return role;
    }
  };

  const getRoleIdFromDescription = (role: UserRole): number => {
    switch (role) {
      case 'Admin':
        return UserRoleEnum.Admin;
      case 'Teacher':
        return UserRoleEnum.Teacher;
      case 'Student':
        return UserRoleEnum.Student;
      default:
        return UserRoleEnum.Student;
    }
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole =
      roleFilter === 'all' || user.role.description === roleFilter;

    return matchesSearch && matchesRole;
  });


  if (loading || fetchingAssignments || authLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!currentUser || currentUser.role?.description !== 'Admin') {
    return <p className="text-red-500 text-center p-8">Acceso denegado: Solo los administradores pueden gestionar usuarios.</p>;
  }


  return (
    <div className="container mx-auto py-4 px-2 sm:py-6 sm:px-4"> 
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6">
        <div className="flex items-center mb-3 sm:mb-0">
          <Users className="w-6 h-6 sm:w-8 sm:h-8 text-orange-500 mr-2 sm:mr-3" /> 
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Gestión de Usuarios</h1>
        </div>
        <button
          onClick={() => setShowCreateFormModal(true)}
          className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded flex items-center text-sm sm:text-base" // Responsive padding and text size
        >
          <UserPlus className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2" />
          Crear Usuario
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row mb-4 space-y-3 sm:space-y-0 sm:space-x-4"> 
        <div className="relative w-full sm:w-1/2"> 
          <input
            className="w-full border px-8 sm:px-10 py-2 rounded text-sm sm:text-base" // Responsive padding and text size
            placeholder="Buscar por nombre o email"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Search className="absolute left-3 top-2.5 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" /> 
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute right-3 top-2.5">
              <FilterX className="w-4 h-4 sm:w-5 sm:h-5" /> 
            </button>
          )}
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="border rounded px-2 py-1.5 text-sm sm:text-base w-full sm:w-auto" // Responsive width, padding, text size
        >
          <option value="all">Todos</option>
          <option value="Admin">Administrador</option>
          <option value="Teacher">Profesor</option>
          <option value="Student">Alumno</option>
        </select>
      </div>

      <div className="overflow-x-auto shadow rounded-lg"> 
        <table className="min-w-full bg-white">
          <thead className="bg-gray-100 hidden sm:table-header-group"> 
            <tr>
              <th className="text-left py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600 uppercase tracking-wider">Usuario</th>
              <th className="text-left py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600 uppercase tracking-wider">Email</th>
              <th className="text-left py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600 uppercase tracking-wider">Rol</th>
              <th className="text-center py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600 uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody className="block sm:table-row-group">
            {filteredUsers.length === 0 ? (
              <tr className="block sm:table-row">
                <td colSpan={4} className="text-center py-6 text-gray-500 block sm:table-cell">
                  No se encontraron usuarios
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr key={user.id} className="block border-t hover:bg-gray-50 mb-4 sm:mb-0 sm:table-row">
                  <td data-label="Usuario" className="block sm:table-cell py-2 px-3 sm:py-3 sm:px-4 text-sm sm:text-base border-b sm:border-0 relative before:content-[attr(data-label)] before:font-bold before:block before:mb-0.5 sm:before:hidden"> {/* Añadir data-label y estilo para móviles */}
                      <div className="flex items-center space-x-1 sm:space-x-2"> 
                        <UserCircle className="w-5 h-5 text-gray-400 sm:w-6 sm:h-6" /> 
                        <span>{user.name}</span>
                      </div>
                  </td>
                  <td data-label="Email" className="block sm:table-cell py-2 px-3 sm:py-3 sm:px-4 text-sm sm:text-base border-b sm:border-0 relative before:content-[attr(data-label)] before:font-bold before:block before:mb-0.5 sm:before:hidden">
                      <span>{user.email}</span>
                  </td>
                  <td data-label="Rol" className="block sm:table-cell py-2 px-3 sm:py-3 sm:px-4 text-sm sm:text-base border-b sm:border-0 relative before:content-[attr(data-label)] before:font-bold before:block before:mb-0.5 sm:before:hidden">
                      <span>{user.role ? getRoleLabel(user.role.description) : 'Sin rol'}</span>
                  </td>
                  <td data-label="Acciones" className="block sm:table-cell py-2 px-3 sm:py-3 sm:px-4 text-center text-sm sm:text-base relative before:content-[attr(data-label)] before:font-bold before:block before:mb-0.5 sm:before:hidden">
                      <div className="flex space-x-1 sm:space-x-2 justify-center"> 
                        <button
                          onClick={() => handleEditClick(user)}
                          className="text-orange-600 hover:text-blue-800 p-1" // Añadido padding para touch target
                        >
                          <Edit className="w-5 h-5" /> 
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className="text-red-600 hover:text-red-800 p-1" // Añadido padding para touch target
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {showCredentialsModal && createdCredentials && (
  <ModalWrapper
    title="Usuario Creado"
    onClose={() => {
      setShowCredentialsModal(false);
      setCreatedCredentials(null);
    }}
  >
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Correo Electrónico</label>
        <div className="flex items-center border rounded px-3 py-2">
          <input
            type="text"
            readOnly
            className="flex-1 outline-none text-gray-800"
            value={createdCredentials.email}
          />
          <button
            onClick={() => navigator.clipboard.writeText(createdCredentials.email)}
            className="ml-2 text-blue-600 hover:underline text-sm"
          >
            Copiar
          </button>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Contraseña</label>
        <div className="flex items-center border rounded px-3 py-2">
          <input
            type="text"
            readOnly
            className="flex-1 outline-none text-gray-800"
            value={createdCredentials.password}
          />
          <button
            onClick={() => navigator.clipboard.writeText(createdCredentials.password)}
            className="ml-2 text-blue-600 hover:underline text-sm"
          >
            Copiar
          </button>
        </div>
      </div>
      <div className="text-sm text-gray-500">
        Guarda estos datos para compartirlos con el nuevo usuario.
      </div>
    </div>
  </ModalWrapper>
)}
      {/* Modal de Creación de Usuario */}
      {showCreateFormModal && (
        <ModalWrapper
          title="Crear Nuevo Usuario"
          onClose={() => setShowCreateFormModal(false)}
        >
          <UserFormModal
            initialUserData={{
              name: '',
              email: '',
              password: '',
              role_id: UserRoleEnum.Student,
              role: 'Student',
              assigned_student_ids: [],
              assigned_teacher_ids: [],
            }}
            isEditMode={false}
            onSave={handleCreateUser}
            onCancel={() => setShowCreateFormModal(false)}
            availableStudents={availableStudents}
            availableTeachers={availableTeachers}
            fetchingAssignments={fetchingAssignments}
            error={createError}
            currentUserId={currentUserId}
          />
        </ModalWrapper>
      )}

      {/* Modal de Edición de Usuario */}
      {editingUser && (
        <ModalWrapper
          title={`Editar Usuario: ${editingUser.name}`}
          onClose={() => setEditingUser(null)}
        >
          <UserFormModal
            initialUserData={{
              name: editingUser.name,
              email: editingUser.email,
              password: '',
              role_id: getRoleIdFromDescription(editingUser.role.description),
              role: editingUser.role.description,
              assigned_student_ids: editingUser.assigned_student_ids || [],
              assigned_teacher_ids: editingUser.assigned_teacher_ids || [],
            }}
            isEditMode={true}
            onSave={handleSaveEdit}
            onCancel={() => setEditingUser(null)}
            availableStudents={availableStudents}
            availableTeachers={availableTeachers}
            fetchingAssignments={fetchingAssignments}
            error={editError}
            currentUserId={currentUserId}
          />
        </ModalWrapper>
      )}
    </div>
  );
};

export default UserManagement;