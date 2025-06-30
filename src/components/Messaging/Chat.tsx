// imports
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createReverbWebSocketService, EchoChannel } from '../../services/ReverbWebSocketService';
import { useAuth } from '../../contexts/AuthContext';
import { MessagePrivate, User } from '../../types';
import { Send, Clock, Paperclip, Smile, Check, CheckCheck } from 'lucide-react'; // Agrega Check y CheckCheck
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';

const API_URL = import.meta.env.VITE_API_URL;

interface ChatProps {
  recipientId: string;
  recipientData: User;
}
// En la interfaz MessagePrivate (en types.ts, o donde la tengas):
interface MessagePrivate {
  id: number; // ID del backend
  user_id: number;
  contact_id: number;
  content: string;
  attachment_url?: string;
  read: boolean;
  created_at: string;
  updated_at: string;
  sender?: User;
  // Agrega esto para mensajes provisionales en el frontend
  tempId?: string; // ID temporal para el frontend, para mensajes que aún no tienen ID de DB
  status?: 'sending' | 'sent' | 'read'; // Nuevo estado para controlar las palomitas
}
const Chat: React.FC<ChatProps> = ({ recipientId, recipientData }) => {
  const { currentUser } = useAuth();
  const [messages, setMessages] = useState<MessagePrivate[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const markMessageAsRead = async (messageId: number) => {
  console.log('estoy andando como leido')
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
        msg.id === messageId ? { ...msg, read: true, status: 'read' } : msg // <-- AGREGADO: status: 'read'
      )
    );
  } catch (error) {
    console.error('Error al marcar mensaje como leído:', error);
  }
};
useEffect(() => {
  const unreadMessages = messages.filter(
    (m) => m.user_id === recipientId && !m.read
  );

  if (unreadMessages.length > 0) {
    unreadMessages.forEach((msg) => markMessageAsRead(msg.id));
  }
}, [messages, recipientId]);

  const roomId = currentUser && recipientId
    ? [currentUser.id, recipientId].sort().join('-')
    : null;
   // Dentro de Chat.tsx
const handleNewMessage = useCallback((data: any) => {
  console.log('📬 Chat: Mensaje recibido vía WebSocket:', data);
  const receivedMsg: MessagePrivate = data.message;

  setMessages((prev) => {
    // Es un mensaje que yo envié si el user_id coincide.
    const isOwnMessageReceived = String(receivedMsg.user_id) === String(currentUser?.id);

    // Si es un mensaje que yo envié, busco si ya tengo un provisional para reemplazar.
    if (isOwnMessageReceived) {
      // Buscamos un mensaje provisional por su contenido y user_id.
      // Opcionalmente, puedes buscar por un tempId si lo pasas de vuelta desde el backend,
      // pero usualmente el backend no lo devuelve.
      const tempMessageIndex = prev.findIndex(
        (msg) => msg.tempId && msg.content === receivedMsg.content && String(msg.user_id) === String(receivedMsg.user_id)
      );

      if (tempMessageIndex > -1) {
        // Encontrado un mensaje provisional, lo reemplazamos con el mensaje real del backend.
        const updatedMessages = [...prev];
        updatedMessages[tempMessageIndex] = {
          ...receivedMsg,
          // Mantén el status 'sent' o 'read' basado en el 'read' del backend
          status: receivedMsg.read ? 'read' : 'sent',
          tempId: undefined, // Limpiamos el tempId ya que ahora es un mensaje real
        };
        console.log('🔄 Chat: Mensaje provisional reemplazado:', receivedMsg.id);
        return updatedMessages;
      } else {
        // Caso de que sea un mensaje mío pero no encontré un provisional para reemplazar.
        // Esto puede pasar si se recargó la página o si el tempId no coincidió.
        // En este caso, lo tratamos como un mensaje nuevo para evitar perderlo.
        // También podemos revisar si ya existe un mensaje con el mismo ID definitivo.
        if (prev.some(msg => msg.id === receivedMsg.id)) {
          console.warn('Chat: Mensaje recibido con ID existente, ignorando para evitar duplicados:', receivedMsg.id);
          return prev; // Ya existe, no lo añades de nuevo
        }
        console.log('➕ Chat: Añadiendo mensaje propio (no provisional) como nuevo:', receivedMsg.id);
        return [...prev, { ...receivedMsg, status: receivedMsg.read ? 'read' : 'sent' }];
      }
    } else {
      // Si es un mensaje de otro usuario, simplemente lo añadimos si no existe ya por ID
      if (prev.some(m => m.id === receivedMsg.id)) {
        console.warn('Chat: Mensaje de otro usuario con ID existente, ignorando:', receivedMsg.id);
        return prev;
      }
      console.log('➕ Chat: Añadiendo mensaje de otro usuario como nuevo:', receivedMsg.id);
      return [...prev, { ...receivedMsg, status: receivedMsg.read ? 'read' : 'sent' }];
    }
  });
}, [currentUser]); // currentUser es una dependencia porque lo usas para isOwnMessageReceived
  useEffect(() => {
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
    // Asegúrate de que reverbService se obtenga solo una vez por mount
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

          // Usa el callback memorizado aquí
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
  }, [currentUser, recipientId, roomId, handleNewMessage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);


 const handleEmojiSelect = (emoji: any) => {
  setNewMessage((prev) => prev + emoji.native);
  setShowEmojiPicker(false); // <- Esto lo oculta automáticamente
};

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setAttachedFile(e.target.files[0]);
    }
  };

// Chat.tsx (solo la función sendMessage)

const sendMessage = async (e: React.FormEvent) => {
  e.preventDefault();
  const messageContent = newMessage.trim();
  if (!messageContent && !attachedFile) return;

  // 1. Crear un mensaje provisional para mostrarlo inmediatamente
  const tempMessage: MessagePrivate = {
    id: Date.now(), // Usamos un timestamp como ID temporal
    tempId: `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, // Un ID único temporal
    user_id: currentUser!.id, // El ID del usuario actual
    contact_id: Number(recipientId),
    content: messageContent,
    attachment_url: attachedFile ? URL.createObjectURL(attachedFile) : undefined, // URL temporal para la visualización del archivo
    read: false, // Por defecto no leído
    created_at: new Date().toISOString(), // Fecha actual
    updated_at: new Date().toISOString(),
    sender: currentUser!, // Se envía a sí mismo
    status: 'sending', // Estado inicial
  };

  setMessages((prev) => [...prev, tempMessage]); // Agrega el mensaje provisional a la UI
  setNewMessage('');
  setAttachedFile(null);
  setShowEmojiPicker(false); // Oculta el picker

  const formData = new FormData();
  formData.append('user_id', String(currentUser?.id)); // Asegúrate de que los IDs son strings si el backend los espera así
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
      // Opcional: Remover el mensaje provisional o marcarlo como error
      setMessages((prev) => prev.filter(msg => msg.tempId !== tempMessage.tempId));
      return;
    }

    // El mensaje exitoso será manejado por el WebSocket, no necesitamos setearlo aquí.
    // La actualización del estado 'sent' o 'read' también la manejará el WebSocket.
    
    // Si quieres actualizar el estado a 'sent' antes de que llegue por WebSocket, podrías hacer:
    // setMessages((prev) =>
    //   prev.map((msg) =>
    //     msg.tempId === tempMessage.tempId ? { ...data.data, status: 'sent' } : msg
    //   )
    // );

  } catch (error) {
    console.error('Error al enviar mensaje:', error);
    // Remover el mensaje provisional o marcarlo como error
    setMessages((prev) => prev.filter(msg => msg.tempId !== tempMessage.tempId));
  }
};



 if (loading) {
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
        </h2>
        <span className="text-sm text-gray-500 capitalize">
          {recipientData.role_id}
        </span>
      </div>

      <div className="flex-1 p-4 overflow-y-auto bg-gray-100">
        {/* Aquí va el cambio para mostrar el mensaje si no hay mensajes */}
        {messages.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 text-center">
            <p className="text-lg font-semibold mb-2">¡Es hora de conectar!</p>
            <p className="text-sm">Envía tu primer mensaje para iniciar la conversación.</p>
          </div>
        ) : (
          // Si hay mensajes, los mapeamos como antes
          messages.map((message) => {
            const isOwnMessage = String(message.user_id) === String(currentUser?.id);
            const sender = message.sender;

            return (
              <div
                key={message.id}
                className={`flex mb-4 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs md:max-w-md lg:max-w-lg px-4 py-2 rounded-2xl shadow-sm ${
                    isOwnMessage ? 'bg-blue-500 text-white' : 'bg-white text-gray-800 border'
                  }`}
                >
                  {!isOwnMessage && (
                    <div className="text-xs text-gray-500 mb-1">
                      {sender?.name || 'Usuario desconocido'}
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
                      className="block mt-2 text-xs text-blue-200 underline"
                    >
                      Ver archivo adjunto
                    </a>
                  )}
                  <div className="flex items-center justify-end mt-1">
                    <span className={`text-xs ${isOwnMessage ? 'text-blue-100' : 'text-gray-400'}`}>
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

      {/* ... (tu formulario de envío de mensaje existente) */}
      <form onSubmit={sendMessage} className="p-4 bg-white border-t">
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
    </div>
  );
};

export default Chat;