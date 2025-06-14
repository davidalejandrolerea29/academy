// src/components/VideoRoom/VideoRoom.tsx

import React, { useEffect, useRef, useState } from 'react';
import { createReverbWebSocketService, EchoChannel } from '../../services/ReverbWebSocketService'; // Ruta correcta
import { useParams, useNavigate } from 'react-router-dom'; // Importa useNavigate
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Room } from '../../types';
import { useMicVolume } from '../../hooks/useMicVolume';

import { Video, VideoOff, Mic, MicOff, ScreenShare, StopCircle, MessageSquare, PhoneOff } from 'lucide-react';

const VideoRoom: React.FC = () => {
  const API_URL = import.meta.env.VITE_API_URL;
  const token = localStorage.getItem('token');
  const navigate = useNavigate(); // Hook para la navegación

  const { roomId } = useParams<{ roomId: string }>();
  const { currentUser } = useAuth();
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTeacher, setIsTeacher] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [messages, setMessages] = useState<{ sender: string; text: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [peerConnections, setPeerConnections] = useState<Record<string, RTCPeerConnection>>({});

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  // --- AQUI ESTABA LA DOBLE DECLARACION. MANTENEMOS ESTA Y ELIMINAMOS LA OTRA ---
  const [channel, setChannel] = useState<EchoChannel | null>(null); // SOLO ESTA DECLARACION
  // --- FIN DE LA CORRECCION ---

  const [participants, setParticipants] = useState<Record<string, { name: string }>>({});
  const [micEnabled, setMicEnabled] = useState(true);
  const [volume, setVolume] = useState(0); // Este 'volume' parece ser el que calculas manualmente
  const [videoEnabled, setVideoEnabled] = useState(true);
  const volume2 = useMicVolume(localStream); // Usa tu hook useMicVolume

  // ... (Tus funciones toggleVideo, toggleMic, toggleScreenShare son correctas) ...

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const msg = { sender: currentUser.name, text: chatInput };
    setMessages(prev => [...prev, msg]);
    setChatInput('');

    channel?.whisper('chat-message', msg);
  };

  useEffect(() => {
    // Escucha whispers solo si el canal ya está establecido
    if (channel) {
      channel.listenForWhisper('chat-message', (msg) => {
        setMessages(prev => [...prev, msg]);
      });
    }
  }, [channel]); // Asegúrate de que este useEffect se re-ejecute cuando 'channel' cambie


  const endCall = () => {
    localStream?.getTracks().forEach(track => track.stop());
    Object.values(peerConnections).forEach(pc => pc.close());
    setParticipants({});
    setMessages([]);
    setIsRecording(false);

    channel?.leave(); // Llama a leave si el canal existe
    navigate('/rooms');
  };

  useEffect(() => {
    if (!localStream) return;
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const microphone = audioContext.createMediaStreamSource(localStream);
    microphone.connect(analyser);

    analyser.fftSize = 512;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const updateVolume = () => {
      analyser.getByteFrequencyData(dataArray);
      let values = 0;
      for (let i = 0; i < dataArray.length; i++) {
        values += dataArray[i];
      }
      const average = values / dataArray.length;
      setVolume(average);
      requestAnimationFrame(updateVolume);
    };
    updateVolume();
    return () => {
      analyser.disconnect();
      microphone.disconnect();
      audioContext.close();
    };
  }, [localStream]);

  useEffect(() => {
    console.log('🔄 Lista de participantes actualizada:', participants);
  }, [participants]);

  const sendSignal = (toId: string, data: any) => {
    if (!channel) {
      console.warn("Cannot send signal: channel is not ready.");
      return;
    }
    channel.whisper('Signal', {
      to: toId,
      from: currentUser.id, // Asegúrate de que currentUser.id esté disponible aquí
      data,
    });
  };

  // --- useEffect PRINCIPAL PARA LA CONEXION A REVERB ---
  useEffect(() => {
    console.log("current user", currentUser);
    if (!roomId || !currentUser) return;

    const reverbService = createReverbWebSocketService(currentUser.token);
    let currentChannel: EchoChannel | null = null; // Usamos un nombre diferente para evitar confusiones con el estado
    console.log("se actualizo al componente nuevo")
    reverbService.join(`video-room.${roomId}`)
      .then((joinedChannel: EchoChannel) => {
        currentChannel = joinedChannel; // Asigna el canal a la variable local
        setChannel(joinedChannel); // Actualiza el estado del canal
        console.log("Canal obtenido y estado actualizado:", joinedChannel);

        joinedChannel.subscribed(() => {
          console.log("✅ Suscrito correctamente al canal video room.");
          joinedChannel.whisper('user-joined', {
            id: currentUser.id,
            name: currentUser.name,
          });
        });

        joinedChannel.error((err: any) => {
          console.error("❌ Error en canal de video-room:", err);
        });

        joinedChannel.listenForWhisper('user-joined', async ({ id, name }: { id: string; name: string }) => {
          console.log('[user-joined] recibido:', { id, name });
          if (id === currentUser.id) return;

          setParticipants((prev) => {
            if (prev[id]) {
              console.log(`[user-joined] Usuario ${id} ya está en la lista de participantes.`);
              return prev;
            }
            const updated = { ...prev, [id]: { name } };
            console.log('[user-joined] Añadiendo nuevo participante:', updated);
            return updated;
          });

          // Crear nueva conexión para este usuario remoto
          const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
          localStream?.getTracks().forEach(track => pc.addTrack(track, localStream));

          pc.onicecandidate = (event) => {
            if (event.candidate) {
              // Asegúrate de que sendSignal acepte 'id' como primer argumento
              sendSignal(id, { type: 'candidate', candidate: event.candidate });
            }
          };

          pc.ontrack = (event) => {
            // Aquí deberías manejar video remoto de ese participante
            // Puedes necesitar un useRef o un mapa de refs para cada video remoto
            // console.log("Remote stream received:", event.streams[0]);
          };

          pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
              console.log(`RTC PeerConnection for ${id} disconnected or failed.`);
              pc.close();
              setPeerConnections(prev => {
                const copy = { ...prev };
                delete copy[id];
                return copy;
              });
              setParticipants(prev => {
                const copy = { ...prev };
                delete copy[id];
                return copy;
              });
            }
          };
          setPeerConnections(prev => ({ ...prev, [id]: pc }));

          // El que se une no inicia llamada, pero si soy yo el admin u originador, iniciaría oferta
          // Esta lógica de `isTeacher` debería estar bien si controla quién inicia la oferta
          // Ten cuidado con el `pc` aquí. Necesitas el `pc` específico para el `id` recibido.
          // El `pc` recién creado es para la conexión con el `id` que se acaba de unir.
          // Si `isTeacher` es quien inicia la oferta, entonces el `pc` debe ser el asociado a ese `id`.
          if (isTeacher) {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            sendSignal(id, { type: 'offer', sdp: offer.sdp });
          }
        });

        joinedChannel.listenForWhisper('Signal', async ({ to, from, data }: { to: string; from: string; data: any }) => {
          console.log('[Signal] recibido:', { to, from, data });
          if (to !== currentUser.id) return;

          let pc = peerConnections[from];
          // Si el PC no existe, lo creamos (esto puede pasar si se reciben señales antes de que el 'user-joined' complete la creación del PC)
          if (!pc) {
              pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
              localStream?.getTracks().forEach(track => pc.addTrack(track, localStream));
              pc.onicecandidate = (event) => {
                  if (event.candidate) {
                      sendSignal(from, { type: 'candidate', candidate: event.candidate });
                  }
              };
              pc.ontrack = (event) => {
                  // Manejar remote track
              };
              pc.onconnectionstatechange = () => {
                  if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                      pc.close();
                      setPeerConnections(prev => {
                          const copy = { ...prev };
                          delete copy[from];
                          return copy;
                      });
                      setParticipants(prev => {
                          const copy = { ...prev };
                          delete copy[from];
                          return copy;
                      });
                  }
              };
              setPeerConnections(prev => ({ ...prev, [from]: pc }));
          }

          switch (data.type) {
            case 'offer':
              await pc.setRemoteDescription(new RTCSessionDescription(data));
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              sendSignal(from, { type: 'answer', sdp: answer.sdp });
              break;
            case 'answer':
              await pc.setRemoteDescription(new RTCSessionDescription(data));
              break;
            case 'candidate':
              // Asegúrate de que data.candidate sea un objeto RTCIceCandidateInit
              if (data.candidate && (pc.remoteDescription || data.candidate.sdpMid)) { // Solo añadir si hay remoteDescription o sdpMid/sdpMLineIndex para evitar errores
                 await pc.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(e => console.error("Error adding ICE candidate:", e, data.candidate));
              }
              break;
          }
        });

        // Asegúrate que 'UserLeft' sea un evento normal, no un whisper, si es de Laravel.
        // Si es un whisper, debería ser listenForWhisper.
        // Asumo que Laravel emite 'UserLeft' como un evento normal del canal.
        joinedChannel.listen('UserLeft', ({ id }: { id: string }) => {
          console.log('[UserLeft] Usuario salió:', id);
          setParticipants((prev) => {
            const updated = { ...prev };
            delete updated[id];
            console.log('[UserLeft] Participantes después de salir:', updated);
            return updated;
          });
          // Cerrar la PeerConnection asociada si existe
          setPeerConnections(prev => {
              const copy = { ...prev };
              if (copy[id]) {
                  copy[id].close();
                  delete copy[id];
              }
              return copy;
          });
        });

      })
      .catch(error => {
        console.error("❌ Error al unirse al canal video-room:", error);
        setChannel(null);
      });

    // Función de limpieza para el useEffect
    return () => {
      if (currentChannel) { // Usa la variable local 'currentChannel' para limpiar
        currentChannel.leave();
      }
      // NO LLAMES a reverbService.disconnect() aquí si hay otros componentes que lo usan.
      // Si este es el único lugar donde se usa el servicio, y quieres que se desconecte,
      // entonces considera tener un contexto o un manejo más global.
      // setChannel(null); // Esto ya se hace en endCall o en el catch.
      // setParticipants([]); // Esto ya se hace en endCall.
    };
  }, [roomId, currentUser, localStream, peerConnections, isTeacher, sendSignal, navigate]); // Añade dependencias que faltan y son necesarias.

  useEffect(() => {
    const startMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        console.log('Local stream tracks:', stream.getTracks());
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Error al acceder a los medios:", err);
      }
    };
    startMedia();
  }, []); // Se ejecuta solo una vez al montar el componente.


  const toggleRecording = async () => {
    if (!room || !isTeacher) return;
    try {
      const newRecordingState = !isRecording;
      await supabase
        .from('rooms')
        .update({ is_recording: newRecordingState })
        .eq('id', room.id);
      setIsRecording(newRecordingState);
    } catch (err) {
      console.error('Error toggling recording:', err);
    }
  };

  // Esta función `createConnection` y las funciones `handleOffer`, `handleAnswer`, `handleCandidate`
  // parecen ser remanentes de una lógica P2P más simple.
  // Tu lógica actual de WebRTC está en el useEffect principal, dentro de los listeners de 'user-joined' y 'Signal'.
  // Si estas funciones no se están utilizando, podrías eliminarlas para evitar confusiones.
  // Asumo que 'peerConnection' es un estado que ya no usas, ya que tienes 'peerConnections' (plural).

  // const createConnection = async () => { /* ... */ };
  // const startCall = async () => { /* ... */ };
  // const handleOffer = async (data: any) => { /* ... */ };
  // const handleAnswer = async (data: any) => { /* ... */ };
  // const handleCandidate = async (data: any) => { /* ... */ };

  // --- Función sendSignal (la que realmente usas en los listeners) ---
  // Asegúrate de que esta función esté definida antes de ser utilizada en el useEffect.
  // Lo más seguro es definirla usando `useCallback` o dentro del `useEffect` principal.
  // Para simplificar, la dejaré como una función normal aquí, pero considera `useCallback`
  // si esto causa problemas de re-renderizado excesivo en componentes hijos.

  // ... (Tus condicionales de loading, error, room son correctas, las omití para brevedad) ...

  return (
    <div className="flex h-screen bg-black text-white">
      {/* Videollamada principal */}
      <div className="flex flex-col flex-1 relative">

        {/* Grid de videos */}
       <div className="flex-1 flex items-center justify-center bg-gray-950">
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-6xl p-4">

    {/* Video local */}
    <div className="relative rounded-xl overflow-hidden border border-gray-700 shadow-lg aspect-video bg-black">
      <video ref={localVideoRef} autoPlay muted className="w-full h-full object-cover" />
      <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 px-3 py-1 text-sm rounded text-white">
        Tú
      </div>
       {micEnabled && (
   <div className="absolute top-2 right-2 flex gap-[2px] items-end h-6">
    {Array.from({ length: 5 }).map((_, i) => {
      const level = (volume2 / 255) * 5;
      const barHeight = i < level ? (i + 1) * 4 : 2;
      return (
        <div
  key={i}
  className="w-1 bg-white transition-all duration-100"
  style={{ height: `${barHeight}px` }}
/>

      );
    })}
  </div>
)}
    </div>


    {/* Videos remotos */}
    {Object.entries(participants).map(([id, { name }]) => (
      <div key={id} className="relative rounded-xl overflow-hidden border border-gray-700 shadow-lg aspect-video bg-black">
        {/* Deberías tener una manera de asociar el video HTML con el stream remoto de cada peerConnection */}
        {/* Esto requeriría una ref por cada video remoto o un componente separado */}
        <video autoPlay className="w-full h-full object-cover" />
        <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 px-3 py-1 text-sm rounded text-white">
          {name}
        </div>
      </div>
    ))}
  </div>
</div>

        {/* Controles */}
        <div className="flex justify-center gap-4 p-4 border-t border-gray-700 bg-black bg-opacity-80">
          <button
            onClick={toggleMic}
            className="w-12 h-12 rounded-full flex items-center justify-center bg-gray-700 hover:bg-gray-600"
          >
            {micEnabled ? <Mic size={20} /> : <MicOff size={20} />}
          </button>

          <button
            onClick={toggleVideo}
            className="w-12 h-12 rounded-full flex items-center justify-center bg-gray-700 hover:bg-gray-600"
          >
            {videoEnabled ? <Video size={20} /> : <VideoOff size={20} />}
          </button>

          <button
            onClick={toggleScreenShare}
            className="w-12 h-12 rounded-full flex items-center justify-center bg-gray-700 hover:bg-gray-600"
          >
            <ScreenShare size={20} />
          </button>

          {isTeacher && (
            <button
              onClick={toggleRecording}
              className="w-12 h-12 rounded-full flex items-center justify-center bg-gray-700 hover:bg-gray-600"
            >
              <StopCircle size={20} className={isRecording ? 'text-red-500' : ''} />
            </button>
          )}

          <button
            onClick={endCall}
            className="w-12 h-12 rounded-full flex items-center justify-center bg-red-600 hover:bg-red-700"
          >
            <PhoneOff size={20} />
          </button>
        </div>
      </div>

      {/* Chat lateral */}
      <div className="w-80 border-l border-gray-700 bg-gray-900 flex flex-col">
        <div className="p-4 border-b border-gray-700 text-lg font-semibold flex items-center gap-2">
          <MessageSquare size={20} /> Chat
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {messages.map((msg, idx) => (
            <div key={idx} className="bg-gray-800 p-2 rounded">
              <div className="text-xs text-gray-400">{msg.sender}</div>
              <div className="text-sm">{msg.text}</div>
            </div>
          ))}
        </div>
        <form
          onSubmit={handleSendMessage}
          className="p-4 border-t border-gray-700 flex gap-2"
        >
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
    </div>
  );
};

export default VideoRoom;