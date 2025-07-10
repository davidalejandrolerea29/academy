import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createReverbWebSocketService, EchoChannel } from '../../services/ReverbWebSocketService';
// import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Room } from '../../types'; // Asumo que este tipo está definido
import { useMicVolume } from '../../hooks/useMicVolume'; // Asumo que tu hook está bien

import {
  Video, VideoOff, Mic, MicOff, ScreenShare, StopCircle,
  MessageSquare, PhoneOff, Minimize2, Maximize2, Users, // <-- NUEVO: Íconos de minimizar/maximizar
  X, Move, Dot, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useDraggableWidget } from '../../hooks/useDraggableWidget';
import { useLocalMedia } from '../../hooks/useLocalMedia'; // Importar el nuevo hook
import { useWebRTC } from '../../hooks/useWebRTC'; // Importar el nuevo hook
import { RecordingIndicator } from './VideoCall/RecordingIndicator'; // Crea este archivo
import { VideoDisplay } from './VideoCall/VideoDisplay'; // Crea este archivo
import { CallControls } from './VideoCall/CallControls'; // Crea este archivo
import { ChatPanel } from './VideoCall/ChatPanel'; // Crea este archivo
import { MinimizedWidget } from './VideoCall/MinimizedWidget'; // Crea este archivo

interface ParticipantState {
  id: string;
  name: string;
  videoEnabled: boolean;
  micEnabled: boolean;
  cameraStream: MediaStream | null;
  screenStream: MediaStream | null;
  isSharingRemoteScreen: boolean; // Indica si este participante remoto está compartiendo su pantalla
  // Puedes añadir más estados si los necesitas, como el volumen remoto
}
interface VideoRoomProps {
  roomId: string;
  onCallEnded: () => void;
  isTeacher: boolean;
  isCallMinimized: boolean; // Pass this from context
  toggleMinimizeCall: () => void; // Pass this from context
  handleCallCleanup: () => void; // Pass this from context
}

// ¡IMPORTA EL COMPONENTE REMOTEVIDEO AQUÍ!
import RemoteVideo from './RemoteVideo'; // Ajusta la ruta si RemoteVideo.tsx está en otro lugar
import ChatBox from './ChatBox';

const VideoRoom: React.FC<VideoRoomProps> = ({
  roomId,
  onCallEnded,
  isTeacher,
  isCallMinimized, // Destructure here
  toggleMinimizeCall, // Destructure here
  handleCallCleanup // Destructure here
}) => {
  const API_URL = import.meta.env.VITE_API_URL;
  // const navigate = useNavigate();
  const iceCandidatesQueueRef = useRef<Record<string, RTCIceCandidate[]>>({});
  // const { isCallMinimized, toggleMinimizeCall } = useCall(); 
  // const { roomId } = useParams<{ roomId: string }>();
  const { currentUser } = useAuth(); // Asegúrate de que `currentUser.id` y `currentUser.name` existan
  const [room, setRoom] = useState<Room | null>(null); // Estado para la información de la sala (si es necesario)
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // const [isTeacher, setIsTeacher] = useState(false); // Determinar si el usuario actual es profesor
  const streamLogCountsRef = useRef<Record<string, number>>({});

  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const widgetRef = useRef<HTMLDivElement>(null);

// En VideoRoom.tsx, dentro del componente:
const [hasJoinedChannel, setHasJoinedChannel] = useState(false);
const [isSharingScreen, setIsSharingScreen] = useState(false);
const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
const screenShareStreamRef = useRef<MediaStream | null>(null);
  // --- Refs para mantener referencias persistentes ---
  const screenShareSendersRef = useRef<Record<string, { video?: RTCRtpSender, audio?: RTCRtpSender }>>({});
const [isChatOpenMobile, setIsChatOpenMobile] = useState(false);
  const channelRef = useRef<EchoChannel | null>(null);
  const reverbServiceRef = useRef(createReverbWebSocketService(currentUser?.token || '')); // Instancia del servicio
const [isChatOpenDesktop, setIsChatOpenDesktop] = useState(true); 


  // Estado para streams remotos y participantes
  // participants ahora incluye toda la info necesaria para renderizar y gestionar el estado del usuario

// --- Uso de los nuevos hooks ---
  const {
    localStream,
    localVideoRef,
    micEnabled,
    videoEnabled,
    toggleMic,
    toggleVideo,
    stopLocalStream,
    error: mediaError // Renombra el error del hook para evitar colisión
  } = useLocalMedia();

  // Callback para que useWebRTC actualice los participantes en VideoRoom
  const handleParticipantsChange = useCallback((newParticipants: Record<string, ParticipantState>) => {
    // Aquí puedes hacer cualquier lógica adicional si necesitas, o simplemente actualizar el estado si fuera un estado aquí
    // Por ahora, como participants ya se devuelve de useWebRTC, no necesitamos un estado aquí.
    // Solo si el componente padre de VideoRoom necesita saber de los participantes, lo pasas arriba.
  }, []); // Dependencias: ninguna si solo actualiza el estado interno

  const {
    participants,
    peerConnectionsRef,
    sendSignal,
  } = useWebRTC({
    roomId,
    currentUser,
    localStream, // Pasa el stream local al hook WebRTC
    channelRef,
    reverbService: reverbServiceRef.current,
    onCallEnded,
    onParticipantsChange: handleParticipantsChange, // Pasa el callback
  });


  const volume = useMicVolume(localStream); // Usa tu hook para el volumen del micrófono local

 
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
// --- Función auxiliar para obtener/crear RTCPeerConnection ---
const getOrCreatePeerConnection = useCallback((peerId: string) => {
    let pc = peerConnectionsRef.current[peerId]; // Declara pc con 'let' una sola vez

    // Si la PC no existe, o si está en un estado cerrado/fallido, crea una nueva.
    if (!pc || pc.connectionState === 'closed' || pc.connectionState === 'failed') {
      
        console.log(`[PC] Creando NUEVA RTCPeerConnection para peer: ${peerId}`);
        // *** CAMBIO CRUCIAL AQUÍ: Elimina 'const' para que se asigne a la 'pc' declarada con 'let' ***
        pc = new RTCPeerConnection({ // <-- ¡QUITAR 'const' aquí!
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun3.l.google.com:19302' },
                { urls: 'stun:stun4.l.google.com:19302' },
                {
                    urls: 'turn:127.0.0.1:3478?transport=udp',
                    username: 'miusuario',
                    credential: 'micontrasena',
                    realm: 'mi_servidor_turn_local'
                },
                {
                    urls: 'turn:127.0.0.1:3478?transport=tcp',
                    username: 'miusuario',
                    credential: 'micontrasena',
                    realm: 'mi_servidor_turn_local'
                },
            ],
            iceTransportPolicy: 'all',
            bundlePolicy: 'balanced',
            rtcpMuxPolicy: 'require',
            iceCandidatePoolSize: 0,
        });

        // Añadir los tracks locales INMEDIATAMENTE al crear la PC
        if (localStream) {
            localStream.getTracks().forEach(track => {
                if (!pc.getSenders().some(sender => sender.track === track)) {
                    pc.addTrack(track, localStream);
                    console.log(`[PC Creation] ✅ Añadido track local ${track.kind} a PC de ${peerId}`);
                } else {
                    console.log(`[PC Creation] Track ${track.kind} ya EXISTE para ${peerId}. No se añade de nuevo.`);
                }
            });
        }
        
        // --- Configuración de Eventos para la NUEVA PC ---
        pc.ontrack = (event) => {
            const incomingStream = event.streams[0];
            const track = event.track;

            setParticipants(prev => {
                const existingParticipant = prev[peerId] || {
                    id: peerId,
                    name: `Usuario ${peerId}`,
                    videoEnabled: false,
                    micEnabled: false,
                    cameraStream: null,
                    screenStream: null,
                    isSharingRemoteScreen: false,
                };
                const updatedParticipant = { ...existingParticipant };

                const isPotentiallyScreenShareTrack = track.kind === 'video' &&
                    (updatedParticipant.isSharingRemoteScreen ||
                     track.label.includes('screen') ||
                     track.label.includes('display') ||
                     track.contentHint === 'detail');

                if (track.kind === 'video') {
                    if (isPotentiallyScreenShareTrack) {
                        if (!updatedParticipant.screenStream || updatedParticipant.screenStream.id !== incomingStream.id) {
                            updatedParticipant.screenStream = incomingStream;
                            console.log(`[ontrack] Recibiendo NUEVO stream de PANTALLA de ${peerId}`);
                            if (updatedParticipant.cameraStream && updatedParticipant.cameraStream.id === incomingStream.id) {
                                updatedParticipant.cameraStream = null;
                            }
                        }
                    } else {
                        if (!updatedParticipant.cameraStream || updatedParticipant.cameraStream.id !== incomingStream.id) {
                            updatedParticipant.cameraStream = incomingStream;
                            console.log(`[ontrack] Recibiendo NUEVO stream de CÁMARA de ${peerId}`);
                            if (updatedParticipant.screenStream && updatedParticipant.screenStream.id === incomingStream.id) {
                                updatedParticipant.screenStream = null;
                            }
                        }
                        updatedParticipant.videoEnabled = true;
                    }
                } else if (track.kind === 'audio') {
                    if (updatedParticipant.isSharingRemoteScreen && updatedParticipant.screenStream?.id === incomingStream.id) {
                        if (!updatedParticipant.screenStream.getAudioTracks().some(t => t.id === track.id)) {
                             updatedParticipant.screenStream.addTrack(track);
                             console.log(`[ontrack] Añadido track de audio a screenStream de ${peerId}`);
                        }
                    } else {
                        if (!updatedParticipant.cameraStream) {
                            updatedParticipant.cameraStream = new MediaStream();
                        }
                        if (!updatedParticipant.cameraStream.getAudioTracks().some(t => t.id === track.id)) {
                             updatedParticipant.cameraStream.addTrack(track);
                             console.log(`[ontrack] Añadido track de audio a cameraStream de ${peerId}`);
                        }
                        updatedParticipant.micEnabled = true;
                    }
                }

                return {
                    ...prev,
                    [peerId]: updatedParticipant
                };
            });
        };

        pc.onicecandidate = (event) => {
            if (event.candidate && currentUser) {
                console.log(`[ICE Candidate] Generado candidato para ${peerId}.`);
                sendSignal(peerId, { type: 'candidate', candidate: event.candidate.toJSON() });
            }
        };

        pc.onnegotiationneeded = async () => {
    if (pc.signalingState !== 'stable') {
        console.warn(`[onnegotiationneeded] signalingState no es 'stable' (${pc.signalingState}). Retrasando oferta para ${peerId}.`);
        return;
    }

    // AÑADE ESTA LÓGICA DE NUEVO
    if (localStream) {
        localStream.getTracks().forEach(track => {
            // Asegúrate de que el track no ha sido añadido ya para evitar duplicados
            // y que el track es de tipo 'live' (no ha terminado)
            if (track.readyState === 'live' && !pc.getSenders().some(sender => sender.track === track)) {
                pc.addTrack(track, localStream);
                console.log(`[ON_NEGOTIATION] ✅ Añadido/re-añadido track local ${track.kind} a PC de ${peerId} durante negociación.`);
            } else if (track.readyState !== 'live') {
                console.warn(`[ON_NEGOTIATION] No se añade track ${track.kind} para ${peerId} porque no está 'live'.`);
            }
        });
    }


    try {
        const localUserId = parseInt(currentUser?.id.toString() || '0');
        const remoteMemberId = parseInt(peerId);
        const isInitiator = localUserId < remoteMemberId;

        if (isInitiator) {
            console.log(`[ON_NEGOTIATION - OFERTA INICIADA] Creando OFERTA para ${peerId}.`);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            sendSignal(peerId, { type: 'offer', sdp: offer.sdp, sdpType: offer.type });
            console.log(`[SIGNAL OUT] Oferta enviada de ${currentUser?.id} a ${peerId}.`);
        } else {
            console.log(`[ON_NEGOTIATION - ESPERANDO OFERTA] Esperando oferta de ${peerId}.`);
        }

    } catch (e) {
        console.error(`[PC Event] Error en onnegotiationneeded para ${peerId}:`, e);
    }
};

        pc.onconnectionstatechange = () => {
            console.log(`[PC State] PeerConnection con ${peerId} estado: ${pc.connectionState}`);
            if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
                console.log(`[PC State] RTC PeerConnection for ${peerId} disconnected/failed/closed. Cleaning up.`);
                if (pc.connectionState !== 'closed') {
                    pc.close();
                }
                const newPeerConnections = { ...peerConnectionsRef.current };
                delete newPeerConnections[peerId];
                peerConnectionsRef.current = newPeerConnections;

                setParticipants(prev => {
                    const copy = { ...prev };
                    delete copy[peerId];
                    return copy;
                });
                console.log(`[PC State] Limpiado peer ${peerId} del estado de participantes.`);
            }
        };
        // Agrega estos logs para depuración completa del estado de la PC
        pc.oniceconnectionstatechange = () => { console.log(`[PC State - ICE] PeerConnection con ${peerId} ICE: ${pc.iceConnectionState}`); };
        pc.onsignalingstatechange = () => { console.log(`[PC State - Signaling] PeerConnection con ${peerId} signaling: ${pc.signalingState}`); };
        pc.onicegatheringstatechange = () => { console.log(`[PC State - Ice Gathering] PeerConnection con ${peerId} ICE gathering: ${pc.iceGatheringState}`); };

        peerConnectionsRef.current[peerId] = pc; // Guarda la nueva PC creada
    }
    
    return pc; // Retorna la instancia correcta de pc
}, [currentUser, localStream, sendSignal, setParticipants]); // Agrega setParticipants como dependencia
  // --- useEffect para obtener el stream local ---
 useEffect(() => {
      const getMedia = async () => {
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

    if (!localStream) { // Solo intenta obtener medios si localStream no existe
        getMedia();
    }

    // --- Función de limpieza actualizada ---
    return () => {
        // Asegúrate de que el stream sea el que se estableció en este efecto
        if (localStream) {
            console.log("🟡 Deteniendo tracks de localStream en cleanup.");
            localStream.getTracks().forEach(track => track.stop());
            // No resetees setLocalStream(null) aquí si esperas que persista
            // para otras lógicas como `handleCallCleanup`.
            // Es mejor que `handleCallCleanup` se encargue de la limpieza final.
        }
    };
}, [localStream]); // ¡IMPORTANTE! Añade localStream a las dependencias.
const processSignal = useCallback(async (peerId: string, type: string, data: any) => {
    const pc = getOrCreatePeerConnection(peerId); // Obtiene o crea la PC para este peer

    try {
        if (type === 'offer') {
            console.log(`[SIGNAL IN] Recibida OFERTA de ${peerId}.`);
            await pc.setRemoteDescription(new RTCSessionDescription(data));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            sendSignal(peerId, { type: 'answer', sdp: answer.sdp, sdpType: answer.type });
            console.log(`[SIGNAL OUT] Enviando RESPUESTA a ${peerId}.`);
            // Procesa candidatos ICE que puedan haber llegado antes que la oferta
            if (iceCandidatesQueueRef.current[peerId]) {
                for (const candidate of iceCandidatesQueueRef.current[peerId]) {
                    try {
                        await pc.addIceCandidate(new RTCIceCandidate(candidate));
                        console.log(`[ICE Candidate] Añadido candidato en cola para ${peerId}.`);
                    } catch (e) {
                        console.error(`[ICE Candidate ERROR] Error al añadir candidato en cola para ${peerId}:`, e);
                    }
                }
                delete iceCandidatesQueueRef.current[peerId]; // Limpia la cola
            }

        } else if (type === 'answer') {
            console.log(`[SIGNAL IN] Recibida RESPUESTA de ${peerId}.`);
            await pc.setRemoteDescription(new RTCSessionDescription(data));
            // Procesa candidatos ICE que puedan haber llegado antes que la respuesta
            if (iceCandidatesQueueRef.current[peerId]) {
                for (const candidate of iceCandidatesQueueRef.current[peerId]) {
                    try {
                        await pc.addIceCandidate(new RTCIceCandidate(candidate));
                        console.log(`[ICE Candidate] Añadido candidato en cola para ${peerId}.`);
                    } catch (e) {
                        console.error(`[ICE Candidate ERROR] Error al añadir candidato en cola para ${peerId}:`, e);
                    }
                }
                delete iceCandidatesQueueRef.current[peerId];
            }

        } else if (type === 'candidate') {
            console.log(`[SIGNAL IN] Recibido CANDIDATO de ${peerId}.`);
            // Si la descripción remota aún no se ha establecido, encolar el candidato
            if (!pc.remoteDescription) {
                console.warn(`[ICE Candidate] Remote description not set for ${peerId}. Queuing candidate.`);
                if (!iceCandidatesQueueRef.current[peerId]) {
                    iceCandidatesQueueRef.current[peerId] = [];
                }
                iceCandidatesQueueRef.current[peerId].push(data.candidate); // Guarda el objeto completo del candidato
            } else {
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
                    console.log(`[ICE Candidate] Añadido candidato para ${peerId}.`);
                } catch (e) {
                    // Ignorar error si el candidato ya fue añadido o si la conexión está cerrada
                    if (!e.toString().includes('already added') && !e.toString().includes('closed')) {
                        console.error(`[ICE Candidate ERROR] Error al añadir candidato para ${peerId}:`, e);
                    }
                }
            }
        } else if (type === 'screenShareStatus') {
            console.log(`[SIGNAL IN] Recibido screenShareStatus de ${peerId}: ${data.isSharing}`);
            setParticipants(prev => ({
                ...prev,
                [peerId]: {
                    ...(prev[peerId] || { id: peerId, name: `Usuario ${peerId}`, videoEnabled: false, micEnabled: false, cameraStream: null, screenStream: null }),
                    isSharingRemoteScreen: data.isSharing,
                    // Si deja de compartir, limpia el screenStream
                    screenStream: data.isSharing ? prev[peerId]?.screenStream : null
                }
            }));
        }
    } catch (e) {
        console.error(`[SIGNAL IN ERROR] Error al procesar señal tipo ${type} de ${peerId}:`, e);
    }
}, [getOrCreatePeerConnection, sendSignal, currentUser]);

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
        joinedChannel.here((members) => {
            console.log(`[REVERB] HERE event: Current members in room ${roomId}:`, members);
            const initialParticipants: Record<string, ParticipantState> = {};
            members.forEach((member: any) => {
                // *** IMPORTANTE: NO CREAR PC PARA EL PROPIO USUARIO ***
                if (String(member.id) !== String(currentUser?.id)) { // Convertir a String para comparación segura
                    initialParticipants[member.id] = {
                        id: member.id,
                        name: member.name,
                        videoEnabled: false,
                        micEnabled: false,
                        cameraStream: null,
                        screenStream: null,
                        isSharingRemoteScreen: false,
                    };
                    // Para cada miembro existente, crea una PC y negocia
                    getOrCreatePeerConnection(member.id);
                }
            });
            setParticipants(prev => ({ ...prev, ...initialParticipants }));
        });

        // --- joinedChannel.joining: Para miembros que se unen DESPUÉS de ti ---
        joinedChannel.joining((member: any) => {
            console.log(`[REVERB] JOINING event: User ${member.id} has joined the room.`);
            // *** IMPORTANTE: NO CREAR PC PARA EL PROPIO USUARIO ***
            if (String(member.id) === String(currentUser?.id)) { // Si es el propio usuario que acaba de unirse
                console.log(`[REVERB] Ignorando JOINING event para mi mismo: ${member.id}`);
                return;
            }

            // Añadir al nuevo participante al estado
            setParticipants(prev => ({
                ...prev,
                [member.id]: {
                    id: member.id,
                    name: member.name,
                    videoEnabled: false,
                    micEnabled: false,
                    cameraStream: null,
                    screenStream: null,
                    isSharingRemoteScreen: false,
                }
            }));
            // Crear una nueva PeerConnection para el nuevo miembro
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
                console.log(`[REVERB] LEAVING event: User ${member.id} has left the room.`);
                // Limpia la RTCPeerConnection para el miembro que se fue
                const pc = peerConnectionsRef.current[member.id];
                if (pc && pc.connectionState !== 'closed') {
                    pc.close();
                    console.log(`[PC] Cerrada RTCPeerConnection para el miembro saliente: ${member.id}`);
                }
                const newPeerConnections = { ...peerConnectionsRef.current };
                delete newPeerConnections[member.id];
                peerConnectionsRef.current = newPeerConnections;

                // Actualiza el estado de participantes
                setParticipants(prev => {
                    const copy = { ...prev };
                    delete copy[member.id];
                    return copy;
                });
                console.log(`[REVERB] Limpiado estado para el miembro saliente: ${member.id}`);
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

                    // Dentro de joinedChannel.listenForWhisper('Signal')
                    // Dentro de joinedChannel.listenForWhisper('Signal')
                  case 'screenShareStatus':
                      console.log(`[ScreenShareStatus] Recibido estado de pantalla compartida de ${data.from}: isSharing=${data.isSharing}`);
                      setParticipants(prev => {
                          const participantId = data.from;
                          const existingParticipant = prev[participantId];
                          if (!existingParticipant) return prev;

                          const updatedParticipant = {
                              ...existingParticipant,
                              isSharingRemoteScreen: data.isSharing // ACTUALIZA ESTO SIEMPRE
                          };

                          if (!data.isSharing) {
                              // Si el usuario deja de compartir pantalla, limpia su screenStream en el estado
                              updatedParticipant.screenStream = null;
                              // Opcional: podrías querer forzar que el cameraStream vuelva a mostrarse
                              // si la cámara de ese usuario estaba activa antes.
                              // Esto se manejaría si el track de la cámara se reanuda y llega por ontrack.
                          }
                          // Cuando inicia a compartir, `screenStream` se establecerá cuando llegue un nuevo track en `ontrack`.

                          return { ...prev, [participantId]: updatedParticipant };
                      });
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
    stopScreenShare,  // Añadir como dependencia para que el linter no se queje
    setParticipants
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
const toggleScreenShare = useCallback(async () => {
    if (!localStream) {
        console.warn("localStream no está disponible. No se puede iniciar/detener la compartición de pantalla.");
        return;
    }

    // Bandera para saber si se necesita una renegociación global
    let negotiationNeeded = false;

    if (isSharingScreen) {
        // --- Lógica para DETENER la compartición de pantalla ---
        if (screenShareStreamRef.current) {
            screenShareStreamRef.current.getTracks().forEach(track => track.stop());
            screenShareStreamRef.current = null;
        }

        Object.values(peerConnectionsRef.current).forEach(pc => {
            const peerId = Object.keys(peerConnectionsRef.current).find(key => peerConnectionsRef.current[key] === pc);
            if (!peerId) return;

            const sendersForThisPeer = screenShareSendersRef.current[peerId];

            // Remueve los senders si existen
            if (sendersForThisPeer?.video) {
                try {
                    pc.removeTrack(sendersForThisPeer.video);
                    console.log(`[ScreenShare Stop] Removed screen video track from PC for ${peerId}.`);
                    negotiationNeeded = true; // Se necesita renegociación
                } catch (e) {
                    console.error(`[ScreenShare Stop Error] Error removing video track for ${peerId}:`, e);
                }
            }
            if (sendersForThisPeer?.audio) {
                try {
                    pc.removeTrack(sendersForThisPeer.audio);
                    console.log(`[ScreenShare Stop] Removed screen audio track from PC for ${peerId}.`);
                    negotiationNeeded = true; // Se necesita renegociación
                } catch (e) {
                    console.error(`[ScreenShare Stop Error] Error removing audio track for ${peerId}:`, e);
                }
            }
            delete screenShareSendersRef.current[peerId];
        });

        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
        }

        Object.keys(peerConnectionsRef.current).forEach(peerId => {
            sendSignal(peerId, { type: 'screenShareStatus', isSharing: false, from: currentUser?.id });
        });

        setIsSharingScreen(false);

    } else {
        // --- Lógica para INICIAR la compartición de pantalla ---
        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
            screenShareStreamRef.current = screenStream;

            const screenVideoTrack = screenStream.getVideoTracks()[0];
            const screenAudioTrack = screenStream.getAudioTracks()[0];

            if (localVideoRef.current) {
                localVideoRef.current.srcObject = screenStream;
            }

            Object.values(peerConnectionsRef.current).forEach(pc => {
                const peerId = Object.keys(peerConnectionsRef.current).find(key => peerConnectionsRef.current[key] === pc);
                if (!peerId) return;

                // Añade los tracks y guarda los senders
                const videoSender = pc.addTrack(screenVideoTrack, screenStream);
                console.log(`[ScreenShare Start] Added NEW screen video track to PC for ${peerId}.`);
                negotiationNeeded = true; // Se necesita renegociación

                let audioSender: RTCRtpSender | undefined;
                if (screenAudioTrack) {
                    audioSender = pc.addTrack(screenAudioTrack, screenStream);
                    console.log(`[ScreenShare Start] Added NEW screen audio track to PC for ${peerId}.`);
                    // Aquí negotiationNeeded ya será true si se añadió el video, pero lo mantenemos por claridad
                    negotiationNeeded = true; 
                }

                screenShareSendersRef.current[peerId] = {
                    video: videoSender,
                    audio: audioSender
                };
            });

            screenVideoTrack.onended = () => {
                console.log("[ScreenShare] Screen share ended by user (browser control).");
                toggleScreenShare(); // Llama a la misma función para detener
            };

            Object.keys(peerConnectionsRef.current).forEach(peerId => {
                sendSignal(peerId, { type: 'screenShareStatus', isSharing: true, from: currentUser?.id });
            });

            setIsSharingScreen(true);

        } catch (error) {
            console.error("Error sharing screen:", error);
            setIsSharingScreen(false);
            if (localVideoRef.current && localStream) {
                localVideoRef.current.srcObject = localStream;
            }
        }
    }

    // *** FUERZA LA RENEGOCIACIÓN SI SE REALIZARON CAMBIOS EN LOS TRACKS ***
    // Esto asegura que la nueva oferta/respuesta se envíe si un track fue añadido/removido.
    if (negotiationNeeded) {
        Object.keys(peerConnectionsRef.current).forEach(async (peerId) => {
            const pc = peerConnectionsRef.current[peerId];
            if (!pc || pc.signalingState === 'closed') return;

            try {
                // Forzar una nueva oferta solo si somos el "iniciador" lógico para este peer,
                // o si el signalingState lo permite sin causar un ICE restart innecesario.
                // Sin embargo, si hemos añadido/removido tracks, `onnegotiationneeded` debería dispararse.
                // A veces, forzarlo explícitamente puede ayudar si el evento no se propaga por alguna razón.
                // Una forma más segura es esperar a que onnegotiationneeded se dispare naturalmente.
                // Si esto no funciona, podemos considerar una señal personalizada de "renegotiation-request".

                // Por ahora, confiamos en que addTrack/removeTrack dispara onnegotiationneeded.
                // La clave es que la lógica de onnegotiationneeded sea robusta.
                console.log(`[ScreenShare Negotiation] Changes made, expecting onnegotiationneeded for ${peerId}.`);
                // Si onnegotiationneeded no se dispara, o no hace su trabajo, puedes intentar esto:
                // if (pc.signalingState === 'stable') {
                //     const offer = await pc.createOffer();
                //     await pc.setLocalDescription(offer);
                //     sendSignal(peerId, { type: 'offer', sdp: offer.sdp, sdpType: offer.type });
                //     console.log(`[ScreenShare Negotiation] Forced offer sent to ${peerId}.`);
                // }
            } catch (e) {
                console.error(`[ScreenShare Negotiation Error] Error forcing negotiation for ${peerId}:`, e);
            }
        });
    }

}, [isSharingScreen, localStream, sendSignal, currentUser, peerConnectionsRef]); // Añadir peerConnectionsRef

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

  const toggleRecording = () => {
    //console.log("Función de grabación no implementada aún.");
    // setIsRecording(prev => !prev);
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
        <button onClick={() => navigate('/rooms')} className="ml-4 px-4 py-2 bg-orange-600 rounded">Volver a Salas</button>
      </div>
    );
  }

  // Obtenemos los IDs de los participantes del estado 'participants'
  //const allParticipants = Object.values(participants);

// ... (imports y hooks se mantienen igual) ...
// ... (resto del código) ...

  const remoteScreenShareActive = Object.values(participants).some(p => p.screenStream);
  const isAnyScreenSharing = isSharingScreen || remoteScreenShareActive;
 
     const remoteScreenShareParticipant = Object.values(participants).find(p => p.screenStream);
    const currentScreenShareStream = isSharingScreen ? screenShareStreamRef.current : (remoteScreenShareParticipant?.screenStream || null);
    const currentScreenShareOwnerId = isSharingScreen ? currentUser?.id : remoteScreenShareParticipant?.id;
    const currentScreenShareOwnerName = isSharingScreen ? `${currentUser?.name || 'Tú'} (Mi Pantalla)` : (remoteScreenShareParticipant ? `${remoteScreenShareParticipant.name} (Pantalla)` : '');
    const allActiveStreams = [
        localStream,
        ...Object.values(participants).map(p => p.cameraStream),
        ...Object.values(participants).filter(p => p.screenStream && p.id !== currentScreenShareOwnerId).map(p => p.screenStream)
    ].filter(Boolean); // Filtra los streams nulos
let totalVideosInGrid = 0;
  if (!currentScreenShareStream) { // Solo si NO hay pantalla compartida principal
    if (localStream && videoEnabled) { // Tu cámara solo cuenta si está habilitada
        totalVideosInGrid += 1;
    }
    totalVideosInGrid += Object.values(participants).filter(p => p.cameraStream && p.videoEnabled).length;
  }
    // Calcular el número de videos para decidir la cuadrícula
    const numVideos = allActiveStreams.length + (currentScreenShareStream ? 0 : 1); // +1 si tu cámara está activa y no hay pantalla compartida
    // La lógica para `numVideos` necesita ser precisa para decidir el layout
// ... (imports y hooks se mantienen igual) ...
return (
    // Contenedor principal de la VideoRoom.
    // En mobile, es una columna (flex-col).
    // En desktop, es una fila (md:flex-row) para el layout principal y el chat lateral.
    <div className={`flex bg-black text-white w-full ${isCallMinimized ? 'flex-col' : 'h-screen flex-col md:flex-row'}`}>

      {/* Si la llamada NO está minimizada */}
      {!isCallMinimized && (
        // Contenedor principal de la vista de llamada cuando NO está minimizada.
        // En mobile: es una columna oculta si el chat mobile está abierto.
        // En desktop: es el área principal que contiene el video y los controles de llamada.
        <div className={`flex flex-1 ${isChatOpenMobile ? 'hidden' : 'flex flex-col'} md:flex md:flex-row`}> {/* AÑADE md:flex-row AQUÍ */}

          {/* Contenedor del VideoDisplay y Controles de llamada (principales) */}
          {/* Este div es la COLUMNA izquierda en desktop (video + controles abajo) */}
          <div className="flex-1 flex flex-col"> {/* flex-1 para que ocupe el espacio principal */}
            <RecordingIndicator isRecording={false} />
            <VideoDisplay
              currentScreenShareStream={currentScreenShareStream}
              currentScreenShareOwnerId={currentScreenShareOwnerId}
              currentScreenShareOwnerName={currentScreenShareOwnerName}
              isSharingScreen={isSharingScreen}
              isAnyScreenSharing={isAnyScreenSharing}
              allActiveStreams={allActiveStreams}
              localStream={localStream}
              currentUser={currentUser}
              videoEnabled={videoEnabled}
              micEnabled={micEnabled}
              volume={volume}
              participants={participants}
            />

            {/* Controles de la llamada para MOBILE (parte inferior) */}
            {/* Estos controles SOLO deben ser visibles en MOBILE (hidden md:flex significa oculto en desktop) */}
            <CallControls
              variant="mobile-main"
              micEnabled={micEnabled}
              videoEnabled={videoEnabled}
              isSharingScreen={isSharingScreen}
              isCallMinimized={isCallMinimized}
              toggleMic={toggleMic}
              toggleVideo={toggleVideo}
              toggleScreenShare={toggleScreenShare}
              toggleMinimizeCall={toggleMinimizeCall}
              handleCallCleanup={handleCallCleanup}
              onToggleChatMobile={() => setIsChatOpenMobile(prev => !prev)}
            />

            {/* Controles principales para DESKTOP (parte inferior de la vista principal de video) */}
            {/* Estos controles SOLO deben ser visibles en DESKTOP (hidden md:flex significa oculto en mobile) */}
            <CallControls
              variant="desktop-main"
              micEnabled={micEnabled}
              videoEnabled={videoEnabled}
              isSharingScreen={isSharingScreen}
              isCallMinimized={isCallMinimized}
              toggleMic={toggleMic}
              toggleVideo={toggleVideo}
              toggleScreenShare={toggleScreenShare}
              toggleMinimizeCall={toggleMinimizeCall}
              handleCallCleanup={handleCallCleanup}
            />
          </div> {/* FIN del contenedor del VideoDisplay y Controles de llamada */}


          {/* Contenedor para el Botón de Toggle del Chat en Desktop */}
          {/* Este es el botón que aparece al lado derecho para abrir/cerrar el chat lateral */}
          {/* Solo visible en desktop */}
          <CallControls
              variant="desktop-chat-toggle"
              isChatOpenDesktop={isChatOpenDesktop}
              onToggleChatDesktop={() => setIsChatOpenDesktop(prev => !prev)}
              // Estas props son requeridas por la interfaz, pero no se usan en esta variante
              micEnabled={micEnabled} videoEnabled={videoEnabled} isSharingScreen={isSharingScreen}
              isCallMinimized={isCallMinimized} toggleMic={toggleMic} toggleVideo={toggleVideo}
              toggleScreenShare={toggleScreenShare} toggleMinimizeCall={toggleMinimizeCall}
              handleCallCleanup={handleCallCleanup}
          />

        </div> // FIN del contenedor principal de la vista de llamada (cuando NO está minimizada)
      )}


      {/* Contenedor lateral para Controles (si los hay dentro del chat) y Chat */}
      {/* Solo visible cuando la llamada NO está minimizada */}
      {!isCallMinimized && (
        <ChatPanel
          roomId={roomId}
          isChatOpenMobile={isChatOpenMobile}
          isChatOpenDesktop={isChatOpenDesktop}
        >
          {/* CallControls con variant="desktop-side" está dentro del ChatPanel.
              Esto es útil si quieres controles duplicados o adicionales DENTRO del panel de chat.
              Si no necesitas controles adicionales aquí, puedes eliminar este bloque.
              Por ahora, lo mantendremos asumiendo que quieres controles allí. */}
          <CallControls
            variant="desktop-side"
            micEnabled={micEnabled}
            videoEnabled={videoEnabled}
            isSharingScreen={isSharingScreen}
            isCallMinimized={isCallMinimized}
            toggleMic={toggleMic}
            toggleVideo={toggleVideo}
            toggleScreenShare={toggleScreenShare}
            toggleMinimizeCall={toggleMinimizeCall}
            handleCallCleanup={handleCallCleanup}
            onToggleChatMobile={() => setIsChatOpenMobile(false)} // Para cerrar el overlay móvil
          />
        </ChatPanel>
      )}

      {/* --- WIDGET MINIMIZADO (Desktop y Mobile) --- */}
      {isCallMinimized && (
        <MinimizedWidget
          currentScreenShareStream={currentScreenShareStream}
          currentScreenShareOwnerId={currentScreenShareOwnerId}
          currentScreenShareOwnerName={currentScreenShareOwnerName}
          isSharingScreen={isSharingScreen}
          isAnyScreenSharing={isAnyScreenSharing}
          localStream={localStream}
          currentUser={currentUser}
          videoEnabled={videoEnabled}
          micEnabled={micEnabled}
          participants={participants}
          toggleMinimizeCall={toggleMinimizeCall}
          handleCallCleanup={handleCallCleanup}
          toggleMic={toggleMic}
          toggleVideo={toggleVideo}
          toggleScreenShare={toggleScreenShare}
          isCallMinimized={isCallMinimized} // Asegúrate de pasarla
        />
      )}
    </div>
  );
};

export default VideoRoom;