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
  MessageSquare, PhoneOff, Minimize2, Maximize2, Users, // <-- NUEVO: Íconos de minimizar/maximizar
  X, Move, Dot, ChevronLeft, ChevronRight
} from 'lucide-react';
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
  isTeacher: boolean; // Add this prop as it's used in VideoRoom
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
   isTeacher, // Destructure new prop
   isCallMinimized, // Destructure
   toggleMinimizeCall, // Destructure
   handleCallCleanup // Destructure
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

  // NUEVO: Estados para drag and drop
  const [widgetPosition, setWidgetPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const widgetRef = useRef<HTMLDivElement>(null);

// En VideoRoom.tsx, dentro del componente:
const [hasJoinedChannel, setHasJoinedChannel] = useState(false);
const [isSharingScreen, setIsSharingScreen] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);
const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
const screenShareStreamRef = useRef<MediaStream | null>(null);
  // --- Refs para mantener referencias persistentes ---
  const screenShareSendersRef = useRef<Record<string, { video?: RTCRtpSender, audio?: RTCRtpSender }>>({});
const [isChatOpenMobile, setIsChatOpenMobile] = useState(false);
  const peerConnectionsRef = useRef<Record<string, RTCPeerConnection>>({});
  const channelRef = useRef<EchoChannel | null>(null);
  const reverbServiceRef = useRef(createReverbWebSocketService(currentUser?.token || '')); // Instancia del servicio
const [isChatOpenDesktop, setIsChatOpenDesktop] = useState(true); 
  // Estado para streams remotos y participantes
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  // participants ahora incluye toda la info necesaria para renderizar y gestionar el estado del usuario
const [participants, setParticipants] = useState<Record<string, ParticipantState>>({});
  const [micEnabled, setMicEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const volume = useMicVolume(localStream); // Usa tu hook para el volumen del micrófono local

   // --- Funciones de Drag and Drop (mantienen la lógica que ya te di) ---

  const stopDragging = useCallback(() => {
    setIsDragging(false);
  }, []);

const DESKTOP_WIDGET_WIDTH = 320;
const DESKTOP_WIDGET_HEIGHT = 400;
const MOBILE_WIDGET_WIDTH = 144; // w-36 * 4px/unit = 144px
const MOBILE_WIDGET_HEIGHT = 96;  // h-24 * 4px/unit = 96px
const widgetDesktopRef = useRef<HTMLDivElement>(null);
const widgetMobileRef = useRef<HTMLDivElement>(null);

const startDragging = useCallback((clientX: number, clientY: number) => {
    let currentWidgetElement: HTMLElement | null = null;
    let fallbackWidth = 0;
    let fallbackHeight = 0;

    // Determinar qué widget está activo y obtener su referencia y dimensiones de fallback
    if (window.innerWidth >= 768) { // Desktop
        currentWidgetElement = widgetDesktopRef.current;
        fallbackWidth = DESKTOP_WIDGET_WIDTH;
        fallbackHeight = DESKTOP_WIDGET_HEIGHT;
    } else { // Mobile
        currentWidgetElement = widgetMobileRef.current;
        fallbackWidth = MOBILE_WIDGET_WIDTH;
        fallbackHeight = MOBILE_WIDGET_HEIGHT;
    }

    if (!currentWidgetElement) {
      console.error('startDragging: No se encontró el widget activo. No se puede iniciar el arrastre.');
      return;
    }

    const rect = currentWidgetElement.getBoundingClientRect();

    // Si rect.width o rect.height son 0, significa que el navegador no ha calculado sus dimensiones.
    // En este caso, usamos los fallbacks predefinidos. Esto solucionará el "salto".
    const actualWidth = rect.width === 0 ? fallbackWidth : rect.width;
    const actualHeight = rect.height === 0 ? fallbackHeight : rect.height;

    // Calculamos el offset basándonos en la esquina superior izquierda del widget
    // Esto ya debería ser preciso si rect.left/top son correctos
    setDragOffset({
      x: clientX - rect.left,
      y: clientY - rect.top
    });

    setIsDragging(true);
    console.log('startDragging: Iniciado. Coordenadas de clic:', { clientX, clientY });
    console.log('startDragging: Rect del widget (medido):', { left: rect.left, top: rect.top, width: rect.width, height: rect.height });
    console.log('startDragging: Dimensiones del widget (usadas):', { actualWidth, actualHeight }); // <-- Nuevo log
    console.log('startDragging: DragOffset calculado:', { x: clientX - rect.left, y: clientY - rect.top });

  }, []);

  const handlePointerMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDragging) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const newX = clientX - dragOffset.x;
    const newY = clientY - dragOffset.y;

    let currentWidgetWidth = 0;
    let currentWidgetHeight = 0;

    // Usar la referencia correcta para obtener las dimensiones, o los fallbacks
    if (window.innerWidth >= 768) { // Desktop
        currentWidgetWidth = widgetDesktopRef.current?.offsetWidth || DESKTOP_WIDGET_WIDTH;
        currentWidgetHeight = widgetDesktopRef.current?.offsetHeight || DESKTOP_WIDGET_HEIGHT;
    } else { // Mobile
        currentWidgetWidth = widgetMobileRef.current?.offsetWidth || MOBILE_WIDGET_WIDTH;
        currentWidgetHeight = widgetMobileRef.current?.offsetHeight || MOBILE_WIDGET_HEIGHT;
    }


    const maxX = window.innerWidth - currentWidgetWidth;
    const maxY = window.innerHeight - currentWidgetHeight;

    setWidgetPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY))
    });

    if ('touches' in e) {
      e.preventDefault();
    }
  }, [isDragging, dragOffset]);


  // Inicializar posición por defecto cuando se minimiza
  useEffect(() => {
    if (isCallMinimized && widgetPosition.x === 0 && widgetPosition.y === 0) {
      let initialWidgetWidth = 0;
      let initialWidgetHeight = 0;

      // Usar la referencia correcta para la posición inicial, o los fallbacks
      if (window.innerWidth >= 768) { // Desktop
          initialWidgetWidth = widgetDesktopRef.current?.offsetWidth || DESKTOP_WIDGET_WIDTH;
          initialWidgetHeight = widgetDesktopRef.current?.offsetHeight || DESKTOP_WIDGET_HEIGHT;
      } else { // Mobile
          initialWidgetWidth = widgetMobileRef.current?.offsetWidth || MOBILE_WIDGET_WIDTH;
          initialWidgetHeight = widgetMobileRef.current?.offsetHeight || MOBILE_WIDGET_HEIGHT;
      }

      setWidgetPosition({
        x: window.innerWidth - initialWidgetWidth - 20,
        y: window.innerHeight - initialWidgetHeight - 20
      });
    }
  }, [isCallMinimized, widgetPosition]);

  // Manejadores de eventos para el BOTÓN de arrastre
  // Ahora estos se aplican solo al elemento que quieres que sea el "mango" de arrastre
  const handleDragButtonMouseDown = useCallback((e: React.MouseEvent) => {
    startDragging(e.clientX, e.clientY);
    e.stopPropagation(); // ¡IMPORTANTE! Evita que el evento se propague al div padre
    e.preventDefault(); // Previene la selección de texto
  }, [startDragging]);

  const handleDragButtonTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    startDragging(touch.clientX, touch.clientY);
    e.stopPropagation(); // ¡IMPORTANTE! Evita que el evento se propague
    // No e.preventDefault() aquí, se maneja en handlePointerMove
  }, [startDragging]);


  // Efecto para agregar event listeners globales
  useEffect(() => {
    if (isDragging) { // ¡Sólo si isDragging es true! Esto es clave para la fluidez
      document.addEventListener('mousemove', handlePointerMove);
      document.addEventListener('mouseup', stopDragging);
      document.addEventListener('touchmove', handlePointerMove, { passive: false });
      document.addEventListener('touchend', stopDragging);

      return () => {
        document.removeEventListener('mousemove', handlePointerMove);
        document.removeEventListener('mouseup', stopDragging);
        document.removeEventListener('touchmove', handlePointerMove);
        document.removeEventListener('touchend', stopDragging);
      };
    }
  }, [isDragging, handlePointerMove, stopDragging]); // Dependencia clave: isDragging


  // Inicializar posición por defecto cuando se minimiza
  useEffect(() => {
    // Solo si se minimiza la llamada Y el widgetRef ya está disponible
    // Y la posición no ha sido establecida explícitamente todavía (ej. x=0, y=0)
    if (isCallMinimized && widgetPosition.x === 0 && widgetPosition.y === 0) {
      // Usar los valores correctos para la inicialización
      const initialWidgetWidth = widgetRef.current?.offsetWidth || (window.innerWidth > 768 ? DESKTOP_WIDGET_WIDTH : MOBILE_WIDGET_WIDTH);
      const initialWidgetHeight = widgetRef.current?.offsetHeight || (window.innerWidth > 768 ? DESKTOP_WIDGET_HEIGHT : MOBILE_WIDGET_HEIGHT);

      setWidgetPosition({
        x: window.innerWidth - initialWidgetWidth - 20, // 20px de margen
        y: window.innerHeight - initialWidgetHeight - 20 // 20px de margen
      });
    }
  }, [isCallMinimized, widgetPosition]); // Mantener widgetPosition aquí es importante

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
            // No necesitas añadir tracks locales aquí de nuevo, ya los añadimos al crear la PC.
            // Si cambian (ej. screen share), toggleScreenShare los gestionará y esto se disparará de nuevo.

            if (pc.signalingState !== 'stable') {
                console.warn(`[onnegotiationneeded] signalingState no es 'stable' (${pc.signalingState}). Retrasando oferta para ${peerId}.`);
                return;
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

            if (sendersForThisPeer?.video) {
                pc.removeTrack(sendersForThisPeer.video); // Remueve el sender que guardaste
                console.log(`[ScreenShare Stop] Removed screen video track from PC for ${peerId}.`);
            }
            if (sendersForThisPeer?.audio) {
                pc.removeTrack(sendersForThisPeer.audio); // Remueve el sender que guardaste
                console.log(`[ScreenShare Stop] Removed screen audio track from PC for ${peerId}.`);
            }
            // Limpia los senders de este peer del ref
            delete screenShareSendersRef.current[peerId];
        });

        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
        }

        Object.keys(peerConnectionsRef.current).forEach(peerId => {
            sendSignal(peerId, { type: 'screenShareStatus', isSharing: false, from: currentUser?.id });
        });

        setIsSharingScreen(false);
        return;
    }

    // --- Lógica para INICIAR la compartición de pantalla ---
    try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        screenShareStreamRef.current = screenStream;

        const screenVideoTrack = screenStream.getVideoTracks()[0];
        const screenAudioTrack = screenStream.getAudioTracks()[0];

        // NO INTENTES ASIGNAR screenVideoTrack.id = '...' o screenAudioTrack.id = '...'
        // Usa la ID que ya tienen o propiedades personalizadas si realmente las necesitas
        // para algo más que buscar el sender, pero para el sender no es necesario.

        if (localVideoRef.current) {
            localVideoRef.current.srcObject = screenStream;
        }

        Object.values(peerConnectionsRef.current).forEach(pc => {
            const peerId = Object.keys(peerConnectionsRef.current).find(key => peerConnectionsRef.current[key] === pc);
            if (!peerId) return;

            // Al añadir el track, guarda el RTCRtpSender que retorna addTrack
            const videoSender = pc.addTrack(screenVideoTrack, screenStream);
            console.log(`[ScreenShare Start] Added NEW screen video track to PC for ${peerId}.`);

            let audioSender: RTCRtpSender | undefined;
            if (screenAudioTrack) {
                audioSender = pc.addTrack(screenAudioTrack, screenStream);
                console.log(`[ScreenShare Start] Added NEW screen audio track to PC for ${peerId}.`);
            }

            // Guarda los senders en la ref para poder removerlos después
            screenShareSendersRef.current[peerId] = {
                video: videoSender,
                audio: audioSender
            };
        });

        screenVideoTrack.onended = () => {
            console.log("[ScreenShare] Screen share ended by user (browser control).");
            toggleScreenShare();
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
}, [isSharingScreen, localStream, sendSignal, currentUser]);

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
        // Contenedor general que ocupa toda la pantalla (h-screen)
        // Ya tienes `h-screen` aquí cuando no está minimizado
        <div className={`flex bg-black text-white w-full ${isCallMinimized ? 'flex-col' : 'h-screen flex-col md:flex-row'}`}>

            {/* Contenedor principal de videos (siempre ocupa el espacio disponible) */}
            {/* Si NO está minimizado, queremos que esto ocupe todo el espacio principal */}
            {!isCallMinimized && (
                <div className={`flex flex-1 flex-col ${isChatOpenMobile ? 'hidden' : ''} md:flex`}> {/* 'hidden' para móvil si chat overlay está abierto, md:flex para mostrar en desktop */}
                    {/* Contenido de los videos */}
                    <div className="flex-grow relative p-2 md:p-4 bg-gray-950">
                        <div className="absolute top-4 left-4 z-10 flex items-center bg-gray-800 bg-opacity-75 px-2 py-1 rounded-full text-sm font-semibold md:px-3 md:py-1">
                            <Dot className="w-5 h-5 text-red-500 mr-0 md:mr-2 animate-pulse-custom" />
                            <span className="hidden md:inline">Grabando</span>
                        </div>
                        {(() => {
                            if (currentScreenShareStream) {
                                return (
                                    <>
                                        {/* Video PRINCIPAL: La pantalla compartida (propia o remota) */}
                                        <div className="w-full flex-grow flex items-center justify-center bg-gray-800 rounded-lg overflow-hidden mb-2 md:mb-4 max-h-[70vh]">
                                            <RemoteVideo
                                                stream={currentScreenShareStream}
                                                participantId={`${currentScreenShareOwnerId}-screen`}
                                                participantName={currentScreenShareOwnerName}
                                                videoEnabled={true}
                                                micEnabled={currentScreenShareStream.getAudioTracks().length > 0}
                                                isLocal={isSharingScreen}
                                                volume={0}
                                                isScreenShare={true}
                                            />
                                        </div>
                                        {/* Miniaturas de otros participantes (cámaras y otras pantallas) */}
                                        {allActiveStreams.length > 0 && (
                                            <div className="w-full flex gap-2 md:gap-3 flex-shrink-0 overflow-x-auto p-1 md:p-2 scrollbar-hide">
                                                {/* Tu cámara local (siempre visible si localStream existe y videoEnabled) */}
                                                {localStream && videoEnabled && (
                                                    <div className="flex-none w-36 h-24 sm:w-48 sm:h-32 md:w-56 md:h-36 lg:w-64 lg:h-40">
                                                        <RemoteVideo
                                                            stream={localStream}
                                                            participantId={currentUser?.id || 'local'}
                                                            participantName={`${currentUser?.name || 'Tú'} (Yo)`}
                                                            videoEnabled={videoEnabled}
                                                            micEnabled={micEnabled}
                                                            isLocal={true}
                                                            volume={volume}
                                                            isScreenShare={false}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </div>
                                                )}
                                                {/* Cámaras de participantes remotos y otras PANTALLAS COMPARTIDAS */}
                                                {Object.values(participants).map(participant => (
                                                    <React.Fragment key={participant.id}>
                                                        {participant.cameraStream && participant.videoEnabled && (
                                                            <div className="flex-none w-36 h-24 sm:w-48 sm:h-32 md:w-56 md:h-36 lg:w-64 lg:h-40">
                                                                <RemoteVideo
                                                                    key={participant.id + '-camera'}
                                                                    stream={participant.cameraStream!}
                                                                    participantId={participant.id}
                                                                    participantName={participant.name}
                                                                    videoEnabled={participant.videoEnabled}
                                                                    micEnabled={participant.micEnabled}
                                                                    isLocal={false}
                                                                    volume={0}
                                                                    isScreenShare={false}
                                                                    className="w-full h-full object-cover"
                                                                />
                                                            </div>
                                                        )}
                                                        {participant.screenStream && participant.id !== currentScreenShareOwnerId && (
                                                            <div className="flex-none w-36 h-24 sm:w-48 sm:h-32 md:w-56 md:h-36 lg:w-64 lg:h-40">
                                                                <RemoteVideo
                                                                    key={participant.id + '-screen'}
                                                                    stream={participant.screenStream!}
                                                                    participantId={participant.id}
                                                                    participantName={`${participant.name} (Pantalla)`}
                                                                    videoEnabled={true}
                                                                    micEnabled={participant.screenStream?.getAudioTracks().length > 0}
                                                                    isLocal={false}
                                                                    volume={0}
                                                                    isScreenShare={true}
                                                                    className="w-full h-full object-cover"
                                                                />
                                                            </div>
                                                        )}
                                                    </React.Fragment>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                );
                            } else {
                                let gridColsClass = "grid-cols-1";
                                if (totalVideosInGrid === 2) gridColsClass = "grid-cols-1 sm:grid-cols-2";
                                else if (totalVideosInGrid === 3) gridColsClass = "grid-cols-1 sm:grid-cols-3 md:grid-cols-3";
                                else if (totalVideosInGrid === 4) gridColsClass = "grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4";
                                else if (totalVideosInGrid >= 5) gridColsClass = "grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";

                                return (
                                    <div className="flex-1 flex items-center justify-center p-2">
                                        <div className={`w-full h-full grid ${gridColsClass} gap-3 md:gap-4 auto-rows-fr`}>
                                            {localStream && videoEnabled && (
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
                                                .filter(p => p.cameraStream && p.videoEnabled)
                                                .map(participant => (
                                                    <RemoteVideo
                                                        key={participant.id}
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

                    {/* Controles de la llamada y botón de chat para MOBILE (parte inferior) */}
                    <div className="flex md:hidden justify-center gap-2 p-3 bg-black bg-opacity-80 w-full flex-wrap">
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

                        {/* <button
                            onClick={toggleScreenShare}
                            className="w-12 h-12 rounded-full flex items-center justify-center bg-gray-700 hover:bg-gray-600"
                            title={isSharingScreen ? 'Detener compartir pantalla' : 'Compartir pantalla'}
                        >
                            <ScreenShare size={20} />
                        </button> */}

                        {/* {isTeacher && (
                           <button
                             onClick={toggleRecording}
                             className="w-12 h-12 rounded-full flex items-center justify-center bg-gray-700 hover:bg-gray-600"
                             title={isRecording ? 'Detener grabación' : 'Iniciar grabación'}
                           >
                             <StopCircle size={20} className={isRecording ? 'text-red-500' : ''} />
                           </button>
                         )} */}

                        <button
                            onClick={() => setIsChatOpenMobile(prev => !prev)}
                            className="w-12 h-12 rounded-full flex items-center justify-center bg-orange-600 hover:bg-orange-700"
                            title="Abrir/Cerrar Chat"
                        >
                            <MessageSquare size={20} />
                        </button>

                        <button
                            onClick={toggleMinimizeCall}
                            className="w-12 h-12 rounded-full flex items-center justify-center bg-gray-700 hover:bg-gray-600"
                            title={isCallMinimized ? 'Maximizar llamada' : 'Minimizar llamada'}
                        >
                            {isCallMinimized ? <Maximize2 size={20} /> : <Minimize2 size={20} />}
                        </button>

                        <button
                            onClick={handleCallCleanup}
                            className="w-12 h-12 rounded-full flex items-center justify-center bg-red-600 hover:bg-red-700"
                            title="Colgar"
                        >
                            <PhoneOff size={20} />
                        </button>
                    </div>
                </div>
            )}

            {/* Nuevo Contenedor para el Botón de Toggle del Chat en Desktop */}
            {/* Solo visible en desktop y cuando la llamada NO está minimizada */}
            {!isCallMinimized && (
                <div className={`
                    hidden md:flex flex-col justify-center items-center h-full
                    ${isChatOpenDesktop ? 'w-10' : 'w-10'} {/* Ancho fijo para el botón */}
                    bg-gray-800 border-l border-gray-700
                    transition-all duration-300 ease-in-out
                `}>
                    <button
                        onClick={() => setIsChatOpenDesktop(prev => !prev)}
                        className="w-10 h-20 rounded-l-lg flex items-center justify-center bg-gray-700 hover:bg-gray-600 focus:outline-none"
                        title={isChatOpenDesktop ? 'Ocultar Chat' : 'Mostrar Chat'}
                    >
                        {isChatOpenDesktop ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
                    </button>
                </div>
            )}


            {/* Contenedor lateral para Controles y Chat */}
            {/* Solo se muestra si NO está minimizado. Comportamiento diferente para Mobile y Desktop */}
            {!isCallMinimized && (
                <div className={`
                    md:flex md:flex-col md:border-r md:border-gray-700 md:bg-gray-900 {/* Cambié a border-r */}
                    transition-all duration-300 ease-in-out
                    ${isChatOpenMobile ? 'fixed inset-0 z-50' : 'hidden'} {/* Overlay para móvil */}
                    ${isChatOpenDesktop ? 'md:w-80' : 'md:w-0 md:overflow-hidden'} {/* Ancho y ocultar en desktop */}
                `}>
                    {/* Controles de la llamada (desktop y overlay móvil) */}
                    <div className="flex justify-center gap-2 p-3 bg-black bg-opacity-80 border-b border-gray-700 flex-wrap">
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

                        <button
                            onClick={toggleScreenShare}
                            className="w-12 h-12 rounded-full flex items-center justify-center bg-gray-700 hover:bg-gray-600"
                            title={isSharingScreen ? 'Detener compartir pantalla' : 'Compartir pantalla'}
                        >
                            <ScreenShare size={20} />
                        </button>

                        {/* {isTeacher && (
                           <button
                             onClick={toggleRecording}
                             className="w-12 h-12 rounded-full flex items-center justify-center bg-gray-700 hover:bg-gray-600"
                             title={isRecording ? 'Detener grabación' : 'Iniciar grabación'}
                           >
                             <StopCircle size={20} className={isRecording ? 'text-red-500' : ''} />
                           </button>
                         )} */}

                        {/* Botón de CERRAR Chat (visible solo en el overlay móvil) */}
                        <button
                            onClick={() => setIsChatOpenMobile(false)}
                            className="w-12 h-12 rounded-full flex items-center justify-center bg-gray-700 hover:bg-gray-600 md:hidden"
                            title="Cerrar Chat"
                        >
                            <X size={20} />
                        </button>

                        {/* Botón de Minimizar/Maximizar (este botón en el panel lateral es para desktop) */}
                        <button
                            onClick={toggleMinimizeCall}
                            className="w-12 h-12 rounded-full flex items-center justify-center bg-gray-700 hover:bg-gray-600 hidden md:flex"
                            title={isCallMinimized ? 'Maximizar llamada' : 'Minimizar llamada'}
                        >
                            {isCallMinimized ? <Maximize2 size={20} /> : <Minimize2 size={20} />}
                        </button>

                        <button
                            onClick={handleCallCleanup}
                            className="w-12 h-12 rounded-full flex items-center justify-center bg-red-600 hover:bg-red-700"
                            title="Colgar"
                        >
                            <PhoneOff size={20} />
                        </button>
                    </div>

                    {/* Chat lateral (solo renderizado si isChatOpenDesktop es true para evitar render innecesario) */}
                    {isChatOpenDesktop && (
                        <div className="flex-grow flex flex-col py-2 md:py-8 justify-end overflow-hidden">
                            {roomId && <ChatBox roomId={roomId} />}
                        </div>
                    )}
                </div>
            )}

            {/* --- WIDGET MINIMIZADO --- */}

            {/* Widget minimizado en DESKTOP (muestra cámaras y más controles) */}
            {isCallMinimized && (
                <div
                    ref={widgetDesktopRef}
                    className={`
                        hidden md:flex fixed z-40
                        w-[320px] h-[400px] rounded-lg shadow-xl overflow-hidden bg-gray-950 flex-col
                        transition-shadow duration-200 hover:shadow-2xl
                    `}
                    style={{
                        left: `${widgetPosition.x}px`,
                        top: `${widgetPosition.y}px`,
                    }}
                >
                    {/* Botón/barra de arrastre para DESKTOP (parte superior) - FUERA del div de videos */}
                    <div
                        className={`
                            flex justify-center items-center h-10 bg-gray-800 border-b border-gray-700
                            ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}
                        `}
                        onMouseDown={handleDragButtonMouseDown}
                        onTouchStart={handleDragButtonTouchStart}
                        title="Arrastrar widget"
                    >
                        <Move size={20} className="text-gray-400" />
                    </div>
                    {/* Contenido de videos en miniatura para desktop minimizado */}
                    <div className="flex-1 flex flex-col bg-gray-950 rounded-lg overflow-hidden p-2 pointer-events-none">
                        {/* Pantalla compartida principal en miniatura (si aplica) */}
                        {currentScreenShareStream && (
                            <div className="w-full h-3/4 mb-2 bg-gray-800 rounded-md flex items-center justify-center overflow-hidden">
                                <RemoteVideo
                                    stream={currentScreenShareStream}
                                    participantId={`${currentScreenShareOwnerId}-screen-mini`}
                                    participantName={currentScreenShareOwnerName}
                                    videoEnabled={true}
                                    micEnabled={currentScreenShareStream.getAudioTracks().length > 0}
                                    isLocal={isSharingScreen}
                                    volume={0}
                                    isScreenShare={true}
                                    className="w-full h-full object-contain"
                                />
                            </div>
                        )}
                        {!currentScreenShareStream && isAnyScreenSharing && (
                            <div className="w-full h-3/4 mb-2 bg-gray-800 rounded-md flex items-center justify-center overflow-hidden text-gray-500 text-center">
                                <ScreenShare className="w-8 h-8 mx-auto mb-1" />
                                <p className="text-sm">Cargando pantalla...</p>
                            </div>
                        )}

                        {/* Miniaturas de cámaras de participantes (local + remotos) Y OTRAS PANTALLAS COMPARTIDAS */}
                        <div className={`w-full ${currentScreenShareStream ? 'h-1/4' : 'flex-grow'} grid grid-cols-2 gap-1 overflow-y-auto`}>
                            {localStream && videoEnabled && (
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

                            {Object.values(participants).map(participant => (
                                <React.Fragment key={participant.id + '-mini'}>
                                    {participant.cameraStream && participant.videoEnabled && (
                                        <RemoteVideo
                                            key={participant.id + '-camera-mini'}
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
                                    )}
                                    {participant.screenStream && participant.id !== currentScreenShareOwnerId && (
                                        <RemoteVideo
                                            key={participant.id + '-screen-mini'}
                                            stream={participant.screenStream!}
                                            participantId={participant.id}
                                            participantName={`${participant.name} (Pantalla)`}
                                            videoEnabled={true}
                                            micEnabled={participant.screenStream?.getAudioTracks().length > 0}
                                            isLocal={false}
                                            volume={0}
                                            isScreenShare={true}
                                            className="w-full h-full object-cover rounded-sm"
                                        />
                                    )}
                                </React.Fragment>
                            ))}

                            {!localStream && Object.values(participants).filter(p => p.cameraStream).length === 0 && !currentScreenShareStream && (
                                <div className="col-span-full flex flex-col items-center justify-center text-gray-500">
                                    <Users className="w-8 h-8 mb-2" />
                                    <p className="text-xs text-center">Nadie con video activo.</p>
                                </div>
                            )}
                        </div>
                    </div>
                    {/* Controles del widget minimizado grande (recuperados) */}
                    <div className="flex justify-center gap-2 p-3 bg-gray-800 border-t border-gray-700 flex-wrap pointer-events-auto">
                        <button
                            onClick={toggleMic}
                            className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-700 hover:bg-gray-600"
                            title={micEnabled ? 'Silenciar micrófono' : 'Activar micrófono'}
                        >
                            {micEnabled ? <Mic size={18} /> : <MicOff size={18} />}
                        </button>
                        <button
                            onClick={toggleVideo}
                            className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-700 hover:bg-gray-600"
                            title={videoEnabled ? 'Apagar cámara' : 'Encender cámara'}
                        >
                            {videoEnabled ? <Video size={18} /> : <VideoOff size={18} />}
                        </button>
                        <button
                            onClick={toggleScreenShare}
                            className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-700 hover:bg-gray-600"
                            title={isSharingScreen ? 'Detener compartir pantalla' : 'Compartir pantalla'}
                        >
                            <ScreenShare size={18} />
                        </button>
                        {/* {isTeacher && (
                           <button
                             onClick={toggleRecording}
                             className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-700 hover:bg-gray-600"
                             title={isRecording ? 'Detener grabación' : 'Iniciar grabación'}
                           >
                             <StopCircle size={18} className={isRecording ? 'text-red-500' : ''} />
                           </button>
                         )} */}
                        <button
                            onClick={toggleMinimizeCall}
                            className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-700 hover:bg-gray-600"
                            title="Maximizar llamada"
                        >
                            <Maximize2 size={18} />
                        </button>
                        <button
                            onClick={handleCallCleanup}
                            className="w-10 h-10 rounded-full flex items-center justify-center bg-red-600 hover:bg-red-700"
                            title="Colgar"
                        >
                            <PhoneOff size={18} />
                        </button>
                    </div>
                </div>
            )}

            {/* Widget minimizado en MOBILE (solo iconos y contador) */}
            {isCallMinimized && (
                <div
                    ref={widgetMobileRef}
                    className={`
                        md:hidden fixed z-50 flex flex-col p-2 bg-gray-900 rounded-lg shadow-lg
                        w-36 h-24
                        ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}
                    `}
                    style={{
                        left: widgetPosition.x === 0 ? 'auto' : `${widgetPosition.x}px`,
                        top: widgetPosition.y === 0 ? 'auto' : `${widgetPosition.y}px`,
                        right: widgetPosition.x === 0 ? '16px' : 'auto',
                        bottom: widgetPosition.y === 0 ? '16px' : 'auto',
                    }}
                >
                    {/* Botón de arrastre para MOBILE (en la parte superior para fácil acceso) - FUERA del div de contenido */}
                    <button
                        onMouseDown={handleDragButtonMouseDown}
                        onTouchStart={handleDragButtonTouchStart}
                        className={`absolute top-0 right-0 m-1 w-8 h-8 rounded-full flex items-center justify-center bg-blue-600 hover:bg-blue-700 z-10
                            ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}
                        `}
                        title="Arrastrar widget"
                    >
                        <Move size={14} />
                    </button>

                    {/* Contenido del widget minimizado */}
                    <div className="flex items-center justify-center flex-grow text-gray-400 text-sm pointer-events-none">
                        {currentScreenShareStream ? (
                            <div className="flex flex-col items-center">
                                <ScreenShare className="w-6 h-6 mb-1" />
                                <p>Compartiendo</p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center">
                                <Users className="w-6 h-6 mb-1" />
                                <p>{Object.keys(participants).length + (localStream && videoEnabled ? 1 : 0)} Usuarios</p>
                            </div>
                        )}
                    </div>
                    {/* Controles de minimizado */}
                    <div className="flex justify-center gap-1 mt-2 pointer-events-auto">
                        <button
                            onClick={toggleMinimizeCall}
                            className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-700 hover:bg-gray-600"
                            title="Maximizar llamada"
                        >
                            <Maximize2 size={16} />
                        </button>
                        <button
                            onClick={handleCallCleanup}
                            className="w-8 h-8 rounded-full flex items-center justify-center bg-red-600 hover:bg-red-700"
                            title="Colgar"
                        >
                            <PhoneOff size={16} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VideoRoom;