import React, { useState, useEffect } from 'react';
import {
  Users,
  UserCircle,
  Edit,
  Trash2,
  Search,
  FilterX,
  UserPlus,
  Check,
  X,
} from 'lucide-react';
import { User, UserRole, Role } from '../../types';
import { useAuth } from '../../contexts/AuthContext'; // Importa useAuth

const API_URL = import.meta.env.VITE_API_URL;

interface StudentOption {
  id: number;
  name: string;
}

const UserManagement: React.FC = () => {
  // --- ¡AQUÍ ESTÁ LA CLAVE! Desestructuramos currentUser y loading del objeto que useAuth devuelve.
  const { currentUser, loading: authLoading } = useAuth();
  // ---

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true); // Este es tu loading para fetching de usuarios/estudiantes
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string | 'all'>('all');

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editRole, setEditRole] = useState<UserRole>('Teacher');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    name: '',
    role: 'Student' as UserRole,
    role_id: 3,
    assigned_student_ids: [] as number[],
  });

  const [createError, setCreateError] = useState<string | null>(null);
  const token = localStorage.getItem('token');
  
  // Ahora currentUserId se obtiene correctamente del objeto currentUser desestructurado
  const currentUserId = currentUser ? currentUser.id : null;
  
  // Para depuración, puedes ver el ID en la consola
  console.log('Current User ID:', currentUserId);

  const [availableStudents, setAvailableStudents] = useState<StudentOption[]>([]);
  const [fetchingStudents, setFetchingStudents] = useState(false);

  const fetchStudents = async () => {
    setFetchingStudents(true);
    try {
      const response = await fetch(`${API_URL}/auth/students`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Error al obtener la lista de estudiantes');
      }

      const result = await response.json();
      setAvailableStudents(result.data.map((student: any) => ({
        id: student.id,
        name: student.name,
      })));
    } catch (error) {
      console.error('Error fetching students:', error);
    } finally {
      setFetchingStudents(false);
    }
  };


  const fetchUsers = async () => {
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
  };

  useEffect(() => {
    if (currentUser && !authLoading) {
      fetchUsers();
      fetchStudents();
    }
  }, [currentUser, authLoading]);

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setLoading(true);

    if (currentUserId === null) {
        setCreateError("No se pudo obtener el ID del usuario actual para asignar. Intente recargar la página o iniciar sesión nuevamente.");
        setLoading(false);
        return;
    }

    const userData: any = {
      email: newUser.email,
      password: newUser.password,
      name: newUser.name,
      role_id: newUser.role_id,
      assigned_by: currentUserId, // Usar el ID del usuario actual del hook
    };

    if (newUser.role_id === UserRoleEnum.Teacher && newUser.assigned_student_ids.length > 0) {
      userData.assigned_student_ids = newUser.assigned_student_ids;
    }

    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.message?.includes('already registered')) {
          setCreateError('El correo electrónico ya está en uso');
        } else {
          setCreateError('Error al crear el usuario');
        }
        return;
      }

      await fetchUsers();
      setNewUser({
        email: '',
        password: '',
        name: '',
        role: 'Student',
        role_id: 3,
        assigned_student_ids: [],
      });
      setShowCreateForm(false);
    } catch (error) {
      console.error('Error creating user:', error);
      setCreateError('Error al crear el usuario');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: number, newRole: UserRole) => {
    try {
      const response = await fetch(`${API_URL}/auth/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ role_id: getRoleIdFromDescription(newRole) }),
      });

      if (!response.ok) throw new Error('Error actualizando el rol');

      setUsers((prevUsers) =>
        prevUsers.map((user) =>
          user.id === userId
            ? {
              ...user,
              role: {
                ...user.role,
                description: newRole,
              },
            }
            : user
        )
      );

      setEditingUser(null);
    } catch (error) {
      console.error('Error updating user role:', error);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este usuario?')) return;

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
    }
  };

  function getRoleLabel(role: string) {
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
  }

  const getRoleIdFromDescription = (role: UserRole): number => {
    switch (role) {
      case 'Admin':
        return 1;
      case 'Teacher':
        return 2;
      case 'Student':
        return 3;
      default:
        return 3;
    }
  };

  const handleNewUserRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRoleId = parseInt(e.target.value);
    const newRoleDesc = Object.keys(UserRoleEnum).find(key => UserRoleEnum[key as keyof typeof UserRoleEnum] === newRoleId) as UserRole;

    setNewUser(prev => ({
      ...prev,
      role_id: newRoleId,
      role: newRoleDesc || 'Student',
      assigned_student_ids: newRoleId === UserRoleEnum.Teacher ? prev.assigned_student_ids : [],
    }));
  };

  const handleStudentToggle = (studentId: number) => {
    setNewUser(prev => {
      const currentSelections = prev.assigned_student_ids;
      if (currentSelections.includes(studentId)) {
        return {
          ...prev,
          assigned_student_ids: currentSelections.filter(id => id !== studentId),
        };
      } else {
        return {
          ...prev,
          assigned_student_ids: [...currentSelections, studentId],
        };
      }
    });
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole =
      roleFilter === 'all' || user.role.description === roleFilter;

    return matchesSearch && matchesRole;
  });

  const UserRoleEnum = {
    Admin: 1,
    Teacher: 2,
    Student: 3,
  };


  if (loading || fetchingStudents || authLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!currentUser) {
      return <p className="text-red-500 text-center p-8">Error: No hay usuario autenticado. Por favor, inicie sesión.</p>;
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
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded flex items-center"
        >
          <UserPlus className="w-5 h-5 mr-2" />
          Crear Usuario
        </button>
      </div>

      {/* Formulario de creación */}
      {showCreateForm && (
        <div className="bg-white rounded shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Crear Nuevo Usuario</h2>
          <form onSubmit={createUser} className="space-y-4">
            <input
              className="w-full border px-3 py-2 rounded"
              placeholder="Nombre completo"
              value={newUser.name}
              onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
              required
            />
            <input
              className="w-full border px-3 py-2 rounded"
              type="email"
              placeholder="Correo electrónico"
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              required
            />
            <input
              className="w-full border px-3 py-2 rounded"
              type="password"
              placeholder="Contraseña"
              value={newUser.password}
              onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
              required
              minLength={6}
            />
            <select
              className="w-full border px-3 py-2 rounded"
              value={newUser.role_id}
              onChange={handleNewUserRoleChange}
            >
              <option value={UserRoleEnum.Student}>Alumno</option>
              <option value={UserRoleEnum.Teacher}>Profesor</option>
              <option value={UserRoleEnum.Admin}>Administrador</option>
            </select>

            {/* --- Nuevo diseño para la selección de alumnos --- */}
            {newUser.role_id === UserRoleEnum.Teacher && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <div className="flex items-center">
                    <Users className="w-5 h-5 mr-1 text-gray-500" />
                    Seleccionar Alumnos
                  </div>
                </label>
                <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-md p-2">
                  {fetchingStudents ? (
                    <p className="text-gray-500 text-sm p-2">Cargando alumnos...</p>
                  ) : availableStudents.length === 0 ? (
                    <p className="text-gray-500 text-sm p-2">No hay alumnos disponibles</p>
                  ) : (
                    availableStudents.map((student) => (
                      <div key={student.id} className="flex items-center p-2 hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          id={`student-${student.id}`}
                          checked={newUser.assigned_student_ids.includes(student.id)}
                          onChange={() => handleStudentToggle(student.id)}
                          className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <label
                          htmlFor={`student-${student.id}`}
                          className="ml-2 block text-sm text-gray-700 cursor-pointer"
                        >
                          {student.name || `Alumno ID: ${student.id}`}
                        </label>
                      </div>
                    ))
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Seleccionados: {newUser.assigned_student_ids.length} alumnos
                </p>
              </div>
            )}
            {/* --- Fin del nuevo diseño --- */}

            {createError && <p className="text-red-500">{createError}</p>}
            <button
              type="submit"
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
            >
              Crear
            </button>
          </form>
        </div>
      )}

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
                <td className="py-3 px-4 flex items-center space-x-2">
                  <UserCircle className="w-6 h-6 text-gray-400" />
                  <span>{user.name}</span>
                </td>
                <td className="py-3 px-4">{user.email}</td>
                <td className="py-3 px-4">
                  {editingUser?.id === user.id ? (
                    <select
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value as UserRole)}
                      className="border rounded px-2 py-1"
                    >
                      <option value="Student">Alumno</option>
                      <option value="Teacher">Profesor</option>
                      <option value="Admin">Administrador</option>
                    </select>
                  ) : (
                    <span>{user.role ? getRoleLabel(user.role.description) : 'Sin rol'}</span>
                  )}
                </td>
                <td className="py-3 px-4 text-center space-x-2">
                  {editingUser?.id === user.id ? (
                    <>
                      <button
                        onClick={() => handleRoleChange(user.id, editRole)}
                        className="text-green-600 hover:text-green-800"
                      >
                        <Check />
                      </button>
                      <button
                        onClick={() => setEditingUser(null)}
                        className="text-gray-600 hover:text-gray-800"
                      >
                        <X />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setEditingUser(user);
                          setEditRole(user.role.description as UserRole);
                        }}
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
                    </>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default UserManagement;