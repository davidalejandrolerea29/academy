import React, { useCallback, useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';

// Define la interfaz para el handle que el padre recibirá
export interface ScreenShareManagerHandle {
    toggleScreenShare: () => void;
    // Opcional: Si quieres exponer el estado interno de si se está compartiendo
    // isSharingScreen: boolean;
}

interface ScreenShareManagerProps {
    localStream: MediaStream | null; // El stream de la cámara/micrófono local
    peerConnections: { [peerId: string]: RTCPeerConnection }; // Las PeerConnections activas
    currentUser: { id: string; name: string } | null; // El usuario local
    sendSignal: (peerId: string, signal: any) => void; // Función para enviar señales a los peers
    // Callbacks para que el padre sepa el estado de la compartición
    onScreenShareStart: (screenStream: MediaStream) => void;
    onScreenShareStop: () => void;
    // Removimos isSharingScreenProp de aquí, ya que el estado es interno
    videoEnabled: boolean; // Estado de la cámara local
    micEnabled: boolean;   // Estado del micrófono local
}

// Envuelve el componente con forwardRef
const ScreenShareManager = forwardRef<ScreenShareManagerHandle, ScreenShareManagerProps>(({
    localStream,
    peerConnections,
    currentUser,
    sendSignal,
    onScreenShareStart,
    onScreenShareStop,
    videoEnabled,
    micEnabled
}, ref) => { // 'ref' es el ref que el padre pasará

    // El estado isSharingScreen ahora es puramente interno a ScreenShareManager
    const [isSharingScreen, setIsSharingScreen] = useState(false);
    const screenShareStreamRef = useRef<MediaStream | null>(null);

    // No necesitamos un useEffect para sincronizar con isSharingScreenProp
    // porque este estado es la fuente de verdad para la compartición.

    // Función para detener la compartición de pantalla
   const stopScreenShare = useCallback(() => {
        console.log("[ScreenShareManager] Deteniendo compartición de pantalla...");
        if (screenShareStreamRef.current) {
            screenShareStreamRef.current.getTracks().forEach(track => track.stop());
            screenShareStreamRef.current = null;
        }

        Object.values(peerConnections).forEach(pc => {
            const peerId = Object.keys(peerConnections).find(key => peerConnections[key] === pc);
            if (!peerId) return;

            const cameraVideoTrack = localStream?.getVideoTracks()[0] || null;
            const cameraAudioTrack = localStream?.getAudioTracks()[0] || null;

            // Encontrar los senders DE VIDEO Y AUDIO que actualmente están enviando (podrían ser de la pantalla)
            const videoSender = pc.getSenders().find(sender => sender.track?.kind === 'video');
            const audioSender = pc.getSenders().find(sender => sender.track?.kind === 'audio');

            // --- RESTAURAR VIDEO (CÁMARA) ---
            if (videoSender) { // Si hay un sender de video (que antes era de pantalla)
                if (cameraVideoTrack && videoEnabled) {
                    // Reemplazamos el track de pantalla con el track de la cámara.
                    videoSender.replaceTrack(cameraVideoTrack).catch(e => console.error(`[ScreenShareManager] Error replacing screen video with camera for ${peerId}:`, e));
                    console.log(`[ScreenShareManager] Replaced screen video track with camera for PC ${peerId}.`);
                } else {
                    // Si no hay track de cámara O la cámara está deshabilitada,
                    // nullificamos el track en el sender para dejar de enviar video.
                    videoSender.replaceTrack(null).catch(e => console.error(`[ScreenShareManager] Error nullifying video track for ${peerId}:`, e));
                    console.log(`[ScreenShareManager] Nullified video track for PC ${peerId} (camera not active or enabled).`);
                }
            } else if (cameraVideoTrack && videoEnabled) {
                // Si no había un videoSender (lo cual es inusual si la cámara estaba activa antes de compartir)
                // y la cámara está activa y habilitada, podemos añadirlo.
                // Esto es más un caso de respaldo; `replaceTrack` es lo común.
                pc.addTrack(cameraVideoTrack, localStream!); // Asegúrate que localStream no sea null aquí
                console.log(`[ScreenShareManager] Added camera track back as no video sender found for PC ${peerId}.`);
            }


            // --- RESTAURAR AUDIO (MICRÓFONO) ---
            if (audioSender) { // Si hay un sender de audio (que antes era de pantalla o micrófono)
                if (cameraAudioTrack && micEnabled) {
                    // Reemplazamos el track de pantalla (si existía) con el track del micrófono.
                    audioSender.replaceTrack(cameraAudioTrack).catch(e => console.error(`[ScreenShareManager] Error replacing screen audio with mic for ${peerId}:`, e));
                    console.log(`[ScreenShareManager] Replaced screen audio track with mic for PC ${peerId}.`);
                } else {
                    // Si no hay track de micrófono O el micrófono está deshabilitado,
                    // nullificamos el track en el sender para dejar de enviar audio.
                    audioSender.replaceTrack(null).catch(e => console.error(`[ScreenShareManager] Error nullifying audio track for ${peerId}:`, e));
                    console.log(`[ScreenShareManager] Nullified audio track for PC ${peerId} (mic not active or enabled).`);
                }
            } else if (cameraAudioTrack && micEnabled) {
                // Similar al video, caso de respaldo para añadir si no había sender.
                pc.addTrack(cameraAudioTrack, localStream!); // Asegúrate que localStream no sea null aquí
                console.log(`[ScreenShareManager] Added mic track back as no audio sender found for PC ${peerId}.`);
            }
            // Importante: No remover `pc.removeTrack(sender)` a menos que sepas exactamente por qué.
            // `replaceTrack(null)` es más seguro que remover el sender por completo.
        });

        onScreenShareStop();
        setIsSharingScreen(false);
        console.log("[ScreenShareManager] Detención de compartición finalizada.");
    }, [localStream, peerConnections, onScreenShareStop, videoEnabled, micEnabled]); // Dependencias correctas
    // Función para iniciar la compartición de pantalla
    const startScreenShare = useCallback(async () => {
        console.log("[ScreenShareManager] Iniciando compartición de pantalla...");
        if (!localStream) {
            console.warn("[ScreenShareManager] localStream no disponible al intentar iniciar compartición.");
            // Esto no debería pasar si la llamada ya está activa, pero es buena precaución
            return;
        }

         try {
            // Pedimos audio: true. Si el navegador lo permite y el usuario lo selecciona, obtendremos audio del sistema.
            // Si no, screenAudioTrack será undefined o el stream no tendrá tracks de audio.
            const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
            screenShareStreamRef.current = screenStream;

            const screenVideoTrack = screenStream.getVideoTracks()[0];
            const screenAudioTrack = screenStream.getAudioTracks()[0]; // Este puede ser null/undefined si no hay audio del sistema

            Object.values(peerConnections).forEach(pc => {
                const peerId = Object.keys(peerConnections).find(key => peerConnections[key] === pc);
                if (!peerId) return;

                // Encontrar senders existentes para video y audio
                let videoSender = pc.getSenders().find(sender => sender.track?.kind === 'video');
                let audioSender = pc.getSenders().find(sender => sender.track?.kind === 'audio');

                // --- Manejo del Track de VIDEO (Pantalla) ---
                if (videoSender) {
                    // Si ya existe un sender de video (ej. de la cámara), lo reemplazamos por el de la pantalla.
                    videoSender.replaceTrack(screenVideoTrack).catch(e => console.error(`[ScreenShareManager] Error replacing video track for ${peerId}:`, e));
                    console.log(`[ScreenShareManager] Replaced existing video track with screen track for PC ${peerId}.`);
                } else {
                    // Si no hay un sender de video, añadimos el nuevo track de pantalla.
                    // Asegúrate de pasar el MediaStream correcto como segundo argumento.
                    pc.addTrack(screenVideoTrack, screenStream);
                    console.log(`[ScreenShareManager] Added NEW screen video track to PC for ${peerId} (no existing video sender).`);
                }

                // --- Manejo del Track de AUDIO (Pantalla o Silencio) ---
                if (screenAudioTrack) { // Si la compartición de pantalla incluye audio (del sistema)
                    if (audioSender) {
                        // Si ya existe un sender de audio (ej. del micrófono), lo reemplazamos por el de la pantalla.
                        audioSender.replaceTrack(screenAudioTrack).catch(e => console.error(`[ScreenShareManager] Error replacing audio track for ${peerId}:`, e));
                        console.log(`[ScreenShareManager] Replaced existing audio track with screen audio for PC ${peerId}.`);
                    } else {
                        // Si no hay un sender de audio, añadimos el nuevo track de audio de la pantalla.
                        pc.addTrack(screenAudioTrack, screenStream);
                        console.log(`[ScreenShareManager] Added NEW screen audio track to PC for ${peerId} (no existing audio sender).`);
                    }
                } else { // Si la compartición de pantalla NO incluye audio (o el usuario no lo permitió)
                    if (audioSender) {
                        // Si el micrófono estaba activo antes de compartir pantalla y ahora no tenemos audio de pantalla,
                        // podríamos querer dejar el micrófono activo o silenciarlo explícitamente.
                        // Para evitar enviar doble audio, lo más seguro es:
                        // 1. Si la pantalla no tiene audio, y el micrófono ya estaba siendo enviado, se podría mantener.
                        //    Pero esto es complejo y puede generar eco.
                        // 2. Lo más común es detener el envío del micrófono cuando se comparte pantalla,
                        //    y reactivarlo cuando se deja de compartir.

                        // Opción A: Deshabilitar el micrófono mientras se comparte pantalla sin audio del sistema
                        // (Si quieres que el audio de la pantalla (si existe) sea el único audio saliente)
                        // audioSender.replaceTrack(null).catch(...) o setEnabled(false) en el track local de la cámara.
                        // Esto depende de cómo quieras gestionar el audio de tu micrófono mientras compartes.
                        
                        // Si tu intención es que el micrófono principal (localStream) se "mutee"
                        // cuando compartes pantalla y la pantalla no tiene su propio audio:
                        const localAudioTrack = localStream?.getAudioTracks()[0];
                        if (localAudioTrack && audioSender.track?.id === localAudioTrack.id) {
                            // Si el sender actual es el del micrófono, y la pantalla no tiene audio,
                            // podríamos optar por silenciar el micrófono o simplemente no hacer nada aquí
                            // y confiar en que el usuario ya ha silenciado el micrófono local si lo desea.
                            // Para simplicidad, si la pantalla no tiene audio, y el sender ya existe,
                            // es mejor no tocarlo a menos que haya una política clara.
                            // Si quieres que el audio del micrófono se detenga, hazlo:
                            // audioSender.replaceTrack(null).catch(e => console.error(`Error nullifying audio track for ${peerId}:`, e));
                            // console.log(`Nullified audio track for PC ${peerId} (screen has no audio, mic silenced).`);
                        }
                    }
                    // Si no hay audioSender o screenAudioTrack, no hay nada que reemplazar o añadir con audio de pantalla.
                    // Los participantes remotos simplemente no recibirán audio de pantalla.
                }
            });

            screenVideoTrack.onended = () => {
                console.log("[ScreenShareManager] Screen share ended by user (browser control).");
                stopScreenShare();
            };

            onScreenShareStart(screenStream);
            setIsSharingScreen(true);
            console.log("[ScreenShareManager] Inicio de compartición finalizado.");

        } catch (error) {
            console.error("[ScreenShareManager] Error sharing screen:", error);
            onScreenShareStop();
            setIsSharingScreen(false);
        }
    }, [localStream, peerConnections, onScreenShareStart, onScreenShareStop, sendSignal, currentUser, videoEnabled, micEnabled]);


    // La función principal que se expondrá al padre
    // Importante: No uses 'isSharingScreenProp' aquí, usa el estado interno 'isSharingScreen'
    useImperativeHandle(ref, () => ({
        toggleScreenShare: () => {
            console.log("[ScreenShareManager] toggleScreenShare called via ref. Current state:", isSharingScreen);
            if (isSharingScreen) {
                stopScreenShare();
            } else {
                startScreenShare();
            }
        },
        // Opcional: si quieres que el padre pueda leer el estado interno
        // isSharingScreen: isSharingScreen, // <-- Exponer si necesitas leer el estado desde el padre
    }), [isSharingScreen, stopScreenShare, startScreenShare]); // Dependencias: estado y funciones de inicio/detención

    // Opcional: useEffect para limpiar al desmontar el componente
    useEffect(() => {
        return () => {
            if (screenShareStreamRef.current) {
                console.log("[ScreenShareManager] Limpiando al desmontar. Deteniendo compartición si está activa.");
                screenShareStreamRef.current.getTracks().forEach(track => track.stop());
                screenShareStreamRef.current = null;
            }
        };
    }, []);

    return null; // Este componente no renderiza nada visible
});

export default ScreenShareManager;