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
  videoEnabled: boolean; // <-- AÑADIDO
  micEnabled: boolean;
  
}

const RemoteVideo: React.FC<RemoteVideoProps> = ({ stream, name, id, videoEnabled, micEnabled }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(true); // Estado para controlar el mute del video remoto (inicialmente muteado)
// RemoteVideo.tsx
useEffect(() => {
  console.log(`[RemoteVideo DEBUG] Renderizando ${name} (ID: ${id}). Stream recibido:`, stream);
  if (videoRef.current && stream) {
    videoRef.current.srcObject = stream;
    videoRef.current.muted = isMuted; // Asegura que esté muteado para autoplay

    console.log(`[RemoteVideo DEBUG] Asignando srcObject para ${name}. Tracks:`, stream.getTracks().map(t => t.kind));

    stream.getTracks().forEach(track => {
    console.log(`[RemoteVideo Track Debug for ${name}] Kind: ${track.kind}, ID: ${track.id}, Label: ${track.label}, Enabled: ${track.enabled}, ReadyState: ${track.readyState}`);
    // Para video tracks, también puedes intentar obtener las capacidades si te da más información
    if (track.kind === 'video') {
        const settings = track.getSettings();
        console.log(`[RemoteVideo Video Track Settings for ${name}] Width: ${settings.width}, Height: ${settings.height}, FrameRate: ${settings.frameRate}, AspectRatio: ${settings.aspectRatio}`);
    }
  });
    if (stream.getVideoTracks().length > 0) {
        console.log(`[RemoteVideo DEBUG] Video track de ${name} habilitado:`, stream.getVideoTracks()[0].enabled);
    }
    if (stream.getAudioTracks().length > 0) {
        console.log(`[RemoteVideo DEBUG] Audio track de ${name} habilitado:`, stream.getAudioTracks()[0].enabled);
    }

    // --- NUEVOS LOGS CLAVE AQUÍ ---
    const checkVideoState = () => {
        if (videoRef.current) {
            console.log(`[RemoteVideo State for ${name}] videoWidth: ${videoRef.current.videoWidth}, videoHeight: ${videoRef.current.videoHeight}, paused: ${videoRef.current.paused}, muted: ${videoRef.current.muted}`);
        }
    };

    videoRef.current.onloadedmetadata = () => {
        console.log(`[RemoteVideo DEBUG] onloadedmetadata para ${name} disparado.`);
        checkVideoState();
        videoRef.current?.play().catch(e => {
            console.warn(`[RemoteVideo DEBUG] Error al intentar reproducir video de ${name} (ID: ${id}) en onloadedmetadata:`, e);
            if (e.name === 'NotAllowedError') {
                console.log(`[RemoteVideo DEBUG] Autoplay bloqueado para ${name}.`);
            }
        });
    };

    videoRef.current.onplay = () => {
        console.log(`[RemoteVideo DEBUG] onplay para ${name} disparado. El video ESTÁ INTENTANDO REPRODUCIRSE.`);
        checkVideoState();
    };

    videoRef.current.onplaying = () => {
        console.log(`[RemoteVideo DEBUG] onplaying para ${name} disparado. El video SE ESTÁ REPRODUCIENDO ACTIVAMENTE.`);
        checkVideoState();
    };

    videoRef.current.onpause = () => {
        console.log(`[RemoteVideo DEBUG] onpause para ${name} disparado. El video está PAUSADO.`);
        checkVideoState();
    };

    videoRef.current.onerror = (event) => {
        console.error(`[RemoteVideo DEBUG] Error en el video de ${name} (ID: ${id}):`, event);
        checkVideoState();
    };

    // Intenta un play inicial (redundante si onloadedmetadata se encarga, pero no hace daño)
    videoRef.current.play().catch(e => {
        console.warn(`[RemoteVideo DEBUG] Error al intentar reproducir video de ${name} (ID: ${id}) en inicial:`, e);
        if (e.name === 'NotAllowedError') {
            console.log(`[RemoteVideo DEBUG] Autoplay bloqueado para ${name}.`);
        }
    });

    // Añade listeners para limpieza
    const currentVideoRef = videoRef.current;
    return () => {
        if (currentVideoRef) {
            currentVideoRef.onloadedmetadata = null;
            currentVideoRef.onplay = null;
            currentVideoRef.onplaying = null;
            currentVideoRef.onpause = null;
            currentVideoRef.onerror = null;
            // No limpiar srcObject aquí si se mantiene el componente montado
        }
    };

  } else if (videoRef.current) {
       console.log(`[RemoteVideo DEBUG] Limpiando srcObject para ${name} (stream es null).`);
       videoRef.current.srcObject = null;
  }
}, [stream, name, id, isMuted]); // isMuted debe ser una dependencia

// ... (tu función toggleMute y el JSX del return) ...
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
      {/* El video real */}
      <video ref={videoRef} autoPlay muted={isMuted} className="w-full h-full object-cover" data-remote-id={id} />

      {/* Capa para indicar cámara apagada si el VIDEO del remoto está deshabilitado */}
      {/* Esto usa la prop `videoEnabled` que ahora pasas */}
      {!videoEnabled && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-75 text-gray-400">
          <VideoOff size={48} /> {/* Icono grande de cámara apagada */}
        </div>
      )}

      <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 px-3 py-1 text-sm rounded text-white">
        {name}
      </div>

      {/* Botón para que el usuario local mutée/desmutée el audio del remoto */}
      <button
        onClick={toggleMute}
        className="absolute top-2 left-2 bg-gray-800 bg-opacity-70 text-white p-1 rounded-full text-xs z-10"
      >
        {/* Este icono muestra el estado de muteo LOCAL para ESTE video remoto */}
        {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
      </button>

      {/* Ícono para indicar el estado del MICRÓFONO REMOTO (no es un botón, es un indicador) */}
      {/* Esto usa la prop `micEnabled` que ahora pasas */}
      {!micEnabled && (
        <div className="absolute top-2 right-2 bg-gray-800 bg-opacity-70 text-white p-1 rounded-full text-xs z-10">
          <MicOff size={16} /> {/* Icono de micrófono apagado para indicar que el remoto lo tiene deshabilitado */}
        </div>
      )}
    </div>
  );
};


const VideoRoom: React.FC = () => {
  const API_URL = import.meta.env.VITE_API_URL;
  const navigate = useNavigate();
  const iceCandidatesQueueRef = useRef<Record<string, RTCIceCandidate[]>>({});
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
      // En la configuración de RTCPeerConnection (donde creas `pc`)
     // En tu VideoRoom.tsx o donde configures RTCPeerConnection
      // En tu VideoRoom.tsx o donde sea que configures RTCPeerConnection
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' },
          // Tu servidor TURN local
          {
            urls: 'turn:127.0.0.1:3478?transport=udp', // Asegúrate de que el puerto 3478 sea el que usa CoTURN
            username: 'miusuario', // El usuario que configuraste en turnserver.conf
            credential: 'micontrasena', // La contraseña que configuraste
          },
          {
            urls: 'turn:127.0.0.1:3478?transport=tcp', // TURN sobre TCP, muy importante para compatibilidad
            username: 'miusuario',
            credential: 'micontrasena',
          },
          // Si hubieras configurado TURNs (TLS) en un puerto como 5349 con certificados (no recomendado para inicio)
          // {
          //   urls: 'turns:127.0.0.1:5349?transport=tcp',
          //   username: 'miusuario',
          //   credential: 'micontrasena',
          // },
        ],
        iceTransportPolicy: 'all', // Permite todos los tipos de candidatos ICE (host, srflx, relay)
        bundlePolicy: 'balanced', // Optimiza el bundling de medios
        rtcpMuxPolicy: 'require', // Requiere multiplexación de RTCP
        iceCandidatePoolSize: 0, // Un pool de 0 está bien para la mayoría de los casos
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

        // Actualiza el stream para este participante
        setParticipants(prev => {
            const existingParticipant = prev[peerId];
            if (existingParticipant) {
                // Si el stream ya existe, verifica si es el mismo.
                // Si no, o si es nulo, asigna el nuevo stream.
                if (!existingParticipant.stream || existingParticipant.stream.id !== event.streams[0].id) {
                    console.log(`[ontrack] Actualizando stream para ${peerId} en el estado.`);
                    return {
                        ...prev,
                        [peerId]: {
                            ...existingParticipant,
                            stream: event.streams[0] // Asigna el stream completo
                        }
                    };
                }
            } else {
                // Si el participante aún no está en el estado (lo cual no debería pasar
                // si here/joining lo manejan, pero es un fallback), añádelo con el stream.
                console.warn(`[ontrack] Participante ${peerId} no encontrado al recibir track. Agregándolo.`);
                return {
                    ...prev,
                    [peerId]: {
                        id: peerId,
                        name: `Usuario ${peerId}`, // Puedes refinar esto si el nombre viene en otro lugar
                        videoEnabled: true, // Asume true inicialmente
                        micEnabled: true,   // Asume true inicialmente
                        stream: event.streams[0]
                    }
                };
            }
            return prev; // No hay cambios si el stream ya existe y es el mismo
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

  // --- useEffect para obtener el stream local ---
  useEffect(() => {
    // En el useEffect donde llamas a getUserMedia:
    const startMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        const videoTrack = stream.getVideoTracks()[0];
        const audioTrack = stream.getAudioTracks()[0];

        // Debugging: Verifica el estado real de los tracks al obtenerlos
        console.log(`[Local Stream Init] Video track enabled: ${videoTrack?.enabled}, Audio track enabled: ${audioTrack?.enabled}`);

        setVideoEnabled(videoTrack?.enabled || false);
        setMicEnabled(audioTrack?.enabled || false);

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
                  // En tu VideoRoom.tsx, dentro de joinedChannel.listenForWhisper('Signal')
                  case 'offer':
                      console.log(`[SDP Offer] Recibida oferta de ${from}. Estableciendo RemoteDescription.`);

                      // Asegúrate de añadir los tracks locales a la PC del respondedor.
                      // Idealmente, esto ya se hizo antes de llegar aquí,
                      // pero si no, es un buen lugar para asegurarse.
                      if (localStream) {
                          localStream.getTracks().forEach(track => {
                              // Solo añade si el track no ha sido añadido ya por un sender
                              if (!pc.getSenders().some(sender => sender.track === track)) {
                                  pc.addTrack(track, localStream);
                                  console.log(`[SDP Offer Recv] ✅ Añadido track local ${track.kind} a PC de ${from}`);
                              }
                          });
                      }

                      await pc.setRemoteDescription(new RTCSessionDescription({
                          type: data.sdpType,
                          sdp: data.sdp
                      }));

                      // --- Lógica CONSOLIDADA para procesar candidatos ICE en cola DESPUÉS de setRemoteDescription ---
                      const peerCandidates = iceCandidatesQueueRef.current[from]; // Usa 'from' consistentemente
                      if (peerCandidates && peerCandidates.length > 0) {
                          console.log(`[ICE Candidate Queue] Procesando ${peerCandidates.length} candidatos en cola para ${from}.`);
                          for (const candidate of peerCandidates) {
                              try {
                                  await pc.addIceCandidate(new RTCIceCandidate(candidate));
                                  console.log(`[ICE Candidate Queue] Añadido candidato en cola para ${from}:`, candidate);
                              } catch (e) {
                                  console.error(`[ICE Candidate Queue] Error al añadir candidato en cola para ${from}:`, e, candidate);
                              }
                          }
                          delete iceCandidatesQueueRef.current[from]; // Limpia la cola para este peer
                      }


                      console.log(`[SDP Offer] Creando y enviando ANSWER a ${from}.`);
                      const answer = await pc.createAnswer();
                      await pc.setLocalDescription(answer);
                      sendSignal(from, { type: 'answer', sdp: answer.sdp, sdpType: answer.type });
                      break;

                  case 'answer':
                      console.log(`[SDP Answer] Recibida respuesta de ${from}. Estableciendo RemoteDescription.`);
                      await pc.setRemoteDescription(new RTCSessionDescription({
                          type: data.sdpType,
                          sdp: data.sdp
                      }));

                      // --- Lógica CONSOLIDADA para procesar candidatos ICE en cola DESPUÉS de setRemoteDescription ---
                      const answerPeerCandidates = iceCandidatesQueueRef.current[from]; // Usa 'from' consistentemente
                      if (answerPeerCandidates && answerPeerCandidates.length > 0) {
                          console.log(`[ICE Candidate Queue] Procesando ${answerPeerCandidates.length} candidatos en cola para ${from}.`);
                          for (const candidate of answerPeerCandidates) {
                              try {
                                  await pc.addIceCandidate(new RTCIceCandidate(candidate));
                                  console.log(`[ICE Candidate Queue] Añadido candidato en cola para ${from}:`, candidate);
                              } catch (e) {
                                  console.error(`[ICE Candidate Queue] Error al añadir candidato en cola para ${from}:`, e, candidate);
                              }
                          }
                          delete iceCandidatesQueueRef.current[from]; // Limpia la cola para este peer
                      }
                      break;
                  // VideoRoom.tsx - dentro de joinedChannel.listenForWhisper('Signal')
                  case 'candidate':
                      if (data.candidate && data.candidate.candidate) { // Añade una verificación más estricta para data.candidate.candidate
                          console.log(`[ICE Candidate IN] Recibido candidato para ${from}:`, data.candidate);
                          const peerConnection = peerConnectionsRef.current[from]; // Usa la ref correcta
                          if (peerConnection && peerConnection.remoteDescription && peerConnection.remoteDescription.type) {
                              console.log(`[ICE Candidate IN] RemoteDescription YA ESTABLECIDA para ${from}. Tipo: ${peerConnection.remoteDescription.type}`);
                              try {
                                  await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
                                  console.log(`[ICE Candidate IN] Añadido ICE candidate para ${from} exitosamente.`);
                              } catch (e) {
                                  // Esto es importante: capturar y loguear errores al añadir candidatos
                                  console.error(`[ICE Candidate IN] Error al añadir ICE candidate para ${from}:`, e, data.candidate);
                              }
                          } else {
                              console.log(`[ICE Candidate IN] Candidato para ${from} en cola. RemoteDescription aún no establecida. Actual remoteDescription:`, peerConnection ? peerConnection.remoteDescription : 'PeerConnection no existe.');
                              if (!iceCandidatesQueueRef.current[from]) {
                                  iceCandidatesQueueRef.current[from] = [];
                              }
                              iceCandidatesQueueRef.current[from].push(data.candidate);
                          }
                      } else {
                          console.warn("Received null/undefined ICE candidate or candidate.candidate. Ignoring.");
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
  const allParticipants = Object.values(participants);

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
        {allParticipants.map(participant => {
          // Aquí está la clave: verificar si el stream existe antes de renderizar RemoteVideo
          // Si el stream es null, se puede mostrar un placeholder.
          // Si el stream existe, renderizar RemoteVideo.
          // Ya tienes la lógica de placeholder en RemoteVideo con !videoEnabled,
          // pero si stream es null, no deberíamos renderizar RemoteVideo
          // Esto es lo que estaba pasando: estabas mostrando tu div de "Cargando video..."
          // en lugar de tu componente RemoteVideo.
          
          if (!participant.stream) {
            // Placeholder si el stream aún no ha llegado
            return (
              <div
                key={participant.id}
                className="relative rounded-xl overflow-hidden border border-gray-700 shadow-lg aspect-video bg-gray-800 flex items-center justify-center text-gray-400"
              >
                Cargando video de {participant.name}...
              </div>
            );
          }

          return (
            <RemoteVideo
              key={participant.id}
              stream={participant.stream}
              name={participant.name}
              id={participant.id}
              videoEnabled={participant.videoEnabled}
              micEnabled={participant.micEnabled}
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