// src/components/Messaging/MessagingPage.tsx
import React, { useState, useEffect } from 'react';
import ContactsList from './ContactsList';
import Chat from './Chat';
import { User, MessagePrivate } from '../../types';
import { MessageSquare, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const API_URL = import.meta.env.VITE_API_URL;

const MessagingPage: React.FC = () => {
  const { currentUser } = useAuth();

  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [selectedContactData, setSelectedContactData] = useState<User | null>(null);
  const [mobileView, setMobileView] = useState<'contacts' | 'chat'>(
    'contacts'
  );

  const [adminView, setAdminView] = useState<'teachers' | 'students' | 'chat-observation'>(
    currentUser?.role_id === 1 ? 'teachers' : 'contacts'
  );
  const [selectedTeacher, setSelectedTeacher] = useState<User | null>(null);

  const [observedChatMessages, setObservedChatMessages] = useState<MessagePrivate[]>([]);
  const [loadingObservedChat, setLoadingObservedChat] = useState(false);
  const [observedChatError, setObservedChatError] = useState<string | null>(null);

  const handleSelectChatTarget = (userId: number, userData: User) => {
    setSelectedContactId(userId.toString());
    setSelectedContactData(userData);
    setMobileView('chat');
  };

  const handleBackToContacts = () => {
    setMobileView('contacts');
    setSelectedContactId(null);
    setSelectedContactData(null);
    if (adminView === 'chat-observation') {
      setObservedChatMessages([]);
      setObservedChatError(null);
      setLoadingObservedChat(false);
    }
  };

  const handleBackToTeachers = () => {
    setSelectedTeacher(null);
    setAdminView('teachers');
    setSelectedContactId(null);
    setSelectedContactData(null);
    setObservedChatMessages([]);
    setMobileView('contacts');
  };

  const handleBackToStudents = () => {
    setAdminView('students');
    setSelectedContactId(null);
    setSelectedContactData(null);
    setObservedChatMessages([]);
    setMobileView('contacts');
  };

  useEffect(() => {
    const fetchObservedChat = async () => {
      if (
        currentUser?.role_id === 1 &&
        adminView === 'chat-observation' &&
        selectedContactData &&
        selectedTeacher
      ) {
        setLoadingObservedChat(true);
        setObservedChatError(null);
        try {
            const user1Id = selectedTeacher.id;
            const user2Id = selectedContactData.id;

            const response = await fetch(
                `${API_URL}/auth/admin/chat-history?user1_id=${user1Id}&user2_id=${user2Id}`,
                {
                    method: 'GET',
                    headers: {
                        Authorization: `Bearer ${currentUser.token}`,
                    },
                }
            );

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Error ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            setObservedChatMessages(data.messages || []);
        } catch (err: any) {
            console.error('Error fetching observed chat history:', err);
            setObservedChatError(err.message || 'Error al cargar el historial del chat.');
        } finally {
            setLoadingObservedChat(false);
        }
      }
    };

    fetchObservedChat();
  }, [adminView, currentUser, selectedContactData, selectedTeacher]);

  return (
    <div className="flex flex-col h-screen"> {/* h-screen para ocupar toda la altura */}
      {/* Encabezado global de Mensajes */}
      <div className="bg-white shadow p-4 border-b">
        <h1 className="text-xl font-semibold text-gray-800 flex items-center">
          <MessageSquare className="w-6 h-6 mr-2 text-blue-500" />
          Mensajes
          {currentUser?.role_id === 1 && (
            <span className="ml-2 px-2 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full">
              Modo Admin
            </span>
          )}
        </h1>
      </div>

      {/* Contenedor principal de contactos y chat */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Mobile navigation for normal users (tabs) */}
        {currentUser?.role_id !== 1 && (
            <div className="lg:hidden flex items-center justify-around p-2 bg-gray-100 border-b w-full">
              <button
                onClick={() => setMobileView('contacts')}
                className={`px-3 py-1 rounded-lg transition-colors ${
                  mobileView === 'contacts' ? 'bg-blue-500 text-white shadow' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Contactos
              </button>
              <button
                onClick={() => setMobileView('chat')}
                disabled={!selectedContactId}
                className={`px-3 py-1 rounded-lg transition-colors ${
                  mobileView === 'chat' && selectedContactId
                    ? 'bg-blue-500 text-white shadow'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                } ${!selectedContactId ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Chat
              </button>
            </div>
        )}

        {/* Admin-specific mobile back button (for chat observation) */}
        {currentUser?.role_id === 1 && mobileView === 'chat' && selectedContactId && adminView === 'chat-observation' && (
            <div className="lg:hidden p-2 bg-gray-100 border-b">
                <button
                    onClick={handleBackToStudents}
                    className="px-3 py-1 text-blue-500 flex items-center hover:text-blue-600"
                >
                    <ArrowLeft className="inline-block mr-1" size={16} /> Volver a Alumnos
                </button>
            </div>
        )}

        {/* Contacts list / Admin view list */}
        <div
          className={`
            ${mobileView === 'contacts' ? 'block' : 'hidden'}
            lg:block
            w-full lg:w-1/3 border-r
            overflow-y-auto h-full
            ${currentUser?.role_id !== 1 && mobileView === 'contacts' ? '' : 'lg:border-r'} {/* Eliminar border-r en móvil si no es la vista de contactos */}
          `}
        >
          <ContactsList
            onSelectChatTarget={(userId, userData) => {
              handleSelectChatTarget(userId, userData);
              if (currentUser?.role_id === 1 && adminView === 'students') {
                  setAdminView('chat-observation');
              }
            }}
            selectedChatTargetId={selectedContactId}
            currentAdminView={adminView}
            setCurrentAdminView={setAdminView}
            selectedTeacherForStudents={selectedTeacher}
            onSetSelectedTeacher={setSelectedTeacher}
          />
        </div>

        {/* Chat area */}
        <div
          className={`
            ${mobileView === 'chat' && selectedContactId ? 'block' : 'hidden'}
            lg:block
            w-full lg:w-2/3 flex flex-col h-full
            ${mobileView === 'chat' ? 'p-0' : 'lg:p-0'} {/* Eliminar padding en chat completo para móvil */}
          `}
        >
          {selectedContactId && selectedContactData ? (
            <Chat
                recipientId={selectedContactId}
                recipientData={selectedContactData}
                isObservationMode={currentUser?.role_id === 1 && adminView === 'chat-observation'}
                observationMessages={observedChatMessages}
                observationLoading={loadingObservedChat}
                observationError={observedChatError}
                onBackToContacts={handleBackToContacts}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 bg-gray-100">
              <MessageSquare className="w-12 h-12 mb-4 text-gray-300" />
              <p className="text-center px-4">
                {currentUser?.role_id === 1
                  ? (adminView === 'teachers' ? 'Selecciona un profesor para ver sus alumnos o su chat.' :
                     adminView === 'students' ? 'Selecciona un alumno para ver su historial de chat.' :
                     'Selecciona un contacto para ver el chat.')
                  : 'Selecciona un contacto para comenzar a chatear.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessagingPage;