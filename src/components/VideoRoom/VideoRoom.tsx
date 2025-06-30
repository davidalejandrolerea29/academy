import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createReverbWebSocketService, EchoChannel } from '../../services/ReverbWebSocketService';
// import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase'; // Asumo que esto es relevante para otras partes de tu app
import { Room } from '../../types'; // Asumo que este tipo está definido
import { useMicVolume } from '../../hooks/useMicVolume'; // Asumo que tu hook está bien
import { useCall } from '../../contexts/CallContext';
import {
  Video, VideoOff, Mic, MicOff, ScreenShare, StopCircle,
  MessageSquare, PhoneOff, Minimize2, Maximize2, Users // <-- NUEVO: Íconos de minimizar/maximizar
} from 'lucide-react';
interface VideoRoomProps {
  roomId: string;
  onCallEnded: () => void;
}

// ¡IMPORTA EL COMPONENTE REMOTEVIDEO AQUÍ!
import RemoteVideo from './RemoteVideo'; // Ajusta la ruta si RemoteVideo.tsx está en otro lugar
import ChatBox from './ChatBox';

const VideoRoom: React.FC<VideoRoomProps> = ({ roomId, onCallEnded }) => {
  const API_URL = import.meta.env.VITE_API_URL;
  // const navigate = useNavigate();
  const iceCandidatesQueueRef = useRef<Record<string, RTCIceCandidate[]>>({});
  const { isCallMinimized, toggleMinimizeCall } = useCall(); 
  // const { roomId } = useParams<{ roomId: string }>();
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
const screenShareStreamRef = useRef<MediaStream | null>(null);
  // --- Refs para mantener referencias persistentes ---
  const peerConnectionsRef = useRef<Record<string, RTCPeerConnection>>({});
  const channelRef = useRef<EchoChannel | null>(null);
  const reverbServiceRef = useRef(createReverbWebSocketService(currentUser?.token || '')); // Instancia del servicio

  // Estado para streams remotos y participantes
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  // participants ahora incluye toda la info necesaria para renderizar y gestionar el estado del usuario
const [participants, setParticipants] = useState<Record<string, {
    id: string,
    name: string,
    videoEnabled: boolean,
    micEnabled: boolean,
    cameraStream: MediaStream | null, // Para la cámara principal
    screenStream: MediaStream | null,  // Para la pantalla compartida
    // Opcional: una lista de todos los streams si no sabes qué esperar
    // streams: MediaStream[]
}>>({});
  const [micEnabled, setMicEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const volume = useMicVolume(localStream); // Usa tu hook para el volumen del micrófono local
  useEffect(() => {
    Object.keys(participants).map(id => ({
        id,
        name: participants[id].name,
        // hasStream: !!participants[id].stream,
        // streamId: participants[id].stream?.id,
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
  const stopLocalStream = useCallback(() => {
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    setLocalStream(null);
  }
}, [localStream]);
  const stopScreenShare = useCallback(() => {
  if (screenShareStreamRef.current) {
    screenShareStreamRef.current.getTracks().forEach(track => track.stop());
    screenShareStreamRef.current = null;
    setIsSharingScreen(false);

    Object.values(peerConnectionsRef.current).forEach(pc => {
      const videoSender = pc.getSenders().find(sender => sender.track?.kind === 'video');
      if (videoSender && localStream) {
        const cameraVideoTrack = localStream.getVideoTracks()[0];
        if (cameraVideoTrack) {
          videoSender.replaceTrack(cameraVideoTrack);
        } else {
          pc.removeTrack(videoSender);
        }
      }
      const audioSender = pc.getSenders().find(sender => sender.track?.kind === 'audio');
      if (audioSender && localStream) {
        const cameraAudioTrack = localStream.getAudioTracks()[0];
        if (cameraAudioTrack) {
          audioSender.replaceTrack(cameraAudioTrack);
        } else {
          pc.removeTrack(audioSender);
        }
      }
    });
    console.log("Compartir pantalla detenido.");
  }
}, [localStream]);
const handleCallCleanup = useCallback(() => {
    console.log('[VideoRoom Cleanup] Iniciando limpieza de la llamada...');
    stopLocalStream();
    stopScreenShare();

    // Cierra todas las PeerConnections
    Object.values(peerConnectionsRef.current).forEach(pc => {
      pc.close();
    });
    peerConnectionsRef.current = {}; // Reinicia el objeto de PeerConnections

    setParticipants({}); // Limpia los participantes

    if (channelRef.current) {
      console.log(`[VideoRoom Cleanup] Dejando canal ${channelRef.current.name}`);
      // CAMBIO AQUÍ: Llamar al método leave() del propio objeto channel
      channelRef.current.leave(); // Esto enviará la señal de UNSUBSCRIBE y limpiará el canal internamente
      channelRef.current = null; // Limpiar la referencia al canal después de dejarlo
    }
    setHasJoinedChannel(false);

    // Notifica al padre (Layout) que la llamada ha terminado
    onCallEnded(); // Esto debería activar el desmontaje de VideoRoom en Layout
    console.log('[VideoRoom Cleanup] Limpieza completa. Notificando a Layout.');
  }, [stopLocalStream, stopScreenShare, onCallEnded]);

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

     // En tu pc.ontrack dentro de VideoRoom.tsx
// Dentro de getOrCreatePeerConnection, después de crear `const pc = new RTCPeerConnection({...});`
pc.ontrack = (event) => {
    const incomingStream = event.streams[0]; // Esto es el MediaStream al que pertenece el track
    const track = event.track; // El MediaStreamTrack que llegó

    // ES CLAVE QUE PEERID ESTÉ CORRECTAMENTE DEFINIDO AQUÍ.
    // Si 'peerId' viene del scope exterior (ej. el parámetro de getOrCreatePeerConnection), úsalo.
    // Si necesitas inferirlo del evento, es más complejo y puede ser event.transceiver.mid o event.receiver.track.id
    // Para simplificar, asumamos que `peerId` ya está disponible en este scope correctamente.

    setParticipants(prev => {
        const existingParticipant = prev[peerId] || { // USA EL `peerId` DEL PARÁMETRO
            id: peerId,
            name: `Usuario ${peerId}`, // Obtén el nombre real aquí si lo tienes
            videoEnabled: true,
            micEnabled: true,
            cameraStream: null,
            screenStream: null
        };

        const updatedParticipant = { ...existingParticipant };

        // Lógica de si el track es de pantalla compartida:
        // Por lo general, getDisplayMedia crea un *nuevo* MediaStream
        // y lo adjunta con el track de video de la pantalla.
        // Lo más fiable es si el `track.kind` es 'video' y si el stream ya no es el de la cámara.
        // O si el `track.id` es de un track de pantalla (aunque no lo asignes, tiene un ID único).

        let isScreenShareTrack = false;
        if (track.kind === 'video') {
            const videoTrack = track as MediaStreamVideoTrack;
            // Métodos comunes para detectar si es pantalla
            if (videoTrack.contentHint === 'detail' || videoTrack.contentHint === 'text') {
                isScreenShareTrack = true;
            }
            const trackSettings = videoTrack.getSettings();
            if (trackSettings.displaySurface) { // Específico de Chrome/Edge
                isScreenShareTrack = true;
            }
            // Otra heurística: si el track.label contiene "screen" o "display"
            if (videoTrack.label.toLowerCase().includes('screen') || videoTrack.label.toLowerCase().includes('display')) {
                isScreenShareTrack = true;
            }
        }
        // Si el stream ya existe y es de cámara, y llega un NUEVO track de video,
        // Y el viejo stream de cámara no tiene este track,
        // podríamos inferir que es un nuevo stream (de pantalla).

        // Aquí es donde la lógica se pone complicada si un peer envía múltiples streams.
        // La forma más robusta es que el *remitente* te diga qué stream es.
        // Si no, la heurística es:
        // Si el incomingStream.id no es el mismo que el existingParticipant.cameraStream.id
        // Y incomingStream tiene un track de video, y existingParticipant.cameraStream ya tenía uno.
        // Entonces es un nuevo stream, probablemente de pantalla.

        // Simplificando: Si llega un track de video, y no es el track de la cámara existente:
        if (track.kind === 'video') {
            // Asumimos que si un participante ya tiene un `cameraStream`,
            // cualquier nuevo track de video que llegue para ese `peerId`
            // que NO es parte de su `cameraStream` existente, es de pantalla.
            const isExistingCameraVideoTrack = updatedParticipant.cameraStream?.getVideoTracks().some(t => t.id === track.id);
            if (isScreenShareTrack || (!isExistingCameraVideoTrack && incomingStream.id !== updatedParticipant.cameraStream?.id)) {
                console.log(`[ontrack DEBUG] Recibiendo stream de PANTALLA de ${peerId} (Stream ID: ${incomingStream.id}, Track ID: ${track.id}).`);
                updatedParticipant.screenStream = incomingStream;
                // Si la pantalla compartida incluye audio, este se adjuntará al mismo stream
                // Si el audio viene por separado, necesitas manejarlo.
            } else { // Es un track de cámara
                console.log(`[ontrack DEBUG] Recibiendo stream de CÁMARA de ${peerId} (Stream ID: ${incomingStream.id}, Track ID: ${track.id}).`);
                updatedParticipant.cameraStream = incomingStream;
                // Aquí podrías asegurar que el `videoEnabled` se actualice si el stream de cámara está presente
                updatedParticipant.videoEnabled = true;
            }
        } else if (track.kind === 'audio') {
            // El audio es más tricky. Asume que el primer audio es de la cámara.
            // Si el audio de la pantalla viene en el mismo `incomingStream` que el video de pantalla,
            // no necesitas una lógica separada para él aquí.
            // Si llega un track de audio y el participante no tiene un `cameraStream` todavía,
            // o si es un audio de un stream diferente que no es pantalla,
            // puedes asignarlo al `cameraStream` o manejarlo aparte.
            if (!updatedParticipant.cameraStream) { // Si aún no hay stream de cámara, asigna el audio aquí
                // Crea un MediaStream solo para el audio si es necesario, o espera al video.
                updatedParticipant.cameraStream = incomingStream; // O crea un nuevo MediaStream con solo este track de audio
            }
            updatedParticipant.micEnabled = true; // Asume que el micrófono está habilitado si hay audio
        }

        return {
            ...prev,
            [peerId]: updatedParticipant
        };
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
          console.log("Un nuevo participante se ha unido:", member); 
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
        joinedChannel.leaving((member: any) => {
          console.log(`Usuario ${member.info.name || member.id} (${member.id}) ha abandonado la sala.`);
          const memberId = String(member.id);

          // Cierra la PeerConnection asociada con el miembro que se fue
          if (peerConnectionsRef.current[memberId]) {
              console.log(`Cerrando PeerConnection con ${memberId}.`);
              peerConnectionsRef.current[memberId].close();
              delete peerConnectionsRef.current[memberId];
          }

          // Elimina al participante del estado para que su widget desaparezca
          setParticipants(prev => {
              const newParticipants = { ...prev };
              delete newParticipants[memberId];
              return newParticipants;
          });
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
      console.log("Limpiando useEffect de conexión al canal al desmontar/re-ejecutar.");

      // Detén los streams locales SIEMPRE que el componente se desmonte o el efecto se limpie.
      // Esto es crucial para la cámara/micrófono de la pestaña del navegador.
      stopLocalStream();
      stopScreenShare();

      // Si hay una instancia de canal activa, asegúrate de dejarla.
      //currentChannelInstance es la referencia al canal del efecto actual.
      if (currentChannelInstance) {
        console.log(`Dejando canal activo de useEffect: ${currentChannelInstance.name}`);
        currentChannelInstance.leave(); // Esto enviará el unsubscribe y limpiará el mapa interno
      }

      // Cierra todas las PeerConnections restantes.
      Object.values(peerConnectionsRef.current).forEach(pc => {
          if (pc.connectionState !== 'closed') {
              console.log("Cerrando PC restante al desmontar.");
              pc.close();
          }
      });
      peerConnectionsRef.current = {}; // Limpia el ref explícitamente

      // Limpia los estados de React
      setParticipants({});
      setHasJoinedChannel(false);
      channelRef.current = null; // Asegúrate de que el ref global del canal también esté nulo
    };
  }, [
    roomId,
    currentUser,
    localStream,
    sendSignal,
    getOrCreatePeerConnection,
    stopLocalStream, // Añadir como dependencia para que el linter no se queje
    stopScreenShare  // Añadir como dependencia para que el linter no se queje
  ]);
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
    if (!localStream) {
        console.warn("localStream no está disponible. No se puede iniciar la compartición de pantalla.");
        return;
    }

    if (isSharingScreen) {
        // Lógica para detener la compartición de pantalla
        if (screenShareStreamRef.current) {
            screenShareStreamRef.current.getTracks().forEach(track => track.stop());
            screenShareStreamRef.current = null;
        }

        // Eliminar los senders de pantalla compartida de todas las PeerConnections
        Object.values(peerConnectionsRef.current).forEach(pc => {
            const screenVideoSender = pc.getSenders().find(s => s.track?.id === 'screen-video-track'); // Usamos un ID custom si lo asignamos
            if (screenVideoSender) {
                pc.removeTrack(screenVideoSender);
                console.log(`[ScreenShare] Removed screen video track from PC for ${pc.remoteDescription?.sdp?.substring(0, 20)}...`);
            }
            const screenAudioSender = pc.getSenders().find(s => s.track?.id === 'screen-audio-track'); // Usamos un ID custom
            if (screenAudioSender) {
                pc.removeTrack(screenAudioSender);
                console.log(`[ScreenShare] Removed screen audio track from PC for ${pc.remoteDescription?.sdp?.substring(0, 20)}...`);
            }
        });

        // Asegúrate de que el localStream original (cámara/mic) siga enviándose
        // Esto es importante si hubieras pausado tus tracks de cámara/mic
        localStream.getTracks().forEach(track => {
            track.enabled = true; // Asegúrate de que tus tracks locales estén habilitados
        });
        setVideoEnabled(true); // Tu cámara local debería estar visible de nuevo
        setMicEnabled(localStream?.getAudioTracks()[0]?.enabled || false); // Tu micrófono local debería estar habilitado de nuevo

        setIsSharingScreen(false);
        return;
    }

    // Lógica para iniciar la compartición de pantalla
    setIsSharingScreen(true);
    try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }); // Audio para compartir audio del sistema si se desea
        screenShareStreamRef.current = screenStream; // Guardamos la referencia

        const screenVideoTrack = screenStream.getVideoTracks()[0];
        const screenAudioTrack = screenStream.getAudioTracks()[0];

        // Opcional: Asignar IDs únicos a los tracks para fácil identificación
        // Esto no es estrictamente necesario ya que el stream ID ya es único,
        // pero puede ayudar a la hora de buscar y remover senders específicos.
        // screenVideoTrack.id = 'screen-video-track';
        // if (screenAudioTrack) {
        //     screenAudioTrack.id = 'screen-audio-track';
        // }

        // Añade las pistas de pantalla a TODAS las PeerConnections existentes
        Object.values(peerConnectionsRef.current).forEach(pc => {
            // Verifica si ya hay un sender para este track para evitar duplicados
           // En toggleScreenShare, sección de añadir tracks:
            const existingVideoSender = pc.getSenders().find(s => s.track === screenVideoTrack); // Comparar por referencia de objeto Track
            if (!existingVideoSender) {
                pc.addTrack(screenVideoTrack, screenStream);
                console.log(`[ScreenShare] Added new screen video track to PC for ${pc.remoteDescription?.sdp?.substring(0, 20)}...`);
            } else {
                // Esto solo debería pasar si el mismo track ya estaba añadido, lo cual es raro para getDisplayMedia
                // O si quieres reemplazar un track previamente enviado con este nuevo track de pantalla.
                // Si la intención es AÑADIR la pantalla COMPARTIDA como un stream ADICIONAL,
                // la lógica debería ser siempre pc.addTrack para un nuevo stream.
                // Si solo quieres tener UN stream de video (cámara O pantalla), entonces usar `replaceTrack` en el sender de la cámara.
                // Pero tu `participants` sugiere que quieres ambos.

                // Para múltiples streams (cámara Y pantalla), siempre deberías hacer addTrack si el track es nuevo.
                // Si el peerConnection ya tiene el track de pantalla, no lo añades de nuevo.
                console.warn(`[ScreenShare] Screen video track already exists for PC via this specific track object.`);
                // existingVideoSender.replaceTrack(screenVideoTrack); // Solo si realmente quieres reemplazar el mismo track
            }

            if (screenAudioTrack) {
                const existingAudioSender = pc.getSenders().find(s => s.track?.id === screenAudioTrack.id);
                if (!existingAudioSender) {
                    pc.addTrack(screenAudioTrack, screenStream);
                    console.log(`[ScreenShare] Added new screen audio track to PC for ${pc.remoteDescription?.sdp?.substring(0, 20)}...`);
                } else {
                    console.log(`[ScreenShare] Screen audio track already exists for PC.`);
                    existingAudioSender.replaceTrack(screenAudioTrack);
                }
            }
        });

        // Cuando la compartición de pantalla termina (ej. el usuario hace clic en "Detener compartir")
        screenVideoTrack.onended = () => {
            console.log("[ScreenShare] Screen share ended by user.");
            toggleScreenShare(); // Llama a la función de nuevo para ejecutar la lógica de "detener"
        };

        // No necesitas deshabilitar tu cámara local.
        // Lo importante es que tu `localStream` original siga enviándose.
        // Si quieres que TU PROPIA CÁMARA se "pause" mientras compartes, puedes hacerlo,
        // pero la propuesta es que siempre se vea tu cámara Y la pantalla.
        // setVideoEnabled(false); // Esto solo afectaría tu propio render, no lo que envías.

    } catch (error) {
        console.error("Error sharing screen:", error);
        setIsSharingScreen(false);
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

// ... (imports y hooks se mantienen igual) ...
// ... (resto del código) ...
  const remoteScreenShareActive = Object.values(participants).some(p => p.screenStream);
  const isAnyScreenSharing = isSharingScreen || remoteScreenShareActive;
 

  return (
    // ... (El resto del JSX es el mismo, no hay cambios aquí a menos que quieras más detalles en la UI)
    <div className={`flex bg-black text-white ${isCallMinimized ? 'h-full w-full flex-col' : 'h-screen flex-row'}`}>
      {/* Contenedor principal de videos (Maximizada) */}
      {!isCallMinimized && (
        <div className="flex flex-col flex-1 relative p-4 bg-gray-950">
          {(() => {
            if (isAnyScreenSharing) {
              return (
                <>
                  <div className="w-full flex-grow flex items-center justify-center bg-gray-800 rounded-lg overflow-hidden mb-4">
                    {isSharingScreen && screenShareStreamRef.current ? (
                      <RemoteVideo
                        stream={screenShareStreamRef.current}
                        participantId={currentUser?.id || 'local-screen'}
                        participantName={`${currentUser?.name || 'Tú'} (Mi Pantalla)`}
                        videoEnabled={true}
                        micEnabled={false}
                        isLocal={true}
                        volume={0}
                        isScreenShare={true}
                      />
                    ) : (
                      (() => {
                        const remoteScreenShare = Object.values(participants).find(p => p.screenStream);
                        if (remoteScreenShare) {
                          return (
                            <RemoteVideo
                              stream={remoteScreenShare.screenStream!}
                              participantId={`${remoteScreenShare.id}-screen`}
                              participantName={`${remoteScreenShare.name} (Pantalla)`}
                              videoEnabled={true}
                              micEnabled={false}
                              isLocal={false}
                              volume={0}
                              isScreenShare={true}
                            />
                          );
                        }
                        return null;
                      })()
                    )}
                  </div>
                  <div className="w-full grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 flex-shrink-0">
                    {localStream && (
                      <RemoteVideo
                        stream={localStream}
                        participantId={currentUser?.id || 'local'}
                        participantName={`${currentUser?.name || 'Tú'} (Yo)`}
                        videoEnabled={videoEnabled}
                        micEnabled={micEnabled}
                        isLocal={true}
                        volume={volume}
                        isScreenShare={false}
                      />
                    )}
                    {/* Filtra aquí para solo mostrar participantes con cameraStream */}
                    {Object.values(participants)
                        .filter(p => p.cameraStream) // Solo muestra si hay un stream de cámara
                        .map(participant => (
                        <RemoteVideo
                            key={participant.id} // Asegúrate de usar una key única
                            stream={participant.cameraStream!}
                            participantId={participant.id}
                            participantName={participant.name}
                            videoEnabled={participant.videoEnabled}
                            micEnabled={participant.micEnabled}
                            isLocal={false}
                            volume={0}
                            isScreenShare={false}
                        />
                    ))}
                  </div>
                </>
              );
            } else {
              return (
                <div className="flex-1 flex items-center justify-center">
                  <div className="w-full grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {localStream && (
                      <RemoteVideo
                        stream={localStream}
                        participantId={currentUser?.id || 'local'}
                        participantName={`${currentUser?.name || 'Tú'} (Yo)`}
                        videoEnabled={videoEnabled}
                        micEnabled={micEnabled}
                        isLocal={true}
                        volume={volume}
                        isScreenShare={false}
                      />
                    )}
                    {Object.values(participants)
                        .filter(p => p.cameraStream) // Solo muestra si hay un stream de cámara
                        .map(participant => (
                        <RemoteVideo
                            key={participant.id} // Asegúrate de usar una key única
                            stream={participant.cameraStream!}
                            participantId={participant.id}
                            participantName={participant.name}
                            videoEnabled={participant.videoEnabled}
                            micEnabled={participant.micEnabled}
                            isLocal={false}
                            volume={0}
                            isScreenShare={false}
                        />
                    ))}
                  </div>
                </div>
              );
            }
          })()}
        </div>
      )}

      {/* Vista Minimizada - Muestra solo si isCallMinimized es true */}
      {isCallMinimized && (
        <div className="flex-1 flex flex-col bg-gray-950 rounded-lg overflow-hidden p-2">
          {/* Pantalla compartida principal en miniatura (si aplica) */}
          {isAnyScreenSharing && (
            <div className="w-full h-3/4 mb-2 bg-gray-800 rounded-md flex items-center justify-center overflow-hidden">
              {isSharingScreen && screenShareStreamRef.current ? (
                <RemoteVideo
                  stream={screenShareStreamRef.current}
                  participantId={currentUser?.id || 'local-screen-mini'}
                  participantName={`${currentUser?.name || 'Tú'} (Mi Pantalla)`}
                  videoEnabled={true}
                  micEnabled={false}
                  isLocal={true}
                  volume={0}
                  isScreenShare={true}
                  className="w-full h-full object-contain"
                />
              ) : (
                (() => {
                  const remoteScreenShare = Object.values(participants).find(p => p.screenStream);
                  if (remoteScreenShare) {
                    return (
                      <RemoteVideo
                        stream={remoteScreenShare.screenStream!}
                        participantId={`${remoteScreenShare.id}-screen-mini`}
                        participantName={`${remoteScreenShare.name} (Pantalla)`}
                        videoEnabled={true}
                        micEnabled={false}
                        isLocal={false}
                        volume={0}
                        isScreenShare={true}
                        className="w-full h-full object-contain"
                      />
                    );
                  }
                  return (
                      <div className="text-gray-500 text-center">
                          <ScreenShare className="w-8 h-8 mx-auto mb-1" />
                          <p className="text-sm">Compartiendo pantalla</p>
                      </div>
                  );
                })()
              )}
            </div>
          )}

          {/* Miniaturas de cámaras de participantes (local + remotos) */}
          <div className={`w-full ${isAnyScreenSharing ? 'h-1/4' : 'flex-grow'} grid grid-cols-2 gap-1 overflow-y-auto`}>
            {/* Tu propia cámara */}
            {localStream && (
              <RemoteVideo
                stream={localStream}
                participantId={currentUser?.id || 'local-mini'}
                participantName={`${currentUser?.name || 'Tú'}`}
                videoEnabled={videoEnabled}
                micEnabled={micEnabled}
                isLocal={true}
                volume={volume}
                isScreenShare={false}
                className="w-full h-full object-cover rounded-sm"
              />
            )}

            {/* Cámaras de participantes remotos */}
            {Object.values(participants)
              .filter(p => p.cameraStream) // Asegúrate de que solo se rendericen si tienen un stream
              .map(participant => (
                <RemoteVideo
                  key={participant.id + '-mini'}
                  stream={participant.cameraStream!}
                  participantId={participant.id}
                  participantName={participant.name}
                  videoEnabled={participant.videoEnabled}
                  micEnabled={participant.micEnabled}
                  isLocal={false}
                  volume={0}
                  isScreenShare={false}
                  className="w-full h-full object-cover rounded-sm"
                />
              ))}

            {/* Placeholder si no hay cámaras para mostrar */}
            {!localStream && Object.values(participants).filter(p => p.cameraStream).length === 0 && !isAnyScreenSharing && (
              <div className="col-span-full flex flex-col items-center justify-center text-gray-500">
                <Users className="w-12 h-12 mb-2" />
                <p className="text-sm text-center">Nadie con cámara activa.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Controles de la llamada - Secciones diferentes para maximizado y minimizado */}
      <div className={`flex justify-center gap-2 p-3 bg-black bg-opacity-80
        ${isCallMinimized ? 'w-full flex-wrap' : 'border-t border-gray-700'}`}>

        {/* Botones de control (Mic, Video) - Comunes y siempre visibles */}
        <button
          onClick={toggleMic}
          className="w-12 h-12 rounded-full flex items-center justify-center bg-gray-700 hover:bg-gray-600"
          title={micEnabled ? 'Silenciar micrófono' : 'Activar micrófono'}
        >
          {micEnabled ? <Mic size={20} /> : <MicOff size={20} />}
        </button>

        <button
          onClick={toggleVideo}
          className="w-12 h-12 rounded-full flex items-center justify-center bg-gray-700 hover:bg-gray-600"
          title={videoEnabled ? 'Apagar cámara' : 'Encender cámara'}
        >
          {videoEnabled ? <Video size={20} /> : <VideoOff size={20} />}
        </button>

        {/* Botón de Compartir Pantalla y Grabar (solo en vista maximizada) */}
        {!isCallMinimized && (
          <>
            <button
              onClick={toggleScreenShare}
              className="w-12 h-12 rounded-full flex items-center justify-center bg-gray-700 hover:bg-gray-600"
              title={isSharingScreen ? 'Detener compartir pantalla' : 'Compartir pantalla'}
            >
              <ScreenShare size={20} />
            </button>

            {isTeacher && (
              <button
                onClick={toggleRecording}
                className="w-12 h-12 rounded-full flex items-center justify-center bg-gray-700 hover:bg-gray-600"
                title={isRecording ? 'Detener grabación' : 'Iniciar grabación'}
              >
                <StopCircle size={20} className={isRecording ? 'text-red-500' : ''} />
              </button>
            )}
          </>
        )}

        {/* Botón de Minimizar/Maximizar: SIEMPRE VISIBLE */}
        <button
          onClick={toggleMinimizeCall}
          className="w-12 h-12 rounded-full flex items-center justify-center bg-gray-700 hover:bg-gray-600"
          title={isCallMinimized ? 'Maximizar llamada' : 'Minimizar llamada'}
        >
          {isCallMinimized ? <Maximize2 size={20} /> : <Minimize2 size={20} />}
        </button>

        {/* Botón de Colgar: SIEMPRE VISIBLE */}
        <button
          onClick={handleCallCleanup} // Llama a la nueva función de limpieza
          className="w-12 h-12 rounded-full flex items-center justify-center bg-red-600 hover:bg-red-700"
          title="Colgar"
        >
          <PhoneOff size={20} />
        </button>
      </div>

      {/* Chat lateral - Oculta si minimizado */}
      <div className={`w-80 border-l border-gray-700 bg-gray-900 flex flex-col flex-2 py-8 justify-end
        ${isCallMinimized ? 'hidden' : ''}`}>
        {roomId && <ChatBox roomId={roomId} />}
      </div>
    </div>
  );
};

export default VideoRoom;