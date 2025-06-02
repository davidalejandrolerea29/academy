import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase'; // ajusta según tu ruta
import { useAuth } from '../../contexts/AuthContext';
import { Message, User } from '../../types';
import { Send, Clock } from 'lucide-react';

interface ChatProps {
  recipientId: string;
  recipientData: User;
}

const Chat: React.FC<ChatProps> = ({ recipientId, recipientData }) => {
  const { currentUser } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!currentUser?.id || !recipientId) return;

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${recipientId}),and(sender_id.eq.${recipientId},receiver_id.eq.${currentUser.id})`)
        .order('timestamp', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
        return;
      }

      setMessages(data || []);
      setLoading(false);

      // Marcar como leídos
      const unread = (data || []).filter(
        (msg) => msg.receiver_id === currentUser.id && !msg.read
      );
      for (const msg of unread) {
        await supabase.from('messages').update({ read: true }).eq('id', msg.id);
      }
    };

    fetchMessages();

    const channel = supabase
      .channel('chat')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const msg = payload.new as Message;
          if (
            (msg.sender_id === currentUser.id && msg.receiver_id === recipientId) ||
            (msg.sender_id === recipientId && msg.receiver_id === currentUser.id)
          ) {
            setMessages((prev) => [...prev, msg]);

            // Marcar como leído si es para mí
            if (msg.receiver_id === currentUser.id && !msg.read) {
              supabase.from('messages').update({ read: true }).eq('id', msg.id);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser, recipientId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUser) return;

    const { error } = await supabase.from('messages').insert([
      {
        sender_id: currentUser.id,
        receiver_id: recipientId,
        content: newMessage,
        read: false,
        participants: [currentUser.id, recipientId],
      },
    ]);

    if (error) {
      console.error('Error sending message:', error);
    } else {
      setNewMessage('');
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });
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
          {recipientData.display_name}
        </h2>
        <span className="text-sm text-gray-500">
          {recipientData.role === 'teacher' ? 'Profesor' :
            recipientData.role === 'alumno' ? 'Alumno' : 'Administrador'}
        </span>
      </div>

      <div className="flex-1 p-4 overflow-y-auto bg-gray-50">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <p>No hay mensajes. ¡Envía el primero!</p>
          </div>
        ) : (
          messages.map((message) => {
            const isOwnMessage = message.sender_id === currentUser?.id;
            return (
              <div
                key={message.id}
                className={`flex mb-4 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs md:max-w-md lg:max-w-lg px-4 py-2 rounded-lg ${isOwnMessage
                    ? 'bg-blue-500 text-white'
                    : 'bg-white text-gray-800 border border-gray-200'
                    }`}
                >
                  <div className="text-sm">{message.content}</div>
                  <div className="flex items-center justify-end mt-1">
                    <span className={`text-xs ${isOwnMessage ? 'text-blue-100' : 'text-gray-500'}`}>
                      {formatTime(message.timestamp)}
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
          })
        )}
        <div ref={messagesEndRef}></div>
      </div>

      <form onSubmit={sendMessage} className="p-4 bg-white border-t">
        <div className="flex">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Escribe un mensaje..."
            className="flex-1 border border-gray-300 rounded-l-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-r-md flex items-center transition-colors"
            disabled={!newMessage.trim()}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </form>
    </div>
  );
};

export default Chat;
