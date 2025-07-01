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

  // Admin-specific states
  const [adminView, setAdminView] = useState<'teachers' | 'students' | 'chat-observation'>(
    currentUser?.role_id === 1 ? 'teachers' : 'contacts'
  );
  const [selectedTeacher, setSelectedTeacher] = useState<User | null>(null);

  // Observed chat history states (admin only)
  const [observedChatMessages, setObservedChatMessages] = useState<MessagePrivate[]>([]);
  const [loadingObservedChat, setLoadingObservedChat] = useState(false);
  const [observedChatError, setObservedChatError] = useState<string | null>(null);

  const handleSelectChatTarget = (userId: number, userData: User) => {
    setSelectedContactId(userId.toString());
    setSelectedContactData(userData);
    if (currentUser?.role_id !== 1) {
      setMobileView('chat');
    }
    // If it's an admin, currentAdminView is already set to 'chat-observation'
    // when clicking a student in ContactsList.
  };

  const handleBackToContacts = () => {
    setMobileView('contacts');
    setSelectedContactId(null);
    setSelectedContactData(null);
  };

  const handleBackToTeachers = () => {
    setSelectedTeacher(null);
    setAdminView('teachers');
    setSelectedContactId(null); // Reset chat selection
    setSelectedContactData(null);
    setObservedChatMessages([]); // Clear observed messages
  };

  const handleBackToStudents = () => {
    setAdminView('students');
    setSelectedContactId(null); // Reset chat selection
    setSelectedContactData(null);
    setObservedChatMessages([]); // Clear observed messages
  };

  useEffect(() => {
    const fetchObservedChat = async () => {
      // Condition: Is admin, in observation view, with selected teacher and student
      if (
        currentUser?.role_id === 1 &&
        adminView === 'chat-observation' &&
        selectedContactData && // This is the student (user2_id)
        selectedTeacher // This is the teacher (user1_id)
      ) {
        setLoadingObservedChat(true);
        setObservedChatError(null);
        try {
            const user1Id = selectedTeacher.id; // Teacher's ID
            const user2Id = selectedContactData.id; // Student's ID

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

  // Lógica para determinar si mostrar la lista de contactos o el chat en modo móvil
  // Para admins, la lista de contactos siempre estará visible en desktop.
  // En móvil, sigue la lógica existente.
  const showContactsList = currentUser?.role_id === 1
    ? (true) // Admin always shows ContactsList (teachers or students)
    : (mobileView === 'contacts'); // Normal user follows mobile view

  const showChatArea = currentUser?.role_id === 1
    ? (selectedContactId && selectedContactData) // Admin shows chat if a contact is selected
    : (mobileView === 'chat' && selectedContactId && selectedContactData); // Normal user follows mobile view

  return (
    <div className="flex flex-col h-screen">
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

      <div className="flex-1 flex overflow-hidden">
        {/* Mobile navigation / Admin navigation buttons */}
        <div className="lg:hidden flex items-center justify-between p-2 bg-gray-100 border-b w-full">
          {currentUser?.role_id === 1 ? (
            <>
              {/* This button is now handled within ContactsList for consistency across desktop/mobile */}
              {adminView === 'chat-observation' && (
                <button
                  onClick={handleBackToStudents}
                  className="px-3 py-1 text-blue-500 flex items-center"
                >
                  <ArrowLeft className="inline-block mr-1" size={16} /> Volver a Alumnos
                </button>
              )}
            </>
          ) : (
            // Normal user mobile navigation remains the same
            <>
              <button
                onClick={() => setMobileView('contacts')}
                className={`px-3 py-1 rounded ${
                  mobileView === 'contacts' ? 'bg-blue-500 text-white' : 'bg-white text-gray-700'
                }`}
              >
                Contactos
              </button>
              <button
                onClick={() => setMobileView('chat')}
                disabled={!selectedContactId}
                className={`px-3 py-1 rounded ${
                  mobileView === 'chat' && selectedContactId
                    ? 'bg-blue-500 text-white'
                    : 'bg-white text-gray-700'
                } ${!selectedContactId ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Chat
              </button>
            </>
          )}
        </div>

        {/* Contacts list / Admin view list */}
        <div
          className={`
            ${showContactsList ? 'block' : 'hidden'}
            lg:block lg:w-1/3 border-r
          `}
        >
          <ContactsList
            onSelectChatTarget={handleSelectChatTarget}
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
            ${showChatArea ? 'block' : 'hidden'}
            lg:block lg:w-2/3 flex flex-col h-full
          `}
        >
          {selectedContactId && selectedContactData ? (
            <>
              {/* Mobile back button for normal users only */}
              {currentUser?.role_id !== 1 && (
                <div className="lg:hidden p-2 bg-gray-100 border-b">
                  <button
                    onClick={handleBackToContacts}
                    className="text-blue-500"
                  >
                    ← Volver a contactos
                  </button>
                </div>
              )}

              {/* Chat component, conditionally in observation mode */}
              <Chat
                recipientId={selectedContactId}
                recipientData={selectedContactData}
                isObservationMode={currentUser?.role_id === 1 && adminView === 'chat-observation'}
                observationMessages={observedChatMessages}
                observationLoading={loadingObservedChat}
                observationError={observedChatError}
              />
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <MessageSquare className="w-12 h-12 mb-4 text-gray-300" />
              <p>
                {currentUser?.role_id === 1
                  ? (adminView === 'teachers' ? 'Selecciona un profesor para ver sus alumnos.' :
                     adminView === 'students' ? 'Selecciona un alumno para ver su historial de chat.' :
                     'Selecciona un profesor o alumno.')
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