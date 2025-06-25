// imports
import React, { useState, useEffect, useRef } from 'react';
import { createReverbWebSocketService, EchoChannel } from '../../services/ReverbWebSocketService';
import { useAuth } from '../../contexts/AuthContext';
import { MessagePrivate, User } from '../../types';
import { Send, Clock, Paperclip, Smile } from 'lucide-react';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';

const API_URL = import.meta.env.VITE_API_URL;

interface ChatProps {
  recipientId: string;
  recipientData: User;
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

    // Actualiza el mensaje localmente
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId ? { ...msg, read: true } : msg
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
    const reverbService = createReverbWebSocketService(currentUser?.token);

    if (roomId) {
      reverbService
        .private(`room.${roomId}`)
        .then((chann) => {
          channel = chann;
          channel.listen('.messagecreated', (data: any) => {
            const msg: MessagePrivate = data.message;
            setMessages((prev) => [...prev, msg]);
          });
        })
        .catch((err) => console.error('❌ Error canal:', err));

      return () => {
        if (channel) channel.leave();
      };
    }
  }, [currentUser, recipientId, roomId]);

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

const sendMessage = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!newMessage.trim() && !attachedFile) return;

  const formData = new FormData();
  formData.append('user_id', currentUser?.id);        // antes: sender_id
  formData.append('contact_id', recipientId);         // antes: receiver_id
  formData.append('content', newMessage.trim() || '');

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
    console.error('❌ Error de validación:', data);
    return;
  }

  if (data?.data) {
    setMessages((prev) => [...prev, data.data]);
    setNewMessage('');
    setAttachedFile(null);
  }
} catch (error) {
  console.error('Error al enviar mensaje:', error);
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
       {messages.map((message) => {
  const isOwnMessage = message.user_id === currentUser?.id;
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
            {sender?.name}
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
          {isOwnMessage && (
            <span className="ml-1">
              {message.read ? (
                <span className="text-xs text-blue-100">✓✓</span>
              ) : (
                <Clock className="w-3 h-3 text-blue-100" />
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
})}

       
        <div ref={messagesEndRef}></div>
      </div>

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
