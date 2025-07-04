// src/components/Messaging/MessagingPage.tsx
import React, { useState, useEffect, useRef } from 'react';
import ContactsList from './ContactsList';
import Chat from './Chat';
import { User, MessagePrivate } from '../../types';
import { MessageSquare } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ChevronLeft } from 'lucide-react'; // Asegúrate de importar ChevronLeft

const API_URL = import.meta.env.VITE_API_URL;

type ChatMode = 'none' | 'direct-chat' | 'observation';

const MessagingPage: React.FC = () => {
  const { currentUser } = useAuth();

  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [selectedContactData, setSelectedContactData] = useState<User | null>(null);
  const [mobileView, setMobileView] = useState<'contacts' | 'chat'>(
    'contacts'
  );

  const [adminView, setAdminView] = useState<'teachers' | 'students' | 'all-students'>(
    currentUser?.role_id === 1 ? 'teachers' : 'contacts'
  );
  const [selectedTeacher, setSelectedTeacher] = useState<User | null>(null);

  const [chatMode, setChatMode] = useState<ChatMode>(
    currentUser?.role_id === 1 ? 'none' : 'direct-chat'
  );

  const [observedChatMessages, setObservedChatMessages] = useState<MessagePrivate[]>([]);
  const [loadingObservedChat, setLoadingObservedChat] = useState(false);
  const [observedChatError, setObservedChatError] = useState<string | null>(null);

  const isInitialRender = useRef(true);

  // Función para resetear completamente el panel derecho y estados relacionados
  const resetChatPanel = () => {
    setSelectedContactId(null);
    setSelectedContactData(null);
    setObservedChatMessages([]);
    setObservedChatError(null);
    setLoadingObservedChat(false);
    setChatMode('none');
    // En móvil, al resetear, siempre volvemos a la vista de contactos
    // Esto es crucial para que el panel de chat desaparezca en móvil si no hay un contacto seleccionado.
    if (window.innerWidth < 1024) { // Solo si es vista móvil
      setMobileView('contacts');
    }
  };

  const handleSelectChatTarget = (userId: number, userData: User) => {
    setSelectedContactId(userId.toString());
    setSelectedContactData(userData);
    setMobileView('chat'); // Para la vista móvil

    if (currentUser?.role_id === 1) {
      if (adminView === 'all-students') {
        setChatMode('direct-chat'); // Admin puede chatear directamente con alumnos de "Todos los Alumnos"
      } else if (adminView === 'students') {
        setChatMode('observation'); // Admin solo observa chats de alumnos de un profesor específico
      } else {
        setChatMode('none'); // Fallback, no debería ocurrir si la lógica es correcta
      }
    } else {
      setChatMode('direct-chat'); // Usuarios normales siempre en chat directo
    }
  };

  // Estas funciones ahora solo cambian la vista y llaman a resetChatPanel
  const handleBackToTeachers = () => {
    setSelectedTeacher(null);
    setAdminView('teachers');
    resetChatPanel(); // Limpia todo el estado del chat al volver a profesores
  };

  const handleBackToStudents = () => {
    // Esto se llama cuando el admin vuelve de un chat de observación a la lista de alumnos de un profesor
    setAdminView('students');
    resetChatPanel(); // Limpia todo el estado del chat
  };

  // Nueva función para el botón "Volver a Alumnos" en vista móvil cuando el admin está en all-students direct-chat
  const handleBackToAllStudents = () => {
    // Al volver de un chat directo con un alumno, volvemos a la lista de "Todos los Alumnos"
    // y limpiamos el panel de chat.
    resetChatPanel();
    // No necesitamos cambiar adminView aquí, ya está en 'all-students'
    // setAdminView('all-students'); // Esto ya debería estar así
  };


  useEffect(() => {
    const fetchObservedChat = async () => {
      if (currentUser?.role_id === 1 && chatMode === 'observation' && selectedContactData && selectedTeacher) {
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
      } else {
          // Limpiar mensajes si no estamos en modo observación o faltan datos
          if (!isInitialRender.current) {
            setObservedChatMessages([]);
            setObservedChatError(null);
            setLoadingObservedChat(false);
          }
      }
    };

    fetchObservedChat();
    isInitialRender.current = false;
  }, [chatMode, currentUser, selectedContactData, selectedTeacher]);

  // Determinar si el panel derecho de chat debe estar visible
  // En escritorio (lg:block), solo si hay un contacto seleccionado.
  // En móvil (block/hidden), según el estado de mobileView.
  const isChatPanelVisibleDesktop = selectedContactId !== null;
  const isChatPanelVisibleMobile = mobileView === 'chat';


  const getChatPanelPlaceholderMessage = () => {
    if (currentUser?.role_id === 1) { // Admin
      if (adminView === 'teachers') {
        return 'Selecciona un profesor para ver sus alumnos o su chat.';
      } else if (adminView === 'students' || adminView === 'all-students') {
        return 'Selecciona un alumno para ver su historial de chat.';
      }
    }
    // Para usuarios normales o como fallback general
    return 'Selecciona un contacto para comenzar a chatear.';
  };

  return (
    <div className="flex flex-col h-full">
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

        {/* Admin-specific mobile back button for students view when observing chat */}
        {currentUser?.role_id === 1 && mobileView === 'chat' && chatMode === 'observation' && (
            <div className="lg:hidden p-2 bg-gray-100 border-b">
                <button
                    onClick={handleBackToStudents} // Volverá a la lista de alumnos del profesor
                    className="px-3 py-1 text-blue-500 flex items-center hover:text-blue-600"
                >
                    <ChevronLeft className="inline-block mr-1" size={16} /> Volver a Alumnos
                </button>
            </div>
        )}
        {/* Admin-specific mobile back button for all-students view when direct chatting */}
        {currentUser?.role_id === 1 && mobileView === 'chat' && chatMode === 'direct-chat' && adminView === 'all-students' && (
            <div className="lg:hidden p-2 bg-gray-100 border-b">
                <button
                    onClick={handleBackToAllStudents} // Nueva función para volver a "Todos los Alumnos"
                    className="px-3 py-1 text-blue-500 flex items-center hover:text-blue-600"
                >
                    <ChevronLeft className="inline-block mr-1" size={16} /> Volver a Alumnos
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
          `}
        >
          <ContactsList
            onSelectChatTarget={handleSelectChatTarget}
            selectedChatTargetId={selectedContactId}
            currentAdminView={adminView}
            setCurrentAdminView={setAdminView}
            selectedTeacherForStudents={selectedTeacher}
            onSetSelectedTeacher={setSelectedTeacher}
            onClearChatPanel={resetChatPanel}
          />
        </div>

        {/* Chat area (Derecha) */}
        <div
          className={`
            ${isChatPanelVisibleMobile ? 'block' : 'hidden'}
            lg:${isChatPanelVisibleDesktop ? 'block' : 'hidden'}
            w-full lg:w-2/3 flex flex-col h-full
            ${isChatPanelVisibleMobile ? 'p-0' : 'lg:p-0'}
          `}
        >
          {selectedContactId && selectedContactData ? (
            <Chat
                recipientId={selectedContactId}
                recipientData={selectedContactData}
                isObservationMode={chatMode === 'observation'}
                observationMessages={observedChatMessages}
                observationLoading={loadingObservedChat}
                observationError={observedChatError}
                onBackToContacts={handleBackToStudents} // Esto está bien si solo aplica para volver de alumnos de un profesor
                                                      // Para 'Todos los Alumnos', el botón de navegación ya llama a resetChatPanel
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 bg-gray-100">
              <MessageSquare className="w-12 h-12 mb-4 text-gray-300" />
              <p className="text-center px-4">
                {getChatPanelPlaceholderMessage()}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessagingPage;