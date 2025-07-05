// src/components/Messaging/MessagingPage.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import ContactsList from './ContactsList';
import Chat from './Chat';
import { User, PrivateChat as PrivateChatType } from '../../types'; // Importar PrivateChatType para los mensajes
import { MessageSquare } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ChevronLeft } from 'lucide-react';

// --- ¡IMPORTAR TU SERVICIO WEBSOCKET! ---
import { ReverbWebSocketService, EchoChannel, createReverbWebSocketService } from '../../services/ReverbWebSocketService';

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

  const [observedChatMessages, setObservedChatMessages] = useState<PrivateChatType[]>([]);
  const [loadingObservedChat, setLoadingObservedChat] = useState(false);
  const [observedChatError, setObservedChatError] = useState<string | null>(null);

  const isInitialRender = useRef(true);

  // --- ESTADO Y REFS PARA CONTADORES Y EL SERVICIO WEBSOCKET ---
  const [unreadCounts, setUnreadCounts] = useState<{ [contactId: string]: number }>({});
  const reverbServiceRef = useRef<ReverbWebSocketService | null>(null); // Referencia a tu servicio
  const userChannelRef = useRef<EchoChannel | null>(null); // Canal privado para notificaciones del usuario
  const privateChatChannelRef = useRef<EchoChannel | null>(null); // Canal para el chat directo con un contacto específico


  // --- Funciones de Fetch para Contadores ---
  const fetchUnreadCounts = useCallback(async () => {
    if (!currentUser) return;
    try {
      const response = await fetch(`${API_URL}/auth/unread-counts`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${currentUser.token}`,
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        const data = await response.json();
        setUnreadCounts(data.unread_counts || {});
      } else {
        console.error('Failed to fetch unread counts:', response.statusText);
      }
    } catch (error) {
      console.error('Error fetching unread counts:', error);
    }
  }, [currentUser]);

  // --- Función para marcar TODOS los mensajes de un chat como leídos ---
  const markAllMessagesAsRead = useCallback(async (contactIdToMark: number) => {
    if (!currentUser) return;
    try {
      const response = await fetch(`${API_URL}/auth/messages/mark-all-read/${contactIdToMark}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${currentUser.token}`,
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        console.log(`All messages from ${contactIdToMark} marked as read for user ${currentUser.id}.`);
        // Optimistic update: limpia el contador localmente
        setUnreadCounts(prevCounts => {
          const newCounts = { ...prevCounts };
          delete newCounts[contactIdToMark.toString()];
          return newCounts;
        });
      } else {
        console.error('Failed to mark all messages as read:', response.statusText);
      }
    } catch (error) {
      console.error('Error marking all messages as read:', error);
    }
  }, [currentUser]);

  // --- Función para marcar UN mensaje específico como leído (cuando se recibe en tiempo real) ---
  const markSingleMessageAsRead = useCallback(async (messageId: number) => {
    if (!currentUser) return;
    try {
      const response = await fetch(`${API_URL}/auth/messages/${messageId}/read`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${currentUser.token}`,
        },
      });
      if (response.ok) {
        console.log(`Single message ${messageId} marked as read.`);
        // No actualizamos unreadCounts aquí directamente, esperamos el evento 'unread.counts.updated'
      } else {
        console.error('Failed to mark single message as read:', response.statusText);
      }
    } catch (error) {
      console.error('Error marking single message as read:', error);
    }
  }, [currentUser]);

  // Función para resetear completamente el panel derecho y estados relacionados
  const resetChatPanel = useCallback(() => {
    setSelectedContactId(null);
    setSelectedContactData(null);
    setObservedChatMessages([]);
    setObservedChatError(null);
    setLoadingObservedChat(false);
    setChatMode('none');
    if (window.innerWidth < 1024) {
      setMobileView('contacts');
    }
  }, []);

  // Lógica de selección de chat target
  const handleSelectChatTarget = useCallback((userId: number, userData: User) => {
    setSelectedContactId(userId.toString());
    setSelectedContactData(userData);
    setMobileView('chat');

    if (currentUser?.role_id === 1) {
      if (adminView === 'all-students') {
        setChatMode('direct-chat');
      } else if (adminView === 'students') {
        setChatMode('observation');
      } else {
        setChatMode('none');
      }
    } else {
      setChatMode('direct-chat');
    }

    // ¡IMPORTANTE! Marcar mensajes como leídos cuando se selecciona un chat
    if (currentUser?.role_id !== 1 || (currentUser?.role_id === 1 && adminView === 'all-students')) {
      markAllMessagesAsRead(userId);
    }
  }, [currentUser, adminView, markAllMessagesAsRead]);


  // Estas funciones ahora solo cambian la vista y llaman a resetChatPanel
  const handleBackToTeachers = useCallback(() => {
    setSelectedTeacher(null);
    setAdminView('teachers');
    resetChatPanel();
  }, [resetChatPanel]);

  const handleBackToStudents = useCallback(() => {
    setAdminView('students');
    resetChatPanel();
  }, [resetChatPanel]);

  const handleBackToAllStudents = useCallback(() => {
    resetChatPanel();
  }, [resetChatPanel]);


  // --- useEffect para Inicializar ReverbWebSocketService y Suscribirse al Canal de Usuario ---
  useEffect(() => {
    if (currentUser && currentUser.token) {
      // Inicializa el servicio solo una vez
      if (!reverbServiceRef.current) {
        reverbServiceRef.current = createReverbWebSocketService(currentUser.token);
        console.log('ReverbWebSocketService initialized.');

        // Opcional: Escuchar eventos globales del servicio si los necesitas para depuración o UI
        reverbServiceRef.current.on('connected', () => console.log('Reverb Service: Global WebSocket Connected!'));
        reverbServiceRef.current.on('disconnected', () => console.warn('Reverb Service: Global WebSocket Disconnected!'));
        reverbServiceRef.current.on('error', (err) => console.error('Reverb Service: Global WebSocket Error:', err));
      } else {
        // Actualiza el token si el currentUser cambia (ej. refresh de token)
        reverbServiceRef.current.setToken(currentUser.token);
      }

      // Conectar el servicio si no está conectado
      if (!reverbServiceRef.current.globalWs || reverbServiceRef.current.globalWs.readyState !== WebSocket.OPEN) {
        reverbServiceRef.current.connect().catch(e => console.error("Failed to connect Reverb service:", e));
      }

      // Suscribirse al canal privado del usuario para notificaciones de contadores
      const shouldSubscribeToUserChannel = currentUser.role_id === 2 || currentUser.role_id === 3; // Estudiantes y Profesores

      if (shouldSubscribeToUserChannel && !userChannelRef.current) {
        console.log(`Subscribing to private-user.${currentUser.id}`);
        reverbServiceRef.current.private(`private-user.${currentUser.id}`) // Tu servicio construye el prefijo 'private-'
          .then(channel => {
            userChannelRef.current = channel;
            console.log(`Successfully subscribed to private-user.${currentUser.id}`);

            // Escuchar el evento de actualización de contadores
            userChannelRef.current.listen('unread.counts.updated', (data: { userId: number; unreadCounts: { [key: string]: number } }) => {
              console.log('Received unread.counts.updated event:', data);
              if (data.userId === currentUser.id) {
                setUnreadCounts(data.unreadCounts);
              }
            });

            userChannelRef.current.error((err: any) => {
              console.error(`Error on private-user.${currentUser.id} channel:`, err);
            });

            // Una vez suscrito, obtener los contadores iniciales
            fetchUnreadCounts();
          })
          .catch(error => {
            console.error(`Error subscribing to private-user.${currentUser.id}:`, error);
          });
      }

      // Limpiar al desmontar o al cambiar de usuario (si el usuario es quien activa la suscripción)
      return () => {
        if (userChannelRef.current) {
          console.log(`Leaving private-user.${currentUser.id}`);
          userChannelRef.current.leave();
          userChannelRef.current = null;
        }
        // No desconectamos completamente el reverbServiceRef.current aquí
        // para permitir que persista si hay otras suscripciones (ej. videollamada)
        // La desconexión global es mejor manejarla en un contexto global si es necesario.
      };
    }
  }, [currentUser, fetchUnreadCounts]); // Dependencias: currentUser para inicializar/actualizar token, fetchUnreadCounts


  // --- useEffect para Carga de Historial de Chat Observado ---
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
          <MessageSquare className="w-6 h-6 mr-2 text-orange-500" />
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
                  mobileView === 'contacts' ? 'bg-orange-500 text-white shadow' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Contactos
              </button>
              <button
                onClick={() => setMobileView('chat')}
                disabled={!selectedContactId}
                className={`px-3 py-1 rounded-lg transition-colors ${
                  mobileView === 'chat' && selectedContactId
                    ? 'bg-orange-500 text-white shadow'
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
                    onClick={handleBackToStudents}
                    className="px-3 py-1 text-orange-500 flex items-center hover:text-orange-600"
                >
                    <ChevronLeft className="inline-block mr-1" size={16} /> Volver a Alumnos
                </button>
            </div>
        )}
        {/* Admin-specific mobile back button for all-students view when direct chatting */}
        {currentUser?.role_id === 1 && mobileView === 'chat' && chatMode === 'direct-chat' && adminView === 'all-students' && (
            <div className="lg:hidden p-2 bg-gray-100 border-b">
                <button
                    onClick={handleBackToAllStudents}
                    className="px-3 py-1 text-orange-500 flex items-center hover:text-orange-600"
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
            unreadCounts={unreadCounts} 
          />
        </div>

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
                onBackToContacts={handleBackToStudents}
                // ¡PASAMOS LA INSTANCIA DE TU SERVICIO!
                reverbService={reverbServiceRef.current}
                onMarkSingleMessageAsRead={markSingleMessageAsRead}
                onNewMessageSent={() => { /* No es necesario aquí, la reactividad la maneja el WebSocket */ }}
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