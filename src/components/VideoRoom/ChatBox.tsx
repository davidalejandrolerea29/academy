// src/components/ChatBox/ChatBox.tsx
import React, { useEffect, useState, useRef } from 'react';
import { createReverbWebSocketService, EchoChannel } from '../../services/ReverbWebSocketService';
import { useAuth } from '../../contexts/AuthContext';

interface ChatBoxProps {
  roomId: string;
  // Puedes pasar otras props si son necesarias, por ejemplo, si quisieras
  // que el chat solo se mostrara para ciertos roles.
}

const ChatBox: React.FC<ChatBoxProps> = ({ roomId }) => {
  const API_URL = import.meta.env.VITE_API_URL;
  const { currentUser } = useAuth(); // Necesitas el token y el nombre del usuario
  const [messages, setMessages] = useState<{ sender: string; text: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [roomParticipantId, setRoomParticipantId] = useState<number | null>(null);

  const reverbServiceRef = useRef<any>(null); // Usamos 'any' si tu tipo no es completo, o EchoChannel
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
        // Esta es la ruta que tu backend espera para obtener el room_participant_id
        // usando QUERY PARAMETERS: user_id y room_id
        const url = `${API_URL}/auth/room-participant?user_id=${currentUser.id}&room_id=${roomId}`;

        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${currentUser.token}`,
            'Accept': 'application/json',
          },
        });

        const data = await response.json();

        if (response.ok && data?.id) { // Asegúrate de que tu backend devuelve 'id'
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
  }, [currentUser, roomId, API_URL]); // Dependencias para re-ejecutar si cambian

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
    const chatChannelName = `private-room.${roomId}`; // Este es el nombre EXACTO que Laravel usa
    let currentChatChannelInstance: EchoChannel | null = null;

    console.log(`[ChatBox Init] Intentando suscribirse al canal de chat privado: ${chatChannelName}`);


    // ...
    // CAMBIA ESTA LÍNEA:
    reverbServiceRef.current.private(chatChannelName)
      .then((joinedChatChannel: EchoChannel) => {
        currentChatChannelInstance = joinedChatChannel;
        chatChannelRef.current = joinedChatChannel;
        console.log(`✅ [ChatBox Init] Suscrito correctamente al canal de chat: ${chatChannelName}`);

        // Escuchar el evento 'messagecreated' (el que emite tu backend de Laravel)
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
  }, [roomId, currentUser, roomParticipantId]); // roomParticipantId como dependencia para asegurar que exista

  // --- Función handleSendMessage ---
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !currentUser?.name || roomParticipantId === null || roomId === undefined) {
      console.warn("ChatBox: No se puede enviar el mensaje: chatInput, currentUser, roomParticipantId, o roomId faltan.");
      return;
    }

    const payload = {
      content: chatInput.trim(),
      room_participant_id: roomParticipantId,
      room_id: Number(roomId),
    };
    console.log('📤 ChatBox: Enviando mensaje con payload:', payload);

    try {
      // ¡¡¡RESTAURA ESTAS LÍNEAS!!!
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
        // Añadir el mensaje localmente para el remitente
        // setMessages(prev => [...prev, {
        //   sender: currentUser.name,
        //   text: chatInput.trim(),
        // }]);
        setChatInput('');
      } else {
        console.error('❌ ChatBox: Respuesta inesperada o error del backend al enviar mensaje:', data);
      }
    } catch (error) {
      console.error('❌ ChatBox: Error al enviar mensaje:', error);
    }
  };

  if (roomParticipantId === null) {
      // Opcional: Mostrar un loader o mensaje mientras se obtiene el roomParticipantId
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
      <form onSubmit={handleSendMessage} className="p-2 border-t border-gray-700 flex gap-2">
        <input
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          className="flex-1 p-2 rounded bg-gray-800 text-white"
          placeholder="Escribe un mensaje..."
        />
        <button type="submit" className="bg-blue-600 px-4 py-2 rounded hover:bg-blue-700">
          Enviar
        </button>
      </form>
    </div>
  );
};

export default ChatBox;