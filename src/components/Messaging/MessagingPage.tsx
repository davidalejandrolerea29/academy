// src/components/Messaging/MessagingPage.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import ContactsList from './ContactsList';
import Chat from './Chat';
import { User, PrivateChat as PrivateChatType } from '../../types';
import { MessageSquare, ChevronLeft } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ReverbWebSocketService, EchoChannel, createReverbWebSocketService } from '../../services/ReverbWebSocketService';

const API_URL = import.meta.env.VITE_API_URL;

type ChatMode = 'none' | 'direct-chat' | 'observation';
type AdminView = 'teachers' | 'students' | 'all-students' | 'contacts';

const MessagingPage: React.FC = () => {
  const { currentUser } = useAuth();

  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [selectedContactData, setSelectedContactData] = useState<User | null>(null);
  const [mobileView, setMobileView] = useState<'contacts' | 'chat'>('contacts');

  const [adminView, setAdminView] = useState<AdminView>(
    currentUser?.role_id === 1 ? 'teachers' : 'contacts'
  );
  const [selectedTeacher, setSelectedTeacher] = useState<User | null>(null);

  const [chatMode, setChatMode] = useState<ChatMode>(
    currentUser?.role_id === 1 ? 'none' : 'direct-chat'
  );

  // Mensajes separados
  const [observedChatMessages, setObservedChatMessages] = useState<PrivateChatType[]>([]);


  const [loadingObservedChat, setLoadingObservedChat] = useState(false);
  const [observedChatError, setObservedChatError] = useState<string | null>(null);

  const [unreadCounts, setUnreadCounts] = useState<{ [contactId: string]: number }>({});

  const reverbServiceRef = useRef<ReverbWebSocketService | null>(null);
  const userChannelRef = useRef<EchoChannel | null>(null);


  const isInitialRender = useRef(true);

  // --- Fetch de contadores ---
  const fetchUnreadCounts = useCallback(async () => {
    if (!currentUser) return;
    try {
      const res = await fetch(`${API_URL}/auth/unread-counts`, {
        headers: { Authorization: `Bearer ${currentUser.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUnreadCounts(data.unread_counts || {});
      }
    } catch (err) {
      console.error('Error fetching unread counts:', err);
    }
  }, [currentUser]);

  const markAllMessagesAsRead = useCallback(async (contactId: number) => {
    if (!currentUser) return;
    try {
      const res = await fetch(`${API_URL}/auth/messages/mark-all-read/${contactId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${currentUser.token}` }
      });
      if (res.ok) {
        setUnreadCounts(prev => {
          const newCounts = { ...prev };
          delete newCounts[contactId.toString()];
          return newCounts;
        });
      }
    } catch (err) { console.error(err); }
  }, [currentUser]);


  const resetChatPanel = useCallback(() => {
    setSelectedContactId(null);
    setSelectedContactData(null);
    setObservedChatMessages([]);
    setLoadingObservedChat(false);
    setObservedChatError(null);
    setChatMode('none');
    if (window.innerWidth < 1024) setMobileView('contacts');
  }, []);

  const handleSelectChatTarget = useCallback((userId: number, userData: User) => {
    setSelectedContactId(userId.toString());
    setSelectedContactData(userData);
    setMobileView('chat');

    if (currentUser?.role_id === 1) {
      if (adminView === 'all-students') setChatMode('direct-chat');
      else if (adminView === 'students') setChatMode('observation');
      else setChatMode('none');
    } else setChatMode('direct-chat');

    if (currentUser?.role_id !== 1 || (currentUser?.role_id === 1 && adminView === 'all-students')) {
      markAllMessagesAsRead(userId);
    }
  }, [currentUser, adminView, markAllMessagesAsRead]);

  const handleBackToTeachers = useCallback(() => { setSelectedTeacher(null); setAdminView('teachers'); resetChatPanel(); }, [resetChatPanel]);
  const handleBackToStudents = useCallback(() => { setAdminView('students'); resetChatPanel(); }, [resetChatPanel]);
  const handleBackToAllStudents = useCallback(() => { resetChatPanel(); }, [resetChatPanel]);

  // --- WebSocket real-time (direct + observation + counters) ---
  useEffect(() => {
    if (!currentUser?.token) return;

    const reverbService = reverbServiceRef.current ?? createReverbWebSocketService(currentUser.token);
    reverbServiceRef.current = reverbService;
    reverbService.setToken(currentUser.token);

    const connectWS = async () => {
      if (!reverbService.globalWs || reverbService.globalWs.readyState !== WebSocket.OPEN) {
        try { await reverbService.connect(); } catch (e) { console.error('WebSocket connect failed:', e); }
      }
    };
    connectWS();

    // Canal usuario (contadores)
    const subscribeToUserChannel = async () => {
      if (!userChannelRef.current && [1, 2, 3].includes(currentUser.role_id)) {
        try {
          const userChannel = await reverbService.private(`private-user.${currentUser.id}`);
          userChannelRef.current = userChannel;

          userChannel.listen('unread.counts.updated', (data: any) => {
            if (data.userId === currentUser.id) setUnreadCounts(data.unreadCounts);
          });
          userChannel.error((err: any) => console.error('User channel error:', err));

          fetchUnreadCounts();
        } catch (err) { console.error('Error subscribing to user channel:', err); }
      }
    };
    subscribeToUserChannel();



    return () => {
      if (userChannelRef.current) { userChannelRef.current.leave(); userChannelRef.current = null; }
    };
  }, [currentUser?.id, currentUser?.token, fetchUnreadCounts]);

  // --- Historial chat observado ---
  useEffect(() => {
    const fetchObservedChat = async () => {
      if (currentUser?.role_id === 1 && chatMode === 'observation' && selectedContactData && selectedTeacher) {
        setLoadingObservedChat(true);
        setObservedChatError(null);
        try {
          const res = await fetch(`${API_URL}/auth/admin/chat-history?user1_id=${selectedTeacher.id}&user2_id=${selectedContactData.id}`, {
            headers: { Authorization: `Bearer ${currentUser.token}` },
          });
          if (!res.ok) throw new Error((await res.json()).error || res.statusText);
          const data = await res.json();
          setObservedChatMessages(data.messages || []);
        } catch (err: any) {
          setObservedChatError(err.message || 'Error al cargar el historial del chat.');
        } finally { setLoadingObservedChat(false); }
      } else {
        if (!isInitialRender.current) { setObservedChatMessages([]); setObservedChatError(null); setLoadingObservedChat(false); }
      }
    };
    fetchObservedChat();
    isInitialRender.current = false;
  }, [chatMode, currentUser, selectedContactData, selectedTeacher]);

  const isChatPanelVisibleDesktop = !!selectedContactId;
  const isChatPanelVisibleMobile = mobileView === 'chat';

  const getChatPanelPlaceholderMessage = () => {
    if (currentUser?.role_id === 1) {
      if (adminView === 'teachers') return 'Selecciona un profesor para ver sus alumnos o su chat.';
      if (['students', 'all-students'].includes(adminView)) return 'Selecciona un alumno para ver su historial de chat.';
    }
    return 'Selecciona un contacto para comenzar a chatear.';
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white shadow p-4 border-b">
        <h1 className="text-xl font-semibold text-gray-800 flex items-center">
          <MessageSquare className="w-6 h-6 mr-2 text-orange-500" /> Mensajes
          {currentUser?.role_id === 1 && <span className="ml-2 px-2 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full">Modo Admin</span>}
        </h1>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Mobile tabs */}
        {currentUser?.role_id !== 1 && (
          <div className="lg:hidden flex items-center justify-around p-2 bg-gray-100 border-b w-full">
            <button onClick={() => setMobileView('contacts')} className={`px-3 py-1 rounded-lg transition-colors ${mobileView === 'contacts' ? 'bg-orange-500 text-white shadow' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>Contactos</button>
            <button onClick={() => setMobileView('chat')} disabled={!selectedContactId} className={`px-3 py-1 rounded-lg transition-colors ${mobileView === 'chat' && selectedContactId ? 'bg-orange-500 text-white shadow' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'} ${!selectedContactId ? 'opacity-50 cursor-not-allowed' : ''}`}>Chat</button>
          </div>
        )}

        {/* Admin back buttons */}
        {currentUser?.role_id === 1 && mobileView === 'chat' && chatMode === 'observation' && (
          <div className="lg:hidden p-2 bg-gray-100 border-b">
            <button onClick={handleBackToStudents} className="px-3 py-1 text-orange-500 flex items-center hover:text-orange-600">
              <ChevronLeft className="inline-block mr-1" size={16} /> Volver a Alumnos
            </button>
          </div>
        )}
        {currentUser?.role_id === 1 && mobileView === 'chat' && chatMode === 'direct-chat' && adminView === 'all-students' && (
          <div className="lg:hidden p-2 bg-gray-100 border-b">
            <button onClick={handleBackToAllStudents} className="px-3 py-1 text-orange-500 flex items-center hover:text-orange-600">
              <ChevronLeft className="inline-block mr-1" size={16} /> Volver a Alumnos
            </button>
          </div>
        )}

        {/* Contacts list */}
        <div className={`${mobileView === 'contacts' ? 'block' : 'hidden'} lg:block w-full lg:w-1/3 border-r overflow-y-auto h-full`}>
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

        {/* Chat panel */}
        <div className={`${isChatPanelVisibleMobile ? 'block' : 'hidden'} lg:${isChatPanelVisibleDesktop ? 'block' : 'hidden'} w-full lg:w-2/3 flex flex-col h-full`}>
          {selectedContactId && selectedContactData ? (
            <Chat
              recipientId={selectedContactId}
              recipientData={selectedContactData}
              isObservationMode={chatMode === 'observation'}
              observationMessages={observedChatMessages}
              observationLoading={loadingObservedChat}
              observationError={observedChatError}
              onBackToContacts={handleBackToStudents}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 bg-gray-100">
              <MessageSquare className="w-12 h-12 mb-4 text-gray-300" />
              <p className="text-center px-4">{getChatPanelPlaceholderMessage()}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessagingPage;
