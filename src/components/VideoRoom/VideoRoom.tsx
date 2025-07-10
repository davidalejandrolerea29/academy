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