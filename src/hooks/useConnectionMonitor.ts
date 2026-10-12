import { useState, useEffect, useCallback, useRef } from 'react';
import { EchoChannel } from '../services/ReverbWebSocketService';
import { ConnectionStatus, ConnectionIssue, HeartbeatSignal, ConnectionMonitorResult } from '../types/webrtc';

interface UseConnectionMonitorProps {
    channelRef: React.MutableRefObject<EchoChannel | null>;
    currentUserId: string | undefined;
    participants: Record<string, any>;
    peerConnectionsRef: React.MutableRefObject<Record<string, RTCPeerConnection>>;
    onReconnectNeeded: (peerId: string) => Promise<void>;
}

const HEARTBEAT_INTERVAL = 5000; // 5 segundos
const HEARTBEAT_TIMEOUT = 15000; // 15 segundos sin heartbeat = problema
const CONNECTION_CHECK_INTERVAL = 3000; // Verificar conexiones cada 3 segundos

export const useConnectionMonitor = ({
    channelRef,
    currentUserId,
    participants,
    peerConnectionsRef,
    onReconnectNeeded,
}: UseConnectionMonitorProps): ConnectionMonitorResult => {
    const [connectionStatuses, setConnectionStatuses] = useState<Record<string, ConnectionStatus>>({});
    const [issues, setIssues] = useState<ConnectionIssue[]>([]);
    const lastHeartbeatsRef = useRef<Record<string, number>>({});
    const reconnectingRef = useRef<Record<string, boolean>>({});

    // Enviar heartbeat a todos los participantes
    const sendHeartbeat = useCallback(() => {
        if (!channelRef.current || !currentUserId) return;

        const participantIds = Object.keys(participants);

        participantIds.forEach(peerId => {
            if (peerId === currentUserId) return;

            const heartbeatSignal: HeartbeatSignal = {
                type: 'heartbeat',
                timestamp: Date.now(),
                hasVideo: true, // TODO: obtener del estado real
                hasAudio: true, // TODO: obtener del estado real
            };

            try {
                channelRef.current?.whisper('Heartbeat', {
                    to: peerId,
                    from: currentUserId,
                    data: heartbeatSignal,
                });
            } catch (error) {
                console.error(`[Heartbeat] Error enviando heartbeat a ${peerId}:`, error);
            }
        });
    }, [channelRef, currentUserId, participants]);

    // Procesar heartbeat recibido
    const handleHeartbeat = useCallback((fromPeerId: string, data: HeartbeatSignal) => {
        lastHeartbeatsRef.current[fromPeerId] = data.timestamp;
        console.log(`[Heartbeat] ✅ Recibido de ${fromPeerId} en ${new Date(data.timestamp).toISOString()}`);
    }, []);

    // Validar estado de conexión de un participante
    const validateConnection = useCallback((peerId: string): ConnectionStatus => {
        const now = Date.now();
        const pc = peerConnectionsRef.current[peerId];
        const participant = participants[peerId];
        const lastHeartbeat = lastHeartbeatsRef.current[peerId] || 0;

        const isInChannel = !!participant;
        const hasPeerConnection = !!pc && pc.connectionState === 'connected';

        // Verificar si hay streams activos
        let hasActiveStream = false;
        if (participant) {
            const hasCamera = participant.cameraStream && participant.cameraStream.active;
            const hasScreen = participant.screenStream && participant.screenStream.active;
            hasActiveStream = !!(hasCamera || hasScreen);
        }

        // Determinar calidad de conexión
        let connectionQuality: 'good' | 'poor' | 'disconnected' = 'disconnected';

        if (isInChannel && hasPeerConnection && hasActiveStream) {
            // Verificar heartbeat reciente
            if (now - lastHeartbeat < HEARTBEAT_TIMEOUT) {
                connectionQuality = 'good';
            } else {
                connectionQuality = 'poor'; // Conectado pero sin heartbeat reciente
            }
        } else if (isInChannel && hasPeerConnection) {
            connectionQuality = 'poor'; // Conectado pero sin stream
        }

        return {
            isInChannel,
            hasPeerConnection,
            hasActiveStream,
            lastHeartbeat,
            connectionQuality,
        };
    }, [participants, peerConnectionsRef]);

    // Detectar problemas de conexión
    const detectIssues = useCallback(() => {
        const detectedIssues: ConnectionIssue[] = [];
        const now = Date.now();

        Object.keys(participants).forEach(peerId => {
            if (peerId === currentUserId) return;
            if (reconnectingRef.current[peerId]) return; // Ya está reconectando

            const status = validateConnection(peerId);
            const participant = participants[peerId];

            // Problema 1: En canal pero sin PeerConnection
            if (status.isInChannel && !status.hasPeerConnection) {
                detectedIssues.push({
                    peerId,
                    peerName: participant.name,
                    issue: 'no_peer_connection',
                    detectedAt: now,
                });
            }

            // Problema 2: PeerConnection pero sin stream
            if (status.hasPeerConnection && !status.hasActiveStream) {
                detectedIssues.push({
                    peerId,
                    peerName: participant.name,
                    issue: 'no_stream',
                    detectedAt: now,
                });
            }

            // Problema 3: Timeout de heartbeat
            if (status.isInChannel && (now - status.lastHeartbeat > HEARTBEAT_TIMEOUT) && status.lastHeartbeat > 0) {
                detectedIssues.push({
                    peerId,
                    peerName: participant.name,
                    issue: 'heartbeat_timeout',
                    detectedAt: now,
                });
            }
        });

        setIssues(detectedIssues);
        return detectedIssues;
    }, [participants, currentUserId, validateConnection]);

    // Forzar reconexión con un participante
    const forceReconnect = useCallback(async (peerId: string) => {
        if (reconnectingRef.current[peerId]) {
            console.log(`[Reconnect] Ya hay una reconexión en progreso para ${peerId}`);
            return;
        }

        console.log(`[Reconnect] 🔄 Iniciando reconexión forzada con ${peerId}`);
        reconnectingRef.current[peerId] = true;

        try {
            await onReconnectNeeded(peerId);
            console.log(`[Reconnect] ✅ Reconexión exitosa con ${peerId}`);
        } catch (error) {
            console.error(`[Reconnect] ❌ Error en reconexión con ${peerId}:`, error);
        } finally {
            // Esperar 2 segundos antes de permitir otra reconexión
            setTimeout(() => {
                reconnectingRef.current[peerId] = false;
            }, 2000);
        }
    }, [onReconnectNeeded]);

    // Reconexión automática cuando se detectan problemas
    useEffect(() => {
        const detectedIssues = detectIssues();

        detectedIssues.forEach(issue => {
            // Solo reconectar automáticamente para problemas críticos
            if (issue.issue === 'no_peer_connection') {
                console.warn(`[Auto-Reconnect] Detectado problema con ${issue.peerName}: ${issue.issue}`);
                // Esperar 5 segundos antes de reconectar automáticamente
                setTimeout(() => {
                    forceReconnect(issue.peerId);
                }, 5000);
            }
        });
    }, [participants, detectIssues, forceReconnect]);

    // Actualizar estados de conexión periódicamente
    useEffect(() => {
        const updateStatuses = () => {
            const newStatuses: Record<string, ConnectionStatus> = {};

            Object.keys(participants).forEach(peerId => {
                if (peerId !== currentUserId) {
                    newStatuses[peerId] = validateConnection(peerId);
                }
            });

            setConnectionStatuses(newStatuses);
        };

        const interval = setInterval(updateStatuses, CONNECTION_CHECK_INTERVAL);
        updateStatuses(); // Ejecutar inmediatamente

        return () => clearInterval(interval);
    }, [participants, currentUserId, validateConnection]);

    // Configurar envío de heartbeats
    useEffect(() => {
        const interval = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
        sendHeartbeat(); // Enviar inmediatamente

        return () => clearInterval(interval);
    }, [sendHeartbeat]);

    // Configurar listener de heartbeats
    useEffect(() => {
        if (!channelRef.current || !currentUserId) return;

        const channel = channelRef.current;

        channel.listenForWhisper('Heartbeat', ({ to, from, data }: { to: string; from: string; data: HeartbeatSignal }) => {
            if (to !== currentUserId) return;
            handleHeartbeat(from, data);
        });

        // No hay forma de remover listeners específicos en Echo, se limpia al desmontar el canal
    }, [channelRef, currentUserId, handleHeartbeat]);

    return {
        connectionStatuses,
        issues,
        forceReconnect,
    };
};
