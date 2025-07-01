// src/components/ChatBox/ChatBox.tsx
import React, { useEffect, useState, useRef } from 'react';
import { createReverbWebSocketService, EchoChannel } from '../../services/ReverbWebSocketService';
import { useAuth } from '../../contexts/AuthContext';

interface ChatBoxProps {
  roomId: string;
}

const ChatBox: React.FC<ChatBoxProps> = ({ roomId }) => {
  const API_URL = import.meta.env.VITE_API_URL;
  const { currentUser } = useAuth();
  const [messages, setMessages] = useState<{ sender: string; text: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [roomParticipantId, setRoomParticipantId] = useState<number | null>(null);
  // Nuevo estado para el mensaje de advertencia al usuario
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  const reverbServiceRef = useRef<any>(null);
  const chatChannelRef = useRef<EchoChannel | null>(null);

  // Inicializa o actualiza el servicio Reverb con el token
  useEffect(() => {
    if (currentUser?.token && !reverbServiceRef.current) {
      reverbServiceRef.current = createReverbWebSocketService(currentUser.token);
    } else if (currentUser?.token && reverbServiceRef.current) {
      reverbServiceRef.current.setToken(currentUser.token);
    }
  }, [currentUser]);

  // --- useEffect para OBTENER roomParticipantId (específico del chat) ---
  useEffect(() => {
    const fetchRoomParticipantId = async () => {
      if (!currentUser?.token || !roomId || !API_URL || !currentUser?.id) return;

      try {
        const url = `${API_URL}/auth/room-participant?user_id=${currentUser.id}&room_id=${roomId}`;

        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${currentUser.token}`,
            'Accept': 'application/json',
          },
        });

        const data = await response.json();

        if (response.ok && data?.id) {
          console.log('✅ ChatBox: room_participant_id obtenido:', data.id);
          setRoomParticipantId(data.id);
        } else {
          console.error('❌ ChatBox: No se encontró room_participant_id o error en la respuesta:', data);
        }
      } catch (err) {
        console.error('❌ ChatBox: Error al obtener room_participant_id:', err);
      }
    };

    fetchRoomParticipantId();
  }, [currentUser, roomId, API_URL]);

  // --- useEffect para SUSCRIBIRSE Y ESCUCHAR el CANAL de CHAT ---
  useEffect(() => {
    if (!roomId || !currentUser || !reverbServiceRef.current || roomParticipantId === null) {
      console.log("[ChatBox Init] Faltan datos para iniciar la suscripción al chat. Esperando...");
      return;
    }
    if (chatChannelRef.current) {
        console.log("[ChatBox Init] Canal de chat ya suscrito. No se suscribirá de nuevo.");
        return;
    }

    const reverbService = reverbServiceRef.current;
    const chatChannelName = `private-room.${roomId}`;
    let currentChatChannelInstance: EchoChannel | null = null;

    console.log(`[ChatBox Init] Intentando suscribirse al canal de chat privado: ${chatChannelName}`);

    reverbServiceRef.current.private(chatChannelName)
      .then((joinedChatChannel: EchoChannel) => {
        currentChatChannelInstance = joinedChatChannel;
        chatChannelRef.current = joinedChatChannel;
        console.log(`✅ [ChatBox Init] Suscrito correctamente al canal de chat: ${chatChannelName}`);

        joinedChatChannel.listen('messagecreated', (e: any) => {
          console.log('🎉 [ChatBox] Mensaje recibido por WebSocket:', e);
          const senderName = e.room_participant?.user?.name || `Participante ${e.room_participant_id}`;
          const messageText = e.content;

          setMessages(prevMessages => [...prevMessages, {
            sender: senderName,
            text: messageText,
          }]);
        });

        joinedChatChannel.error((error: any) => {
            console.error('❌ [ChatBox] Error en el canal de chat:', error);
        });

      })
      .catch(error => {
        console.error(`❌ [ChatBox Init] Falló la suscripción al canal de chat "${chatChannelName}":`, error);
        chatChannelRef.current = null;
      });

    return () => {
      if (currentChatChannelInstance) {
        console.log(`🔌 [ChatBox Cleanup] Desuscribiendo del canal de chat: ${chatChannelName}`);
        currentChatChannelInstance.leave();
      }
    };
  }, [roomId, currentUser, roomParticipantId]);

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
        console.warn(`[ChatBox] Mensaje bloqueado por palabra clave: ${keyword}`);
        return true;
      }
    }

    // Verificar patrones de números de teléfono
    for (const regex of phoneRegex) {
      if (regex.test(lowerCaseText)) {
        console.warn(`[ChatBox] Mensaje bloqueado por patrón de número de teléfono: ${text}`);
        return true;
      }
    }

    return false;
  };
  // --- Fin de la nueva función de validación ---

  // --- Función handleSendMessage ---
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !currentUser?.name || roomParticipantId === null || roomId === undefined) {
      console.warn("ChatBox: No se puede enviar el mensaje: chatInput, currentUser, roomParticipantId, o roomId faltan.");
      return;
    }

    // --- Llamada a la función de validación ---
    if (containsBannedWordsOrPatterns(chatInput.trim())) {
      setWarningMessage(
        '¡Advertencia! Este mensaje contiene información sensible o prohibida. El intento de compartir contactos externos puede resultar en la suspensión de tu cuenta.'
      );
      setTimeout(() => setWarningMessage(null), 8000); // El mensaje desaparece después de 8 segundos
      return; // Detener el envío del mensaje
    }
    // --- Fin de la validación ---

    const payload = {
      content: chatInput.trim(),
      room_participant_id: roomParticipantId,
      room_id: Number(roomId),
    };
    console.log('📤 ChatBox: Enviando mensaje con payload:', payload);

    try {
      const response = await fetch(`${API_URL}/auth/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${currentUser.token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok && data?.message_data) {
        console.log('✅ ChatBox: Mensaje enviado al backend:', data);
        setChatInput('');
        setWarningMessage(null); // Limpiar cualquier advertencia anterior
      } else {
        console.error('❌ ChatBox: Respuesta inesperada o error del backend al enviar mensaje:', data);
      }
    } catch (error) {
      console.error('❌ ChatBox: Error al enviar mensaje:', error);
    }
  };

  if (roomParticipantId === null) {
      return <div className="chat-loading p-4 text-center text-gray-500">Cargando chat...</div>;
  }

  return (
    <div className="chat-section border-l border-gray-700 bg-gray-900 flex flex-col w-4/4">
      <div className="chat-messages flex-1 overflow-y-auto p-4">
        {messages.map((msg, index) => (
          <div key={index} className="mb-2">
            <strong className="text-blue-400">{msg.sender}:</strong> {msg.text}
          </div>
        ))}
      </div>
      <form onSubmit={handleSendMessage} className="p-2 border-t border-gray-700 flex flex-col gap-2">
        {/* Mensaje de advertencia */}
        {warningMessage && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
            <strong className="font-bold">¡Cuidado! </strong>
            <span className="block sm:inline">{warningMessage}</span>
          </div>
        )}
        <div className="flex gap-2">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              className="flex-1 p-2 rounded bg-gray-800 text-white"
              placeholder="Escribe un mensaje..."
            />
            <button type="submit" className="bg-blue-600 px-4 py-2 rounded hover:bg-blue-700">
              Enviar
            </button>
        </div>
      </form>
    </div>
  );
};

export default ChatBox;