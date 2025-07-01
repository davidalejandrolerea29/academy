// src/components/Messaging/Chat.tsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createReverbWebSocketService, EchoChannel } from '../../services/ReverbWebSocketService';
import { useAuth } from '../../contexts/AuthContext';
import { MessagePrivate, User } from '../../types';
import { Send, Clock, Paperclip, Smile, Check, CheckCheck } from 'lucide-react';
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
}

const Chat: React.FC<ChatProps> = ({
  recipientId,
  recipientData,
  isObservationMode = false,
  observationMessages = [],
  observationLoading = false,
  observationError = null,
}) => {
  const { currentUser } = useAuth();
  const [messages, setMessages] = useState<MessagePrivate[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  // Nuevo estado para el mensaje de advertencia al usuario
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Mark messages as read (solo para usuarios NO admin)
  const markMessageAsRead = async (messageId: number) => {
    if (isObservationMode) return;

    console.log('Marcando mensaje como leído...');
    try {
      await fetch(`${API_URL}/auth/privatechat/${messageId}/read`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${currentUser?.token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      });

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId ? { ...msg, read: true, status: 'read' } : msg
        )
      );
    } catch (error) {
      console.error('Error al marcar mensaje como leído:', error);
    }
  };

  useEffect(() => {
    if (isObservationMode) return;

    const unreadMessages = messages.filter(
      (m) => String(m.user_id) === recipientId && !m.read
    );

    if (unreadMessages.length > 0) {
      unreadMessages.forEach((msg) => markMessageAsRead(msg.id));
    }
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

  // --- Nueva función de validación de mensajes ---
  const containsBannedWordsOrPatterns = (text: string): boolean => {
    const lowerCaseText = text.toLowerCase();

    // Palabras clave
    const bannedKeywords = [
      'whatsapp',
      'telegram',
      'numero', // cubre 'número' también
      'nro',
      'hablame',
      'llama',
      'contacto',
      'por fuera',
      'clases privadas', // Para capturar frases
      'mi cel', // Mi celular
      'mi tel', // Mi teléfono
      '+54', // Prefijo de Argentina
    ];

    // Expresiones Regulares para números de teléfono
    // Adaptar esto a los formatos de números en Argentina o los esperados
    const phoneRegex = [
        /\b\d{2}\s?\d{4}[-\s]?\d{4}\b/, // Ej: 11 4567 8901, 11-4567-8901, 1145678901 (para 10 dígitos)
        /\b\d{3}[-\s]?\d{3}[-\s]?\d{4}\b/, // Ej: 221-555-1234 (para 10 dígitos)
        /\b(?:\+?54)?(?:\s*\d{2,4}){2,3}\s*\d{6,8}\b/, // Patrón más flexible para números argentinos con o sin prefijo de país. Ej: +54 9 11 5555-1234, 11 5555 1234
        /\b\d{7,10}\b/ // Para números de 7 a 10 dígitos consecutivos
    ];

    // Verificar palabras clave
    for (const keyword of bannedKeywords) {
      if (lowerCaseText.includes(keyword)) {
        console.warn(`Mensaje bloqueado por palabra clave: ${keyword}`);
        return true;
      }
    }

    // Verificar patrones de números de teléfono
    for (const regex of phoneRegex) {
      if (regex.test(lowerCaseText)) {
        console.warn(`Mensaje bloqueado por patrón de número de teléfono: ${text}`);
        return true;
      }
    }

    return false;
  };
  // --- Fin de la nueva función de validación ---


  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isObservationMode) return;

    const messageContent = newMessage.trim();
    if (!messageContent && !attachedFile) return;

    // --- Llamada a la función de validación ---
    if (containsBannedWordsOrPatterns(messageContent)) {
      setWarningMessage(
        '¡Advertencia! Este mensaje contiene información sensible o prohibida. Por favor, revisa el contenido. El intento de compartir contactos externos puede resultar en la suspensión de tu cuenta.'
      );
      // Opcional: podrías poner un timeout para que el mensaje desaparezca
      setTimeout(() => setWarningMessage(null), 8000); // El mensaje desaparece después de 8 segundos
      return; // Detener el envío del mensaje
    }
    // --- Fin de la validación ---


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
    setWarningMessage(null); // Limpiar cualquier advertencia anterior

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
      <div className="bg-white shadow-sm p-4 border-b">
        <h2 className="text-lg font-semibold text-gray-800">
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
            const isTargetRecipient = String(message.user_id) === String(recipientId);

            return (
              <div
                key={message.id}
                className={`flex mb-4 ${isTargetRecipient ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs md:max-w-md lg:max-w-lg px-4 py-2 rounded-2xl shadow-sm ${
                    isTargetRecipient ? 'bg-blue-500 text-white' : 'bg-white text-gray-800 border'
                  }`}
                >
                  <div className="text-xs text-gray-500 mb-1">
                    {message.sender?.name || 'Usuario desconocido'}
                  </div>

                  <div className="text-sm break-words whitespace-pre-wrap">
                    {message.content}
                  </div>
                  {message.attachment_url && (
                    <a
                      href={message.attachment_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block mt-2 text-xs text-blue-200 underline"
                    >
                      Ver archivo adjunto
                    </a>
                  )}
                  <div className="flex items-center justify-end mt-1">
                    <span className={`text-xs ${isTargetRecipient ? 'text-blue-100' : 'text-gray-400'}`}>
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
          {/* Mensaje de advertencia */}
          {warningMessage && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-3" role="alert">
              <strong className="font-bold">¡Cuidado! </strong>
              <span className="block sm:inline">{warningMessage}</span>
            </div>
          )}

          <div className="flex items-center space-x-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="text-gray-500 hover:text-blue-600"
              >
                <Smile className="w-6 h-6" />
              </button>
              {showEmojiPicker && (
                <div className="absolute bottom-12 left-0 z-50">
                  <Picker data={data} onEmojiSelect={handleEmojiSelect} theme="light" />
                </div>
              )}
            </div>

            <label className="cursor-pointer text-gray-500 hover:text-blue-600">
              <Paperclip className="w-6 h-6" />
              <input type="file" hidden onChange={handleFileChange} />
            </label>

            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Escribe un mensaje..."
              className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <button
              type="submit"
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
              disabled={!newMessage.trim() && !attachedFile}
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          {attachedFile && (
            <div className="mt-2 text-xs text-gray-500">
              Archivo seleccionado: <strong>{attachedFile.name}</strong>
            </div>
          )}
        </form>
      )}
    </div>
  );
};

export default Chat;