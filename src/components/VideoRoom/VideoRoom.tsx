import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createReverbWebSocketService, EchoChannel } from '../../services/ReverbWebSocketService';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase'; // Asumo que esto es relevante para otras partes de tu app
import { Room } from '../../types'; // Asumo que este tipo está definido
import { useMicVolume } from '../../hooks/useMicVolume'; // Asumo que tu hook está bien

import { Video, VideoOff, Mic, MicOff, ScreenShare, StopCircle, MessageSquare, PhoneOff } from 'lucide-react';

interface RemoteVideoProps {
  stream: MediaStream | null;
  name: string;
  id: string; // Asegúrate de pasar el ID al componente RemoteVideo
}

const RemoteVideo: React.FC<RemoteVideoProps> = ({ stream, name, id }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(true); // Estado para controlar el mute del video remoto (inicialmente muteado)

  useEffect(() => {
    // console.log(`[RemoteVideo] Renderizando ${name} (ID: ${id}). Stream recibido:`, stream);
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      // Intenta reproducir el video. Si el navegador lo bloquea, se manejará con el .catch
      videoRef.current.play().catch(e => {
        // console.warn(`Error al intentar reproducir video de ${name} (ID: ${id}):`, e);
        // Si hay un error de autoplay, desmutear y intentar de nuevo
        if (e.name === 'NotAllowedError' || e.name === 'NotSupportedError' || e.name === 'AbortError') {
             // console.log(`[RemoteVideo] Autoplay bloqueado para ${name}. Se requiere interacción del usuario.`);
             // Puedes mostrar un botón "Play" o un indicador visual aquí.
        }
      });
    } else if (videoRef.current) {
         videoRef.current.srcObject = null; // Limpiar si el stream se ha ido
    }
  }, [stream, name, id]);

  // Si quieres que los videos remotos no estén muteados por defecto, cambia `useState(true)` a `useState(false)`
  // y quita `muted={isMuted}` del elemento <video> o cambia `muted` a `false`.
  // La línea `videoRef.current.muted = isMuted;` en el useEffect debería ser eliminada si no quieres control de mute manual para remotos.
  // Usualmente, los videos remotos no se muten a sí mismos, pero un usuario local podría silenciar a otro.
  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
      if (!videoRef.current.muted) {
        videoRef.current.play().catch(e => console.warn(`Error al reproducir después de desmutear:`, e));
      }
    }
  };

  return (
    <div className="relative rounded-xl overflow-hidden border border-gray-700 shadow-lg aspect-video bg-black">
      {/* Asegúrate de que `muted` en <video> refleje `isMuted` si quieres control de mute manual */}
      <video ref={videoRef} autoPlay muted={isMuted} className="w-full h-full object-cover" data-remote-id={id} />
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
  const { currentUser } = useAuth(); // Asegúrate de que `currentUser.id` y `currentUser.name` existan
  const [room, setRoom] = useState<Room | null>(null); // Estado para la información de la sala (si es necesario)
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTeacher, setIsTeacher] = useState(false); // Determinar si el usuario actual es profesor
  const [isRecording, setIsRecording] = useState(false);
  const [messages, setMessages] = useState<{ sender: string; text: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
// En VideoRoom.tsx, dentro del componente:
const [hasJoinedChannel, setHasJoinedChannel] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  // --- Refs para mantener referencias persistentes ---
  const peerConnectionsRef = useRef<Record<string, RTCPeerConnection>>({});
  const channelRef = useRef<EchoChannel | null>(null);
  const reverbServiceRef = useRef(createReverbWebSocketService(currentUser?.token || '')); // Instancia del servicio

  // Estado para streams remotos y participantes
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  // participants ahora incluye toda la info necesaria para renderizar y gestionar el estado del usuario
  const [participants, setParticipants] = useState<Record<string, { id: string, name: string, videoEnabled: boolean, micEnabled: boolean, stream: MediaStream | null }>>({});

  const [micEnabled, setMicEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const volume = useMicVolume(localStream); // Usa tu hook para el volumen del micrófono local

  const sendSignal = useCallback((toId: string, data: any) => {
    if (!channelRef.current) {
      console.warn("Cannot send signal: channel is not ready.");
      return;
    }
    channelRef.current.whisper('Signal', {
      to: toId,
      from: currentUser?.id,
      data,
    });
  }, [currentUser?.id]);
  // --- Función auxiliar para obtener/crear RTCPeerConnection ---
    const getOrCreatePeerConnection = useCallback((peerId: string) => {
    if (!peerConnectionsRef.current[peerId]) {
      console.log(`[PC] Creando nueva RTCPeerConnection para peer: ${peerId}`);
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },],
      });

      // --- CAMBIO CLAVE: Manejo de onicecandidate ---
      // Dentro de pc.onicecandidate:
      pc.onicecandidate = (event) => {
        if (event.candidate && currentUser) {
          console.log(`[ICE Candidate] Generado candidato para ${peerId}.`);
          // Envía event.candidate como un objeto plano para que sea reconstruido.
          sendSignal(peerId, { type: 'candidate', candidate: event.candidate.toJSON() });
        }
      };

      pc.ontrack = (event) => {
        console.log(`[ontrack] Recibiendo stream de ${peerId}, tracks:`, event.streams[0].getTracks().map(t => t.kind));
        setParticipants(prev => {
          const currentParticipant = prev[peerId] || {};
          return {
            ...prev,
            [peerId]: {
              ...currentParticipant,
              id: peerId,
              name: currentParticipant.name || `Usuario ${peerId}`,
              stream: event.streams[0]
            }
          };
        });
      };

      // --- CAMBIO CLAVE: Manejo de onnegotiationneeded ---
      pc.onnegotiationneeded = async () => {
          console.log(`[onnegotiationneeded] Iniciando negociación para peer: ${peerId}.`);
          if (!localStream) {
            console.warn(`[onnegotiationneeded] localStream no está listo para peer ${peerId}. No se puede crear oferta.`);
            return;
          }

          // Asegurarse de que los tracks locales estén añadidos antes de crear la oferta
          localStream.getTracks().forEach(track => {
            if (!pc.getSenders().some(sender => sender.track === track)) {
              pc.addTrack(track, localStream);
              console.log(`[ON_NEGOTIATION] ✅ Añadido track local ${track.kind} a PC de ${peerId}`);
            }
          });

          try {
            // Solo creamos oferta si somos el "iniciador" basado en IDs
            // (esto evita ofertas duplicadas si ambos inician al mismo tiempo)
            const localUserId = parseInt(currentUser?.id.toString() || '0');
            const remoteMemberId = parseInt(peerId);
            const isInitiator = localUserId < remoteMemberId; // O tu lógica para determinar quién inicia

            if (isInitiator) {
                console.log(`[ON_NEGOTIATION - OFERTA INICIADA] Creando OFERTA para ${peerId}.`);
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                sendSignal(peerId, { type: 'offer', sdp: offer.sdp, sdpType: offer.type });
            } else {
                console.log(`[ON_NEGOTIATION - ESPERANDO OFERTA] Esperando oferta de ${peerId}.`);
            }

          } catch (e) {
            console.error("Error en onnegotiationneeded al crear/enviar oferta:", e);
          }
      };

      pc.onconnectionstatechange = () => {
        console.log(`[PC State] PeerConnection con ${peerId} estado: ${pc.connectionState}`);
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          console.log(`[PC State] RTC PeerConnection for ${peerId} disconnected/failed/closed. Cleaning up.`);
          pc.close();
          const newPeerConnections = { ...peerConnectionsRef.current };
          delete newPeerConnections[peerId];
          peerConnectionsRef.current = newPeerConnections;

          setParticipants(prev => {
            const copy = { ...prev };
            delete copy[peerId];
            return copy;
          });
        }
      };

      // --- CAMBIO: Añadir los tracks locales INMEDIATAMENTE al crear la PC ---
      // Esto asegura que pc.onnegotiationneeded se dispare si es necesario
      // o que la oferta inicial contenga los tracks.
      if (localStream) {
        localStream.getTracks().forEach(track => {
          if (!pc.getSenders().some(sender => sender.track === track)) {
            pc.addTrack(track, localStream);
            console.log(`[PC Creation] ✅ Añadido track local ${track.kind} a PC de ${peerId}`);
          }
        });
      }


      peerConnectionsRef.current = { ...peerConnectionsRef.current, [peerId]: pc };
    }
    return peerConnectionsRef.current[peerId];
  }, [currentUser, localStream, sendSignal]); // Añadido localStream a las dependencias



  // --- NUEVA FUNCIÓN PARA INICIAR LA LLAMADA CON UN PEER ESPECÍFICO ---
  // const initiateCallForPeer = useCallback(async (peerId: string, isInitiator: boolean) => {
  //   if (!localStream || !currentUser) {
  //     console.warn(`[initiateCallForPeer] localStream o currentUser no están listos para peer ${peerId}.`);
  //     return;
  //   }

  //   const pc = getOrCreatePeerConnection(peerId);

  //   // Añadir tracks locales si no están ya añadidos
  //   localStream.getTracks().forEach(track => {
  //     if (!pc.getSenders().some(sender => sender.track === track)) {
  //       pc.addTrack(track, localStream);
  //       console.log(`[INIT_CALL] ✅ Añadido track local ${track.kind} a PC de ${peerId}`);
  //     }
  //   });

  //   if (isInitiator) {
  //     console.log(`[INIT_CALL - OFERTA INICIADA] Creando OFERTA para ${peerId}.`);
  //     try {
  //       const offer = await pc.createOffer();
  //       await pc.setLocalDescription(offer);
  //       sendSignal(peerId, { type: 'offer', sdp: offer.sdp });
  //     } catch (e) {
  //       console.error("Error al crear/enviar oferta en initiateCallForPeer:", e);
  //     }
  //   } else {
  //     console.log(`[INIT_CALL - ESPERANDO OFERTA] Esperando oferta de ${peerId}.`);
  //   }
  // }, [localStream, currentUser, getOrCreatePeerConnection, sendSignal]);

  // --- useEffect para obtener el stream local ---
  useEffect(() => {
    const startMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        // console.log('Local stream tracks:', stream.getTracks());
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
      // Limpia los streams y conexiones al desmontar el componente
      localStream?.getTracks().forEach(track => track.stop());
      Object.values(peerConnectionsRef.current).forEach(pc => {
          if (pc.connectionState !== 'closed') pc.close();
      });
      peerConnectionsRef.current = {};
      setLocalStream(null);
      setParticipants({});
      channelRef.current?.leave(); // Asegúrate de dejar el canal de Echo/Reverb
      channelRef.current = null;
      setHasJoinedChannel(false);
    };
  }, []); // El array de dependencias vacío asegura que esto solo se ejecute una vez al montar

  // --- useEffect PRINCIPAL PARA LA CONEXION A REVERB Y WEB RTC ---
useEffect(() => {
    if (!roomId || !currentUser || !localStream) {
        console.log("Faltan roomId, currentUser o localStream para unirse al canal. Reintentando...");
        return;
    }
    if (channelRef.current) {
        console.log("Ya existe un canal (en el ref), no se unirá de nuevo.");
        return;
    }

    const reverbService = reverbServiceRef.current;
    let currentChannelInstance: EchoChannel | null = null;

    console.log(`Intentando unirse al canal presence-video-room.${roomId}`);
      reverbService.presence(`presence-video-room.${roomId}`)
      .then((joinedChannel: EchoChannel) => {
        currentChannelInstance = joinedChannel;
        channelRef.current = joinedChannel;
        setHasJoinedChannel(true);
        // --- joinedChannel.here: Para miembros que ya están en la sala cuando te unes ---
        joinedChannel.here(async (members: { id: string; name: string; user_info?: any }[]) => {
          console.log("Aquí estamos: Sincronizando participantes iniciales:", members);
          const initialParticipants: Record<string, { id: string, name: string, videoEnabled: boolean, micEnabled: boolean, stream: MediaStream | null }> = {};
          const localUserId = parseInt(currentUser.id.toString());

          for (const member of members) {
            if (String(member.id) !== String(currentUser.id)) {
              initialParticipants[String(member.id)] = {
                id: String(member.id),
                name: member.name || member.user_info?.name || `Usuario ${member.id}`,
                videoEnabled: true,
                micEnabled: true,
                stream: null
              };

              // const remoteMemberId = parseInt(String(member.id));
              // Determina si este cliente debe iniciar la oferta
              // const shouldInitiate = localUserId < remoteMemberId;

              // Llama a la nueva función para iniciar la llamada con este peer
              // await initiateCallForPeer(String(member.id), shouldInitiate);
              getOrCreatePeerConnection(member.id);
            }
          }
          setParticipants(initialParticipants);
        });

        // --- joinedChannel.joining: Para miembros que se unen DESPUÉS de ti ---
        joinedChannel.joining(async (member: { id: string; name: string; user_info?: any }) => {
            console.log("Un nuevo participante se ha unido:", member);
            const memberId = String(member.id);
            if (memberId === String(currentUser.id)) return;

            setParticipants(prev => {
                const updatedParticipants = {
                    ...prev,
                    [memberId]: {
                        id: memberId,
                        name: member.name || member.user_info?.name || `Usuario ${memberId}`,
                        videoEnabled: true,
                        micEnabled: true,
                        stream: null
                    }
                };
                return updatedParticipants;
            });

            // const localUserId = parseInt(currentUser.id.toString());
            // const remoteMemberId = parseInt(memberId);
            // Determina si este cliente debe iniciar la oferta
            // const shouldInitiate = localUserId < remoteMemberId;

            // Llama a la nueva función para iniciar la llamada con este peer
            // await initiateCallForPeer(memberId, shouldInitiate);
            getOrCreatePeerConnection(member.id);

        });


     
        joinedChannel.subscribed(() => {
          console.log("✅ Suscrito correctamente al canal video room.");
        });

        joinedChannel.error((err: any) => {
          console.error("❌ Error en canal de video-room:", err);
          channelRef.current = null;
          setError("No se pudo conectar a la sala de video.");
          setLoading(false);
          setHasJoinedChannel(false);
        });


        // --- Listener para señales WebRTC (Ofertas, Respuestas, Candidatos ICE) ---
      joinedChannel.listenForWhisper('Signal', async ({ to, from, data }: { to: string; from: string; data: any }) => {
          if (to !== String(currentUser.id)) return;

          const pc = getOrCreatePeerConnection(from);

          try {
              switch (data.type) {
                  case 'offer':
                      console.log(`[SDP Offer] Recibida oferta de ${from}. Estableciendo RemoteDescription.`);
                        // Antes de setRemoteDescription, asegúrate de que los tracks locales estén añadidos.
                        if (localStream) {
                            localStream.getTracks().forEach(track => {
                                if (!pc.getSenders().some(sender => sender.track === track)) {
                                    pc.addTrack(track, localStream);
                                    console.log(`[SDP Offer Recv] ✅ Añadido track local ${track.kind} a PC de ${from}`);
                                }
                            });
                        }
                      await pc.setRemoteDescription(new RTCSessionDescription({
                          type: data.sdpType, // Usa el sdpType que enviaste
                          sdp: data.sdp
                      }));
                      console.log(`[SDP Offer] Creando y enviando ANSWER a ${from}.`);
                      const answer = await pc.createAnswer();
                      await pc.setLocalDescription(answer);
                      sendSignal(from, { type: 'answer', sdp: answer.sdp, sdpType: answer.type }); // También envía el tipo de la respuesta
                      break;
                  case 'answer':
                      console.log(`[SDP Answer] Recibida respuesta de ${from}. Estableciendo RemoteDescription.`);
                      await pc.setRemoteDescription(new RTCSessionDescription({
                          type: data.sdpType, // Usa el sdpType que enviaste
                          sdp: data.sdp
                      }));
                      break;
                  case 'candidate':
                      if (data.candidate) {
                          // Reconstruye RTCIceCandidate a partir del objeto plano
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
        console.error("❌ Error al unirse al canal video-room:", error);
        channelRef.current = null;
        setError("No se pudo conectar a la sala de video.");
        setLoading(false);
        setHasJoinedChannel(false);
      });

    // Función de limpieza al desmontar o cuando las dependencias cambien
    return () => {
      console.log("Limpiando useEffect de conexión al canal.");
      if (currentChannelInstance) {
        currentChannelInstance.leave(); // Deja el canal de Echo/Reverb
        setHasJoinedChannel(false);
      }
      // Cierra todas las PeerConnections
      Object.values(peerConnectionsRef.current).forEach(pc => {
          if (pc.connectionState !== 'closed') pc.close();
      });
      peerConnectionsRef.current = {}; // Limpia el ref explícitamente
      setParticipants({}); // Limpia los participantes
      channelRef.current = null; // Limpia el ref del canal
    };
  }, [roomId, currentUser, localStream, sendSignal, getOrCreatePeerConnection]); // Añadido getOrCreatePeerConnection

  // --- Listeners para Whispers de estado de video/micrófono ---
  useEffect(() => {
    const currentChannel = channelRef.current;
    if (currentChannel) {
      const chatListener = (msg: { sender: string; text: string }) => {
        setMessages(prev => [...prev, msg]);
      };
      currentChannel.listenForWhisper('chat-message', chatListener);

      currentChannel.listenForWhisper('toggle-video', ({ id, enabled }: { id: string; enabled: boolean }) => {
        // console.log(`[toggle-video] Recibido para ${id}: ${enabled}`);
        setParticipants(prev => ({
          ...prev,
          [id]: { ...prev[id], videoEnabled: enabled }
        }));
      });

      currentChannel.listenForWhisper('toggle-mic', ({ id, enabled }: { id: string; enabled: boolean }) => {
        // console.log(`[toggle-mic] Recibido para ${id}: ${enabled}`);
        setParticipants(prev => ({
          ...prev,
          [id]: { ...prev[id], micEnabled: enabled }
        }));
      });

      return () => {
        // Laravel Echo / Reverb se encarga de limpiar listeners al hacer `channel.leave()`
        // Si tienes listeners de `listenForWhisper` que necesitan ser explícitamente removidos,
        // tendrías que ver la implementación de `ReverbWebSocketService`.
      };
    }
  }, [currentUser?.id]);

  // Logs para depuración de participantes
  useEffect(() => {
    // console.log('🔄 Lista de participantes actualizada (estado):', participants);
  }, [participants]);

  // Funciones de control de medios
  const toggleVideo = () => {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    if (!videoTrack) return;
    videoTrack.enabled = !videoTrack.enabled;
    setVideoEnabled(videoTrack.enabled);

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

    channelRef.current?.whisper('toggle-mic', {
      id: currentUser?.id,
      enabled: audioTrack.enabled,
    });
  };

  const toggleScreenShare = async () => {
    if (!localStream) return; // Asegúrate de tener el stream original

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }); // Audio para compartir audio del sistema si se desea
      const screenVideoTrack = screenStream.getVideoTracks()[0];
      const screenAudioTrack = screenStream.getAudioTracks()[0]; // Si compartes audio del sistema

      // Reemplaza las pistas en todas las PeerConnections existentes
      Object.values(peerConnectionsRef.current).forEach(pc => {
        const videoSender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (videoSender) {
          videoSender.replaceTrack(screenVideoTrack);
        }
        const audioSender = pc.getSenders().find(s => s.track?.kind === 'audio');
        if (audioSender && screenAudioTrack) { // Solo si hay audio en la compartición de pantalla
            audioSender.replaceTrack(screenAudioTrack);
        }
      });

      // Cuando la compartición de pantalla termina (ej. el usuario hace clic en "Detener compartir")
      screenVideoTrack.onended = () => {
        // Vuelve a cambiar a la cámara original
        const cameraVideoTrack = localStream.getVideoTracks()[0];
        const cameraAudioTrack = localStream.getAudioTracks()[0];

        Object.values(peerConnectionsRef.current).forEach(pc => {
          const videoSender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (videoSender) {
            videoSender.replaceTrack(cameraVideoTrack);
          }
          const audioSender = pc.getSenders().find(s => s.track?.kind === 'audio');
          if (audioSender && cameraAudioTrack) {
              audioSender.replaceTrack(cameraAudioTrack);
          }
        });
        setVideoEnabled(true); // Tu cámara local debería estar visible de nuevo
        setMicEnabled(cameraAudioTrack?.enabled || false); // Tu micrófono local debería estar habilitado de nuevo
      };
      setVideoEnabled(false); // Tu cámara local debería ocultarse (solo se ve la pantalla compartida)
      setMicEnabled(screenAudioTrack?.enabled || false); // El micrófono local debería deshabilitarse si se comparte audio del sistema

    } catch (error) {
      console.error("Error sharing screen:", error);
      // Vuelve al estado original si hay un error
      setVideoEnabled(localStream?.getVideoTracks()[0]?.enabled || true);
      setMicEnabled(localStream?.getAudioTracks()[0]?.enabled || true);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !currentUser?.name) return; // Asegúrate de que currentUser.name esté disponible
    const msg = { sender: currentUser.name, text: chatInput };
    setMessages(prev => [...prev, msg]);
    setChatInput('');
    channelRef.current?.whisper('chat-message', msg);
  };

  const endCall = () => {
    // Detener todos los tracks de los streams locales
    localStream?.getTracks().forEach(track => track.stop());

    // Cerrar todas las PeerConnections activas
    Object.values(peerConnectionsRef.current).forEach(pc => {
      if (pc.connectionState !== 'closed') pc.close();
    });
    peerConnectionsRef.current = {}; // Limpiar el ref

    // Resetear estados relevantes
    setLocalStream(null);
    setParticipants({});
    setMessages([]);
    setIsRecording(false);
    setRemoteStreams({}); // Asegúrate de limpiar también los streams remotos

    // Dejar el canal de Reverb
    if (channelRef.current) {
      channelRef.current.leave();
      channelRef.current = null;
    }

    navigate('/rooms'); // Redirigir al usuario
  };

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

  // Obtenemos los IDs de los participantes del estado 'participants'
  const participantIds = Object.keys(participants);

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
                    {/* Indicador de volumen para el micrófono local */}
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className={`w-1 rounded-full bg-blue-400 transition-all duration-100 ${
                          volume > i * (255 / 5) ? `h-${(i + 1) * 2}` : 'h-1' // Ajusta el multiplicador para el tamaño visual
                        }`}
                      />
                    ))}
                </div>
              )}
            </div>

            {/* Videos remotos */}
            {participantIds.map(id => {
              const participantData = participants[id];
              // Asegúrate de que `participantData` y `participantData.stream` existan antes de renderizar
              if (!participantData || !participantData.stream) {
                  // Puedes renderizar un placeholder si aún no hay stream pero sí participante
                  return (
                    <div key={id} className="relative rounded-xl overflow-hidden border border-gray-700 shadow-lg aspect-video bg-gray-800 flex items-center justify-center text-gray-400">
                      Cargando video de {participantData?.name || `Usuario ${id}`}...
                    </div>
                  );
              }

              return (
                <RemoteVideo
                  key={id}
                  stream={participantData.stream}
                  name={participantData.name}
                  id={participantData.id}
                />
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