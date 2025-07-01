// src/components/Messaging/Chat.tsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createReverbWebSocketService, EchoChannel } from '../../services/ReverbWebSocketService';
import { useAuth } from '../../contexts/AuthContext';
import { MessagePrivate, User } from '../../types';
import { Send, Paperclip, Smile, ArrowLeft } from 'lucide-react'; // Importar ArrowLeft
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
  // Nueva prop para manejar la acción de volver en móvil
  onBackToContacts?: () => void;
}

const Chat: React.FC<ChatProps> = ({
  recipientId,
  recipientData,
  isObservationMode = false,
  observationMessages = [],
  observationLoading = false,
  observationError = null,
  onBackToContacts, // Recibimos la función para volver
}) => {
  const { currentUser } = useAuth();
  const [messages, setMessages] = useState<MessagePrivate[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // const markMessageAsRead = async (messageId: number) => {
  //   if (isObservationMode) return;

  //   console.log('Marcando mensaje como leído...');
  //   try {
  //     await fetch(`${API_URL}/auth/privatechat/${messageId}/read`, {
  //       method: 'PATCH',
  //       headers: {
  //         Authorization: `Bearer ${currentUser?.token}`,
  //         'Content-Type': 'application/json',
  //         Accept: 'application/json',
  //       },
  //     });

  //     setMessages((prev) =>
  //       prev.map((msg) =>
  //         msg.id === messageId ? { ...msg, read: true, status: 'read' } : msg
  //       )
  //     );
  //   } catch (error) {
  //     console.error('Error al marcar mensaje como leído:', error);
  //   }
  // };

  useEffect(() => {
    if (isObservationMode) return;

    const unreadMessages = messages.filter(
      (m) => String(m.user_id) === recipientId && !m.read
    );

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isObservationMode) return;

    const messageContent = newMessage.trim();
    if (!messageContent && !attachedFile) return;

    if (containsBannedWordsOrPatterns(messageContent)) {
      setWarningMessage(
        '¡Advertencia! Este mensaje contiene información sensible o prohibida. Por favor, revisa el contenido. El intento de compartir contactos externos puede resultar en la suspensión de tu cuenta.'
      );
      setTimeout(() => setWarningMessage(null), 8000);
      return;
    }

    const tempMessage: MessagePrivate = {
      id: Date.now(),
      tempId: `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      user_id: currentUser!.id,
      contact_id: Number(recipientId),
      content: messageContent,
      attachment_url: attachedFile ? URL.createObjectURL(attachedFile) : undefined,
      read: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sender: currentUser!,
      status: 'sending',
    };

    setMessages((prev) => [...prev, tempMessage]);
    setNewMessage('');
    setAttachedFile(null);
    setShowEmojiPicker(false);
    setWarningMessage(null);

    const formData = new FormData();
    formData.append('user_id', String(currentUser?.id));
    formData.append('contact_id', String(recipientId));
    formData.append('content', messageContent || '');

    if (attachedFile) {
      formData.append('file', attachedFile);
    }

    try {
      const response = await fetch(`${API_URL}/auth/privatechat`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${currentUser?.token}`,
          Accept: 'application/json',
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('❌ Error de validación al enviar:', data);
        setMessages((prev) => prev.filter(msg => msg.tempId !== tempMessage.tempId));
        return;
      }
    } catch (error) {
      console.error('Error al enviar mensaje:', error);
      setMessages((prev) => prev.filter(msg => msg.tempId !== tempMessage.tempId));
    }
  };

  const displayMessages = isObservationMode ? observationMessages : messages;
  const displayLoading = isObservationMode ? observationLoading : loading;
  const displayError = isObservationMode ? observationError : null;

  if (displayLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white shadow-sm border-b flex items-center p-2"> {/* Añadimos flex y items-center */}
        {/* Botón de volver, visible solo en móvil para usuarios que no son admin */}
        {onBackToContacts && currentUser?.role_id !== 1 && (
          <button
            onClick={onBackToContacts}
            className="lg:hidden text-blue-500 hover:text-blue-600 mr-3 flex items-center"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <h2 className="text-lg font-semibold text-gray-800 flex-1"> {/* flex-1 para que el título ocupe el espacio restante */}
          {recipientData.name}
          {isObservationMode && (
             <span className="ml-2 px-2 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full">
               Observando
             </span>
          )}
        </h2>
      </div>

      <div className="flex-1 p-4 overflow-y-auto bg-gray-100">
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
          displayMessages.map((message) => {
            // Un mensaje es "mío" si el user_id del mensaje coincide con el currentUser.id
            const isMyMessage = String(message.user_id) === String(currentUser?.id);

            return (
              <div
                key={message.id}
                // Cambiamos la lógica: si es mío a la derecha, si no a la izquierda
                className={`flex mb-4 ${isMyMessage ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`
                    max-w-[75%]
                    md:max-w-md
                    lg:max-w-lg
                    px-4 py-2 rounded-2xl shadow-sm
                    ${isMyMessage ? 'bg-blue-500 text-white' : 'bg-white text-gray-800 border'}
                  `}
                >
                  {/* Solo mostrar el nombre del remitente si no es mi mensaje */}
                  {!isMyMessage && (
                    <div className="text-xs text-gray-500 mb-1">
                      {message.sender?.name || 'Usuario desconocido'}
                    </div>
                  )}

                  <div className="text-sm break-words whitespace-pre-wrap">
                    {message.content}
                  </div>
                  {message.attachment_url && (
                    <a
                      href={message.attachment_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`block mt-2 text-xs ${isMyMessage ? 'text-blue-100' : 'text-blue-500'} underline`}
                    >
                      Ver archivo adjunto
                    </a>
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

          <div className="flex items-end space-x-2">
            <div className="relative flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="text-gray-500 hover:text-blue-600 p-1 rounded-full transition-colors"
              >
                <Smile className="w-6 h-6" />
              </button>
              {showEmojiPicker && (
                <div className="absolute bottom-12 left-0 z-50">
                  <Picker data={data} onEmojiSelect={handleEmojiSelect} theme="light" />
                </div>
              )}
            </div>

            <label className="cursor-pointer text-gray-500 hover:text-blue-600 flex-shrink-0 p-1 rounded-full transition-colors">
              <Paperclip className="w-6 h-6" />
              <input type="file" hidden onChange={handleFileChange} />
            </label>

            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Escribe un mensaje..."
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:focus:ring-blue-500 min-w-0"
            />

            <button
              type="submit"
              className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg transition-colors flex-shrink-0"
              disabled={!newMessage.trim() && !attachedFile}
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          {attachedFile && (
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