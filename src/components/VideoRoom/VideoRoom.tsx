import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createReverbWebSocketService, EchoChannel } from '../../services/ReverbWebSocketService';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Room } from '../../types';
import { useMicVolume } from '../../hooks/useMicVolume';

import { Video, VideoOff, Mic, MicOff, ScreenShare, StopCircle, MessageSquare, PhoneOff } from 'lucide-react';

interface RemoteVideoProps {
  stream: MediaStream | null;
  name: string;
}

const RemoteVideo: React.FC<RemoteVideoProps> = ({ stream, name }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="relative rounded-xl overflow-hidden border border-gray-700 shadow-lg aspect-video bg-black">
      <video ref={videoRef} autoPlay className="w-full h-full object-cover" />
      <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 px-3 py-1 text-sm rounded text-white">
        {name}
      </div>
    </div>
  );
};


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

  // --- CAMBIO CLAVE: Usamos useRef para peerConnections y channel ---
  const peerConnectionsRef = useRef<Record<string, RTCPeerConnection>>({});
  const channelRef = useRef<EchoChannel | null>(null);

  // remoteStreams todavía es un estado porque queremos que cause re-renders para mostrar los videos
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});


  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [participants, setParticipants] = useState<Record<string, { name: string, videoEnabled?: boolean, micEnabled?: boolean }>>({});
  const [micEnabled, setMicEnabled] = useState(true);
  const [volume, setVolume] = useState(0); // <--- Asegúrate de que esta línea exista y no esté comentada
  const [videoEnabled, setVideoEnabled] = useState(true);
  const volume2 = useMicVolume(localStream); // Asumo que `useMicVolume` no tiene problemas


  // useEffect para obtener el stream local
  useEffect(() => {
    const startMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        console.log('Local stream tracks:', stream.getTracks());
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        setVideoEnabled(stream.getVideoTracks()[0]?.enabled || false);
        setMicEnabled(stream.getAudioTracks()[0]?.enabled || false);
      } catch (err) {
        console.error("Error al acceder a los medios:", err);
        setError("No se pudo acceder a la cámara o micrófono. Asegúrate de dar permisos.");
      }
    };
    startMedia();

    return () => {
      localStream?.getTracks().forEach(track => track.stop());
      // Usar Object.values(remoteStreams) para los streams ya en el estado
      Object.values(remoteStreams).forEach(stream => stream.getTracks().forEach(track => track.stop()));
      setRemoteStreams({});
    };
  }, []); // localStream NO es una dependencia aquí, se establece ONCE.


  const toggleVideo = () => {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    if (!videoTrack) return;
    videoTrack.enabled = !videoTrack.enabled;
    setVideoEnabled(videoTrack.enabled);

    // Usa channelRef.current
    channelRef.current?.whisper('toggle-video', {
      id: currentUser?.id,
      enabled: videoTrack.enabled,
    });
  };

  const toggleMic = () => {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (!audioTrack) return;
    audioTrack.enabled = !audioTrack.enabled;
    setMicEnabled(audioTrack.enabled);

    // Usa channelRef.current
    channelRef.current?.whisper('toggle-mic', {
      id: currentUser?.id,
      enabled: audioTrack.enabled,
    });
  };

  const toggleScreenShare = async () => {
    if (!localStream) return;

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = screenStream.getVideoTracks()[0];

      // Usa peerConnectionsRef.current
      Object.values(peerConnectionsRef.current).forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(screenTrack);
        }
      });

      screenTrack.onended = () => {
        const videoTrack = localStream.getVideoTracks()[0];
        Object.values(peerConnectionsRef.current).forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) {
            sender.replaceTrack(videoTrack);
          }
        });
        setVideoEnabled(true);
      };
      setVideoEnabled(false);
    } catch (error) {
      console.error("Error sharing screen:", error);
      setVideoEnabled(true);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const msg = { sender: currentUser?.name || 'Invitado', text: chatInput };
    setMessages(prev => [...prev, msg]);
    setChatInput('');
    // Usa channelRef.current
    channelRef.current?.whisper('chat-message', msg);
  };

  // Este useEffect para listeners del canal puede depender de channelRef.current
  // PERO, si ReverbWebSocketService ya tiene un sistema de limpieza, esto podría no ser necesario.
  // Para fines de prueba y para garantizar que los listeners se configuran correctamente una vez,
  // podemos mantener un useEffect que dependa de channelRef.current.
  useEffect(() => {
    const currentChannel = channelRef.current; // Lee el valor actual del ref
    if (currentChannel) {
      const chatListener = (msg: { sender: string; text: string }) => {
        setMessages(prev => [...prev, msg]);
      };
      currentChannel.listenForWhisper('chat-message', chatListener);

      currentChannel.listenForWhisper('toggle-video', ({ id, enabled }: { id: string; enabled: boolean }) => {
        setParticipants(prev => ({
          ...prev,
          [id]: { ...prev[id], videoEnabled: enabled }
        }));
      });
      currentChannel.listenForWhisper('toggle-mic', ({ id, enabled }: { id: string; enabled: boolean }) => {
        setParticipants(prev => ({
          ...prev,
          [id]: { ...prev[id], micEnabled: enabled }
        }));
      });

      return () => {
        // En Reverb/Laravel Echo, usualmente channel.leave() ya limpia todos los listeners.
        // Si no, aquí deberías desregistrar los listeners específicos si es necesario.
        // No hay método directo like `stopListeningForWhisper` en Echo/Reverb fuera de `leave()`.
      };
    }
  }, [currentUser?.id]); // Quitamos `channel` de las dependencias, ya que `channelRef.current` no cambia la referencia del ref.


  const endCall = () => {
    localStream?.getTracks().forEach(track => track.stop());
    Object.values(peerConnectionsRef.current).forEach(pc => pc.close()); // Usa el ref
    peerConnectionsRef.current = {}; // Limpia el ref
    setRemoteStreams({});
    setParticipants({});
    setMessages([]);
    setIsRecording(false);
    channelRef.current?.leave(); // Usa el ref
    channelRef.current = null; // Limpia el ref
    navigate('/rooms');
  };

  // Uso de useMicVolume - sin cambios aquí
  useEffect(() => {
    if (!localStream) return;
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
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


  // `sendSignal` necesita acceder al `channel` para susurrar.
  // Ahora usará `channelRef.current`.
  // ... (resto del código)

// sendSignal - No deberíamos cambiarlo, parece bien
const sendSignal = useCallback((toId: string, data: any) => {
  if (!channelRef.current) {
    console.warn("Cannot send signal: channel is not ready.");
    return;
  }
  console.log(`[SIGNAL OUT] Sending ${data.type} to ${toId} from ${currentUser?.id}`);
  channelRef.current.whisper('Signal', {
    to: toId,
    from: currentUser?.id,
    data,
  });
}, [currentUser?.id]);

// --- useEffect PRINCIPAL PARA LA CONEXION A REVERB ---
useEffect(() => {
    console.log("current user", currentUser);
    if (!roomId || !currentUser) {
        console.log("Faltan roomId o currentUser para unirse al canal.");
        return;
    }
    if (!localStream) {
        console.log("Esperando localStream para unirse al canal.");
        return;
    }
    if (channelRef.current) {
        console.log("Ya existe un canal (en el ref), no se unirá de nuevo.");
        return;
    }

    const reverbService = createReverbWebSocketService(currentUser.token);
    let currentChannelInstance: EchoChannel | null = null;

    console.log(`Intentando unirse al canal video-room.${roomId}`);
    reverbService.join(`video-room.${roomId}`)
      .then((joinedChannel: EchoChannel) => {
        currentChannelInstance = joinedChannel;
        channelRef.current = joinedChannel;

        console.log("Canal obtenido y asignado a ref:", joinedChannel);

        joinedChannel.subscribed(() => {
          console.log("✅ Suscrito correctamente al canal video room.");
          joinedChannel.whisper('user-joined', {
            id: currentUser.id,
            name: currentUser.name,
            videoEnabled: videoEnabled,
            micEnabled: micEnabled,
          });
        });

        joinedChannel.error((err: any) => {
          console.error("❌ Error en canal de video-room:", err);
          channelRef.current = null;
        });

        // Handler for user-joined whispers
        joinedChannel.listenForWhisper('user-joined', async ({ id, name, videoEnabled: remoteVideoEnabled, micEnabled: remoteMicEnabled }: { id: string; name: string; videoEnabled?: boolean; micEnabled?: boolean }) => {
          console.log(`[user-joined] recibido de ${id} (mi ID: ${currentUser.id})`);
          if (id === currentUser.id) {
            console.log("Ignorando user-joined para el usuario actual.");
            return;
          }

          setParticipants((prev) => {
            if (prev[id]) {
              console.log(`[user-joined] Usuario ${id} ya está en la lista de participantes.`);
              return prev;
            }
            const updated = { ...prev, [id]: { name, videoEnabled: remoteVideoEnabled, micEnabled: remoteMicEnabled } };
            console.log(`[user-joined] Añadiendo nuevo participante ${name} (${id})`);
            return updated;
          });

          // Obtener o crear PeerConnection para este ID
          let pc = peerConnectionsRef.current[id];
          if (!pc) {
              console.log(`[user-joined] Creando nueva PeerConnection para ${id}.`);
              pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
              peerConnectionsRef.current = { ...peerConnectionsRef.current, [id]: pc };
          } else {
              console.log(`[user-joined] PeerConnection con ${id} ya existe.`);
          }

          // Añadir pistas locales al PeerConnection ANTES de crear ofertas/respuestas
          if (localStream) {
            console.log(`[user-joined] Agregando tracks locales a PC de ${id}`);
            localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
          } else {
              console.warn(`[user-joined] No localStream disponible para agregar tracks a PC de ${id}.`);
          }

          // Configurar onicecandidate
          pc.onicecandidate = (event) => {
            if (event.candidate) {
              console.log(`[ICE Candidate] Generado candidato para ${id}:`, event.candidate);
              sendSignal(id, { type: 'candidate', candidate: event.candidate });
            }
          };

          // Configurar ontrack
          pc.ontrack = (event) => {
            console.log(`[ontrack] Recibiendo stream de ${id}, tracks:`, event.streams[0].getTracks().map(t => t.kind));
            setRemoteStreams(prev => ({ ...prev, [id]: event.streams[0] }));
          };

          // Configurar onconnectionstatechange
          pc.onconnectionstatechange = () => {
            console.log(`PeerConnection con ${id} estado: ${pc.connectionState}`);
            if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
              console.log(`RTC PeerConnection for ${id} disconnected or failed.`);
              pc.close();
              const newPeerConnections = { ...peerConnectionsRef.current };
              delete newPeerConnections[id];
              peerConnectionsRef.current = newPeerConnections;

              setParticipants(prev => {
                const copy = { ...prev };
                delete copy[id];
                return copy;
              });
              setRemoteStreams(prev => {
                const copy = { ...prev };
                delete copy[id];
                return copy;
              });
            }
          };

          // Estrategia de SDP Offer/Answer: el que tenga el ID más bajo inicia la oferta
          // U1 (ID 1) se une, luego U2 (ID 2) se une.
          // Cuando U1 recibe user-joined de U2: 1 < 2 es TRUE, U1 envía oferta a U2.
          // Cuando U2 recibe user-joined de U1: 2 < 1 es FALSE, U2 NO envía oferta.
          // Esto es correcto. U2 debe esperar la oferta de U1.
          if (currentUser.id < parseInt(id)) {
              console.log(`[SDP Offer] ${currentUser.id} (local) es menor que ${id} (remoto), enviando oferta.`);
              try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                sendSignal(id, { type: 'offer', sdp: offer.sdp });
              } catch (e) {
                console.error("Error al crear/enviar oferta:", e);
              }
          }
        });

        // Handler for Signal whispers (SDP Offer/Answer/Candidate)
        joinedChannel.listenForWhisper('Signal', async ({ to, from, data }: { to: string; from: string; data: any }) => {
          console.log(`[SIGNAL IN] Received ${data.type} from ${from} (for me: ${to === currentUser.id})`);
          if (to !== currentUser.id) return; // Si la señal no es para mí, la ignoramos

          let pc = peerConnectionsRef.current[from];
          if (!pc) {
            console.warn(`[SIGNAL IN] Creando nueva PeerConnection para ${from} (señal recibida antes de user-joined o PC no existía).`);
            pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
            peerConnectionsRef.current = { ...peerConnectionsRef.current, [from]: pc };

            if (localStream) {
              console.log(`[SIGNAL IN] Agregando tracks locales a PC de ${from}.`);
              localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
            } else {
                console.warn(`[SIGNAL IN] No localStream disponible para agregar tracks a PC de ${from}.`);
            }

            pc.onicecandidate = (event) => {
              if (event.candidate) {
                console.log(`[ICE Candidate] (Tardío) Generado candidato para ${from}:`, event.candidate);
                sendSignal(from, { type: 'candidate', candidate: event.candidate });
              }
            };
            pc.ontrack = (event) => {
              console.log(`[ontrack] (Tardío) Recibiendo stream de ${from}, tracks:`, event.streams[0].getTracks().map(t => t.kind));
              setRemoteStreams(p => ({ ...p, [from]: event.streams[0] }));
            };
            pc.onconnectionstatechange = () => {
              console.log(`PeerConnection con ${from} (tardío) estado: ${pc.connectionState}`);
              if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                pc.close();
                const newPeerConnections = { ...peerConnectionsRef.current };
                delete newPeerConnections[from];
                peerConnectionsRef.current = newPeerConnections;
                setParticipants(p => { const copy = { ...p }; delete copy[from]; return copy; });
                setRemoteStreams(p => { const copy = { ...p }; delete copy[from]; return copy; });
              }
            };
          }

          try {
            switch (data.type) {
              case 'offer':
                console.log(`[SDP Offer] Recibida oferta de ${from}. Estableciendo RemoteDescription.`);
                await pc.setRemoteDescription(new RTCSessionDescription(data));
                console.log(`[SDP Offer] Creando y enviando ANSWER a ${from}.`);
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                sendSignal(from, { type: 'answer', sdp: answer.sdp });
                break;
              case 'answer':
                console.log(`[SDP Answer] Recibida respuesta de ${from}. Estableciendo RemoteDescription.`);
                await pc.setRemoteDescription(new RTCSessionDescription(data));
                break;
              case 'candidate':
                console.log(`[ICE Candidate] Recibido candidato de ${from}. Agregando ICE candidate.`);
                if (data.candidate) { // Asegurarse de que el candidato no sea null/undefined
                    await pc.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(e => console.error("Error adding ICE candidate:", e, data.candidate));
                } else {
                    console.warn("Received null/undefined ICE candidate. Ignoring.");
                }
                break;
              default:
                console.warn(`[SIGNAL IN] Tipo de señal desconocido: ${data.type}`);
            }
          } catch (e) {
            console.error("Error processing WebRTC signal:", e);
          }
        });

        // Handler for UserLeft events
        joinedChannel.listen('UserLeft', ({ id }: { id: string }) => {
          console.log('[UserLeft] Usuario salió:', id);
          setParticipants((prev) => {
            const updated = { ...prev };
            delete updated[id];
            console.log('[UserLeft] Participantes después de salir:', updated);
            return updated;
          });

          const newPeerConnections = { ...peerConnectionsRef.current };
          if (newPeerConnections[id]) {
            newPeerConnections[id].close();
            delete newPeerConnections[id];
          }
          peerConnectionsRef.current = newPeerConnections;

          setRemoteStreams(prev => {
            const copy = { ...prev };
            delete copy[id];
            return copy;
          });
        });

      })
      .catch(error => {
        console.error("❌ Error al unirse al canal video-room:", error);
        channelRef.current = null;
        setError("No se pudo conectar a la sala de video.");
        setLoading(false);
      });

    return () => {
      console.log("Limpiando useEffect de conexión al canal.");
      if (currentChannelInstance) {
        currentChannelInstance.leave();
      }
      Object.values(peerConnectionsRef.current).forEach(pc => {
          if (pc.connectionState !== 'closed') pc.close();
      });
      peerConnectionsRef.current = {};
      // Asegurarse de detener tracks de streams remotos
      Object.values(remoteStreams).forEach(stream => stream.getTracks().forEach(track => track.stop()));
      setRemoteStreams({});
      channelRef.current = null;
    };
}, [roomId, currentUser, localStream, sendSignal, videoEnabled, micEnabled]);


  const toggleRecording = () => {
    console.log("Función de grabación no implementada aún.");
    setIsRecording(prev => !prev);
  };


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
      <div className="flex flex-col flex-1 relative">
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
    {/* Código para el indicador de volumen */}
  </div>
)}
    </div>

    {Object.entries(participants).map(([id, participantData]) => {
      // Asegúrate de que el ID del usuario actual sea un string para la comparación consistente
      if (id === currentUser?.id?.toString()) return null;
      const remoteStream = remoteStreams[id] || null;
      return (
        <RemoteVideo key={id} stream={remoteStream} name={participantData.name} />
      );
    })}
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