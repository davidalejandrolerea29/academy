import React, { useEffect, useRef, useState, useCallback } from 'react'; // Importa useCallback
import { createReverbWebSocketService, EchoChannel } from '../../services/ReverbWebSocketService';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Room } from '../../types';
import { useMicVolume } from '../../hooks/useMicVolume';

import { Video, VideoOff, Mic, MicOff, ScreenShare, StopCircle, MessageSquare, PhoneOff } from 'lucide-react';

const VideoRoom: React.FC = () => {
  const API_URL = import.meta.env.VITE_API_URL;
  const navigate = useNavigate();

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

  // peerConnections es un estado que se actualiza frecuentemente,
  // pero el useEffect principal no debe depender directamente de sus cambios para re-ejecutarse.
  // Lo mejor es que la lógica que usa/modifica peerConnections esté en funciones memoizadas.
  const [peerConnections, setPeerConnections] = useState<Record<string, RTCPeerConnection>>({});

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [channel, setChannel] = useState<EchoChannel | null>(null); // Única declaración
  const [participants, setParticipants] = useState<Record<string, { name: string }>>({});
  const [micEnabled, setMicEnabled] = useState(true);
  const [volume, setVolume] = useState(0);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const volume2 = useMicVolume(localStream);

  // Asegúrate de que este useEffect solo se ejecute una vez para obtener el stream
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

    // Limpieza al desmontar para parar el stream local
    return () => {
      localStream?.getTracks().forEach(track => track.stop());
    };
  }, []); // Dependencia vacía para que se ejecute solo al montar

  const toggleVideo = () => {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    if (!videoTrack) return;
    videoTrack.enabled = !videoTrack.enabled;
    setVideoEnabled(videoTrack.enabled);
  };

  const toggleMic = () => {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (!audioTrack) return;
    audioTrack.enabled = !audioTrack.enabled;
    setMicEnabled(audioTrack.enabled);
  };

  const toggleScreenShare = async () => {
    if (!localStream) return;

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = screenStream.getVideoTracks()[0];

      // Reemplazar la pista de video en todas las conexiones existentes
      // Debes iterar sobre las peerConnections actuales
      Object.values(peerConnections).forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(screenTrack);
        }
      });

      screenTrack.onended = () => {
        // Volver a cámara al terminar compartir
        const videoTrack = localStream.getVideoTracks()[0];
        Object.values(peerConnections).forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) {
            sender.replaceTrack(videoTrack);
          }
        });
        setVideoEnabled(true); // Asegúrate de que el estado de video se actualice
      };
      setVideoEnabled(false); // Indica que ahora estamos compartiendo pantalla
    } catch (error) {
      console.error("Error sharing screen:", error);
      setVideoEnabled(true); // Vuelve al estado de video si hubo un error
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const msg = { sender: currentUser.name, text: chatInput };
    setMessages(prev => [...prev, msg]);
    setChatInput('');
    channel?.whisper('chat-message', msg);
  };

  useEffect(() => {
    if (channel) {
      const chatListener = (msg: { sender: string; text: string }) => {
        setMessages(prev => [...prev, msg]);
      };
      channel.listenForWhisper('chat-message', chatListener);
      return () => {
        // Limpiar listener al desmontar o al cambiar el canal
        // En Reverb/Laravel Echo, usualmente channel.leave() ya limpia todos los listeners.
        // Pero si solo quieres remover un listener específico sin dejar el canal:
        // channel.stopListeningForWhisper('chat-message', chatListener); // Esto no existe directamente en Echo, pero se ilustra el concepto.
      };
    }
  }, [channel]);

  const endCall = () => {
    localStream?.getTracks().forEach(track => track.stop());
    Object.values(peerConnections).forEach(pc => pc.close());
    setPeerConnections({}); // Limpia el estado de las conexiones
    setParticipants({});
    setMessages([]);
    setIsRecording(false);
    channel?.leave();
    setChannel(null); // Asegúrate de limpiar el canal del estado
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

  // --- FUNCIÓN sendSignal envuelta en useCallback ---
  const sendSignal = useCallback((toId: string, data: any) => {
    if (!channel) {
      console.warn("Cannot send signal: channel is not ready.");
      return;
    }
    channel.whisper('Signal', {
      to: toId,
      from: currentUser?.id, // Asegúrate de que currentUser.id esté disponible aquí
      data,
    });
  }, [channel, currentUser?.id]); // Depende del canal y del ID del usuario actual


  // --- useEffect PRINCIPAL PARA LA CONEXION A REVERB ---
  // Las dependencias de este useEffect son cruciales.
  // Solo debe re-ejecutarse si cambian roomId o currentUser.
  // Las actualizaciones de `peerConnections` o `participants` no deben causarlo.
  useEffect(() => {
    console.log("current user", currentUser);
    if (!roomId || !currentUser) return;

    // Si ya tenemos un canal, no intentemos unirnos de nuevo.
    // Esto es CRUCIAL para evitar bucles si alguna dependencia cambia
    // de una manera que no esperábamos que re-ejecutara el join.
    if (channel) {
        console.log("Ya existe un canal, no se unirá de nuevo.");
        return;
    }

    const reverbService = createReverbWebSocketService(currentUser.token);
    let currentChannel: EchoChannel | null = null; // Variable local para la limpieza

    console.log("Intentando unirse al canal", `video-room.${roomId}`);
    reverbService.join(`video-room.${roomId}`)
      .then((joinedChannel: EchoChannel) => {
        currentChannel = joinedChannel;
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

        // --- Manejo de señales RTC (dentro del useEffect de conexión al canal) ---
        // Es importante que la lógica de manejo de RTCPeerConnection esté dentro de la promesa
        // y que use los closures para acceder a `peerConnections` y `localStream` de forma segura.

        joinedChannel.listenForWhisper('user-joined', async ({ id, name }: { id: string; name: string }) => {
          console.log('[user-joined] recibido:', { id, name });
          if (id === currentUser.id) return;

          // Usar la forma funcional de setParticipants para evitar dependencias en 'participants'
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

          // Asegúrate de que localStream exista antes de añadir pistas
          if (localStream) {
            localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
          }

          pc.onicecandidate = (event) => {
            if (event.candidate) {
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

          // Actualizar peerConnections de forma funcional para evitar dependencia en el array del useEffect
          setPeerConnections(prev => ({ ...prev, [id]: pc }));

          if (isTeacher) {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            sendSignal(id, { type: 'offer', sdp: offer.sdp });
          }
        });

        joinedChannel.listenForWhisper('Signal', async ({ to, from, data }: { to: string; from: string; data: any }) => {
          console.log('[Signal] recibido:', { to, from, data });
          if (to !== currentUser.id) return;

          // Accede a peerConnections desde el estado actual
          setPeerConnections(prevPeerConnections => {
            let pc = prevPeerConnections[from];
            if (!pc) {
              // Si el PC no existe, lo creamos (esto puede pasar si se reciben señales antes de que el 'user-joined' complete la creación del PC)
              console.warn(`Creating new PeerConnection for ${from} on the fly for received signal.`);
              pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
              if (localStream) {
                localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
              }

              pc.onicecandidate = (event) => {
                if (event.candidate) {
                  sendSignal(from, { type: 'candidate', candidate: event.candidate });
                }
              };
              pc.ontrack = (event) => { /* Manejar remote track */ };
              pc.onconnectionstatechange = () => {
                if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                  pc.close();
                  setPeerConnections(p => { const copy = { ...p }; delete copy[from]; return copy; });
                  setParticipants(p => { const copy = { ...p }; delete copy[from]; return copy; });
                }
              };
            }

            // Realiza las operaciones WebRTC
            const processSignal = async () => {
              try {
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
                    if (data.candidate && (pc.remoteDescription || data.candidate.sdpMid)) {
                      await pc.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(e => console.error("Error adding ICE candidate:", e, data.candidate));
                    }
                    break;
                }
              } catch (e) {
                console.error("Error processing WebRTC signal:", e);
              }
            };
            processSignal();

            return { ...prevPeerConnections, [from]: pc }; // Asegúrate de devolver el nuevo estado
          });
        });

        joinedChannel.listen('UserLeft', ({ id }: { id: string }) => {
          console.log('[UserLeft] Usuario salió:', id);
          setParticipants((prev) => {
            const updated = { ...prev };
            delete updated[id];
            console.log('[UserLeft] Participantes después de salir:', updated);
            return updated;
          });
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
        setError("No se pudo conectar a la sala de video.");
        setLoading(false);
      });

    // Función de limpieza para el useEffect
    return () => {
      console.log("Limpiando useEffect de conexión al canal.");
      if (currentChannel) { // Usa la variable local 'currentChannel' para limpiar
        currentChannel.leave();
        // setChannel(null) se maneja en endCall, o si el join falla.
        // También puedes limpiar los listeners aquí si no se limpian automáticamente con leave()
      }
      // Asegúrate de que las peer connections se cierren aquí también si el componente se desmonta
      Object.values(peerConnections).forEach(pc => pc.close());
      setPeerConnections({}); // Limpiar el estado de las conexiones
    };
  }, [roomId, currentUser]); // Dependencias MUY reducidas: solo roomId y currentUser.
                             // localStream, peerConnections, isTeacher, sendSignal, navigate
                             // Ya no están porque sus actualizaciones no deben disparar el join del canal.
                             // Las funciones que usan estos estados deben usar sus valores actuales
                             // o ser envueltas en useCallback/memo si se pasan como props.

  // Si necesitas que `isTeacher` u otras dependencias re-evalúen alguna parte del efecto
  // sin volver a unirse al canal, tendrías que tener `useEffect`s separados para esa lógica.


  // ... el resto de tu componente (JSX) sin cambios ...

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-white bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        <p className="ml-4">Cargando sala de video...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-500 bg-gray-900">
        <p>Error: {error}</p>
        <button onClick={() => navigate('/rooms')} className="ml-4 px-4 py-2 bg-blue-600 rounded">Volver a Salas</button>
      </div>
    );
  }

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
        {/* Aquí la clave es cómo renderizar los streams remotos. */}
        {/* Deberías tener una manera de asociar cada 'pc' en `peerConnections`
            con un elemento <video> y su `srcObject`.
            Esto es más complejo y podría requerir un componente `RemoteVideo` separado
            o un mapa de `useRef`s, actualizando el `srcObject` cuando el `ontrack` se dispara.
            Por ahora, el `video` tag es solo un placeholder. */}
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
              // onClick={toggleRecording}
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