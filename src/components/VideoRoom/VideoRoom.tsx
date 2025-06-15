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
  id: string;
}

const RemoteVideo: React.FC<RemoteVideoProps> = ({ stream, name, id }) => {
   console.log(`VIENE AL MENOS`);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(true); // Nuevo estado para controlar el mute

  useEffect(() => {
    console.log(`[RemoteVideo] Renderizando ${name} (ID: ${id}). Stream recibido:`, stream);
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      // Aplicar el estado de mute
      videoRef.current.muted = isMuted; // <-- Aquí
      console.log(`[RemoteVideo] Asignado srcObject para ${name} (ID: ${id}). Tracks:`, stream.getTracks().map(t => t.kind));
      videoRef.current.play().catch(e => console.warn(`Error al intentar reproducir video de ${name} (ID: ${id}):`, e));
    } else if (videoRef.current) {
         videoRef.current.srcObject = null;
    }
  }, [stream, name, id, isMuted]); // <-- isMuted como dependencia

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
      // Si estaba muteado y lo desmuteas, intenta reproducir por si acaso
      if (!videoRef.current.muted) {
        videoRef.current.play().catch(e => console.warn(`Error al reproducir después de desmutear:`, e));
      }
    }
  };

  return (
    <div className="relative rounded-xl overflow-hidden border border-gray-700 shadow-lg aspect-video bg-black">
      <video ref={videoRef} autoPlay muted={isMuted} className="w-full h-full object-cover" data-remote-id={id} /> {/* muted={isMuted} */}
      <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 px-3 py-1 text-sm rounded text-white">
        {name}
      </div>
      {/* Botón para desmutear/mutear */}
      <button
        onClick={toggleMute}
        className="absolute top-2 left-2 bg-gray-800 bg-opacity-70 text-white p-1 rounded-full text-xs z-10"
      >
        {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
      </button>
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
        setLocalStream(stream); // <-- Aquí se actualiza el estado
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
// ... (resto del código)

// --- useEffect PRINCIPAL PARA LA CONEXION A REVERB ---

useEffect(() => {
    console.log("current user", currentUser);
    if (!roomId || !currentUser || !localStream) { // Esperar a que todo esté listo
        console.log("Faltan roomId, currentUser o localStream para unirse al canal. Reintentando...");
        return;
    }
    if (channelRef.current) {
        console.log("Ya existe un canal (en el ref), no se unirá de nuevo.");
        return;
    }

    const reverbService = createReverbWebSocketService(currentUser.token);
    let currentChannelInstance: EchoChannel | null = null;

    console.log(`Intentando unirse al canal de presencia: video-room.${roomId}`);
    reverbService.presence(`presence-video-room.${roomId}`) // <--- ¡CAMBIO AQUÍ! USAMOS .presence()
      .then((joinedChannel: EchoChannel) => {
        currentChannelInstance = joinedChannel;
        channelRef.current = joinedChannel;

        console.log("Canal de presencia obtenido y asignado a ref:", joinedChannel);

        joinedChannel.subscribed(() => {
          console.log("✅ Suscrito correctamente al canal de presencia video room.");
          // Ya no necesitamos enviar un whisper 'user-joined', Reverb se encarga de 'member_added'.
          // Aquí puedes hacer algo si lo necesitas, pero la presencia maneja la lista.
        });

        joinedChannel.error((err: any) => {
          console.error("❌ Error en canal de presencia de video-room:", err);
          channelRef.current = null;
          setError("Error al conectar con la sala de video.");
        });

        // --- MANEJO DE PRESENCIA ---
        joinedChannel.here((members: any[]) => { // El 'any[]' debe ser tipado con tu estructura de usuario de Laravel
            console.log("🔔 [PRESENCE] Miembros iniciales en la sala (HERE):", members);
            const initialParticipants: Record<string, Participant> = {};
            members.forEach(member => {
                // Revisa que el 'member.id' no sea tu propio ID antes de añadirlo a los participantes
                if (member.id !== currentUser.id) {
                    initialParticipants[member.id] = {
                        name: member.name,
                        videoEnabled: member.videoEnabled, // Asegúrate de que Laravel retorne estos campos en tu canal de presencia
                        micEnabled: member.micEnabled,     // en routes/channels.php
                    };
                    // Si el miembro es nuevo, crea su PeerConnection
                    let pc = peerConnectionsRef.current[member.id];
                    if (!pc) {
                        console.log(`[HERE] Creando nueva PeerConnection para miembro inicial ${member.name} (${member.id}).`);
                        pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
                        peerConnectionsRef.current = { ...peerConnectionsRef.current, [member.id]: pc };
                        // Asignar handlers ONCE
                        assignPeerConnectionHandlers(pc, member.id, joinedChannel, currentUser, localStream, peerConnectionsRef, setRemoteStreams, setParticipants);
                        // Asegúrate de agregar los tracks locales a la nueva PC
                        if (localStream) {
                            localStream.getTracks().forEach(track => {
                                if (!pc.getSenders().some(sender => sender.track === track)) {
                                    pc.addTrack(track, localStream);
                                }
                            });
                        }
                    }
                }
            });
            setParticipants(initialParticipants);
        });

        joinedChannel.joining((member: any) => { // Cuando un NUEVO miembro se une
            console.log("👉 [PRESENCE] Nuevo miembro uniéndose (JOINING):", member);
            if (member.id === currentUser.id) { // No te añadas a ti mismo como "otro" participante
                console.log("Ignorando 'joining' para el usuario actual.");
                return;
            }

            setParticipants((prev) => {
                if (prev[member.id]) return prev; // Ya lo tenemos
                const updated = {
                    ...prev,
                    [member.id]: {
                        name: member.name,
                        videoEnabled: member.videoEnabled,
                        micEnabled: member.micEnabled,
                    }
                };
                console.log(`[JOINING] Añadiendo participante ${member.name} (${member.id}) a la lista.`);
                return updated;
            });

            // Crear y configurar la PeerConnection para el nuevo miembro
            let pc = peerConnectionsRef.current[member.id];
            if (!pc) {
                console.log(`[JOINING] Creando nueva PeerConnection para ${member.id}.`);
                pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
                peerConnectionsRef.current = { ...peerConnectionsRef.current, [member.id]: pc };

                // Asignar handlers ONCE
                assignPeerConnectionHandlers(pc, member.id, joinedChannel, currentUser, localStream, peerConnectionsRef, setRemoteStreams, setParticipants);

                // Agrega los tracks locales. Esto disparará onnegotiationneeded si es necesario.
                if (localStream) {
                    localStream.getTracks().forEach(track => {
                        if (!pc.getSenders().some(sender => sender.track === track)) {
                            pc.addTrack(track, localStream);
                        }
                    });
                    console.log(`[JOINING] Tracks locales agregados a PC de ${member.id}.`);
                } else {
                    console.warn(`[JOINING] No localStream disponible para agregar tracks a PC de ${member.id}.`);
                }
            }
        });

        joinedChannel.leaving((member: any) => { // Cuando un miembro ABANDONA
            console.log("👋 [PRESENCE] Miembro abandonando (LEAVING):", member);
            setParticipants((prev) => {
                const updated = { ...prev };
                delete updated[member.id];
                console.log(`[LEAVING] Eliminando participante ${member.name} (${member.id}) de la lista.`);
                return updated;
            });

            // Cerrar y limpiar la PeerConnection
            const pc = peerConnectionsRef.current[member.id];
            if (pc && pc.connectionState !== 'closed') {
                console.log(`[LEAVING] Cerrando PeerConnection con ${member.id}.`);
                pc.close();
            }
            const newPeerConnections = { ...peerConnectionsRef.current };
            delete newPeerConnections[member.id];
            peerConnectionsRef.current = newPeerConnections;

            setRemoteStreams(prev => {
                const copy = { ...prev };
                delete copy[member.id];
                return copy;
            });
        });
        // --- FIN MANEJO DE PRESENCIA ---


        // Handler para Whispers de Señalización WebRTC (ESTE DEBE PERMANECER)
        // La lógica de señalización de WebRTC (client-Signal) sigue siendo necesaria
        // para el intercambio de SDP y ICE candidates entre pares.
        joinedChannel.listenForWhisper('Signal', async ({ to, from, data }: { to: string; from: string; data: any }) => {
            console.log(`[SIGNAL IN] Received ${data.type} from ${from} (for me: ${to === currentUser.id})`);
            if (to !== currentUser.id) return; // Asegúrate de que la señal sea para este cliente

            let pc = peerConnectionsRef.current[from];
            if (!pc) {
                console.warn(`[SIGNAL IN] Creando nueva PeerConnection para ${from} (señal recibida antes de 'joining' o PC no existía).`);
                pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
                peerConnectionsRef.current = { ...peerConnectionsRef.current, [from]: pc };

                // Asignar handlers ONCE (reusa la función auxiliar)
                assignPeerConnectionHandlers(pc, from, joinedChannel, currentUser, localStream, peerConnectionsRef, setRemoteStreams, setParticipants);

                // Agrega los tracks locales si se crea la PC tarde
                if (localStream) {
                    localStream.getTracks().forEach(track => {
                        if (!pc.getSenders().some(sender => sender.track === track)) {
                            pc.addTrack(track, localStream);
                        }
                    });
                } else {
                    console.warn(`[SIGNAL IN] No localStream disponible para agregar tracks a PC de ${from}.`);
                }
            }

            try {
                switch (data.type) {
                    case 'offer':
                        console.log(`[SDP Offer] Recibida oferta de ${from}. Estableciendo RemoteDescription.`);
                        await pc.setRemoteDescription(new RTCSessionDescription(data));
                        console.log(`[SDP Offer] Creando y enviando ANSWER a ${from}.`);
                        const answer = await pc.createAnswer();
                        await pc.setLocalDescription(answer);
                        joinedChannel.whisper('Signal', { to: from, from: currentUser.id, data: { type: 'answer', sdp: answer.sdp } }); // <--- Usar joinedChannel.whisper
                        break;
                    case 'answer':
                        console.log(`[SDP Answer] Recibida respuesta de ${from}. Estableciendo RemoteDescription.`);
                        await pc.setRemoteDescription(new RTCSessionDescription(data));
                        break;
                    case 'candidate':
                        console.log(`[ICE Candidate] Recibido candidato de ${from}. Agregando ICE candidate.`);
                        if (data.candidate) {
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

      })
      .catch(error => {
        console.error("❌ Error al unirse al canal de presencia:", error);
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
      peerConnectionsRef.current = {}; // Limpiar el ref explícitamente
      setRemoteStreams({}); // Limpiar el estado de streams remotos
      setParticipants({}); // Limpiar los participantes
      channelRef.current = null;
    };
// Añade todas las dependencias necesarias.
// sendSignal ya no es global, ahora se llama desde el closure o se redefine localmente.
// Si sendSignal es una función useCallback que usa 'joinedChannel', asegúrate de que esté bien.
// Aquí, he redefinido sendSignal como una función local dentro del efecto para capturar 'joinedChannel'
}, [roomId, currentUser, localStream, videoEnabled, micEnabled]);


// --- Función auxiliar para asignar handlers a PeerConnection ---
// Esto reduce la duplicación de código y asegura que todos los PCs tengan los mismos handlers.
const assignPeerConnectionHandlers = useCallback((
    pc: RTCPeerConnection,
    remoteId: string,
    channel: EchoChannel,
    currentUser: User,
    localStream: MediaStream | null,
    peerConnectionsRef: React.MutableRefObject<Record<string, RTCPeerConnection>>,
    setRemoteStreams: React.Dispatch<React.SetStateAction<Record<string, MediaStream>>>,
    setParticipants: React.Dispatch<React.SetStateAction<Record<string, Participant>>>
) => {
    // Definir sendSignal aquí para que capture el 'channel' correcto
    const sendSignal = (toId: string, data: any) => {
        if (channel) {
            channel.whisper('Signal', { to: toId, from: currentUser.id, data: data });
        } else {
            console.error("No hay canal para enviar la señal.");
        }
    };

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            console.log(`[ICE Candidate] Generado candidato para ${remoteId}:`, event.candidate);
            sendSignal(remoteId, { type: 'candidate', candidate: event.candidate });
        }
    };

    pc.ontrack = (event) => {
        console.log(`[ontrack] Recibiendo stream de ${remoteId}, tracks:`, event.streams[0].getTracks().map(t => t.kind));
        setRemoteStreams(prev => ({ ...prev, [remoteId]: event.streams[0] }));
    };

    pc.onnegotiationneeded = async () => {
        // Solo el usuario con ID menor crea la oferta
        if (currentUser.id < parseInt(remoteId.toString())) { // Asegúrate de que remoteId sea numérico para la comparación
            console.log(`[onnegotiationneeded] ${currentUser.id} (local) es menor que ${remoteId} (remoto), creando OFERTA.`);
            try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                sendSignal(remoteId, { type: 'offer', sdp: offer.sdp });
            } catch (e) {
                console.error("Error al crear/enviar oferta en onnegotiationneeded:", e);
            }
        } else {
            console.log(`[onnegotiationneeded] ${currentUser.id} (local) es mayor que ${remoteId} (remoto). Esperando oferta.`);
        }
    };

    pc.onconnectionstatechange = () => {
        console.log(`PeerConnection con ${remoteId} estado: ${pc.connectionState}`);
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
            console.log(`RTC PeerConnection for ${remoteId} disconnected, failed, or closed. Cleaning up.`);
            pc.close();
            const newPeerConnections = { ...peerConnectionsRef.current };
            delete newPeerConnections[remoteId];
            peerConnectionsRef.current = newPeerConnections;

            setParticipants(prev => {
                const copy = { ...prev };
                delete copy[remoteId];
                return copy;
            });
            setRemoteStreams(prev => {
                const copy = { ...prev };
                delete copy[remoteId];
                return copy;
            });
        }
    };
}, []); // No hay dependencias aquí, ya que los valores se pasan como argumentos.

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
    const stream = remoteStreams[id]; // Obtener el stream asociado a este id
    if (!stream) return null; // Si no hay stream, no renderizar el video (o renderizar un placeholder)

    return (
      <div key={id} className="relative">
        <RemoteVideo 
          stream={stream} 
          name={participantData?.name || `Usuario ${id}`} 
          id={id} // ¡Aquí pasamos el id!
        />
        {/* Tu botón de depuración (si aún lo usas) ahora puede acceder al id directamente */}
        <button
          onClick={() => {
            const remoteVideoElement = document.querySelector(`video[data-remote-id="${id}"]`);
            if (remoteVideoElement instanceof HTMLVideoElement) {
              remoteVideoElement.play().catch(e => console.error("Error al reproducir manualmente:", e));
            }
          }}
          className="absolute top-2 right-2 bg-blue-500 text-white p-1 rounded z-10"
        >
          Play {participantData?.name}
        </button>
      </div>
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