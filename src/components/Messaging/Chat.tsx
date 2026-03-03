// src/components/Messaging/Chat.tsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createReverbWebSocketService, EchoChannel } from '../../services/ReverbWebSocketService';
import { useAuth } from '../../contexts/AuthContext';
import { MessagePrivate, User } from '../../types';
import { ChatService } from '../../services/ChatService';
import { UploadProgress } from '../../services/LibraryService';
import { formatBytes } from '../../utils/fileValidation';
import { Send, Paperclip, Smile, ArrowLeft, Loader2 } from 'lucide-react';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';

const API_URL = import.meta.env.VITE_API_URL;

interface ChatProps {
  recipientId: string;
  recipientData: User;
  isObservationMode?: boolean;
  observationMessages?: MessagePrivate[];
  observationLoading?: boolean;
  observationError?: string | null;
  onBackToContacts?: () => void;
}

const Chat: React.FC<ChatProps> = ({
  recipientId,
  recipientData,
  isObservationMode = false,
  observationMessages = [],
  observationLoading = false,
  observationError = null,
  onBackToContacts,
}) => {
  const { currentUser } = useAuth();
  const [messages, setMessages] = useState<MessagePrivate[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({ percent: 0, loaded: 0, total: 0 });
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isObservationMode) return;

    const unreadMessages = messages.filter(
      (m) => String(m.user_id) === recipientId && !m.read
    );

    // Considera re-habilitar esto si necesitas marcar mensajes como leídos
    // if (unreadMessages.length > 0) {
    //   unreadMessages.forEach((msg) => markMessageAsRead(msg.id));
    // }
  }, [messages, recipientId, isObservationMode]);

  const roomId = currentUser && recipientId && !isObservationMode
    ? [currentUser.id, recipientId].sort().join('-')
    : null;

  const handleNewMessage = useCallback((data: any) => {
    if (isObservationMode) return;

    console.log('📬 Chat: Mensaje recibido vía WebSocket:', data);
    const receivedMsg: MessagePrivate = data.message;

    setMessages((prev) => {
      const isOwnMessageReceived = String(receivedMsg.user_id) === String(currentUser?.id);

      if (isOwnMessageReceived) {
        const tempMessageIndex = prev.findIndex(
          (msg) => msg.tempId && msg.content === receivedMsg.content && String(msg.user_id) === String(receivedMsg.user_id)
        );

        if (tempMessageIndex > -1) {
          const updatedMessages = [...prev];
          updatedMessages[tempMessageIndex] = {
            ...receivedMsg,
            status: receivedMsg.read ? 'read' : 'sent',
            tempId: undefined,
          };
          console.log('🔄 Chat: Mensaje provisional reemplazado:', receivedMsg.id);
          return updatedMessages;
        } else {
          if (prev.some(msg => msg.id === receivedMsg.id)) {
            console.warn('Chat: Mensaje recibido con ID existente, ignorando para evitar duplicados:', receivedMsg.id);
            return prev;
          }
          console.log('➕ Chat: Añadiendo mensaje propio (no provisional) como nuevo:', receivedMsg.id);
          return [...prev, { ...receivedMsg, status: receivedMsg.read ? 'read' : 'sent' }];
        }
      } else {
        if (prev.some(m => m.id === receivedMsg.id)) {
          console.warn('Chat: Mensaje de otro usuario con ID existente, ignorando:', receivedMsg.id);
          return prev;
        }
        console.log('➕ Chat: Añadiendo mensaje de otro usuario como nuevo:', receivedMsg.id);
        return [...prev, { ...receivedMsg, status: receivedMsg.read ? 'read' : 'sent' }];
      }
    });
  }, [currentUser, isObservationMode]);

  useEffect(() => {
    if (isObservationMode) {
      setMessages(observationMessages);
      setLoading(observationLoading);
      return;
    }

    if (!currentUser?.id || !recipientId) return;

    const fetchMessages = async () => {
      try {
        const response = await fetch(
          `${API_URL}/auth/privatechat?user_id=${currentUser.id}&contact_id=${recipientId}`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${currentUser.token}`,
            },
          }
        );
        const data = await response.json();
        setMessages(data.messages || []);
      } catch (error) {
        console.error('Error al obtener mensajes:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();

    let channel: EchoChannel | null = null;
    const reverbService = createReverbWebSocketService(currentUser?.token);

    if (roomId) {
      const channelName = `private-room.${roomId}`;
      reverbService
        .private(channelName)
        .then((chann) => {
          channel = chann;
          console.log(`✅ Chat: Intentando escuchar canal "${channelName}".`);
          channel.subscribed(() => {
            console.log(`✨ Chat: Autenticado y suscrito exitosamente al canal: "${channelName}"`);
          });
          channel.listen('.messagecreatedprivate', handleNewMessage);
        })
        .catch((err) => console.error(`❌ Chat: Error al intentar suscribirse o autenticar el canal "${channelName}":`, err));

      return () => {
        if (channel) {
          console.log(`👋 Chat: Dejando el canal "${channelName}".`);
          channel.leave();
        }
      };
    }
  }, [currentUser, recipientId, roomId, handleNewMessage, isObservationMode, observationMessages, observationLoading]);

  // Auto-scroll hacia abajo cuando llegan nuevos mensajes
  useEffect(() => {
    // Usar setTimeout para asegurar que el DOM se haya actualizado
    const timer = setTimeout(() => {
      if (messagesContainerRef.current) {
        // Usar scrollTop para hacer scroll al final del contenedor
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [messages]);

  const handleEmojiSelect = (emoji: any) => {
    setNewMessage((prev) => prev + emoji.native);
    setShowEmojiPicker(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setAttachedFile(e.target.files[0]);
    }
  };

  const containsBannedWordsOrPatterns = (text: string): boolean => {
    const lowerCaseText = text.toLowerCase();

    const bannedKeywords = [
      'whatsapp', 'telegram', 'numero', 'nro', 'hablame', 'llama',
      'contacto', 'por fuera', 'clases privadas', 'mi cel', 'mi tel', '+54',
    ];

    const phoneRegex = [
      /\b\d{2}\s?\d{4}[-\s]?\d{4}\b/,
      /\b\d{3}[-\s]?\d{3}[-\s]?\d{4}\b/,
      /\b(?:\+?54)?(?:\s*\d{2,4}){2,3}\s*\d{6,8}\b/,
      /\b\d{7,10}\b/
    ];

    for (const keyword of bannedKeywords) {
      if (lowerCaseText.includes(keyword)) {
        console.warn(`Mensaje bloqueado por palabra clave: ${keyword}`);
        return true;
      }
    }

    for (const regex of phoneRegex) {
      if (regex.test(lowerCaseText)) {
        console.warn(`Mensaje bloqueado por patrón de número de teléfono: ${text}`);
        return true;
      }
    }
    return false;
  };

  const handleDownloadAttachment = async (messageId: number) => {
    try {
      const response = await fetch(`${API_URL}/auth/privatechat/${messageId}/download-url`, {
        headers: {
          'Authorization': `Bearer ${currentUser?.token}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Error al obtener URL de descarga');
      }

      const data = await response.json();

      // Open download URL in new tab
      window.open(data.download_url, '_blank');
    } catch (error) {
      console.error('Error downloading attachment:', error);
      alert('Error al descargar el archivo. Por favor, intenta de nuevo.');
    }
  };


  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isObservationMode) return;

    const messageContent = newMessage.trim();
    const currentFile = attachedFile;

    // Clear input immediately for better UX
    setNewMessage('');
    setAttachedFile(null);
    setShowEmojiPicker(false);
    setWarningMessage(null);

    // Create temp message for optimistic UI
    const tempMessage: MessagePrivate = {
      id: Date.now(),
      tempId: `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      user_id: currentUser!.id,
      contact_id: Number(recipientId),
      content: messageContent,
      read: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sender: currentUser!,
      status: 'sending',
    };

    setMessages((prev) => [...prev, tempMessage]);

    try {
      let messageData;

      // If there's a file, use S3 upload flow
      if (currentFile) {
        setIsUploading(true);
        setUploadProgress({ percent: 0, loaded: 0, total: currentFile.size });

        messageData = await ChatService.uploadChatFile(
          currentUser!.token!,
          currentUser!.id,
          Number(recipientId),
          currentFile,
          messageContent,
          (progress) => {
            setUploadProgress(progress);
          }
        );

        setIsUploading(false);
        setUploadProgress({ percent: 0, loaded: 0, total: 0 });
      } else {
        // Text-only message - use existing endpoint
        const formData = new FormData();
        formData.append('user_id', String(currentUser?.id));
        formData.append('contact_id', String(recipientId));
        formData.append('content', messageContent || '');

        const response = await fetch(`${API_URL}/auth/privatechat`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${currentUser?.token}`,
            Accept: 'application/json',
          },
          body: formData,
        });

        const data = await response.json();

        // Handle banned content
        if (response.status === 403 && data.code === 'BANNED_CONTENT_DETECTED') {
          console.warn('🚫 Mensaje bloqueado por el backend (chat privado):', data.message);
          setWarningMessage(data.message);
          setTimeout(() => setWarningMessage(null), 8000);
          setMessages((prev) => prev.filter(msg => msg.tempId !== tempMessage.tempId));
          return;
        }

        if (!response.ok) {
          console.error('❌ Error del backend al enviar mensaje:', data);
          setMessages((prev) => prev.filter(msg => msg.tempId !== tempMessage.tempId));
          setWarningMessage(data.message || 'Error al enviar el mensaje. Por favor, inténtalo de nuevo.');
          setTimeout(() => setWarningMessage(null), 5000);
          return;
        }

        messageData = data.data;
      }

      // Update temp message with real data from backend
      setMessages((prev) => prev.map(msg =>
        msg.tempId === tempMessage.tempId
          ? { ...messageData, status: 'sent' }
          : msg
      ));
    } catch (error: any) {
      console.error('Error al enviar mensaje:', error);
      setMessages((prev) => prev.filter(msg => msg.tempId !== tempMessage.tempId));
      setWarningMessage(error.message || 'Error al enviar el mensaje');
      setTimeout(() => setWarningMessage(null), 5000);
      setIsUploading(false);
      setUploadProgress({ percent: 0, loaded: 0, total: 0 });
    }
  };

  const displayMessages = isObservationMode ? observationMessages : messages;
  const displayLoading = isObservationMode ? observationLoading : loading;
  const displayError = isObservationMode ? observationError : null;

  // Helper: formato de fecha estilo WhatsApp (Hoy, Ayer, o fecha completa)
  const getDateLabel = (dateStr: string): string => {
    const messageDate = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const isSameDay = (d1: Date, d2: Date) =>
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate();

    if (isSameDay(messageDate, today)) return 'Hoy';
    if (isSameDay(messageDate, yesterday)) return 'Ayer';

    return messageDate.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: messageDate.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
    });
  };

  const getDateKey = (dateStr: string): string => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  };

  if (displayLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white shadow-sm border-b flex items-center p-2">
        {/*
          CAMBIO CLAVE AQUÍ:
          El botón de volver se muestra si:
          1. onBackToContacts está presente (indica que estamos en una vista móvil de Chat que puede "volver").
          2. O el usuario es un administrador Y está en modo observación.
        */}
        {onBackToContacts && (currentUser?.role_id !== 1 || (currentUser?.role_id === 1 && isObservationMode)) && (
          <button
            onClick={onBackToContacts}
            className="lg:hidden text-orange-500 hover:text-orange-600 mr-3 flex items-center"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <h2 className="text-lg font-semibold text-gray-800 flex-1">
          {recipientData.name}
          {isObservationMode && (
            <span className="ml-2 px-2 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full">
              Observando
            </span>
          )}
        </h2>
      </div>

      <div ref={messagesContainerRef} className="flex-1 p-4 overflow-y-auto bg-gray-100">
        {displayError ? (
          <div className="flex items-center justify-center h-full text-red-500 text-center">
            Error al cargar el chat: {displayError}
          </div>
        ) : displayMessages.length === 0 && !displayLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 text-center">
            <p className="text-lg font-semibold mb-2">¡Es hora de conectar!</p>
            <p className="text-sm">Envía tu primer mensaje para iniciar la conversación.</p>
          </div>
        ) : (
          displayMessages.map((message, index) => {
            const isMyMessage = String(message.user_id) === String(currentUser?.id);
            const currentDateKey = getDateKey(message.created_at);
            const prevDateKey = index > 0 ? getDateKey(displayMessages[index - 1].created_at) : null;
            const showDateSeparator = index === 0 || currentDateKey !== prevDateKey;

            return (
              <React.Fragment key={message.id}>
                {showDateSeparator && (
                  <div className="flex items-center justify-center my-4">
                    <div
                      className="px-4 py-1 rounded-lg text-xs font-medium text-gray-600 shadow-sm"
                      style={{ backgroundColor: '#e2ddd5' }}
                    >
                      {getDateLabel(message.created_at)}
                    </div>
                  </div>
                )}
                <div
                  className={`flex mb-4 ${isMyMessage ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`
                      max-w-[75%]
                      md:max-w-md
                      lg:max-w-lg
                      px-4 py-2 rounded-2xl shadow-sm
                      ${isMyMessage ? 'bg-orange-500 text-white' : 'bg-white text-gray-800 border'}
                    `}
                  >
                    {!isMyMessage && (
                      <div className="text-xs text-gray-500 mb-1">
                        {message.sender?.name || 'Usuario desconocido'}
                      </div>
                    )}

                    <div className="text-sm break-words whitespace-pre-wrap">
                      {message.content}
                    </div>
                    {message.attachment_url && (
                      <button
                        onClick={() => handleDownloadAttachment(message.id)}
                        className={`block mt-2 text-xs ${isMyMessage ? 'text-blue-100' : 'text-orange-500'} underline hover:opacity-80`}
                      >
                        📎 Descargar archivo adjunto
                      </button>
                    )}
                    <div className="flex items-center justify-end mt-1">
                      <span className={`text-xs ${isMyMessage ? 'text-blue-100' : 'text-gray-400'}`}>
                        {new Date(message.created_at).toLocaleTimeString('es-ES', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              </React.Fragment>
            );
          })
        )}
        <div ref={messagesEndRef}></div>
      </div>

      {!isObservationMode && (
        <form onSubmit={sendMessage} className="p-4 bg-white border-t">
          {warningMessage && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-3 text-sm" role="alert">
              <strong className="font-bold">¡Cuidado! </strong>
              <span className="block sm:inline">{warningMessage}</span>
            </div>
          )}

          {/* Upload Progress */}
          {isUploading && (
            <div className="mb-3 bg-blue-50 p-3 rounded-lg border border-blue-200">
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium text-blue-700 flex items-center">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Subiendo archivo...
                </span>
                <span className="text-sm font-medium text-blue-700">
                  {uploadProgress.percent}% ({formatBytes(uploadProgress.loaded)} / {formatBytes(uploadProgress.total)})
                </span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-in-out"
                  style={{ width: `${uploadProgress.percent}%` }}
                ></div>
              </div>
            </div>
          )}

          <div className="flex items-end space-x-2">
            <div className="relative flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="text-gray-500 hover:text-orange-600 p-1 rounded-full transition-colors"
              >
                <Smile className="w-6 h-6" />
              </button>
              {showEmojiPicker && (
                <div className="absolute bottom-12 left-0 z-50">
                  <Picker data={data} onEmojiSelect={handleEmojiSelect} theme="light" />
                </div>
              )}
            </div>

            <label className="cursor-pointer text-gray-500 hover:text-orange-600 flex-shrink-0 p-1 rounded-full transition-colors">
              <Paperclip className="w-6 h-6" />
              <input type="file" hidden onChange={handleFileChange} disabled={isUploading} />
            </label>

            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Escribe un mensaje..."
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:focus:ring-orange-500 min-w-0"
              disabled={isUploading}
            />

            <button
              type="submit"
              className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-lg transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={(!newMessage.trim() && !attachedFile) || isUploading}
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          {attachedFile && !isUploading && (
            <div className="mt-2 text-xs text-gray-500 text-right">
              Archivo seleccionado: <strong>{attachedFile.name}</strong>
            </div>
          )}
        </form>
      )}
    </div>
  );
};

export default Chat;