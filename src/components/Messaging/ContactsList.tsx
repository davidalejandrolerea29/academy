// src/components/Messaging/ContactsList.tsx
import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { ChevronLeft } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL;

interface ContactsListProps {
  onSelectChatTarget: (userId: number, userData: User) => void;
  selectedChatTargetId: string | null;

  currentAdminView: 'contacts' | 'teachers' | 'students' | 'chat-observation' | 'all-students';
  setCurrentAdminView: (view: 'contacts' | 'teachers' | 'students' | 'chat-observation' | 'all-students') => void;
  selectedTeacherForStudents?: User | null;
  onSetSelectedTeacher: (teacher: User | null) => void;
  // Agregamos una prop para notificar a MessagingPage que debe limpiar el chat
  onClearChatPanel: () => void;
}

const ContactsList: React.FC<ContactsListProps> = ({
  onSelectChatTarget,
  selectedChatTargetId,
  currentAdminView,
  setCurrentAdminView,
  selectedTeacherForStudents,
  onSetSelectedTeacher,
  onClearChatPanel, // Recibimos la nueva prop
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
        } else if (currentAdminView === 'students' || currentAdminView === 'chat-observation' || currentAdminView === 'all-students') {
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
        } else if (currentAdminView === 'students' || currentAdminView === 'chat-observation' || currentAdminView === 'all-students') {
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
    if (currentUser && (currentUser.role_id === 1 || currentAdminView === 'contacts')) {
      fetchItems();
    }
  }, [currentUser, currentAdminView, selectedTeacherForStudents]);

  if (loading) {
    return <div className="p-4 text-center">Cargando...</div>;
  }

  if (error) {
    return <div className="p-4 text-center text-red-500">Error: {error}</div>;
  }

  // Determine the title to display based on the current view
  const getHeaderTitle = () => {
    if (currentUser?.role_id === 1) {
      if (currentAdminView === 'teachers') return 'Profesores';
      if (currentAdminView === 'all-students') return 'Todos los Alumnos';
      if (currentAdminView === 'chat-observation') return 'Chats Observables';
      if (currentAdminView === 'students') return `Alumnos de ${selectedTeacherForStudents?.name || 'Profesor'}`;
    }
    return 'Mis Contactos';
  };

  // Helper function to get the empty list message
  const getEmptyListMessage = () => {
    if (currentUser?.role_id === 1) {
      if (currentAdminView === 'teachers') {
        return 'No hay profesores registrados.';
      } else if (currentAdminView === 'students') {
        return 'No hay alumnos asignados a este profesor.';
      } else if (currentAdminView === 'all-students') {
        return 'No hay alumnos registrados.';
      }
    }
    return 'No tienes contactos.';
  };


  return (
    <div className="h-full bg-white overflow-y-auto shadow-sm">
      {currentUser?.role_id === 1 && (
        <div className="p-4 border-b bg-gray-50">
          <div className="w-full flex flex-wrap justify-center sm:justify-start gap-2">
            <button
              onClick={() => {
                setCurrentAdminView('teachers');
                onSetSelectedTeacher(null);
                onClearChatPanel(); // Llama a la función de limpieza en MessagingPage
              }}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap ${currentAdminView === 'teachers' ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
            >
              Profesores
            </button>
            <button
              onClick={() => {
                setCurrentAdminView('all-students');
                onSetSelectedTeacher(null);
                onClearChatPanel(); // Llama a la función de limpieza en MessagingPage
              }}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap ${currentAdminView === 'all-students' ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
            >
              Todos los Alumnos
            </button>
            {/* <button
              onClick={() => setCurrentAdminView('chat-observation')}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap ${currentAdminView === 'chat-observation' ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
            >
              Observar Chats
            </button> */}
          </div>
        </div>
      )}

      <div className="p-4 border-b flex justify-between items-center">
        {currentUser?.role_id === 1 && currentAdminView === 'students' && (
          <button
            onClick={() => {
              setCurrentAdminView('teachers');
              onSetSelectedTeacher(null);
              onClearChatPanel(); // Llama a la función de limpieza en MessagingPage
            }}
            className="flex items-center text-orange-500 hover:text-orange-600 text-sm"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Volver a Profesores
          </button>
        )}
        <h2 className={`text-md font-semibold text-gray-700 ${currentUser?.role_id === 1 && currentAdminView === 'students' ? 'ml-auto' : 'mx-auto'}`}>
          {getHeaderTitle()}
        </h2>
        {/* Spacer to center the title if there's a button on the left */}
        {currentUser?.role_id === 1 && currentAdminView === 'students' && (
          <div className="w-4 h-4 mr-1 invisible"></div>
        )}
      </div>

      <ul>
        {listItems.length === 0 ? (
          <li className="p-4 text-gray-500 text-center text-sm">
            {getEmptyListMessage()} {/* Call the helper function here */}
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
                  } else if (currentAdminView === 'students' || currentAdminView === 'all-students' || currentAdminView === 'chat-observation') {
                    // Solo seleccionamos el chat si es un ID de usuario real
                    if (item.id !== 0) {
                      onSelectChatTarget(item.id, item);
                    }
                  }
                } else {
                  onSelectChatTarget(item.id, item);
                }
              }}
            >
              <div className="flex-1">
                <div className="font-medium text-gray-800">{item.name}</div>
                <div className="text-sm text-gray-500 capitalize">
                  {item.role_id === 2 ? 'Profesor' : (item.role_id === 3 ? 'Estudiante' : 'Usuario')}
                </div>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
};

export default ContactsList;