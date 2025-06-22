<<<<<<< HEAD
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createReverbWebSocketService, EchoChannel } from '../../services/ReverbWebSocketService';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase'; // Asumo que esto es relevante para otras partes de tu app
import { Room } from '../../types'; // Asumo que este tipo está definido
import { useMicVolume } from '../../hooks/useMicVolume'; // Asumo que tu hook está bien

import { Video, VideoOff, Mic, MicOff, ScreenShare, StopCircle, MessageSquare, PhoneOff } from 'lucide-react';


// ¡IMPORTA EL COMPONENTE REMOTEVIDEO AQUÍ!
import RemoteVideo from './RemoteVideo'; // Ajusta la ruta si RemoteVideo.tsx está en otro lugar


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
  const streamLogCountsRef = useRef<Record<string, number>>({});
// En VideoRoom.tsx, dentro del componente:
const [hasJoinedChannel, setHasJoinedChannel] = useState(false);
const [isSharingScreen, setIsSharingScreen] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);
const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
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
  useEffect(() => {
    console.log(`[VideoRoom State] Participants actualizados:`, Object.keys(participants).map(id => ({
        id,
        name: participants[id].name,
        hasStream: !!participants[id].stream,
        streamId: participants[id].stream?.id,
        videoEnabled: participants[id].videoEnabled,
        micEnabled: participants[id].micEnabled
    })));
  }, [participants]);

  // Log el estado de cada PeerConnection en peerConnectionsRef.current
  useEffect(() => {
    // Para ver el estado inicial y cualquier cambio posterior en las PeerConnections
    const logPeerConnectionStates = () => {
      console.log(`[VideoRoom State] Estado actual de peerConnectionsRef:`);
      const pcs = peerConnectionsRef.current;
      if (Object.keys(pcs).length === 0) {
        console.log("  No hay PeerConnections activas.");
        return;
      }
      // for (const peerId in pcs) {
      //   const pc = pcs[peerId];
      //   if (pc) {
      //     console.log(`  - Peer ${peerId}:`);
      //     console.log(`    - connectionState: ${pc.connectionState}`);
      //     console.log(`    - signalingState: ${pc.signalingState}`);
      //     console.log(`    - iceConnectionState: ${pc.iceConnectionState}`);
      //     console.log(`    - iceGatheringState: ${pc.iceGatheringState}`);
      //     console.log(`    - localDescription: ${pc.localDescription?.type || 'N/A'}`);
      //     console.log(`    - remoteDescription: ${pc.remoteDescription?.type || 'N/A'}`);
      //     console.log(`    - senders: ${pc.getSenders().length} (${pc.getSenders().map(s => s.track?.kind).join(', ')})`);
      //     console.log(`    - receivers: ${pc.getReceivers().length} (${pc.getReceivers().map(r => r.track?.kind).join(', ')})`);
      //   }
      // }
    };

    // Logear inmediatamente
    logPeerConnectionStates();

    // Establecer un intervalo para logear periódicamente (útil para cambios de estado ICE/Connection)
    const intervalId = setInterval(logPeerConnectionStates, 5000); // Cada 5 segundos

    return () => {
      clearInterval(intervalId); // Limpiar el intervalo al desmontar
    };
  }, []); // Dependencia vacía para que se ejecute una vez y establezca el intervalo

  // Dentro de tu función sendSignal:
  const sendSignal = useCallback(async (toPeerId: string, signalData: any) => {
    if (!channelRef.current) {
      console.error("sendSignal: Canal no disponible.");
      return;
    }
    // Añade este log para verificar si la señal 'answer' se está intentando enviar
    console.log(`[SIGNAL OUT DEBUG] Intentando enviar señal de tipo ${signalData.type} de ${currentUser?.id} a ${toPeerId}`);
    try {
      await channelRef.current.whisper('Signal', {
        to: toPeerId,
        from: String(currentUser?.id), // Asegúrate de que esto sea la ID correcta del remitente
        data: signalData
      });
      console.log(`[SIGNAL OUT DEBUG] ✅ Señal ${signalData.type} enviada de ${currentUser?.id} a ${toPeerId}`);
    } catch (error) {
      console.error(`[SIGNAL OUT ERROR] Error al enviar señal ${signalData.type} de ${currentUser?.id} a ${toPeerId}:`, error);
    }
  }, [currentUser, channelRef]); // Asegúrate de que currentUser esté en las dependencias si lo usas
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
            realm: 'mi_servidor_turn_local'
          },
          {
            urls: 'turn:127.0.0.1:3478?transport=tcp', // TURN sobre TCP, muy importante para compatibilidad
            username: 'miusuario',
            credential: 'micontrasena',
            realm: 'mi_servidor_turn_local'
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
            // --- CAMBIO: Añadir los tracks locales INMEDIATAMENTE al crear la PC ---
      // Esto asegura que pc.onnegotiationneeded se dispare si es necesario
      // o que la oferta inicial contenga los tracks.
      if (localStream) {
          localStream.getTracks().forEach(track => {
              console.log(`[PC Creation DEBUG] Track ${track.kind} readyState: ${track.readyState}`); // <-- NUEVO LOG
              if (!pc.getSenders().some(sender => sender.track === track)) {
                  pc.addTrack(track, localStream);
                  console.log(`[PC Creation] ✅ Añadido track local ${track.kind} a PC de ${peerId}`);
              } else {
                  console.log(`[PC Creation] Track ${track.kind} ya EXISTE para ${peerId}. No se añade de nuevo.`);
              }
          });
      }
      peerConnectionsRef.current[peerId] = pc;

      pc.ontrack = (event) => {
          // Ahora, peerId ya está disponible desde el closure de getOrCreatePeerConnection
          // y es el ID REAL del usuario remoto, no la ID del track.
          const incomingStream = event.streams[0];
          const trackKind = event.track.kind; // 'audio' o 'video'

          // Lógica para limitar logs del stream (la que ya implementaste)
          if (incomingStream) {
              const streamId = incomingStream.id;
              streamLogCountsRef.current[streamId] = (streamLogCountsRef.current[streamId] || 0) + 1;

              if (streamLogCountsRef.current[streamId] <= 3) {
                  console.log(`[ontrack DEBUG] Recibiendo ${trackKind} track de ${peerId} (Stream ID: ${streamId}).`);
              } else if (streamLogCountsRef.current[streamId] === 4) {
                  console.log(`[ontrack DEBUG] (Más de 3 logs para stream ${streamId}, suprimiendo logs adicionales para este stream)`);
              }
          } else {
              console.warn(`[ontrack DEBUG] Recibido evento sin stream para peer: ${peerId}`);
          }

          setParticipants(prev => {
              const existingParticipant = prev[peerId];
              if (existingParticipant) {
                  if (!existingParticipant.stream || existingParticipant.stream.id !== incomingStream.id) {
                      console.log(`[ontrack DEBUG] Actualizando stream para ${peerId} en el estado. Nuevo stream ID: ${incomingStream.id}`);
                      return {
                          ...prev,
                          [peerId]: {
                              ...existingParticipant,
                              stream: incomingStream // Asigna el stream completo
                          }
                      };
                  }
              } else {
                  console.warn(`[ontrack DEBUG] Participante ${peerId} no encontrado al recibir track. Agregándolo.`);
                  return {
                      ...prev,
                      [peerId]: {
                          id: peerId,
                          name: `Usuario ${peerId}`,
                          videoEnabled: true,
                          micEnabled: true,
                          stream: incomingStream
                      }
                  };
              }
              return prev;
          });
      };

            // --- CAMBIO CLAVE: Manejo de onicecandidate ---
      // Dentro de pc.onicecandidate:
      pc.onicecandidate = (event) => {
        if (event.candidate && currentUser) {
          console.log(`[ICE Candidate] Generado candidato para ${peerId}.`);
          // Envía event.candidate como un objeto plano para que sea reconstruido.
          sendSignal(peerId, { type: 'candidate', candidate: event.candidate.toJSON() });
        }
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
                console.log(`[SIGNAL OUT] Enviando OFFER de ${currentUser?.id} a ${peerId}:`, { type: 'offer', sdpType: offer.type }); // NUEVO LOG
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


      pc.oniceconnectionstatechange = () => {
          console.log(`[PC State - ICE] PeerConnection con ${peerId} ICE: ${pc.iceConnectionState}`);
      };
      pc.onconnectionstatechange = () => {
          console.log(`[PC State - Connection] PeerConnection con ${peerId} conexión: ${pc.connectionState}`);
      };
      pc.onsignalingstatechange = () => {
          console.log(`[PC State - Signaling] PeerConnection con ${peerId} signaling: ${pc.signalingState}`);
      };
      pc.onicegatheringstatechange = () => {
          console.log(`[PC State - Ice Gathering] PeerConnection con ${peerId} ICE gathering: ${pc.iceGatheringState}`);
      };

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
          console.log(`[DEBUG WHISPER RECIBIDO] Mensaje recibido: to=${to}, from=${from}, type=${data.type}`);

          if (to !== String(currentUser.id)) {
              console.warn(`[DEBUG WHISPER FILTRADO] Mensaje para otro usuario. Mi ID: ${currentUser.id}, Mensaje TO: ${to}`);
              return;
          }

          const pc = getOrCreatePeerConnection(from);

          try {
              switch (data.type) {
                  // En tu VideoRoom.tsx, dentro de joinedChannel.listenForWhisper('Signal')
                  case 'offer':
                      console.log(`[SDP Offer] Recibida oferta de ${from}. Estableciendo RemoteDescription.`);
                      console.log(`[SDP Offer Recv DEBUG] localStream disponible para ${from}?:`, !!localStream);
                      if (localStream) {
                          console.log(`[SDP Offer Recv DEBUG] localStream tracks para ${from}:`, localStream.getTracks().map(t => t.kind));
                          localStream.getTracks().forEach(track => {
                              const hasSender = pc.getSenders().some(sender => sender.track === track);
                              console.log(`[SDP Offer Recv DEBUG] Track ${track.kind} (ID: ${track.id}) ya tiene sender en PC de ${from}?: ${hasSender}`);
                              if (!hasSender) {
                                  pc.addTrack(track, localStream);
                                  console.log(`[SDP Offer Recv] ✅ Añadido track local ${track.kind} a PC de ${from}`);
                              } else {
                                  console.log(`[SDP Offer Recv] Track ${track.kind} ya EXISTE en PC de ${from}. No se añade de nuevo.`);
                              }
                          });
                      } else {
                          console.warn(`[SDP Offer Recv] localStream es NULO al recibir oferta de ${from}. No se pueden añadir tracks locales.`);
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
                      console.log(`[PC State - Signaling] PeerConnection con ${from} signaling: ${pc.signalingState}`); // <-- NUEVO LOG

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
                    // Agrega una verificación más estricta para data.candidate y data.candidate.candidate
                    if (data.candidate && data.candidate.candidate) {
                        console.log(`[ICE Candidate IN] Recibido candidato para ${from}:`, data.candidate);

                        // Asegúrate de usar la ref correcta para obtener la PeerConnection
                        const peerConnection = peerConnectionsRef.current[from];

                        // Solo procede si la PeerConnection existe
                        if (peerConnection) {
                            // Verifica si la RemoteDescription ya ha sido establecida
                            if (peerConnection.remoteDescription && peerConnection.remoteDescription.type) {
                                console.log(`[ICE Candidate IN] RemoteDescription YA ESTABLECIDA para ${from}. Tipo: ${peerConnection.remoteDescription.type}`);
                                try {
                                    // Intenta añadir el candidato ICE
                                    await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
                                    console.log(`[ICE Candidate IN] Añadido ICE candidate para ${from} exitosamente.`);
                                } catch (e) {
                                    // Es crucial capturar y loguear errores al añadir candidatos
                                    // ya que pueden indicar un problema con el candidato o el estado de la PC
                                    console.error(`[ICE Candidate IN] Error al añadir ICE candidate para ${from}:`, e, data.candidate);
                                }
                            } else {
                                // Si la RemoteDescription aún no está establecida, encola el candidato
                                console.log(`[ICE Candidate IN] Candidato para ${from} en cola. RemoteDescription aún no establecida. Actual remoteDescription:`, peerConnection.remoteDescription);

                                if (!iceCandidatesQueueRef.current[from]) {
                                    iceCandidatesQueueRef.current[from] = [];
                                }
                                iceCandidatesQueueRef.current[from].push(data.candidate);
                                console.log(`[ICE Candidate IN] Candidato añadido a la cola para ${from}. Cola actual: ${iceCandidatesQueueRef.current[from].length} candidatos.`);
                            }
                        } else {
                            console.warn(`[ICE Candidate IN] PeerConnection para ${from} no encontrada al intentar añadir candidato. Ignorando candidato.`);
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
   setIsSharingScreen(true);
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
         setIsSharingScreen(false);
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
  
const [roomParticipantId, setRoomParticipantId] = useState<number | null>(null);
useEffect(() => {
  const fetchRoomParticipantId = async () => {
    if (!roomId || !currentUser?.id) return;

    try {
      const response = await fetch(`${API_URL}/auth/room-participant?user_id=${currentUser.id}&room_id=${roomId}`, {
        headers: {
          Authorization: `Bearer ${currentUser.token}`,
          Accept: 'application/json',
        }
      });

      const data = await response.json();

      if (data?.id) {
        console.log('✅ room_participant_id obtenido:', data.id);
        setRoomParticipantId(data.id);
      } else {
        console.error('❌ No se encontró room_participant_id:', data);
      }
    } catch (error) {
      console.error('❌ Error al obtener room_participant_id:', error);
    }
  };

  fetchRoomParticipantId();
}, [roomId, currentUser?.id]);
if (!roomParticipantId) return;

console.log('roompartricipan', roomParticipantId);
const handleSendMessage = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!chatInput.trim() || !currentUser?.name || !channelRef.current || !roomParticipantId) return;

  const payload = {
    content: chatInput.trim(),
    room_participant_id: roomParticipantId,
    room_id: Number(roomId),
  };
  console.log('el payload', payload);

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

    if (data?.data) {
      setMessages(prev => [...prev, {
        sender: currentUser.name,
        text: chatInput.trim(),
      }]);

      channelRef.current?.whisper('chat-message', {
        sender: currentUser.name,
        text: chatInput.trim(),
      });

      setChatInput('');
    } else {
      console.error('Respuesta inesperada:', data);
    }
  } catch (error) {
    console.error('Error al enviar mensaje:', error);
  }
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
  //const allParticipants = Object.values(participants);


  return (
    <div className="flex h-screen bg-black text-white">
      <div className="flex flex-col flex-1 relative">
        <div className="flex-1 flex items-center justify-center bg-gray-950">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-6xl p-4">

            {/* Video local */}
            <div
  className={`
    relative rounded-xl overflow-hidden border border-gray-700 shadow-lg aspect-video bg-black
    ${isSharingScreen ? 'col-span-2 w-full' : ''}
  `}
>
  <video
    ref={localVideoRef}
    autoPlay
    muted
    className="w-full h-full object-contain" // usa contain si no querés recortar pantalla compartida
  />
  <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 px-3 py-1 text-sm rounded text-white">
    {isSharingScreen ? 'Compartiendo pantalla' : 'Tú'}
  </div>
  {/* ... mic indicator */}
</div>
            
            {/* ¡VIDEOS REMOTOS AHORA USANDO EL COMPONENTE REMOTEVIDEO! */}
            {Object.values(participants).map(p => (
              // Asegúrate de que 'p' no sea el usuario local si no quieres renderizar tu propio video dos veces
              // Si tu `participants` ya excluye al usuario local, entonces no necesitas esta comprobación.
              // Asumo que `p.id` es diferente de `currentUser?.id`.
              p.id !== currentUser?.id && ( // Opcional: Asegura que no se renderice el video del usuario local aquí
                <RemoteVideo
                  key={p.id} // La `key` es CRÍTICA para el rendimiento de React en listas
                  stream={p.stream} // ¡Aquí pasas el MediaStream al componente RemoteVideo!
                  name={p.name}
                  id={p.id}
                  videoEnabled={p.videoEnabled}
                  micEnabled={p.micEnabled}
                />
              )
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

=======
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createReverbWebSocketService, EchoChannel } from '../../services/ReverbWebSocketService';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase'; // Asumo que esto es relevante para otras partes de tu app
import { Room } from '../../types'; // Asumo que este tipo está definido
import { useMicVolume } from '../../hooks/useMicVolume'; // Asumo que tu hook está bien

import { Video, VideoOff, Mic, MicOff, ScreenShare, StopCircle, MessageSquare, PhoneOff } from 'lucide-react';


// ¡IMPORTA EL COMPONENTE REMOTEVIDEO AQUÍ!
import RemoteVideo from './RemoteVideo'; // Ajusta la ruta si RemoteVideo.tsx está en otro lugar
import ChatBox from './ChatBox';

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
  const streamLogCountsRef = useRef<Record<string, number>>({});
// En VideoRoom.tsx, dentro del componente:
const [hasJoinedChannel, setHasJoinedChannel] = useState(false);
const [isSharingScreen, setIsSharingScreen] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);
const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
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
  useEffect(() => {
    Object.keys(participants).map(id => ({
        id,
        name: participants[id].name,
        hasStream: !!participants[id].stream,
        streamId: participants[id].stream?.id,
        videoEnabled: participants[id].videoEnabled,
        micEnabled: participants[id].micEnabled
    }));
  }, [participants]);

  // Log el estado de cada PeerConnection en peerConnectionsRef.current
  useEffect(() => {
    // Para ver el estado inicial y cualquier cambio posterior en las PeerConnections
    const logPeerConnectionStates = () => {
      //console.log(`[VideoRoom State] Estado actual de peerConnectionsRef:`);
      const pcs = peerConnectionsRef.current;
      if (Object.keys(pcs).length === 0) {
        //console.log("  No hay PeerConnections activas.");
        return;
      }
      // for (const peerId in pcs) {
      //   const pc = pcs[peerId];
      //   if (pc) {
      //     console.log(`  - Peer ${peerId}:`);
      //     console.log(`    - connectionState: ${pc.connectionState}`);
      //     console.log(`    - signalingState: ${pc.signalingState}`);
      //     console.log(`    - iceConnectionState: ${pc.iceConnectionState}`);
      //     console.log(`    - iceGatheringState: ${pc.iceGatheringState}`);
      //     console.log(`    - localDescription: ${pc.localDescription?.type || 'N/A'}`);
      //     console.log(`    - remoteDescription: ${pc.remoteDescription?.type || 'N/A'}`);
      //     console.log(`    - senders: ${pc.getSenders().length} (${pc.getSenders().map(s => s.track?.kind).join(', ')})`);
      //     console.log(`    - receivers: ${pc.getReceivers().length} (${pc.getReceivers().map(r => r.track?.kind).join(', ')})`);
      //   }
      // }
    };

    // Logear inmediatamente
    logPeerConnectionStates();

    // Establecer un intervalo para logear periódicamente (útil para cambios de estado ICE/Connection)
    const intervalId = setInterval(logPeerConnectionStates, 5000); // Cada 5 segundos

    return () => {
      clearInterval(intervalId); // Limpiar el intervalo al desmontar
    };
  }, []); // Dependencia vacía para que se ejecute una vez y establezca el intervalo

  // Dentro de tu función sendSignal:
  const sendSignal = useCallback(async (toPeerId: string, signalData: any) => {
    if (!channelRef.current) {
      console.error("sendSignal: Canal no disponible.");
      return;
    }
    // Añade este log para verificar si la señal 'answer' se está intentando enviar
    //console.log(`[SIGNAL OUT DEBUG] Intentando enviar señal de tipo ${signalData.type} de ${currentUser?.id} a ${toPeerId}`);
    try {
      await channelRef.current.whisper('Signal', {
        to: toPeerId,
        from: String(currentUser?.id), // Asegúrate de que esto sea la ID correcta del remitente
        data: signalData
      });
      //console.log(`[SIGNAL OUT DEBUG] ✅ Señal ${signalData.type} enviada de ${currentUser?.id} a ${toPeerId}`);
    } catch (error) {
      console.error(`[SIGNAL OUT ERROR] Error al enviar señal ${signalData.type} de ${currentUser?.id} a ${toPeerId}:`, error);
    }
  }, [currentUser, channelRef]); // Asegúrate de que currentUser esté en las dependencias si lo usas
  // --- Función auxiliar para obtener/crear RTCPeerConnection ---
    const getOrCreatePeerConnection = useCallback((peerId: string) => {
    if (!peerConnectionsRef.current[peerId]) {
      //console.log(`[PC] Creando nueva RTCPeerConnection para peer: ${peerId}`);
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
            realm: 'mi_servidor_turn_local'
          },
          {
            urls: 'turn:127.0.0.1:3478?transport=tcp', // TURN sobre TCP, muy importante para compatibilidad
            username: 'miusuario',
            credential: 'micontrasena',
            realm: 'mi_servidor_turn_local'
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
            // --- CAMBIO: Añadir los tracks locales INMEDIATAMENTE al crear la PC ---
      // Esto asegura que pc.onnegotiationneeded se dispare si es necesario
      // o que la oferta inicial contenga los tracks.
      if (localStream) {
          localStream.getTracks().forEach(track => {
              //console.log(`[PC Creation DEBUG] Track ${track.kind} readyState: ${track.readyState}`); // <-- NUEVO LOG
              if (!pc.getSenders().some(sender => sender.track === track)) {
                  pc.addTrack(track, localStream);
                  //console.log(`[PC Creation] ✅ Añadido track local ${track.kind} a PC de ${peerId}`);
              } else {
                  //console.log(`[PC Creation] Track ${track.kind} ya EXISTE para ${peerId}. No se añade de nuevo.`);
              }
          });
      }
      peerConnectionsRef.current[peerId] = pc;

      pc.ontrack = (event) => {
          // Ahora, peerId ya está disponible desde el closure de getOrCreatePeerConnection
          // y es el ID REAL del usuario remoto, no la ID del track.
          const incomingStream = event.streams[0];
          const trackKind = event.track.kind; // 'audio' o 'video'

          // Lógica para limitar logs del stream (la que ya implementaste)
          if (incomingStream) {
              const streamId = incomingStream.id;
              streamLogCountsRef.current[streamId] = (streamLogCountsRef.current[streamId] || 0) + 1;

              if (streamLogCountsRef.current[streamId] <= 3) {
                  //console.log(`[ontrack DEBUG] Recibiendo ${trackKind} track de ${peerId} (Stream ID: ${streamId}).`);
              } else if (streamLogCountsRef.current[streamId] === 4) {
                  //console.log(`[ontrack DEBUG] (Más de 3 logs para stream ${streamId}, suprimiendo logs adicionales para este stream)`);
              }
          } else {
              console.warn(`[ontrack DEBUG] Recibido evento sin stream para peer: ${peerId}`);
          }

          setParticipants(prev => {
              const existingParticipant = prev[peerId];
              if (existingParticipant) {
                  if (!existingParticipant.stream || existingParticipant.stream.id !== incomingStream.id) {
                      //console.log(`[ontrack DEBUG] Actualizando stream para ${peerId} en el estado. Nuevo stream ID: ${incomingStream.id}`);
                      return {
                          ...prev,
                          [peerId]: {
                              ...existingParticipant,
                              stream: incomingStream // Asigna el stream completo
                          }
                      };
                  }
              } else {
                  console.warn(`[ontrack DEBUG] Participante ${peerId} no encontrado al recibir track. Agregándolo.`);
                  return {
                      ...prev,
                      [peerId]: {
                          id: peerId,
                          name: `Usuario ${peerId}`,
                          videoEnabled: true,
                          micEnabled: true,
                          stream: incomingStream
                      }
                  };
              }
              return prev;
          });
      };

            // --- CAMBIO CLAVE: Manejo de onicecandidate ---
      // Dentro de pc.onicecandidate:
      pc.onicecandidate = (event) => {
        if (event.candidate && currentUser) {
          //console.log(`[ICE Candidate] Generado candidato para ${peerId}.`);
          // Envía event.candidate como un objeto plano para que sea reconstruido.
          sendSignal(peerId, { type: 'candidate', candidate: event.candidate.toJSON() });
        }
      };
      // --- CAMBIO CLAVE: Manejo de onnegotiationneeded ---
      pc.onnegotiationneeded = async () => {
          //console.log(`[onnegotiationneeded] Iniciando negociación para peer: ${peerId}.`);
          if (!localStream) {
            console.warn(`[onnegotiationneeded] localStream no está listo para peer ${peerId}. No se puede crear oferta.`);
            return;
          }

          // Asegurarse de que los tracks locales estén añadidos antes de crear la oferta
          localStream.getTracks().forEach(track => {
            if (!pc.getSenders().some(sender => sender.track === track)) {
              pc.addTrack(track, localStream);
              //console.log(`[ON_NEGOTIATION] ✅ Añadido track local ${track.kind} a PC de ${peerId}`);
            }
          });

          try {
            // Solo creamos oferta si somos el "iniciador" basado en IDs
            // (esto evita ofertas duplicadas si ambos inician al mismo tiempo)
            const localUserId = parseInt(currentUser?.id.toString() || '0');
            const remoteMemberId = parseInt(peerId);
            const isInitiator = localUserId < remoteMemberId; // O tu lógica para determinar quién inicia

            if (isInitiator) {
                //console.log(`[ON_NEGOTIATION - OFERTA INICIADA] Creando OFERTA para ${peerId}.`);
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                //console.log(`[SIGNAL OUT] Enviando OFFER de ${currentUser?.id} a ${peerId}:`, { type: 'offer', sdpType: offer.type }); // NUEVO LOG
                sendSignal(peerId, { type: 'offer', sdp: offer.sdp, sdpType: offer.type });
            } else {
                //console.log(`[ON_NEGOTIATION - ESPERANDO OFERTA] Esperando oferta de ${peerId}.`);
            }

          } catch (e) {
            console.error("Error en onnegotiationneeded al crear/enviar oferta:", e);
          }
      };

      pc.onconnectionstatechange = () => {
        //console.log(`[PC State] PeerConnection con ${peerId} estado: ${pc.connectionState}`);
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          //console.log(`[PC State] RTC PeerConnection for ${peerId} disconnected/failed/closed. Cleaning up.`);
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


      pc.oniceconnectionstatechange = () => {
          //console.log(`[PC State - ICE] PeerConnection con ${peerId} ICE: ${pc.iceConnectionState}`);
      };
      pc.onconnectionstatechange = () => {
          //console.log(`[PC State - Connection] PeerConnection con ${peerId} conexión: ${pc.connectionState}`);
      };
      pc.onsignalingstatechange = () => {
          //console.log(`[PC State - Signaling] PeerConnection con ${peerId} signaling: ${pc.signalingState}`);
      };
      pc.onicegatheringstatechange = () => {
          //console.log(`[PC State - Ice Gathering] PeerConnection con ${peerId} ICE gathering: ${pc.iceGatheringState}`);
      };

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
        //console.log(`[Local Stream Init] Video track enabled: ${videoTrack?.enabled}, Audio track enabled: ${audioTrack?.enabled}`);

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
        //console.log("Faltan roomId, currentUser o localStream para unirse al canal. Reintentando...");
        return;
    }
    if (channelRef.current) {
        //console.log("Ya existe un canal (en el ref), no se unirá de nuevo.");
        return;
    }

    const reverbService = reverbServiceRef.current;
    let currentChannelInstance: EchoChannel | null = null;
    
    //console.log(`Intentando unirse al canal presence-video-room.${roomId}`);
      reverbService.presence(`presence-video-room.${roomId}`)
      .then((joinedChannel: EchoChannel) => {
        currentChannelInstance = joinedChannel;
        channelRef.current = joinedChannel;
        setHasJoinedChannel(true);
        // --- joinedChannel.here: Para miembros que ya están en la sala cuando te unes ---
        joinedChannel.here(async (members: { id: string; name: string; user_info?: any }[]) => {
          //console.log("Aquí estamos: Sincronizando participantes iniciales:", members);
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
            //console.log("Un nuevo participante se ha unido:", member);
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
          //console.log(`[DEBUG WHISPER RECIBIDO] Mensaje recibido: to=${to}, from=${from}, type=${data.type}`);

          if (to !== String(currentUser.id)) {
              console.warn(`[DEBUG WHISPER FILTRADO] Mensaje para otro usuario. Mi ID: ${currentUser.id}, Mensaje TO: ${to}`);
              return;
          }

          const pc = getOrCreatePeerConnection(from);

          try {
              switch (data.type) {
                  // En tu VideoRoom.tsx, dentro de joinedChannel.listenForWhisper('Signal')
                  case 'offer':
                      //console.log(`[SDP Offer] Recibida oferta de ${from}. Estableciendo RemoteDescription.`);
                      //console.log(`[SDP Offer Recv DEBUG] localStream disponible para ${from}?:`, !!localStream);
                      if (localStream) {
                          //console.log(`[SDP Offer Recv DEBUG] localStream tracks para ${from}:`, localStream.getTracks().map(t => t.kind));
                          localStream.getTracks().forEach(track => {
                              const hasSender = pc.getSenders().some(sender => sender.track === track);
                              //console.log(`[SDP Offer Recv DEBUG] Track ${track.kind} (ID: ${track.id}) ya tiene sender en PC de ${from}?: ${hasSender}`);
                              if (!hasSender) {
                                  pc.addTrack(track, localStream);
                                  //console.log(`[SDP Offer Recv] ✅ Añadido track local ${track.kind} a PC de ${from}`);
                              } else {
                                  //console.log(`[SDP Offer Recv] Track ${track.kind} ya EXISTE en PC de ${from}. No se añade de nuevo.`);
                              }
                          });
                      } else {
                          console.warn(`[SDP Offer Recv] localStream es NULO al recibir oferta de ${from}. No se pueden añadir tracks locales.`);
                      }
                      await pc.setRemoteDescription(new RTCSessionDescription({
                          type: data.sdpType,
                          sdp: data.sdp
                      }));

                      // --- Lógica CONSOLIDADA para procesar candidatos ICE en cola DESPUÉS de setRemoteDescription ---
                      const peerCandidates = iceCandidatesQueueRef.current[from]; // Usa 'from' consistentemente
                      if (peerCandidates && peerCandidates.length > 0) {
                          //console.log(`[ICE Candidate Queue] Procesando ${peerCandidates.length} candidatos en cola para ${from}.`);
                          for (const candidate of peerCandidates) {
                              try {
                                  await pc.addIceCandidate(new RTCIceCandidate(candidate));
                                  //console.log(`[ICE Candidate Queue] Añadido candidato en cola para ${from}:`, candidate);
                              } catch (e) {
                                  console.error(`[ICE Candidate Queue] Error al añadir candidato en cola para ${from}:`, e, candidate);
                              }
                          }
                          delete iceCandidatesQueueRef.current[from]; // Limpia la cola para este peer
                      }


                      //console.log(`[SDP Offer] Creando y enviando ANSWER a ${from}.`);
                      const answer = await pc.createAnswer();
                      await pc.setLocalDescription(answer);
                      sendSignal(from, { type: 'answer', sdp: answer.sdp, sdpType: answer.type });
                      break;

                  case 'answer':
                      //console.log(`[SDP Answer] Recibida respuesta de ${from}. Estableciendo RemoteDescription.`);
                      await pc.setRemoteDescription(new RTCSessionDescription({
                          type: data.sdpType,
                          sdp: data.sdp
                      }));
                      //console.log(`[PC State - Signaling] PeerConnection con ${from} signaling: ${pc.signalingState}`); // <-- NUEVO LOG

                      // --- Lógica CONSOLIDADA para procesar candidatos ICE en cola DESPUÉS de setRemoteDescription ---
                      const answerPeerCandidates = iceCandidatesQueueRef.current[from]; // Usa 'from' consistentemente
                      if (answerPeerCandidates && answerPeerCandidates.length > 0) {
                          //console.log(`[ICE Candidate Queue] Procesando ${answerPeerCandidates.length} candidatos en cola para ${from}.`);
                          for (const candidate of answerPeerCandidates) {
                              try {
                                  await pc.addIceCandidate(new RTCIceCandidate(candidate));
                                  //console.log(`[ICE Candidate Queue] Añadido candidato en cola para ${from}:`, candidate);
                              } catch (e) {
                                  console.error(`[ICE Candidate Queue] Error al añadir candidato en cola para ${from}:`, e, candidate);
                              }
                          }
                          delete iceCandidatesQueueRef.current[from]; // Limpia la cola para este peer
                      }
                      break;
                  // VideoRoom.tsx - dentro de joinedChannel.listenForWhisper('Signal')
                 case 'candidate':
                    // Agrega una verificación más estricta para data.candidate y data.candidate.candidate
                    if (data.candidate && data.candidate.candidate) {
                        //console.log(`[ICE Candidate IN] Recibido candidato para ${from}:`, data.candidate);

                        // Asegúrate de usar la ref correcta para obtener la PeerConnection
                        const peerConnection = peerConnectionsRef.current[from];

                        // Solo procede si la PeerConnection existe
                        if (peerConnection) {
                            // Verifica si la RemoteDescription ya ha sido establecida
                            if (peerConnection.remoteDescription && peerConnection.remoteDescription.type) {
                                //console.log(`[ICE Candidate IN] RemoteDescription YA ESTABLECIDA para ${from}. Tipo: ${peerConnection.remoteDescription.type}`);
                                try {
                                    // Intenta añadir el candidato ICE
                                    await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
                                    //console.log(`[ICE Candidate IN] Añadido ICE candidate para ${from} exitosamente.`);
                                } catch (e) {
                                    // Es crucial capturar y loguear errores al añadir candidatos
                                    // ya que pueden indicar un problema con el candidato o el estado de la PC
                                    console.error(`[ICE Candidate IN] Error al añadir ICE candidate para ${from}:`, e, data.candidate);
                                }
                            } else {
                                // Si la RemoteDescription aún no está establecida, encola el candidato
                                //console.log(`[ICE Candidate IN] Candidato para ${from} en cola. RemoteDescription aún no establecida. Actual remoteDescription:`, peerConnection.remoteDescription);

                                if (!iceCandidatesQueueRef.current[from]) {
                                    iceCandidatesQueueRef.current[from] = [];
                                }
                                iceCandidatesQueueRef.current[from].push(data.candidate);
                                //console.log(`[ICE Candidate IN] Candidato añadido a la cola para ${from}. Cola actual: ${iceCandidatesQueueRef.current[from].length} candidatos.`);
                            }
                        } else {
                            console.warn(`[ICE Candidate IN] PeerConnection para ${from} no encontrada al intentar añadir candidato. Ignorando candidato.`);
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
      //console.log("Limpiando useEffect de conexión al canal.");
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
      // const chatListener = (msg: { sender: string; text: string }) => {
      //   setMessages(prev => [...prev, msg]);
      // };
      // currentChannel.listenForWhisper('chat-message', chatListener);

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
   setIsSharingScreen(true);
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
         setIsSharingScreen(false);
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
  
const [roomParticipantId, setRoomParticipantId] = useState<number | null>(null);
useEffect(() => {
  const fetchRoomParticipantId = async () => {
    if (!roomId || !currentUser?.id) return;

    try {
      const response = await fetch(`${API_URL}/auth/room-participant?user_id=${currentUser.id}&room_id=${roomId}`, {
        headers: {
          Authorization: `Bearer ${currentUser.token}`,
          Accept: 'application/json',
        }
      });

      const data = await response.json();

      if (data?.id) {
        //console.log('✅ room_participant_id obtenido:', data.id);
        setRoomParticipantId(data.id);
      } else {
        console.error('❌ No se encontró room_participant_id:', data);
      }
    } catch (error) {
      console.error('❌ Error al obtener room_participant_id:', error);
    }
  };

  fetchRoomParticipantId();
}, [roomId, currentUser?.id]);
if (!roomParticipantId) return;

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
    // setMessages([]);
    // setIsRecording(false);
    setRemoteStreams({}); // Asegúrate de limpiar también los streams remotos

    // Dejar el canal de Reverb
    if (channelRef.current) {
      channelRef.current.leave();
      channelRef.current = null;
    }

    navigate('/rooms'); // Redirigir al usuario
  };

  // const toggleRecording = () => {
  //   //console.log("Función de grabación no implementada aún.");
  //   setIsRecording(prev => !prev);
  // };


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
  //const allParticipants = Object.values(participants);


  return (
    <div className="flex h-screen bg-black text-white">
      <div className="flex flex-col flex-1 relative">
        <div className="flex-1 flex items-center justify-center bg-gray-950">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-6xl p-4">

            {/* Video local */}
            <div
  className={`
    relative rounded-xl overflow-hidden border border-gray-700 shadow-lg aspect-video bg-black
    ${isSharingScreen ? 'col-span-2 w-full' : ''}
  `}
>
  <video
    ref={localVideoRef}
    autoPlay
    muted
    className="w-full h-full object-contain" // usa contain si no querés recortar pantalla compartida
  />
  <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 px-3 py-1 text-sm rounded text-white">
    {isSharingScreen ? 'Compartiendo pantalla' : 'Tú'}
  </div>
  {/* ... mic indicator */}
</div>
            
            {/* ¡VIDEOS REMOTOS AHORA USANDO EL COMPONENTE REMOTEVIDEO! */}
            {Object.values(participants).map(p => (
              // Asegúrate de que 'p' no sea el usuario local si no quieres renderizar tu propio video dos veces
              // Si tu `participants` ya excluye al usuario local, entonces no necesitas esta comprobación.
              // Asumo que `p.id` es diferente de `currentUser?.id`.
              p.id !== currentUser?.id && ( // Opcional: Asegura que no se renderice el video del usuario local aquí
                <RemoteVideo
                  key={p.id} // La `key` es CRÍTICA para el rendimiento de React en listas
                  stream={p.stream} // ¡Aquí pasas el MediaStream al componente RemoteVideo!
                  name={p.name}
                  id={p.id}
                  videoEnabled={p.videoEnabled}
                  micEnabled={p.micEnabled}
                />
              )
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
      <div className="w-80 border-l border-gray-700 bg-gray-900 flex flex-col flex-2 py-8 justify-end">
        {roomId && <ChatBox roomId={roomId} />}
      </div>
    </div>
  );
};

>>>>>>> feature/modificacion-echo-prod
export default VideoRoom;