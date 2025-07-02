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
  X, // Asegúrate de que la 'X' para cerrar el modal esté importada
} from 'lucide-react';
import { User, UserRole, UserFormData, Option } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

const API_URL = import.meta.env.VITE_API_URL;

const UserRoleEnum = {
  Admin: 1,
  Teacher: 2,
  Student: 3,
};

// --- Componente de Modal Genérico (puedes sacarlo a su propio archivo si quieres, e.g., components/ModalWrapper.tsx) ---
interface ModalWrapperProps {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
}

const ModalWrapper: React.FC<ModalWrapperProps> = ({ children, onClose, title }) => {
  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl transform transition-all sm:my-8 sm:w-full">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-xl font-semibold text-gray-900">{title}</h3>
          <button
            type="button"
            className="text-gray-400 hover:text-gray-600 focus:outline-none"
            onClick={onClose}
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6">
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
  currentUserId: number | null; // Necesario para 'assigned_by' en creación
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
  const [password, setPassword] = useState(''); // Estado separado para la contraseña

  useEffect(() => {
    // Cuando initialUserData cambie (e.g., al abrir el modal de edición para un nuevo usuario),
    // actualiza el estado local del formulario.
    setFormData(initialUserData);
    setPassword(''); // Siempre resetear la contraseña al abrir/cambiar usuario
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

    if (!isEditMode) { // Para la creación, añade assigned_by
      if (currentUserId === null) {
        // Esto debería ser manejado antes de abrir el modal, pero como fallback
        console.error("currentUserId es null, no se puede crear usuario.");
        return;
      }
      (dataToSave as any).assigned_by = currentUserId; // Casting temporal, considera ajustar tu tipo UserFormData para esto
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
          className="mt-1 block w-full border px-3 py-2 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
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
          className="mt-1 block w-full border px-3 py-2 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
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
          className="mt-1 block w-full border px-3 py-2 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
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
          className="mt-1 block w-full border px-3 py-2 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
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
              <GraduationCap className="w-5 h-5 mr-1 text-gray-500" />
              Seleccionar Alumnos a Asignar
            </div>
          </label>
          <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-md p-2 bg-gray-50">
            {fetchingAssignments ? (
              <p className="text-gray-500 text-sm p-2">Cargando alumnos...</p>
            ) : availableStudents.length === 0 ? (
              <p className="text-gray-500 text-sm p-2">No hay alumnos disponibles para asignar.</p>
            ) : (
              availableStudents.map((student) => (
                <div key={student.id} className="flex items-center p-2 hover:bg-gray-100 cursor-pointer">
                  <input
                    type="checkbox"
                    id={`assign-student-${student.id}`}
                    checked={formData.assigned_student_ids?.includes(student.id) || false}
                    onChange={() => handleAssignmentToggle(student.id, 'student')}
                    className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <label
                    htmlFor={`assign-student-${student.id}`}
                    className="ml-2 block text-sm text-gray-700 cursor-pointer"
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
              <Briefcase className="w-5 h-5 mr-1 text-gray-500" />
              Seleccionar Profesores a Asignar
            </div>
          </label>
          <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-md p-2 bg-gray-50">
            {fetchingAssignments ? (
              <p className="text-gray-500 text-sm p-2">Cargando profesores...</p>
            ) : availableTeachers.length === 0 ? (
              <p className="text-gray-500 text-sm p-2">No hay profesores disponibles para asignar.</p>
            ) : (
              availableTeachers.map((teacher) => (
                <div key={teacher.id} className="flex items-center p-2 hover:bg-gray-100 cursor-pointer">
                  <input
                    type="checkbox"
                    id={`assign-teacher-${teacher.id}`}
                    checked={formData.assigned_teacher_ids?.includes(teacher.id) || false}
                    onChange={() => handleAssignmentToggle(teacher.id, 'teacher')}
                    className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <label
                    htmlFor={`assign-teacher-${teacher.id}`}
                    className="ml-2 block text-sm text-gray-700 cursor-pointer"
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
          className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
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

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string | 'all'>('all');

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showCreateFormModal, setShowCreateFormModal] = useState(false); // Cambiado para modal

  const [createError, setCreateError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const token = localStorage.getItem('token');

  const currentUserId = currentUser ? currentUser.id : null;

  const [availableStudents, setAvailableStudents] = useState<Option[]>([]);
  const [availableTeachers, setAvailableTeachers] = useState<Option[]>([]);
  const [fetchingAssignments, setFetchingAssignments] = useState(false);

  const fetchAvailableStudents = async () => {
    setFetchingAssignments(true);
    try {
      const response = await fetch(`${API_URL}/auth/students`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Error al obtener la lista de estudiantes');
      const result = await response.json();
      setAvailableStudents(result.data.map((student: any) => ({
        id: student.id,
        name: student.name,
      })));
    } catch (error) {
      console.error('Error fetching students:', error);
    } finally {
      setFetchingAssignments(false);
    }
  };

  const fetchAvailableTeachers = async () => {
    setFetchingAssignments(true);
    try {
      const response = await fetch(`${API_URL}/auth/admin/teachers`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Error al obtener la lista de profesores');
      const result = await response.json();
      setAvailableTeachers(result.data.map((teacher: any) => ({
        id: teacher.id,
        name: teacher.name,
      })));
    } catch (error) {
      console.error('Error fetching teachers:', error);
    } finally {
      setFetchingAssignments(false);
    }
  };


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
  }, [token]); // token como dependencia

  useEffect(() => {
    if (currentUser && !authLoading) {
      fetchUsers();
      fetchAvailableStudents();
      fetchAvailableTeachers();
    }
  }, [currentUser, authLoading, fetchUsers]); // Añade fetchUsers a las dependencias del useEffect

  // Manejador para iniciar edición (abre el modal)
  const handleEditClick = (user: User) => {
    setEditingUser(user);
    setEditError(null); // Limpiar errores previos
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
      setEditingUser(null); // Cerrar el modal
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
      setShowCreateFormModal(false); // Cerrar el modal
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

      setUsers((prevUsers) => prevUsers.filter((user) => user.id !== userId));
    } catch (error) {
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
    <div className="container mx-auto py-6 px-4">
      {/* Encabezado */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center">
          <Users className="w-8 h-8 text-blue-500 mr-3" />
          <h1 className="text-2xl font-bold text-gray-800">Gestión de Usuarios</h1>
        </div>
        <button
          onClick={() => setShowCreateFormModal(true)}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded flex items-center"
        >
          <UserPlus className="w-5 h-5 mr-2" />
          Crear Usuario
        </button>
      </div>

      {/* Filtros */}
      <div className="flex mb-4 space-x-4">
        <div className="relative w-1/2">
          <input
            className="w-full border px-10 py-2 rounded"
            placeholder="Buscar por nombre o email"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute right-3 top-2.5">
              <FilterX />
            </button>
          )}
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="border rounded px-2 py-1"
        >
          <option value="all">Todos</option>
          <option value="Admin">Administrador</option>
          <option value="Teacher">Profesor</option>
          <option value="Student">Alumno</option>
        </select>
      </div>

      {/* Tabla */}
      <table className="min-w-full bg-white rounded shadow">
        <thead className="bg-gray-100">
          <tr>
            <th className="text-left py-3 px-4">Usuario</th>
            <th className="text-left py-3 px-4">Email</th>
            <th className="text-left py-3 px-4">Rol</th>
            <th className="text-center py-3 px-4">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {filteredUsers.length === 0 ? (
            <tr>
              <td colSpan={4} className="text-center py-6 text-gray-500">
                No se encontraron usuarios
              </td>
            </tr>
          ) : (
            filteredUsers.map((user) => (
              <tr key={user.id} className="border-t hover:bg-gray-50">
                <td className="py-3 px-4">
                    <div className="flex items-center space-x-2">
                      <UserCircle className="w-6 h-6 text-gray-400" />
                      <span>{user.name}</span>
                    </div>
                </td>
                <td className="py-3 px-4">
                    <span>{user.email}</span>
                </td>
                <td className="py-3 px-4">
                    <span>{user.role ? getRoleLabel(user.role.description) : 'Sin rol'}</span>
                </td>
                <td className="py-3 px-4 text-center">
                    <div className="flex space-x-2 justify-center">
                      <button
                        onClick={() => handleEditClick(user)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <Edit />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 />
                      </button>
                    </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

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
              password: '', // Esto se maneja internamente en UserFormModal
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
              password: '', // La contraseña se gestiona aparte
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