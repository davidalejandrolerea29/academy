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

const ScreenShareManager = forwardRef<ScreenShareManagerHandle, ScreenShareManagerProps>(({
    localStream,
    peerConnections,
    currentUser,
    sendSignal,
    onScreenShareStart,
    onScreenShareStop,
    videoEnabled,
    micEnabled
}, ref) => {
    const [isSharingScreen, setIsSharingScreen] = useState(false);
    const screenShareStreamRef = useRef<MediaStream | null>(null);

    // Función para detener la compartición de pantalla
    const stopScreenShare = useCallback(() => {
        console.log("[SSM] Deteniendo compartición de pantalla...");
        if (screenShareStreamRef.current) {
            screenShareStreamRef.current.getTracks().forEach(track => track.stop());
            screenShareStreamRef.current = null;
        }

        Object.values(peerConnections).forEach(pc => {
            const peerId = Object.keys(peerConnections).find(key => peerConnections[key] === pc);
            if (!peerId) return;

            const cameraVideoTrack = localStream?.getVideoTracks()[0] || null;
            const cameraAudioTrack = localStream?.getAudioTracks()[0] || null;

            const videoSender = pc.getSenders().find(sender => sender.track?.kind === 'video');
            const audioSender = pc.getSenders().find(sender => sender.track?.kind === 'audio');

            if (videoSender) {
                // Si la cámara está habilitada y hay un track, reemplazar
                if (cameraVideoTrack && videoEnabled) {
                    videoSender.replaceTrack(cameraVideoTrack).catch(e => console.error(`[SSM] Error reemplazando video de pantalla con cámara para ${peerId}:`, e));
                    console.log(`[SSM] Reemplazado track de video de pantalla por cámara para PC ${peerId}.`);
                } else {
                    // Si la cámara no está habilitada o no hay track, poner null
                    videoSender.replaceTrack(null).catch(e => console.error(`[SSM] Error nullifying screen video track for ${peerId}:`, e));
                    console.log(`[SSM] Nulificado track de video de pantalla para PC ${peerId} (cámara no activa).`);
                }
            } else if (cameraVideoTrack && videoEnabled) {
                 // Si no hay sender pero hay track de cámara activo, añadirlo
                 pc.addTrack(cameraVideoTrack, localStream!);
                 console.log(`[SSM] Añadido track de cámara porque no se encontró sender de video para PC ${peerId}.`);
            }

            if (audioSender) {
                // Si el micrófono está habilitado y hay un track, reemplazar
                if (cameraAudioTrack && micEnabled) {
                    audioSender.replaceTrack(cameraAudioTrack).catch(e => console.error(`[SSM] Error reemplazando audio de pantalla con micro para ${peerId}:`, e));
                    console.log(`[SSM] Reemplazado track de audio de pantalla por micro para PC ${peerId}.`);
                } else {
                    // Si el micrófono no está habilitado o no hay track, poner null
                    audioSender.replaceTrack(null).catch(e => console.error(`[SSM] Error nullifying screen audio track for ${peerId}:`, e));
                    console.log(`[SSM] Nulificado track de audio de pantalla para PC ${peerId} (micrófono no activo).`);
                }
            } else if (cameraAudioTrack && micEnabled) {
                // Si no hay sender pero hay track de audio activo, añadirlo
                pc.addTrack(cameraAudioTrack, localStream!);
                console.log(`[SSM] Añadido track de micro porque no se encontró sender de audio para PC ${peerId}.`);
            }

            // --- ¡IMPORTANTE! Envía la señal de estado de pantalla compartida aquí ---
            if (currentUser) {
                sendSignal(peerId, { type: 'screenShareStatus', isSharing: false, from: currentUser.id });
                console.log(`[SSM] Señal 'screenShareStatus: false' enviada a ${peerId}.`);
            }
        });

        onScreenShareStop();
        setIsSharingScreen(false);
        console.log("[SSM] Detención de compartición finalizada.");
    }, [localStream, peerConnections, onScreenShareStop, videoEnabled, micEnabled, sendSignal, currentUser]);


    // Función para iniciar la compartición de pantalla
    const startScreenShare = useCallback(async () => {
        console.log("[SSM] Iniciando compartición de pantalla...");
        if (!localStream) {
            console.warn("[SSM] localStream no disponible al intentar iniciar compartición.");
            return;
        }

        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
            screenShareStreamRef.current = screenStream;

            const screenVideoTrack = screenStream.getVideoTracks()[0];
            const screenAudioTrack = screenStream.getAudioTracks()[0];

            Object.values(peerConnections).forEach(pc => {
                const peerId = Object.keys(peerConnections).find(key => peerConnections[key] === pc);
                if (!peerId) return;

                let videoSender = pc.getSenders().find(sender => sender.track?.kind === 'video');
                let audioSender = pc.getSenders().find(sender => sender.track?.kind === 'audio');

                if (videoSender) {
                    videoSender.replaceTrack(screenVideoTrack).catch(e => console.error(`[SSM] Error reemplazando track de video para ${peerId}:`, e));
                    console.log(`[SSM] Reemplazado track de video existente por track de pantalla para PC ${peerId}.`);
                } else {
                    pc.addTrack(screenVideoTrack, screenStream);
                    console.log(`[SSM] Añadido NUEVO track de video de pantalla a PC para ${peerId} (no hay sender de video existente).`);
                }

                if (screenAudioTrack) {
                    if (audioSender) {
                        audioSender.replaceTrack(screenAudioTrack).catch(e => console.error(`[SSM] Error reemplazando track de audio para ${peerId}:`, e));
                        console.log(`[SSM] Reemplazado track de audio existente por audio de pantalla para PC ${peerId}.`);
                    } else {
                        pc.addTrack(screenAudioTrack, screenStream);
                        console.log(`[SSM] Añadido NUEVO track de audio de pantalla a PC para ${peerId} (no hay sender de audio existente).`);
                    }
                } else if (audioSender) {
                    // Si la pantalla no tiene audio, pero hay un sender de audio (ej. de la cámara),
                    // deberíamos nullificarlo o mantener el de la cámara si esa es la intención.
                    // Por ahora, lo nulificamos para asegurar que solo haya audio de la pantalla.
                    audioSender.replaceTrack(null).catch(e => console.error(`[SSM] Error nullifying audio track for ${peerId}:`, e));
                    console.log(`[SSM] Nulificado track de audio para PC ${peerId} (la pantalla no tiene audio).`);
                }
                // Si no había audioSender y la pantalla no tiene audio, no hacemos nada.
            });

            screenVideoTrack.onended = () => {
                console.log("[SSM] Compartición de pantalla finalizada por el usuario (control del navegador).");
                stopScreenShare();
            };

            onScreenShareStart(screenStream);
            setIsSharingScreen(true);
            console.log("[SSM] Inicio de compartición finalizado.");

            // --- ¡IMPORTANTE! Envía la señal de estado de pantalla compartida aquí ---
            if (currentUser) {
                Object.keys(peerConnections).forEach(peerId => {
                     sendSignal(peerId, { type: 'screenShareStatus', isSharing: true, from: currentUser.id });
                     console.log(`[SSM] Señal 'screenShareStatus: true' enviada a ${peerId}.`);
                });
            }

        } catch (error) {
            console.error("[SSM] Error al compartir pantalla:", error);
            onScreenShareStop();
            setIsSharingScreen(false);
        }
    }, [localStream, peerConnections, onScreenShareStart, onScreenShareStop, sendSignal, currentUser]); // Agrega sendSignal y currentUser a las dependencias.


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