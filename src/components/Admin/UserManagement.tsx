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
import { User, UserRole } from '../../types';

const API_URL = import.meta.env.VITE_API_URL;

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string | 'all'>('all');

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editRole, setEditRole] = useState<UserRole>('alumno');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    name: '',
    role_description: 'alumno' as UserRole,
    role_id: 3
  });
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/users`);
      console.log('Response:', response);
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
    fetchUsers();
  }, []);

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body:JSON.stringify({
  ...newUser,
  role_id: getRoleIdFromDescription(newUser.role_description),
}),
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
      setNewUser({ email: '', password: '', name: '', role_description: 'alumno' });
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
      const response = await fetch(`${API_URL}/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) throw new Error('Error actualizando el rol');

      setUsers((prevUsers) =>
        prevUsers.map((user) =>
          user.id === userId ? { ...user, role_description: newRole } : user
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
      const response = await fetch(`${API_URL}/users/${userId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Error al eliminar el usuario');

      setUsers((prevUsers) => prevUsers.filter((user) => user.id !== userId));
    } catch (error) {
      console.error('Error deleting user:', error);
    }
  };

const getRoleLabel = (role: string) => {
  switch (role) {
    case 'Teacher':
      return 'Profesor';
    case 'Alumno':
      return 'Alumno';
    case 'Admin':
      return 'Administrador';
    default:
      return role;
  }
};
const getRoleIdFromDescription = (role: UserRole): number => {
  switch (role) {
    case 'Admin':
      return 1;
    case 'teacher':
      return 2;
    case 'alumno':
      return 3;
    default:
      return 3;
  }
};



  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole =
      roleFilter === 'all' || user.role_description === roleFilter || roleFilter === 'all'


    return matchesSearch && matchesRole;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" />
      </div>
    );
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
  onChange={(e) => setNewUser({ ...newUser, role_id: parseInt(e.target.value) })}
>
  <option value={3}>Alumno</option>
  <option value={2}>Profesor</option>
  <option value={1}>Administrador</option>
</select>

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
  onChange={(e) => setRoleFilter(e.target.value as UserRole | 'all')}
  className="border px-3 py-2 rounded"
>
  <option value="all">Todos los roles</option>
  <option value="Alumno">Alumno</option>
  <option value="Teacher">Profesor</option>
  <option value="Admin">Administrador</option>
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
                      <option value="alumno">Alumno</option>
                      <option value="teacher">Profesor</option>
                      <option value="admin">Administrador</option>
                    </select>
                  ) : (
                    getRoleLabel(user.role_description)
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
                          setEditRole(user.role_description);
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
