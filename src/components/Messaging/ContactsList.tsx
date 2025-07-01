// src/components/Messaging/ContactsList.tsx
import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { ChevronLeft } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL;

interface ContactsListProps {
  onSelectChatTarget: (userId: number, userData: User) => void;
  selectedChatTargetId: string | null;

  currentAdminView: 'contacts' | 'teachers' | 'students' | 'chat-observation';
  setCurrentAdminView: (view: 'contacts' | 'teachers' | 'students' | 'chat-observation') => void;
  selectedTeacherForStudents?: User | null;
  onSetSelectedTeacher: (teacher: User | null) => void;
}

const ContactsList: React.FC<ContactsListProps> = ({
  onSelectChatTarget,
  selectedChatTargetId,
  currentAdminView,
  setCurrentAdminView,
  selectedTeacherForStudents,
  onSetSelectedTeacher,
}) => {
  const { currentUser } = useAuth();
  const [listItems, setListItems] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = async () => {
    if (!currentUser) return;

    setLoading(true);
    setError(null);
    let url = '';
    let isContactsList = false;

    try {
      if (currentUser.role_id === 1) { // If it's an Admin
        if (currentAdminView === 'teachers') {
          url = `${API_URL}/auth/admin/teachers`;
        } else if (currentAdminView === 'students' || currentAdminView === 'chat-observation') {
          url = `${API_URL}/auth/admin/students`;
        } else {
          setListItems([]);
          setLoading(false);
          return;
        }
      } else { // If not an Admin, show normal contacts
        url = `${API_URL}/auth/contacts`;
        isContactsList = true;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${currentUser.token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (isContactsList) {
        setListItems(data.contacts?.map((c: any) => c.user) || []);
      } else if (currentUser.role_id === 1) {
        if (currentAdminView === 'teachers') {
          setListItems(data.teachers || []);
        } else if (currentAdminView === 'students' || currentAdminView === 'chat-observation') {
          setListItems(data.students || []);
        }
      }
    } catch (err: any) {
      console.error('Error fetching list items:', err);
      setError(err.message || 'Error al cargar la lista.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser?.role_id === 1 || (currentUser?.role_id !== 1 && currentAdminView === 'contacts')) {
      fetchItems();
    }
  }, [currentUser, currentAdminView, selectedTeacherForStudents]);


  if (loading) {
    return <div className="p-4 text-center">Cargando...</div>;
  }

  if (error) {
    return <div className="p-4 text-center text-red-500">Error: {error}</div>;
  }

  return (
    <div className="h-full bg-white overflow-y-auto shadow-sm">
      <div className="p-4 border-b flex justify-between items-center">
        {/* "Back to Teachers" button, visible only for Admin when viewing students or observing chat */}
        {currentUser?.role_id === 1 && (currentAdminView === 'students' || currentAdminView === 'chat-observation') && (
          <button
            onClick={() => {
              setCurrentAdminView('teachers');
              onSetSelectedTeacher(null); // Deselect the teacher when going back
            }}
            className="flex items-center text-blue-500 hover:text-blue-600"
          >
            <ChevronLeft className="w-5 h-5 mr-1" />
            Profesores
          </button>
        )}
        <h2 className={`text-md font-semibold text-gray-700 ${currentUser?.role_id === 1 && (currentAdminView === 'students' || currentAdminView === 'chat-observation') ? 'ml-auto' : 'mx-auto'}`}>
          {currentUser?.role_id === 1
            ? (currentAdminView === 'teachers' ? 'Lista de Profesores' : `Alumnos`)
            : 'Mis Contactos'}
        </h2>
        {/* Spacer to center the title if there's a button on the left */}
        {currentUser?.role_id === 1 && (currentAdminView === 'students' || currentAdminView === 'chat-observation') && (
          <div className="w-5 h-5 mr-1 invisible"></div>
        )}
      </div>

      <ul>
        {listItems.length === 0 ? (
          <li className="p-4 text-gray-500 text-center">
            {currentUser?.role_id === 1 && currentAdminView === 'teachers' ?
             'No hay profesores registrados.' :
             (currentUser?.role_id === 1 && (currentAdminView === 'students' || currentAdminView === 'chat-observation') ?
              'No hay alumnos asignados a este profesor o registrados.' :
              'No tienes contactos.')
            }
          </li>
        ) : (
          listItems.map((item) => (
            <li
              key={item.id}
              className={`flex items-center p-3 border-b cursor-pointer hover:bg-blue-50 ${
                selectedChatTargetId === String(item.id) ? 'bg-blue-100' : ''
              }`}
              onClick={() => {
                if (currentUser?.role_id === 1) {
                  if (currentAdminView === 'teachers') {
                    onSetSelectedTeacher(item);
                    setCurrentAdminView('students');
                  } else if (currentAdminView === 'students' || currentAdminView === 'chat-observation') {
                    onSelectChatTarget(item.id, item);
                  }
                } else {
                  onSelectChatTarget(item.id, item);
                }
              }}
            >
              <div className="flex-1">
                <div className="font-medium text-gray-800">{item.name}</div>
                <div className="text-sm text-gray-500 capitalize">{item.role_id === 2 ? 'Profesor' : (item.role_id === 3 ? 'Estudiante' : 'Usuario')}</div>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
};

export default ContactsList;