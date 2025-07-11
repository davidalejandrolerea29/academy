import { useState, useEffect, useRef, useCallback } from 'react';
import { EchoChannel } from '../services/ReverbWebSocketService'; // Asumo que esta ruta es correcta

// Definiciones de tipos (pueden ir en un archivo de tipos global o aquí)
interface ParticipantState {
  id: string;
  name: string;
  videoEnabled: boolean;
  micEnabled: boolean;
  cameraStream: MediaStream | null;
  screenStream: MediaStream | null;
  isSharingRemoteScreen: boolean;
}

interface UseWebRTCProps {
  roomId: string;
  currentUser: { id: string; name: string } | null;
  localStream: MediaStream | null;
  channelRef: React.MutableRefObject<EchoChannel | null>;
  localScreenStream: MediaStream | null; 
  reverbService: any; // Ajusta este tipo si tienes una interfaz para tu servicio Reverb
  onCallEnded: () => void;
  // Añadir un callback para notificar al componente padre sobre cambios de estado de participantes
  onParticipantsChange: (participants: Record<string, ParticipantState>) => void;
}

interface UseWebRTCResult {
  participants: Record<string, ParticipantState>;
  peerConnectionsRef: React.MutableRefObject<Record<string, RTCPeerConnection>>;
  sendSignal: (toPeerId: string, signalData: any) => Promise<void>;
  processSignal: (peerId: string, type: string, data: any) => Promise<void>;
  handlePeerDisconnected: (peerId: string) => void;
  addLocalTracksToPeerConnection: (pc: RTCPeerConnection, stream: MediaStream) => void;
  replaceLocalTrackInPeerConnection: (pc: RTCPeerConnection, oldTrack: MediaStreamTrack, newTrack: MediaStreamTrack, stream: MediaStream) => void;
  removeLocalTrackFromPeerConnection: (pc: RTCPeerConnection, track: MediaStreamTrack) => void;
}

export const useWebRTC = ({
  roomId,
  currentUser,
  localStream,
  localScreenStream,
  channelRef,
  reverbService,
  onCallEnded,
  onParticipantsChange,
}: UseWebRTCProps): UseWebRTCResult => {
  const [participants, setParticipants] = useState<Record<string, ParticipantState>>({});
  const peerConnectionsRef = useRef<Record<string, RTCPeerConnection>>({});
  const iceCandidatesQueueRef = useRef<Record<string, RTCIceCandidate[]>>({});

  // Centraliza la gestión de participantes para que onParticipantsChange se llame consistentemente
  const updateParticipantsState = useCallback((updater: (prev: Record<string, ParticipantState>) => Record<string, ParticipantState>) => {
    setParticipants(prev => {
      const newParticipants = updater(prev);
      onParticipantsChange(newParticipants); // Notifica al componente padre
      return newParticipants;
    });
  }, [onParticipantsChange]);

  // Función para enviar señales a través del canal de Reverb
  const sendSignal = useCallback(async (toPeerId: string, signalData: any) => {
    if (!channelRef.current) {
      console.error("sendSignal: Canal no disponible.");
      return;
    }
    try {
      await channelRef.current.whisper('Signal', {
        to: toPeerId,
        from: String(currentUser?.id),
        data: signalData
      });
      // console.log(`[SIGNAL OUT DEBUG] ✅ Señal ${signalData.type} enviada de ${currentUser?.id} a ${toPeerId}`);
    } catch (error) {
      console.error(`[SIGNAL OUT ERROR] Error al enviar señal ${signalData.type} de ${currentUser?.id} a ${toPeerId}:`, error);
    }
  }, [currentUser, channelRef]);

  // Agrega/reemplaza tracks locales en una PC existente.
  // Es importante pasar el stream completo con el track, para que el sender sepa a qué stream pertenece.
  const addLocalTracksToPeerConnection = useCallback((pc: RTCPeerConnection, stream: MediaStream) => {
    stream.getTracks().forEach(track => {
      const hasSender = pc.getSenders().some(sender => sender.track === track);
      if (!hasSender) {
        pc.addTrack(track, stream);
        console.log(`[PC] ✅ Añadido track local ${track.kind} (ID: ${track.id}) a PC de ${Object.keys(peerConnectionsRef.current).find(key => peerConnectionsRef.current[key] === pc) || 'unknown'}`);
      } else {
        console.log(`[PC] Track ${track.kind} (ID: ${track.id}) ya existe en PC. No se añade de nuevo.`);
      }
    });
  }, []);

  const replaceLocalTrackInPeerConnection = useCallback(async (pc: RTCPeerConnection, oldTrack: MediaStreamTrack | null, newTrack: MediaStreamTrack, stream: MediaStream) => {
    const sender = pc.getSenders().find(s => s.track === oldTrack);
    if (sender) {
      await sender.replaceTrack(newTrack);
      console.log(`[PC] Reemplazado track ${oldTrack?.kind || 'N/A'} con ${newTrack.kind} en PC.`);
    } else {
      // Si no hay un sender para el oldTrack, simplemente añade el newTrack
      pc.addTrack(newTrack, stream);
      console.log(`[PC] No se encontró sender para el track antiguo, se añadió el nuevo track ${newTrack.kind}.`);
    }
    // Forzar renegociación si no hay 'negotiationneeded' implícito
    pc.dispatchEvent(new Event('negotiationneeded'));
  }, []);

  const removeLocalTrackFromPeerConnection = useCallback((pc: RTCPeerConnection, track: MediaStreamTrack) => {
    const sender = pc.getSenders().find(s => s.track === track);
    if (sender) {
      pc.removeTrack(sender);
      console.log(`[PC] Removido track ${track.kind} de PC.`);
      // Forzar renegociación
      pc.dispatchEvent(new Event('negotiationneeded'));
    }
  }, []);


  // --- Función auxiliar para obtener/crear RTCPeerConnection ---
  const getOrCreatePeerConnection = useCallback((peerId: string) => {
    let pc = peerConnectionsRef.current[peerId];

    if (!pc || pc.connectionState === 'closed' || pc.connectionState === 'failed') {
      console.log(`[PC] Creando NUEVA RTCPeerConnection para peer: ${peerId}`);
      pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          // ... (mantén tus otros STUN/TURN servers aquí) ...
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
      if (localScreenStream) {
        addLocalTracksToPeerConnection(pc, localScreenStream);
      } else if (localStream) {
        addLocalTracksToPeerConnection(pc, localStream);
      }

      // --- Configuración de Eventos para la NUEVA PC ---
      pc.ontrack = (event) => {
    const incomingStream = event.streams[0];
    const track = event.track;

    updateParticipantsState(prev => {
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

        // Determine if this is a screen share track based on multiple hints
        // We'll also rely heavily on the `isSharingRemoteScreen` signal
        const isPotentiallyScreenShareTrack = track.kind === 'video' &&
            (updatedParticipant.isSharingRemoteScreen || // The signal from the sender is paramount
            track.label.includes('screen') ||
            track.label.includes('display') ||
            track.contentHint === 'detail' ||
            (incomingStream.getVideoTracks().length > 1 && track === incomingStream.getVideoTracks()[1]) ||
            incomingStream.id.includes('screen')); // Check stream ID too

        if (track.kind === 'video') {
            if (isPotentiallyScreenShareTrack) {
                // If a new screen stream or the existing one is different
                if (!updatedParticipant.screenStream || updatedParticipant.screenStream.id !== incomingStream.id) {
                    // Stop tracks of any old screen stream to avoid memory leaks
                    updatedParticipant.screenStream?.getTracks().forEach(t => t.stop());
                    updatedParticipant.screenStream = incomingStream;
                    console.log(`[ontrack] Recibiendo NUEVO stream de PANTALLA de ${peerId}`);
                    // If camera stream was the same, clear it to avoid duplication
                    if (updatedParticipant.cameraStream && updatedParticipant.cameraStream.id === incomingStream.id) {
                        updatedParticipant.cameraStream = null;
                    }
                }
                updatedParticipant.isSharingRemoteScreen = true; // Confirm this participant is sharing screen
            } else { // This is likely a camera video track
                // If a new camera stream or the existing one is different
                if (!updatedParticipant.cameraStream || updatedParticipant.cameraStream.id !== incomingStream.id) {
                    // Stop tracks of any old camera stream
                    updatedParticipant.cameraStream?.getTracks().forEach(t => t.stop());
                    updatedParticipant.cameraStream = incomingStream;
                    console.log(`[ontrack] Recibiendo NUEVO stream de CÁMARA de ${peerId}`);
                    // If screen stream was the same, clear it
                    if (updatedParticipant.screenStream && updatedParticipant.screenStream.id === incomingStream.id) {
                        updatedParticipant.screenStream = null;
                        updatedParticipant.isSharingRemoteScreen = false; // They stopped sharing screen
                    }
                }
                updatedParticipant.videoEnabled = true;
            }
        } else if (track.kind === 'audio') {
            // Audio logic: try to attach audio to the currently active video stream
            // Or create a new stream if only audio
            if (updatedParticipant.isSharingRemoteScreen && updatedParticipant.screenStream) {
                if (!updatedParticipant.screenStream.getAudioTracks().some(t => t.id === track.id)) {
                    updatedParticipant.screenStream.addTrack(track);
                    console.log(`[ontrack] Añadido track de audio a screenStream de ${peerId}`);
                }
            } else if (updatedParticipant.cameraStream) {
                if (!updatedParticipant.cameraStream.getAudioTracks().some(t => t.id === track.id)) {
                    updatedParticipant.cameraStream.addTrack(track);
                    console.log(`[ontrack] Añadido track de audio a cameraStream de ${peerId}`);
                }
            } else {
                // Fallback: create a new camera stream with just audio if no video stream yet
                updatedParticipant.cameraStream = new MediaStream([track]);
                console.log(`[ontrack] Creado nuevo cameraStream solo con audio para ${peerId}`);
            }
            updatedParticipant.micEnabled = true;
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

        try {
          // El iniciador es el que tiene la ID más baja para evitar colisiones
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
          handlePeerDisconnected(peerId); // Usar la función de limpieza centralizada
        }
      };
      pc.oniceconnectionstatechange = () => { console.log(`[PC State - ICE] PeerConnection con ${peerId} ICE: ${pc.iceConnectionState}`); };
      pc.onsignalingstatechange = () => { console.log(`[PC State - Signaling] PeerConnection con ${peerId} signaling: ${pc.signalingState}`); };
      pc.onicegatheringstatechange = () => { console.log(`[PC State - Ice Gathering] PeerConnection con ${peerId} ICE gathering: ${pc.iceGatheringState}`); };

      peerConnectionsRef.current[peerId] = pc;
    }

    return pc;
  }, [currentUser, localStream, sendSignal, addLocalTracksToPeerConnection, updateParticipantsState]);

const localScreenShareSendersRef = useRef<Record<string, { video?: RTCRtpSender, audio?: RTCRtpSender }>>({});

useEffect(() => {
    // Si no hay localStream ni localScreenStream, no hay nada que enviar
    if (!localStream && !localScreenStream) {
      // Opcional: Remover todos los tracks si ambos streams se vuelven nulos
      Object.values(peerConnectionsRef.current).forEach(pc => {
        pc.getSenders().forEach(sender => {
          try {
            pc.removeTrack(sender);
            console.log(`[PC Update] Removed track ${sender.track?.kind} (ID: ${sender.track?.id}) from PC.`);
          } catch (e) {
            console.warn(`[PC Update Warning] Could not remove track during cleanup:`, e);
          }
        });
      });
      return;
    }

    Object.values(peerConnectionsRef.current).forEach(pc => {
      const peerId = Object.keys(peerConnectionsRef.current).find(key => peerConnectionsRef.current[key] === pc);
      if (!peerId) return; // Asegurarse de tener un peerId válido

      // ¡NUEVO! Asegurarse de que el objeto para este peerId exista en la ref
      if (!localScreenShareSendersRef.current[peerId]) {
        localScreenShareSendersRef.current[peerId] = {};
      }

      // 1. Manejar el stream de PANTALLA
      const currentVideoScreenSender = localScreenShareSendersRef.current[Object.keys(peerConnectionsRef.current).find(key => peerConnectionsRef.current[key] === pc) || '']?.video;
      const currentAudioScreenSender = localScreenShareSendersRef.current[Object.keys(peerConnectionsRef.current).find(key => peerConnectionsRef.current[key] === pc) || '']?.audio;

      if (localScreenStream) { // Si hay un stream de pantalla disponible
        const screenVideoTrack = localScreenStream.getVideoTracks()[0];
        const screenAudioTrack = localScreenStream.getAudioTracks()[0];

        // Añadir/Reemplazar track de video de pantalla
        if (screenVideoTrack) {
          if (currentVideoScreenSender && currentVideoScreenSender.track === screenVideoTrack) {
            // Ya está enviando este track de pantalla, no hacer nada
          } else if (currentVideoScreenSender) {
            // Reemplazar el track de pantalla existente
            currentVideoScreenSender.replaceTrack(screenVideoTrack)
              .then(() => console.log(`[Screen Share] Replaced existing screen video track on PC.`))
              .catch(e => console.error(`[Screen Share Error] Failed to replace screen video track:`, e));
          } else {
            // No hay sender de pantalla, añadirlo. Primero, remover cualquier sender de cámara si existe.
            pc.getSenders().filter(s => s.track?.kind === 'video' && s.track?.id !== screenVideoTrack.id).forEach(s => {
                pc.removeTrack(s);
                console.log(`[Screen Share] Removed old camera video track before adding screen track.`);
            });
            const sender = pc.addTrack(screenVideoTrack, localScreenStream);
            localScreenShareSendersRef.current[peerId].video = sender;

            console.log(`[Screen Share] Added new screen video track on PC.`);
          }
        } else if (currentVideoScreenSender) { // Si no hay track de pantalla pero había un sender activo
            pc.removeTrack(currentVideoScreenSender);
           delete localScreenShareSendersRef.current[peerId].video;
            console.log(`[Screen Share] Removed screen video track from PC.`);
        }

        // Añadir/Reemplazar track de audio de pantalla (si existe)
        if (screenAudioTrack) {
          if (currentAudioScreenSender && currentAudioScreenSender.track === screenAudioTrack) {
            // Ya está enviando este track de audio de pantalla, no hacer nada
          } else if (currentAudioScreenSender) {
            currentAudioScreenSender.replaceTrack(screenAudioTrack)
              .then(() => console.log(`[Screen Share] Replaced existing screen audio track on PC.`))
              .catch(e => console.error(`[Screen Share Error] Failed to replace screen audio track:`, e));
          } else {
            // No hay sender de audio de pantalla, añadirlo. Remover cualquier sender de audio de cámara si existe.
            pc.getSenders().filter(s => s.track?.kind === 'audio' && s.track?.id !== screenAudioTrack.id).forEach(s => {
                pc.removeTrack(s);
                console.log(`[Screen Share] Removed old camera audio track before adding screen audio track.`);
            });
            const sender = pc.addTrack(screenAudioTrack, localScreenStream);
            localScreenShareSendersRef.current[peerId].audio = sender;
            console.log(`[Screen Share] Added new screen audio track on PC.`);
          }
        } else if (currentAudioScreenSender) { // Si no hay track de audio de pantalla pero había un sender activo
            pc.removeTrack(currentAudioScreenSender);
             delete localScreenShareSendersRef.current[peerId].audio;
            console.log(`[Screen Share] Removed screen audio track from PC.`);
        }

        // Si se añadió o reemplazó un track de pantalla, forzar negociación
        pc.dispatchEvent(new Event('negotiationneeded'));

      } else { // Si NO hay stream de pantalla (la compartición terminó o no ha comenzado)
        // Remover cualquier track de pantalla que pudiera estar activo
        if (currentVideoScreenSender) {
          pc.removeTrack(currentVideoScreenSender);
          delete localScreenShareSendersRef.current[Object.keys(peerConnectionsRef.current).find(key => peerConnectionsRef.current[key] === pc) || ''].video;
          console.log(`[Screen Share] Cleaned up old screen video sender.`);
          pc.dispatchEvent(new Event('negotiationneeded')); // Negociar si se quitó un track
        }
        if (currentAudioScreenSender) {
          pc.removeTrack(currentAudioScreenSender);
          delete localScreenShareSendersRef.current[Object.keys(peerConnectionsRef.current).find(key => peerConnectionsRef.current[key] === pc) || ''].audio;
          console.log(`[Screen Share] Cleaned up old screen audio sender.`);
          pc.dispatchEvent(new Event('negotiationneeded')); // Negociar si se quitó un track
        }

        // 2. Manejar el stream de CÁMARA (solo si NO hay stream de pantalla)
        if (localStream) {
          const cameraVideoTrack = localStream.getVideoTracks()[0];
          const cameraAudioTrack = localStream.getAudioTracks()[0];
          
          const currentCameraVideoSender = pc.getSenders().find(s => s.track?.kind === 'video' && s.track?.id === cameraVideoTrack?.id);
          const currentCameraAudioSender = pc.getSenders().find(s => s.track?.kind === 'audio' && s.track?.id === cameraAudioTrack?.id);

          // Añadir/Reemplazar track de video de cámara
          if (cameraVideoTrack) {
            if (!currentCameraVideoSender) { // Si no hay sender de video de cámara
              // Primero, asegurar que no haya otros tracks de video que no sean de cámara o pantalla
              pc.getSenders().filter(s => s.track?.kind === 'video').forEach(s => {
                  pc.removeTrack(s); // Remover cualquier track de video anterior (ej. pantalla que no se limpió)
                  console.log(`[Camera Stream] Removed old video track before adding camera track.`);
              });
              pc.addTrack(cameraVideoTrack, localStream);
              console.log(`[Camera Stream] Added new camera video track on PC.`);
              pc.dispatchEvent(new Event('negotiationneeded'));
            } else if (currentCameraVideoSender.track !== cameraVideoTrack) {
                // Si el track existente es diferente, reemplazarlo
                currentCameraVideoSender.replaceTrack(cameraVideoTrack)
                    .then(() => console.log(`[Camera Stream] Replaced existing camera video track on PC.`))
                    .catch(e => console.error(`[Camera Stream Error] Failed to replace camera video track:`, e));
            }
          } else { // Si no hay track de video de cámara en localStream
              pc.getSenders().filter(s => s.track?.kind === 'video').forEach(s => {
                  pc.removeTrack(s);
                  console.log(`[Camera Stream] Removed camera video track.`);
                  pc.dispatchEvent(new Event('negotiationneeded'));
              });
          }

          // Añadir/Reemplazar track de audio de cámara
          if (cameraAudioTrack) {
            if (!currentCameraAudioSender) { // Si no hay sender de audio de cámara
              pc.getSenders().filter(s => s.track?.kind === 'audio').forEach(s => {
                  pc.removeTrack(s); // Remover cualquier track de audio anterior
                  console.log(`[Camera Stream] Removed old audio track before adding camera audio track.`);
              });
              pc.addTrack(cameraAudioTrack, localStream);
              console.log(`[Camera Stream] Added new camera audio track on PC.`);
              pc.dispatchEvent(new Event('negotiationneeded'));
            } else if (currentCameraAudioSender.track !== cameraAudioTrack) {
                currentCameraAudioSender.replaceTrack(cameraAudioTrack)
                    .then(() => console.log(`[Camera Stream] Replaced existing camera audio track on PC.`))
                    .catch(e => console.error(`[Camera Stream Error] Failed to replace camera audio track:`, e));
            }
          } else { // Si no hay track de audio de cámara en localStream
              pc.getSenders().filter(s => s.track?.kind === 'audio').forEach(s => {
                  pc.removeTrack(s);
                  console.log(`[Camera Stream] Removed camera audio track.`);
                  pc.dispatchEvent(new Event('negotiationneeded'));
              });
          }
        }
      }
    });

}, [localStream, localScreenStream, peerConnectionsRef, replaceLocalTrackInPeerConnection, removeLocalTrackFromPeerConnection]); // Dependencias: ambos streams locales y las refs/callbacks.
  // Función para procesar señales (ofertas, respuestas, candidatos)
  const processSignal = useCallback(async (peerId: string, type: string, data: any) => {
    const pc = getOrCreatePeerConnection(peerId);

    try {
      if (type === 'offer') {
        console.log(`[SIGNAL IN] Recibida OFERTA de ${peerId}.`);
        // Asegurarse de que los tracks locales estén presentes ANTES de setRemoteDescription
        if (localStream) {
          addLocalTracksToPeerConnection(pc, localStream);
        } else {
            console.warn(`[SIGNAL IN] localStream es NULO al recibir oferta de ${peerId}. No se pueden añadir tracks locales.`);
        }
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
          delete iceCandidatesQueueRef.current[peerId];
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
        if (!pc.remoteDescription) {
          console.warn(`[ICE Candidate] Remote description not set for ${peerId}. Queuing candidate.`);
          if (!iceCandidatesQueueRef.current[peerId]) {
            iceCandidatesQueueRef.current[peerId] = [];
          }
          iceCandidatesQueueRef.current[peerId].push(data.candidate);
        } else {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            console.log(`[ICE Candidate] Añadido candidato para ${peerId}.`);
          } catch (e) {
            if (!e.toString().includes('already added') && !e.toString().includes('closed')) {
              console.error(`[ICE Candidate ERROR] Error al añadir candidato para ${peerId}:`, e);
            }
          }
        }
      } else if (type === 'screenShareStatus') {
        console.log(`[SIGNAL IN] Recibido screenShareStatus de ${peerId}: ${data.isSharing}`);
        updateParticipantsState(prev => ({
          ...prev,
          [peerId]: {
            ...(prev[peerId] || { id: peerId, name: `Usuario ${peerId}`, videoEnabled: false, micEnabled: false, cameraStream: null, screenStream: null }),
            isSharingRemoteScreen: data.isSharing,
            screenStream: data.isSharing ? prev[peerId]?.screenStream : null // Limpiar si deja de compartir
          }
        }));
      }
    } catch (e) {
      console.error(`[SIGNAL IN ERROR] Error al procesar señal tipo ${type} de ${peerId}:`, e);
    }
  }, [getOrCreatePeerConnection, sendSignal, localStream, addLocalTracksToPeerConnection, updateParticipantsState]);

  // Manejar desconexión de un peer
  const handlePeerDisconnected = useCallback((peerId: string) => {
    const pc = peerConnectionsRef.current[peerId];
    if (pc && pc.connectionState !== 'closed') {
      pc.close();
      console.log(`[PC] Cerrada RTCPeerConnection para el miembro saliente: ${peerId}`);
    }
    const newPeerConnections = { ...peerConnectionsRef.current };
    delete newPeerConnections[peerId];
    peerConnectionsRef.current = newPeerConnections;

    updateParticipantsState(prev => {
      const copy = { ...prev };
      delete copy[peerId];
      return copy;
    });
    console.log(`[REVERB] Limpiado estado para el miembro saliente: ${peerId}`);
  }, [updateParticipantsState]);


  // --- useEffect PRINCIPAL PARA LA CONEXION A REVERB Y WEB RTC (MOVIDO Y ADAPTADO) ---
  useEffect(() => {
    if (!roomId || !currentUser || !localStream) {
      return;
    }
    // Si ya tenemos un canal, no intentamos crear otro.
    // Esto es importante para evitar múltiples suscripciones en re-renders.
    if (channelRef.current) {
        console.log("[REVERB] Canal ya existente, saltando nueva suscripción.");
        return;
    }

    let cleanupPerformed = false; // Flag para asegurar la limpieza una sola vez

    // Usamos una variable local para el canal y la asignamos a channelRef.current
    // para que la función de limpieza pueda acceder a ella directamente.
    let activeChannel: EchoChannel | null = null;

    reverbService.presence(`presence-video-room.${roomId}`)
      .then((joinedChannel: EchoChannel) => {
        if (cleanupPerformed) { // Evitar procesar si el componente ya se desmontó
            // Usar .leave() aquí también si es la forma correcta de desuscribirse
            // aunque el componente se esté desmontando, para no dejar conexiones abiertas.
            if (typeof joinedChannel.leave === 'function') {
                joinedChannel.leave();
            } else {
                console.warn("[REVERB] joinedChannel no tiene un método leave().");
            }
            return;
        }
        activeChannel = joinedChannel; // Asigna a la variable local
        channelRef.current = joinedChannel; // Asigna también a la ref

        // --- joinedChannel.here: Para miembros que ya están en la sala cuando te unes ---
        joinedChannel.here((members) => {
          console.log(`[REVERB] HERE event: Current members in room ${roomId}:`, members);
          const initialParticipants: Record<string, ParticipantState> = {};
          members.forEach((member: any) => {
            if (String(member.id) !== String(currentUser?.id)) {
              initialParticipants[member.id] = {
                id: member.id,
                name: member.name,
                videoEnabled: false,
                micEnabled: false,
                cameraStream: null,
                screenStream: null,
                isSharingRemoteScreen: false,
              };
              getOrCreatePeerConnection(member.id);
            }
          });
          updateParticipantsState(prev => ({ ...prev, ...initialParticipants }));
        });

        // --- joinedChannel.joining: Para miembros que se unen DESPUÉS de ti ---
        joinedChannel.joining((member: any) => {
          console.log(`[REVERB] JOINING event: User ${member.id} has joined the room.`);
          if (String(member.id) === String(currentUser?.id)) {
            console.log(`[REVERB] Ignorando JOINING event para mi mismo: ${member.id}`);
            return;
          }

          updateParticipantsState(prev => ({
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
          getOrCreatePeerConnection(member.id);
        });

        joinedChannel.subscribed(() => {
          console.log("✅ Suscrito correctamente al canal video room.");
        });

        joinedChannel.error((err: any) => {
          console.error("❌ Error en canal de video-room:", err);
          channelRef.current = null;
          onCallEnded(); // O un callback específico para errores de conexión
        });

        joinedChannel.leaving((member: any) => {
          console.log(`[REVERB] LEAVING event: User ${member.id} has left the room.`);
          handlePeerDisconnected(member.id);
        });

        // --- Listener para señales WebRTC (Ofertas, Respuestas, Candidatos ICE) ---
        joinedChannel.listenForWhisper('Signal', async ({ to, from, data }: { to: string; from: string; data: any }) => {
          if (!currentUser || to !== String(currentUser.id)) { // Añadir chequeo para currentUser
            console.warn(`[DEBUG WHISPER FILTRADO] Mensaje para otro usuario. Mi ID: ${currentUser?.id}, Mensaje TO: ${to}`);
            return;
          }
          await processSignal(from, data.type, data.sdp ? { type: data.sdpType, sdp: data.sdp } : data);
        });

      })
      .catch((err: any) => {
        console.error("❌ Error al suscribirse al canal de Reverb:", err);
        onCallEnded();
      });

    // Cleanup para el canal de Reverb
    return () => {
      cleanupPerformed = true; // Marca que la limpieza ha sido iniciada
      // Usar 'activeChannel' que es la instancia correcta del canal suscrito
      if (activeChannel) {
        console.log(`[REVERB] Abandonando el canal presence-video-room.${roomId}`);
        // *** CAMBIO CLAVE AQUÍ: Usar .leave() en lugar de .unsubscribe() ***
        if (typeof activeChannel.leave === 'function') { // Asegúrate de que el método leave exista
            activeChannel.leave();
        } else {
            console.warn("[REVERB] activeChannel no tiene un método leave(). Verifique la API de Reverb/Echo.");
        }
        channelRef.current = null; // Limpiar la referencia
      }
      localScreenShareSendersRef.current = {};

      // Cerrar todas las PeerConnections al salir de la sala
      Object.values(peerConnectionsRef.current).forEach(pc => {
        if (pc.connectionState !== 'closed') {
          pc.close();
        }
      });
      peerConnectionsRef.current = {}; // Limpiar la ref de PCs
      updateParticipantsState(() => ({})); // Limpiar participantes
    };
  }, [roomId, currentUser, localStream, reverbService, channelRef, getOrCreatePeerConnection, processSignal, handlePeerDisconnected, onCallEnded, updateParticipantsState]);

  // Log el estado de cada PeerConnection periódicamente (opcional, para depuración)
  useEffect(() => {
    const logPeerConnectionStates = () => {
      const pcs = peerConnectionsRef.current;
      // ... (tu lógica de logging actual, puedes mantenerla o eliminarla)
    };
    const intervalId = setInterval(logPeerConnectionStates, 5000);
    return () => {
      clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    // Asegúrate de que localStream exista
    if (!localStream) {
      // Si localStream se vuelve nulo, podríamos querer detener todos los tracks salientes
      Object.values(peerConnectionsRef.current).forEach(pc => {
        pc.getSenders().forEach(sender => {
          if (sender.track && sender.track.kind === 'video') { // Solo tracks de video para pantalla/cámara
            removeLocalTrackFromPeerConnection(pc, sender.track);
          }
        });
      });
      return;
    }

    const videoTrack = localStream.getVideoTracks()[0]; // Asume que hay un solo track de video principal
    const audioTrack = localStream.getAudioTracks()[0]; // Asume un solo track de audio

    Object.values(peerConnectionsRef.current).forEach(pc => {
      const currentVideoSender = pc.getSenders().find(s => s.track?.kind === 'video');
      const currentAudioSender = pc.getSenders().find(s => s.track?.kind === 'audio');

      // Lógica para el video (cámara o pantalla)
      if (videoTrack) {
        if (currentVideoSender) {
          if (currentVideoSender.track !== videoTrack) { // Si el track actual es diferente
            replaceLocalTrackInPeerConnection(pc, currentVideoSender.track, videoTrack, localStream);
          }
        } else {
          // No hay sender de video, añadir el nuevo
          pc.addTrack(videoTrack, localStream);
          pc.dispatchEvent(new Event('negotiationneeded')); // Forzar renegociación
        }
      } else {
        // No hay video track en localStream, remover el existente si lo hay
        if (currentVideoSender) {
          removeLocalTrackFromPeerConnection(pc, currentVideoSender.track);
        }
      }

      // Lógica para el audio (similar al video)
      if (audioTrack) {
        if (currentAudioSender) {
          if (currentAudioSender.track !== audioTrack) {
            replaceLocalTrackInPeerConnection(pc, currentAudioSender.track, audioTrack, localStream);
          }
        } else {
          pc.addTrack(audioTrack, localStream);
          pc.dispatchEvent(new Event('negotiationneeded'));
        }
      } else {
        if (currentAudioSender) {
          removeLocalTrackFromPeerConnection(pc, currentAudioSender.track);
        }
      }
    });
  }, [localStream, peerConnectionsRef, addLocalTracksToPeerConnection, replaceLocalTrackInPeerConnection, removeLocalTrackFromPeerConnection]);

  return {
    participants,
    peerConnectionsRef,
    sendSignal,
    processSignal,
    handlePeerDisconnected,
    addLocalTracksToPeerConnection,
    replaceLocalTrackInPeerConnection,
    removeLocalTrackFromPeerConnection
  };
};