import React, { useState, useEffect } from 'react';

import {
  Users,
  UserCircle,
  Edit,
  Trash2,
  Search,
  FilterX,
  UserPlus,
} from 'lucide-react';

import { User, UserRole } from '../../types';
import { supabase } from '../../lib/supabase'; // 👈 Importa tu cliente Supabase desde tu módulo

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editRole, setEditRole] = useState<UserRole>('alumno');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    displayName: '',
    role: 'alumno' as UserRole,
  });
  const [createError, setCreateError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      if (error) {
        console.error('Error fetching current user:', error);
        setCurrentUser(null);
      } else if (user) {
        const { data, error: roleError } = await supabase
          .from<User>('users')
          .select('id, email, displayName, role')
          .eq('id', user.id)
          .single();

        if (roleError) {
          console.error('Error fetching user role:', roleError);
          setCurrentUser(null);
        } else {
          setCurrentUser(data);
        }
      }
    };
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    const fetchUsers = async () => {
      if (!currentUser || currentUser.role !== 'admin') {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from<User>('users')
          .select('id, email, displayName, role')
          .order('displayName', { ascending: true });

        if (error) {
          console.error('Error fetching users:', error);
        } else if (data) {
          setUsers(data);
        }
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [currentUser]);

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || currentUser.role !== 'admin') return;

    try {
      setCreateError(null);
      setLoading(true);

      const { data, error } = await supabase.auth.signUp({
        email: newUser.email,
        password: newUser.password,
      });

      if (error) throw error;
      if (!data.user) throw new Error('No user returned');

      const { error: insertError } = await supabase.from('users').insert({
        id: data.user.id,
        email: newUser.email,
        displayName: newUser.displayName,
        role: newUser.role,
        created_at: new Date().toISOString(),
      });

      if (insertError) throw insertError;

      setUsers((prev) => [
        ...prev,
        {
          id: data.user.id,
          email: newUser.email,
          displayName: newUser.displayName,
          role: newUser.role,
        },
      ]);

      setNewUser({ email: '', password: '', displayName: '', role: 'alumno' });
      setShowCreateForm(false);
    } catch (error: any) {
      console.error('Error creating user:', error);
      setCreateError(
        error.status === 400 && error.message.includes('already registered')
          ? 'El correo electrónico ya está en uso'
          : 'Error al crear el usuario'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    if (!currentUser || currentUser.role !== 'admin') return;

    try {
      const { error } = await supabase
        .from('users')
        .update({ role: newRole, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (error) throw error;

      setUsers((prevUsers) =>
        prevUsers.map((user) =>
          user.id === userId ? { ...user, role: newRole } : user
        )
      );
      setEditingUser(null);
    } catch (error) {
      console.error('Error updating user role:', error);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!currentUser || currentUser.role !== 'admin') return;
    if (!confirm('¿Estás seguro de que deseas eliminar este usuario?')) return;

    try {
      const { error } = await supabase.from('users').delete().eq('id', userId);
      if (error) throw error;

      setUsers((prevUsers) => prevUsers.filter((user) => user.id !== userId));
    } catch (error) {
      console.error('Error deleting user:', error);
    }
  };

  const startEditingUser = (user: User) => {
    setEditingUser(user);
    setEditRole(user.role);
  };

  const cancelEditing = () => {
    setEditingUser(null);
  };

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case 'teacher':
        return 'Profesor';
      case 'alumno':
        return 'Alumno';
      case 'admin':
        return 'Administrador';
      default:
        return role;
    }
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole = roleFilter === 'all' || user.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-full p-8">
        <div className="text-red-500 mb-4">
          {/* Icono Shield no definido, puedes agregarlo o reemplazar */}
          <Users className="h-16 w-16" />
        </div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Acceso Denegado</h1>
        <p className="text-gray-600">No tienes permisos para acceder a esta sección.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div className="flex items-center mb-4 md:mb-0">
          <Users className="w-8 h-8 text-blue-500 mr-3" />
          <h1 className="text-2xl font-bold text-gray-800">Gestión de Usuarios</h1>
        </div>

        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md flex items-center transition-colors"
        >
          <UserPlus className="w-5 h-5 mr-2" />
          Crear Usuario
        </button>
      </div>

      {showCreateForm && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">Crear Nuevo Usuario</h2>
          <form onSubmit={createUser} className="space-y-4">
            <div>
              <label className="block mb-1 font-medium">Nombre Completo</label>
              <input
                type="text"
                required
                value={newUser.displayName}
                onChange={(e) => setNewUser((prev) => ({ ...prev, displayName: e.target.value }))}
                className="w-full border rounded px-3 py-2"
                placeholder="Juan Pérez"
              />
            </div>
            <div>
              <label className="block mb-1 font-medium">Correo Electrónico</label>
              <input
                type="email"
                required
                value={newUser.email}
                onChange={(e) => setNewUser((prev) => ({ ...prev, email: e.target.value }))}
                className="w-full border rounded px-3 py-2"
                placeholder="correo@ejemplo.com"
              />
            </div>
            <div>
              <label className="block mb-1 font-medium">Contraseña</label>
              <input
                type="password"
                required
                minLength={6}
                value={newUser.password}
                onChange={(e) => setNewUser((prev) => ({ ...prev, password: e.target.value }))}
                className="w-full border rounded px-3 py-2"
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div>
              <label className="block mb-1 font-medium">Rol</label>
              <select
                value={newUser.role}
                onChange={(e) => setNewUser((prev) => ({ ...prev, role: e.target.value as UserRole }))}
                className="w-full border rounded px-3 py-2"
              >
                <option value="alumno">Alumno</option>
                <option value="teacher">Profesor</option>
                <option value="admin">Administrador</option>
              </select>
            </div>

            {createError && <p className="text-red-600">{createError}</p>}

            <button
              type="submit"
              disabled={loading}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md"
            >
              Crear Usuario
            </button>
          </form>
        </div>
      )}

      <div className="mb-4 flex flex-col md:flex-row md:items-center md:space-x-4">
        <div className="relative w-full md:w-1/3 mb-2 md:mb-0">
          <input
            type="text"
            placeholder="Buscar por nombre o email"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full border rounded pl-10 pr-3 py-2"
          />
          <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-700"
              aria-label="Limpiar búsqueda"
            >
              <FilterX />
            </button>
          )}
        </div>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as UserRole | 'all')}
          className="border rounded px-3 py-2 w-full md:w-48"
        >
          <option value="all">Todos los roles</option>
          <option value="alumno">Alumno</option>
          <option value="teacher">Profesor</option>
          <option value="admin">Administrador</option>
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white rounded-lg shadow">
          <thead>
            <tr className="border-b bg-gray-100">
              <th className="text-left py-3 px-4">Nombre</th>
              <th className="text-left py-3 px-4">Email</th>
              <th className="text-left py-3 px-4">Rol</th>
              <th className="text-center py-3 px-4">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center py-6 text-gray-600">
                  No se encontraron usuarios
                </td>
              </tr>
            )}

            {filteredUsers.map((user) => (
              <tr
                key={user.id}
                className={`border-b ${
                  editingUser?.id === user.id ? 'bg-yellow-50' : ''
                }`}
              >
                <td className="py-3 px-4 flex items-center space-x-2">
                  <UserCircle className="w-6 h-6 text-gray-400" />
                  <span>{user.displayName}</span>
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
                    getRoleLabel(user.role)
                  )}
                </td>
                <td className="py-3 px-4 text-center space-x-2">
                  {editingUser?.id === user.id ? (
                    <>
                      <button
                        onClick={() => handleRoleChange(user.id, editRole)}
                        className="text-green-600 hover:text-green-800"
                        aria-label="Guardar cambios"
                      >
                        <Edit />
                      </button>
                      <button
                        onClick={cancelEditing}
                        className="text-gray-600 hover:text-gray-800"
                        aria-label="Cancelar edición"
                      >
                        ✕
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => startEditingUser(user)}
                        className="text-blue-600 hover:text-blue-800"
                        aria-label="Editar usuario"
                      >
                        <Edit />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        className="text-red-600 hover:text-red-800"
                        aria-label="Eliminar usuario"
                      >
                        <Trash2 />
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UserManagement;
