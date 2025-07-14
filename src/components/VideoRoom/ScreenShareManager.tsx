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

            const videoSender = pc.getSenders().find(sender => sender.track?.kind === 'video');
            const audioSender = pc.getSenders().find(sender => sender.track?.kind === 'audio');

            if (videoSender) {
                if (cameraVideoTrack && videoEnabled) {
                    videoSender.replaceTrack(cameraVideoTrack).catch(e => console.error(`[ScreenShareManager] Error replacing screen video with camera for ${peerId}:`, e));
                    console.log(`[ScreenShareManager] Replaced screen video track with camera for PC ${peerId}.`);
                } else {
                    videoSender.replaceTrack(null).catch(e => console.error(`[ScreenShareManager] Error nullifying screen video track for ${peerId}:`, e));
                    console.log(`[ScreenShareManager] Nullified screen video track for PC ${peerId} (camera not active).`);
                }
            } else if (cameraVideoTrack && videoEnabled) {
                 pc.addTrack(cameraVideoTrack, localStream!);
                 console.log(`[ScreenShareManager] Added camera track back as no video sender found for PC ${peerId}.`);
            }

            if (audioSender) {
                if (cameraAudioTrack && micEnabled) {
                    audioSender.replaceTrack(cameraAudioTrack).catch(e => console.error(`[ScreenShareManager] Error replacing screen audio with mic for ${peerId}:`, e));
                    console.log(`[ScreenShareManager] Replaced screen audio track with mic for PC ${peerId}.`);
                } else {
                    audioSender.replaceTrack(null).catch(e => console.error(`[ScreenShareManager] Error nullifying screen audio track for ${peerId}:`, e));
                    console.log(`[ScreenShareManager] Nullified screen audio track for PC ${peerId} (mic not active).`);
                }
            } else if (cameraAudioTrack && micEnabled) {
                pc.addTrack(cameraAudioTrack, localStream!);
                console.log(`[ScreenShareManager] Added mic track back as no audio sender found for PC ${peerId}.`);
            }
        });

        onScreenShareStop();
        setIsSharingScreen(false);
        console.log("[ScreenShareManager] Detención de compartición finalizada.");
    }, [localStream, peerConnections, onScreenShareStop, videoEnabled, micEnabled]);


    // Función para iniciar la compartición de pantalla
    const startScreenShare = useCallback(async () => {
        console.log("[ScreenShareManager] Iniciando compartición de pantalla...");
        if (!localStream) {
            console.warn("[ScreenShareManager] localStream no disponible al intentar iniciar compartición.");
            // Esto no debería pasar si la llamada ya está activa, pero es buena precaución
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
                    videoSender.replaceTrack(screenVideoTrack).catch(e => console.error(`[ScreenShareManager] Error replacing video track for ${peerId}:`, e));
                    console.log(`[ScreenShareManager] Replaced existing video track with screen track for PC ${peerId}.`);
                } else {
                    pc.addTrack(screenVideoTrack, screenStream);
                    console.log(`[ScreenShareManager] Added NEW screen video track to PC for ${peerId} (no existing video sender).`);
                }

                if (screenAudioTrack) {
                    if (audioSender) {
                        audioSender.replaceTrack(screenAudioTrack).catch(e => console.error(`[ScreenShareManager] Error replacing audio track for ${peerId}:`, e));
                        console.log(`[ScreenShareManager] Replaced existing audio track with screen audio for PC ${peerId}.`);
                    } else {
                        pc.addTrack(screenAudioTrack, screenStream);
                        console.log(`[ScreenShareManager] Added NEW screen audio track to PC for ${peerId} (no existing audio sender).`);
                    }
                } else if (audioSender) {
                    audioSender.replaceTrack(null).catch(e => console.error(`[ScreenShareManager] Error nullifying audio track for ${peerId}:`, e));
                    console.log(`[ScreenShareManager] Nullified audio track for PC ${peerId} (screen has no audio).`);
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