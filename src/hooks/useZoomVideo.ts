// Custom hook for managing Zoom Video SDK
import { useState, useEffect, useCallback, useRef } from 'react';
import { getZoomVideoSDKService } from '../services/ZoomVideoSDKService';
import { createZoomTokenService } from '../services/ZoomTokenService';
import type {
    UseZoomVideoResult,
    ZoomSessionConfig,
    ZoomStreamState
} from '../types/zoom';
import type { Participant } from '@zoom/videosdk';

interface UseZoomVideoProps {
    roomId: string;
    currentUser: { id: string; name: string; token: string } | null;
    onParticipantJoined?: (name: string) => void;
    onParticipantLeft?: (name: string) => void;
}

export const useZoomVideo = ({
    roomId,
    currentUser,
    onParticipantJoined,
    onParticipantLeft,
}: UseZoomVideoProps): UseZoomVideoResult => {
    const [isInSession, setIsInSession] = useState(false);
    const [participants, setParticipants] = useState<Map<number, ZoomStreamState>>(new Map());
    const [localUserId, setLocalUserId] = useState<number | null>(null);
    const [isVideoOn, setIsVideoOn] = useState(false);
    const [isAudioOn, setIsAudioOn] = useState(false);
    const [isSharingScreen, setIsSharingScreen] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const zoomService = useRef(getZoomVideoSDKService());
    const tokenService = useRef(currentUser ? createZoomTokenService(currentUser.token) : null);
    const participantCanvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());

    /**
     * Join a Zoom session
     */
    const joinSession = useCallback(async (config: ZoomSessionConfig) => {
        try {
            setError(null);
            console.log('[useZoomVideo] Joining session:', config.sessionName);

            await zoomService.current.joinSession(config);

            const client = zoomService.current.getClient();
            if (!client) {
                throw new Error('Client not initialized');
            }

            const currentUserInfo = zoomService.current.getCurrentUser();
            if (currentUserInfo) {
                setLocalUserId(currentUserInfo.userId);
            }

            setIsInSession(true);
            console.log('[useZoomVideo] Successfully joined session');

            // Setup event listeners
            setupEventListeners();

        } catch (err: any) {
            console.error('[useZoomVideo] Failed to join session:', err);
            setError(err.message || 'Failed to join session');
            throw err;
        }
    }, []);

    /**
     * Leave the current session
     */
    const leaveSession = useCallback(async () => {
        try {
            console.log('[useZoomVideo] Leaving session');

            await zoomService.current.leaveSession();

            setIsInSession(false);
            setParticipants(new Map());
            setLocalUserId(null);
            setIsVideoOn(false);
            setIsAudioOn(false);
            setIsSharingScreen(false);
            participantCanvasRefs.current.clear();

            console.log('[useZoomVideo] Successfully left session');
        } catch (err: any) {
            console.error('[useZoomVideo] Error leaving session:', err);
            setError(err.message || 'Failed to leave session');
        }
    }, []);

    /**
     * Toggle video on/off
     */
    const toggleVideo = useCallback(async () => {
        try {
            if (isVideoOn) {
                await zoomService.current.stopVideo();
                setIsVideoOn(false);
            } else {
                await zoomService.current.startVideo();
                setIsVideoOn(true);
            }
        } catch (err: any) {
            console.error('[useZoomVideo] Error toggling video:', err);
            setError(err.message || 'Failed to toggle video');
        }
    }, [isVideoOn]);

    /**
     * Toggle audio on/off
     */
    const toggleAudio = useCallback(async () => {
        try {
            if (isAudioOn) {
                await zoomService.current.stopAudio();
                setIsAudioOn(false);
            } else {
                await zoomService.current.startAudio();
                setIsAudioOn(true);
            }
        } catch (err: any) {
            console.error('[useZoomVideo] Error toggling audio:', err);
            setError(err.message || 'Failed to toggle audio');
        }
    }, [isAudioOn]);

    /**
     * Start screen sharing
     */
    const startScreenShare = useCallback(async () => {
        try {
            await zoomService.current.startScreenShare();
            setIsSharingScreen(true);
        } catch (err: any) {
            console.error('[useZoomVideo] Error starting screen share:', err);
            setError(err.message || 'Failed to start screen sharing');
        }
    }, []);

    /**
     * Stop screen sharing
     */
    const stopScreenShare = useCallback(async () => {
        try {
            await zoomService.current.stopScreenShare();
            setIsSharingScreen(false);
        } catch (err: any) {
            console.error('[useZoomVideo] Error stopping screen share:', err);
            setError(err.message || 'Failed to stop screen sharing');
        }
    }, []);

    /**
     * Setup event listeners for Zoom SDK events
     */
    const setupEventListeners = useCallback(() => {
        const client = zoomService.current.getClient();
        if (!client) return;

        // User added event
        client.on('user-added', (payload: Participant[]) => {
            console.log('[useZoomVideo] User added:', payload);
            payload.forEach((participant) => {
                setParticipants((prev) => {
                    const newMap = new Map(prev);
                    newMap.set(participant.userId, {
                        userId: participant.userId,
                        displayName: participant.displayName,
                        videoEnabled: participant.bVideoOn,
                        audioEnabled: !participant.muted,
                        isSharing: participant.sharerOn,
                    });
                    return newMap;
                });

                if (onParticipantJoined) {
                    onParticipantJoined(participant.displayName);
                }
            });
        });

        // User removed event
        client.on('user-removed', (payload: Participant[]) => {
            console.log('[useZoomVideo] User removed:', payload);
            payload.forEach((participant) => {
                setParticipants((prev) => {
                    const newMap = new Map(prev);
                    newMap.delete(participant.userId);
                    return newMap;
                });

                if (onParticipantLeft) {
                    onParticipantLeft(participant.displayName);
                }
            });
        });

        // User updated event
        client.on('user-updated', (payload: Participant[]) => {
            console.log('[useZoomVideo] User updated:', payload);
            payload.forEach((participant) => {
                setParticipants((prev) => {
                    const newMap = new Map(prev);
                    const existing = newMap.get(participant.userId);
                    if (existing) {
                        newMap.set(participant.userId, {
                            ...existing,
                            videoEnabled: participant.bVideoOn,
                            audioEnabled: !participant.muted,
                            isSharing: participant.sharerOn,
                        });
                    }
                    return newMap;
                });
            });
        });

        // Video active change
        client.on('video-active-change', (payload: any) => {
            console.log('[useZoomVideo] Video active change:', payload);
            if (payload.userId === localUserId) {
                setIsVideoOn(payload.state === 'Active');
            }
        });

        // Audio active change
        client.on('audio-active-speaker', (payload: any) => {
            console.log('[useZoomVideo] Audio active speaker:', payload);
        });

        // Share screen change
        client.on('active-share-change', (payload: any) => {
            console.log('[useZoomVideo] Share screen change:', payload);
            if (payload.userId === localUserId) {
                setIsSharingScreen(payload.state === 'Active');
            }
        });

        // Peer video state change
        client.on('peer-video-state-change', (payload: any) => {
            console.log('[useZoomVideo] Peer video state change:', payload);
            setParticipants((prev) => {
                const newMap = new Map(prev);
                const participant = newMap.get(payload.userId);
                if (participant) {
                    newMap.set(payload.userId, {
                        ...participant,
                        videoEnabled: payload.action === 'Start',
                    });
                }
                return newMap;
            });
        });

    }, [localUserId, onParticipantJoined, onParticipantLeft]);

    /**
     * Initialize Zoom SDK on mount
     */
    useEffect(() => {
        const initZoom = async () => {
            try {
                await zoomService.current.init();
                console.log('[useZoomVideo] Zoom SDK initialized');
            } catch (err: any) {
                console.error('[useZoomVideo] Failed to initialize Zoom SDK:', err);
                setError(err.message || 'Failed to initialize Zoom SDK');
            }
        };

        initZoom();

        return () => {
            // Cleanup on unmount
            if (isInSession) {
                leaveSession();
            }
        };
    }, []);

    /**
     * Auto-join session when roomId and currentUser are available
     */
    useEffect(() => {
        const autoJoin = async () => {
            if (!roomId || !currentUser || isInSession) return;

            try {
                // Generate token from backend
                if (!tokenService.current) {
                    tokenService.current = createZoomTokenService(currentUser.token);
                }

                const { token, sessionName } = await tokenService.current.generateToken(
                    roomId,
                    0 // 0 = participant, 1 = host
                );

                // Join the session
                await joinSession({
                    sessionName,
                    token,
                    userName: currentUser.name,
                    userIdentity: currentUser.id,
                });

                // Start audio and video by default
                await zoomService.current.startAudio();
                setIsAudioOn(true);

                await zoomService.current.startVideo();
                setIsVideoOn(true);

            } catch (err: any) {
                console.error('[useZoomVideo] Auto-join failed:', err);
                setError(err.message || 'Failed to auto-join session');
            }
        };

        autoJoin();
    }, [roomId, currentUser, isInSession, joinSession]);

    return {
        client: zoomService.current.getClient(),
        isInSession,
        participants,
        localUserId,
        isVideoOn,
        isAudioOn,
        isSharingScreen,
        joinSession,
        leaveSession,
        toggleVideo,
        toggleAudio,
        startScreenShare,
        stopScreenShare,
        error,
    };
};
