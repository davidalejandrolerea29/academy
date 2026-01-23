import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import DailyIframe from '@daily-co/daily-js';
import { PhoneOff, Monitor, MonitorOff, Minimize2, Maximize2, Mic, MicOff, Video, VideoOff, MessageSquare, X, Signal, ShieldAlert } from 'lucide-react';
import ChatBox, { Message } from './ChatBox';
import Toast from './Toast';
import { useAuth } from '../../contexts/AuthContext';

interface VideoRoomProps {
    roomId: string;
    onCallEnded: () => void;
    isTeacher: boolean;
    isCallMinimized: boolean;
    toggleMinimizeCall: () => void;
    handleCallCleanup: () => void;
}

const VideoRoom: React.FC<VideoRoomProps> = ({
    roomId,
    onCallEnded,
    handleCallCleanup,
    toggleMinimizeCall,
    isCallMinimized,
    isTeacher,
}) => {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const [callObject, setCallObject] = useState<any>(null);
    const [isCreatingRoom, setIsCreatingRoom] = useState(false);
    const [roomError, setRoomError] = useState<string | null>(null);
    const [chatMessages, setChatMessages] = useState<Message[]>([]);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
    const [networkQuality, setNetworkQuality] = useState<'good' | 'low' | 'very-low'>('good');
    const [permissionError, setPermissionError] = useState(false);
    const [participants, setParticipants] = useState<any[]>([]);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);

    const [teacherName, setTeacherName] = useState<string | null>(null);
    const [manualFeaturedId, setManualFeaturedId] = useState<string | null>(null);
    const [isChatOpen, setIsChatOpen] = useState(window.innerWidth >= 768);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const videoContainerRef = useRef<HTMLDivElement>(null);

    // Draggable widget state
    const [widgetPosition, setWidgetPosition] = useState({ x: window.innerWidth - 420, y: 20 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    // Handle drag start
    const handleDragStart = (e: React.MouseEvent) => {
        setIsDragging(true);
        setDragOffset({
            x: e.clientX - widgetPosition.x,
            y: e.clientY - widgetPosition.y,
        });
    };

    // Handle drag move
    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            if (mobile && isChatOpen) {
                // optional: close chat on mobile when resizing down? 
                // keeping current state is usually better for UX unless it breaks layout
            } else if (!mobile && !isChatOpen) {
                // on desktop, default chat to open
                setIsChatOpen(true);
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [isChatOpen]);

    useEffect(() => {
        const handleDragMove = (e: MouseEvent) => {
            if (isDragging) {
                setWidgetPosition({
                    x: e.clientX - dragOffset.x,
                    y: e.clientY - dragOffset.y,
                });
            }
        };

        const handleDragEnd = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            document.addEventListener('mousemove', handleDragMove);
            document.addEventListener('mouseup', handleDragEnd);
        }

        return () => {
            document.removeEventListener('mousemove', handleDragMove);
            document.removeEventListener('mouseup', handleDragEnd);
        };
    }, [isDragging, dragOffset]);

    useEffect(() => {
        let mounted = true;

        const initializeRoom = async () => {
            if (!currentUser || !roomId) return;

            setIsCreatingRoom(true);
            setRoomError(null);

            try {
                // Call backend to create/get room
                const API_URL = import.meta.env.VITE_API_URL;
                const token = localStorage.getItem('token');

                if (!token) {
                    throw new Error('No authentication token found');
                }

                const url = `${API_URL}/auth/daily/room`;
                console.log('[Daily] Calling URL:', url);

                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                    },
                    body: JSON.stringify({ room_id: roomId }),
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.message || errorData.error || 'Failed to create room');
                }

                const data = await response.json();

                if (!data.success || !data.room?.url) {
                    throw new Error('Invalid response from server');
                }

                const roomUrl = data.room.url;
                console.log('[Daily] Room URL:', roomUrl);

                if (!mounted) return;

                // Create call object (NO iframe)
                const call = DailyIframe.createCallObject();
                setCallObject(call);

                // Join the call
                await call.join({
                    url: roomUrl,
                    userName: currentUser?.name || 'Usuario',
                }).catch((error: any) => {
                    console.error('[Daily] Join error:', error);
                    // Check specifically for permission errors
                    if (error?.errorMsg?.includes('permissions') || error?.errorMsg?.includes('device access denied')) {
                        throw new Error('PERMISSION_DENIED');
                    }
                    throw error;
                });

                setIsCreatingRoom(false);
                setToast({ message: 'Conectado a la sala', type: 'success' });

                // Fetch room teacher information
                try {
                    const roomInfoResponse = await fetch(`${import.meta.env.VITE_API_URL}/auth/rooms/${roomId}`, {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Accept': 'application/json',
                        },
                    });

                    if (roomInfoResponse.ok) {
                        const roomData = await roomInfoResponse.json();
                        if (roomData.teacher?.name) {
                            setTeacherName(roomData.teacher.name);
                            console.log('[VideoRoom] Teacher name:', roomData.teacher.name);
                        }
                    }
                } catch (error) {
                    console.error('[VideoRoom] Error fetching room teacher:', error);
                }

                // Load historical chat messages
                try {
                    const messagesResponse = await fetch(`${import.meta.env.VITE_API_URL}/auth/messages/room/${roomId}`, {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Accept': 'application/json',
                        },
                    });

                    if (messagesResponse.ok) {
                        const messagesData = await messagesResponse.json();
                        const historicalMessages = messagesData.map((msg: any) => ({
                            sender: msg.room_participant?.user?.name || 'Usuario',
                            text: msg.content,
                        }));
                        setChatMessages(historicalMessages);
                        console.log('[VideoRoom] Loaded', historicalMessages.length, 'historical messages');
                    }
                } catch (error) {
                    console.error('[VideoRoom] Error loading chat history:', error);
                }

                // Listen for participant updates
                call.on('participant-joined', (event: any) => {
                    console.log('[Daily] Participant joined:', event);
                    setToast({ message: `${event.participant.user_name} se unió`, type: 'info' });
                    updateParticipants(call);
                });

                call.on('participant-left', (event: any) => {
                    console.log('[Daily] Participant left:', event);
                    setToast({ message: `${event.participant.user_name} salió`, type: 'info' });
                    updateParticipants(call);
                });

                call.on('participant-updated', () => {
                    updateParticipants(call);
                });

                call.on('left-meeting', (event: any) => {
                    console.log('[Daily] Left meeting', event);
                    // Handle "room full" or "meeting ended" or "kicked"
                    if (event?.reason === 'meetingFull') {
                        setToast({ message: 'La sala está llena', type: 'error' });
                        setTimeout(handleEndCall, 3000);
                    } else {
                        handleEndCall();
                    }
                });

                // Add error handling for connection issues
                call.on('error', (event: any) => {
                    console.error('[Daily] Error event:', event);
                    // Don't disconnect on minor errors, just log them
                    if (event.errorMsg?.includes('connection')) {
                        setToast({ message: 'Problema de conexión detectado', type: 'error' });
                    }
                });

                // Monitor network quality
                call.on('network-quality-change', (event: any) => {
                    console.log('[Daily] Network quality:', event);
                    if (event.threshold === 'good') {
                        setNetworkQuality('good');
                    } else if (event.threshold === 'low') {
                        setNetworkQuality('low');
                        setToast({ message: 'Conexión inestable detectada', type: 'info' });
                    } else if (event.threshold === 'very-low') {
                        setNetworkQuality('very-low');
                        setToast({ message: 'Conexión crítica', type: 'error' });
                    }
                });

                // Track connection state changes
                call.on('track-started', (event: any) => {
                    console.log('[Daily] Track started:', event.participant?.user_name, event.track?.kind);
                });

                call.on('track-stopped', (event: any) => {
                    console.log('[Daily] Track stopped:', event.participant?.user_name, event.track?.kind);
                });

                // Initial participant update
                updateParticipants(call);

            } catch (error: any) {
                console.error('[Daily] Error creating room:', error);
                if (mounted) {
                    if (error.message === 'PERMISSION_DENIED' || error.message?.includes('permissions')) {
                        setPermissionError(true);
                        setIsCreatingRoom(false);
                        return;
                    }
                    setRoomError(error.message || 'Error al crear la sala');
                    setIsCreatingRoom(false);
                }
            }
        };

        const updateParticipants = (call: any) => {
            const parts = call.participants();
            let participantList = Object.values(parts);

            // Sort participants: teachers first, then students
            // We identify teachers by checking if their user_name matches the teacher's name
            participantList = participantList.sort((a: any, b: any) => {
                const aIsTeacher = isTeacher && a.user_name === currentUser?.name;
                const bIsTeacher = isTeacher && b.user_name === currentUser?.name;

                // If we're the teacher and this is our session, put us first
                if (aIsTeacher && !bIsTeacher) return -1;
                if (!aIsTeacher && bIsTeacher) return 1;

                // Otherwise maintain order
                return 0;
            });

            setParticipants(participantList);
        };

        initializeRoom();

        return () => {
            mounted = false;
            if (callObject) {
                callObject.destroy();
            }
        };
    }, [roomId, currentUser]);



    // Helper to update video source
    const updateVideoSource = (videoEl: HTMLVideoElement, participant: any) => {
        if (!videoEl || !participant || !videoEl.load) return;

        const tracks = [];

        // Prioritize screen share if available
        if (participant.tracks?.screenVideo?.persistentTrack) {
            tracks.push(participant.tracks.screenVideo.persistentTrack);
        } else if (participant.tracks?.video?.persistentTrack) {
            tracks.push(participant.tracks.video.persistentTrack);
        }

        // Add audio if not local
        if (participant.tracks?.audio?.persistentTrack && !participant.local) {
            tracks.push(participant.tracks.audio.persistentTrack);
        }

        if (tracks.length > 0) {
            const newStream = new MediaStream(tracks);

            // Only update if the stream is different to avoid flickering
            if (!videoEl.srcObject) {
                videoEl.srcObject = newStream;
            } else {
                const currentStream = videoEl.srcObject as MediaStream;
                const currentTracks = currentStream.getTracks();
                const newTracks = newStream.getTracks();

                // Simple ID check to see if tracks changed
                if (currentTracks.length !== newTracks.length ||
                    currentTracks[0]?.id !== newTracks[0]?.id) {
                    videoEl.srcObject = newStream;
                }
            }
        }
    };

    // Update video elements when participants change or layout changes
    useEffect(() => {
        if (!callObject) return;

        participants.forEach((participant: any) => {
            // Find ALL video elements for this participant (normal view AND minimized widget)
            // Matches: video-${session_id}, video-mini-${session_id}
            const videoElements = document.querySelectorAll(
                `video[id="video-${participant.session_id}"], video[id="video-mini-${participant.session_id}"]`
            ) as NodeListOf<HTMLVideoElement>;

            videoElements.forEach((videoEl) => {
                if (videoEl) {
                    const tracks = [];

                    // Prioritize screen share if available
                    if (participant.tracks?.screenVideo?.persistentTrack) {
                        tracks.push(participant.tracks.screenVideo.persistentTrack);
                    } else if (participant.tracks?.video?.persistentTrack) {
                        tracks.push(participant.tracks.video.persistentTrack);
                    }

                    // Add audio if not local
                    if (participant.tracks?.audio?.persistentTrack && !participant.local) {
                        tracks.push(participant.tracks.audio.persistentTrack);
                    }

                    if (tracks.length > 0) {
                        const newStream = new MediaStream(tracks);
                        // Only update if the stream is different to avoid flickering
                        if (!videoEl.srcObject || videoEl.srcObject !== newStream) {
                            videoEl.srcObject = newStream;
                        }
                    }
                }
            });
        });
    }, [participants, callObject, isCallMinimized, manualFeaturedId]);

    const toggleScreenShare = async () => {
        if (!callObject) return;

        try {
            if (isScreenSharing) {
                await callObject.stopScreenShare();
                setIsScreenSharing(false);
                setToast({ message: 'Compartir pantalla detenido', type: 'info' });
            } else {
                await callObject.startScreenShare();
                setIsScreenSharing(true);
                setToast({ message: 'Compartiendo pantalla', type: 'success' });
            }
        } catch (error) {
            console.error('[Daily] Screen share error:', error);
            setToast({ message: 'Error al compartir pantalla', type: 'error' });
        }
    };

    const toggleMute = async () => {
        if (!callObject) return;

        const newMutedState = !isMuted;
        await callObject.setLocalAudio(!newMutedState);
        setIsMuted(newMutedState);
        setToast({ message: newMutedState ? 'Micrófono silenciado' : 'Micrófono activado', type: 'info' });
    };

    const toggleVideo = async () => {
        if (!callObject) return;

        const newVideoState = !isVideoOff;
        await callObject.setLocalVideo(!newVideoState);
        setIsVideoOff(newVideoState);
        setToast({ message: newVideoState ? 'Cámara desactivada' : 'Cámara activada', type: 'info' });
    };

    const handleEndCall = () => {
        console.log('[Daily] Ending call');
        if (callObject) {
            callObject.destroy();
        }
        handleCallCleanup();
        onCallEnded();

        // Navigate back to rooms list using React Router
        navigate('/rooms');
    };

    if (isCreatingRoom) {
        return (
            <div className="flex h-screen bg-gray-900 items-center justify-center">
                <div className="text-center">
                    <div className="text-white text-xl mb-4">Creando sala de videollamada...</div>
                    <div className="text-gray-400">Por favor espera un momento</div>
                </div>
            </div>
        );
    }

    if (permissionError) {
        return (
            <div className="flex h-screen bg-gray-900 items-center justify-center p-4">
                <div className="text-center max-w-lg bg-gray-800 p-8 rounded-xl shadow-2xl border border-gray-700">
                    <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-white mb-2">Permisos requeridos</h2>
                    <p className="text-gray-300 mb-6">
                        No pudimos acceder a tu cámara o micrófono. Para unirte a la clase, necesitas dar permiso en tu navegador.
                    </p>

                    <div className="text-left bg-gray-900 p-4 rounded-lg mb-6 border border-gray-700">
                        <h3 className="text-white font-semibold mb-2">Cómo habilitar permisos:</h3>
                        <ol className="list-decimal list-inside text-gray-400 space-y-2 text-sm">
                            <li>Haz clic en el ícono de candado 🔒 o cámara 📷 en la barra de dirección (arriba a la izquierda).</li>
                            <li>Activa los permisos de <strong>Cámara</strong> y <strong>Micrófono</strong>.</li>
                            <li>Recarga esta página.</li>
                        </ol>
                    </div>

                    <button
                        onClick={() => window.location.reload()}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold transition-all w-full"
                    >
                        Ya activé los permisos, recargar página
                    </button>

                    <button
                        onClick={() => navigate('/rooms')}
                        className="mt-4 text-gray-400 hover:text-white text-sm underline"
                    >
                        Volver a la lista de salas
                    </button>
                </div>
            </div>
        );
    }

    if (roomError) {
        return (
            <div className="flex h-screen bg-gray-900 items-center justify-center">
                <div className="text-center max-w-md">
                    <div className="text-red-500 text-xl mb-4">❌ Error</div>
                    <div className="text-white mb-4">{roomError}</div>
                    <button
                        onClick={() => window.location.reload()}
                        className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded-lg"
                    >
                        Reintentar
                    </button>
                </div>
            </div>
        );
    }

    // Minimized draggable widget
    if (isCallMinimized) {
        return (
            <>
                <div
                    className="fixed z-50 bg-gray-900 rounded-lg shadow-2xl overflow-hidden"
                    style={{
                        left: `${widgetPosition.x}px`,
                        top: `${widgetPosition.y}px`,
                        width: '400px',
                        cursor: isDragging ? 'grabbing' : 'grab',
                    }}
                    onMouseDown={handleDragStart}
                >
                    {/* Widget header */}
                    <div className="bg-gray-800 px-3 py-2 flex items-center justify-between border-b border-gray-700">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                            <span className="text-white text-sm font-medium">Sala: {roomId}</span>
                            <span className="text-gray-300 text-xs">({participants.length})</span>
                        </div>
                        <div className="flex gap-1">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toggleMinimizeCall();
                                }}
                                className="p-1 hover:bg-gray-700 rounded"
                                title="Maximizar"
                            >
                                <Maximize2 className="w-4 h-4 text-white" />
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleEndCall();
                                }}
                                className="p-1 hover:bg-red-700 rounded"
                                title="Colgar"
                            >
                                <PhoneOff className="w-4 h-4 text-white" />
                            </button>
                        </div>
                    </div>

                    {/* Mini video grid - shows both participants */}
                    <div className="relative bg-black grid grid-cols-2 gap-1 p-1" style={{ height: '225px' }}>
                        {participants.map((participant: any) => (
                            <div key={participant.session_id} className="relative bg-gray-800 rounded overflow-hidden">
                                <video
                                    id={`video-mini-${participant.session_id}`}
                                    ref={(el) => updateVideoSource(el!, participant)}
                                    autoPlay
                                    playsInline
                                    muted={participant.local}
                                    className="w-full h-full object-cover"
                                />
                                <div className="absolute bottom-1 left-1 text-white text-xs bg-black bg-opacity-60 px-2 py-0.5 rounded">
                                    {participant.user_name || 'Usuario'}{participant.local && ' (Tú)'}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Toast notifications */}
                {toast && (
                    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
                        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
                    </div>
                )}
            </>
        );
    }

    // Full screen view
    return (
        <div className="flex h-screen bg-gray-900 overflow-hidden flex-col md:flex-row">
            {/* Main video area */}
            <div className={`flex-1 flex flex-col min-w-0 relative ${isChatOpen && isMobile ? 'hidden' : 'flex'}`}>
                {/* Video grid */}
                <div className="flex-1 relative bg-black p-4" ref={videoContainerRef}>
                    {/* Check if anyone is sharing screen */}
                    {(() => {
                        const screenSharer = participants.find(p => p.tracks?.screenVideo?.persistentTrack);

                        if (screenSharer) {
                            // Google Meet style: Large screen share + small participant videos
                            return (
                                <div className="flex gap-4 h-full">
                                    {/* Main screen share area */}
                                    <div className="flex-1 relative bg-gray-900 rounded-lg overflow-hidden">
                                        <video
                                            id={`video-${screenSharer.session_id}`}
                                            ref={(el) => updateVideoSource(el!, screenSharer)}
                                            autoPlay
                                            playsInline
                                            muted={screenSharer.local}
                                            className="w-full h-full object-contain"
                                        />
                                        <div className="absolute bottom-4 left-4 bg-black bg-opacity-60 px-3 py-2 rounded-lg">
                                            <span className="text-white font-medium">
                                                {screenSharer.user_name || 'Usuario'} está compartiendo pantalla
                                            </span>
                                        </div>
                                    </div>

                                    {/* Participant thumbnails on the right */}
                                    <div className="flex flex-col gap-2" style={{ width: '200px' }}>
                                        {participants.map((participant: any) => (
                                            <div key={participant.session_id} className="relative bg-gray-800 rounded-lg overflow-hidden" style={{ height: '150px' }}>
                                                <video
                                                    id={`video-thumb-${participant.session_id}`}
                                                    ref={(el) => updateVideoSource(el!, participant)}
                                                    autoPlay
                                                    playsInline
                                                    muted={participant.local}
                                                    className="w-full h-full object-cover"
                                                />
                                                <div className="absolute bottom-2 left-2 bg-black bg-opacity-60 px-2 py-1 rounded text-xs">
                                                    <span className="text-white">
                                                        {participant.user_name || 'Usuario'}
                                                        {participant.local && ' (Tú)'}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        } else {
                            // Multiple layout options based on viewLayout state
                            if (participants.length === 0) {
                                // No participants yet - show loading state
                                return (
                                    <div className="h-full flex items-center justify-center">
                                        <div className="text-white text-center">
                                            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white mx-auto mb-4"></div>
                                            <p>Conectando...</p>
                                        </div>
                                    </div>
                                );
                            } else if (participants.length === 1) {
                                // Single participant - full screen
                                const participant = participants[0];
                                return (
                                    <div className="h-full">
                                        <div className="relative bg-gray-800 rounded-lg overflow-hidden h-full">
                                            <video
                                                id={`video-${participant.session_id}`}
                                                ref={(el) => updateVideoSource(el!, participant)}
                                                autoPlay
                                                playsInline
                                                muted={participant.local}
                                                className="w-full h-full object-contain"
                                            />
                                            <div className="absolute bottom-4 left-4 bg-black bg-opacity-60 px-3 py-2 rounded-lg">
                                                <span className="text-white font-medium">
                                                    {participant.user_name || 'Usuario'}
                                                    {participant.local && ' (Tú)'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            } else {
                                // Speaker view - Teacher large, students as thumbnails
                                // Priority: manual selection > teacher > first participant
                                let featuredParticipant;

                                if (manualFeaturedId) {
                                    // Use manually selected participant
                                    featuredParticipant = participants.find((p: any) => p.session_id === manualFeaturedId) || participants[0];
                                } else {
                                    // Find the teacher by name, or default to first participant
                                    const teacherParticipant = teacherName
                                        ? participants.find((p: any) =>
                                            p.user_name?.toLowerCase().trim() === teacherName.toLowerCase().trim()
                                        )
                                        : null;
                                    featuredParticipant = teacherParticipant || participants[0];
                                }

                                const otherParticipants = participants.filter((p: any) => p.session_id !== featuredParticipant.session_id);

                                return (
                                    <div className="relative h-full w-full bg-black">
                                        {/* Main featured video area */}
                                        <div className="absolute inset-0 z-0">
                                            <video
                                                id={`video-${featuredParticipant.session_id}`}
                                                ref={(el) => updateVideoSource(el!, featuredParticipant)}
                                                autoPlay
                                                playsInline
                                                muted={featuredParticipant.local}
                                                className="w-full h-full object-contain"
                                            />
                                            <div className="absolute bottom-24 left-6 bg-black bg-opacity-60 px-4 py-2 rounded-lg z-10">
                                                <span className="text-white font-medium text-lg">
                                                    {featuredParticipant.user_name || 'Usuario'}
                                                    {featuredParticipant.local && ' (Tú)'}
                                                </span>
                                            </div>

                                            {/* Reset button - Moved to top center/left to avoid thumbnails */}
                                            {manualFeaturedId && (
                                                <button
                                                    onClick={() => setManualFeaturedId(null)}
                                                    className="absolute top-20 left-6 bg-black bg-opacity-60 hover:bg-opacity-80 px-4 py-2 rounded-lg transition-all z-20 flex items-center gap-2"
                                                    title="Volver a vista por defecto"
                                                >
                                                    <span className="text-white text-sm font-semibold">↺ Restablecer vista automática</span>
                                                </button>
                                            )}
                                        </div>

                                        {/* Student thumbnails - Floating on right */}
                                        {otherParticipants.length > 0 && (
                                            <div
                                                className="absolute top-4 right-4 flex flex-col gap-2 z-20 max-h-[80%] overflow-y-auto custom-scrollbar pr-1"
                                                style={{ width: isMobile ? '120px' : '200px' }}
                                            >
                                                {otherParticipants.map((participant: any) => (
                                                    <div
                                                        key={participant.session_id}
                                                        className="relative bg-gray-800 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all shadow-lg border border-gray-700"
                                                        style={{ height: isMobile ? '90px' : '150px' }}
                                                        onClick={() => setManualFeaturedId(participant.session_id)}
                                                        title="Clic para ver en grande"
                                                    >
                                                        <video
                                                            id={`video-thumb-${participant.session_id}`}
                                                            ref={(el) => updateVideoSource(el!, participant)}
                                                            autoPlay
                                                            playsInline
                                                            muted={participant.local}
                                                            className="w-full h-full object-cover"
                                                        />
                                                        <div className="absolute bottom-1 left-1 bg-black bg-opacity-70 px-2 py-0.5 rounded text-[10px] sm:text-xs">
                                                            <span className="text-white truncate max-w-[90px] block">
                                                                {participant.user_name || 'Usuario'}
                                                                {participant.local && ' (Tú)'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            }
                        }
                    })()}
                </div>

                {/* Room info - Top Left */}
                <div className="absolute top-4 left-4 bg-black bg-opacity-60 px-4 py-2 rounded-lg z-50 flex flex-col gap-1">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                        <span className="text-white font-medium">Sala: {roomId}</span>
                        <span className="text-gray-300 text-sm">({participants.length} participante{participants.length !== 1 ? 's' : ''})</span>
                    </div>

                    {/* Network Quality Indicator */}
                    <div className="flex items-center gap-2 mt-1 pl-5">
                        <Signal className={`w-3 h-3 ${networkQuality === 'good' ? 'text-green-500' :
                            networkQuality === 'low' ? 'text-yellow-500' : 'text-red-500'
                            }`} />
                        <span className={`text-xs ${networkQuality === 'good' ? 'text-gray-400' :
                            networkQuality === 'low' ? 'text-yellow-500' : 'text-red-500'
                            }`}>
                            {networkQuality === 'good' ? 'Conexión estable' :
                                networkQuality === 'low' ? 'Conexión inestable' : 'Conexión crítica'}
                        </span>
                    </div>
                </div>

                {/* Bottom Controls Bar (Mobile & Desktop Unified) */}
                <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-center gap-4 bg-gray-900 bg-opacity-90 px-6 py-3 rounded-2xl z-50 border border-gray-800 shadow-xl">
                    <button
                        onClick={toggleMute}
                        className={`p-3 rounded-full transition-all ${isMuted ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600'}`}
                        title={isMuted ? 'Activar micrófono' : 'Silenciar micrófono'}
                    >
                        {isMuted ? <MicOff className="w-5 h-5 text-white" /> : <Mic className="w-5 h-5 text-white" />}
                    </button>

                    <button
                        onClick={toggleVideo}
                        className={`p-3 rounded-full transition-all ${isVideoOff ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600'}`}
                        title={isVideoOff ? 'Activar cámara' : 'Desactivar cámara'}
                    >
                        {isVideoOff ? <VideoOff className="w-5 h-5 text-white" /> : <Video className="w-5 h-5 text-white" />}
                    </button>

                    {!isMobile && (
                        <button
                            onClick={toggleScreenShare}
                            className={`p-3 rounded-full transition-all ${isScreenSharing ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 hover:bg-gray-600'}`}
                            title="Compartir pantalla"
                        >
                            {isScreenSharing ? <MonitorOff className="w-5 h-5 text-white" /> : <Monitor className="w-5 h-5 text-white" />}
                        </button>
                    )}

                    <button
                        onClick={() => setIsChatOpen(!isChatOpen)}
                        className={`p-3 rounded-full transition-all ${isChatOpen ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 hover:bg-gray-600'}`}
                        title="Chat"
                    >
                        <MessageSquare className="w-5 h-5 text-white" />
                        {/* Unread badge logic could go here */}
                    </button>

                    <button
                        onClick={toggleMinimizeCall}
                        className="p-3 bg-gray-700 hover:bg-gray-600 rounded-full transition-all"
                        title="Minimizar"
                    >
                        <Minimize2 className="w-5 h-5 text-white" />
                    </button>

                    <button
                        onClick={handleEndCall}
                        className="p-3 bg-red-600 hover:bg-red-700 rounded-full transition-all"
                        title="Colgar"
                    >
                        <PhoneOff className="w-5 h-5 text-white" />
                    </button>
                </div>
            </div>

            {/* Chat sidebar */}
            {isChatOpen && (
                <div className={`${isMobile ? 'w-full absolute inset-0 z-40' : 'w-96 border-l'} bg-gray-800 border-gray-700 flex flex-col flex-shrink-0 transition-all duration-300`}>
                    <div className="p-4 bg-gray-900 border-b border-gray-700 flex items-center justify-between flex-shrink-0">
                        <h3 className="text-white font-semibold text-lg">Chat</h3>
                        <button
                            onClick={() => setIsChatOpen(false)}
                            className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-800"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="flex-1 min-h-0">
                        <ChatBox roomId={roomId} messages={chatMessages} setMessages={setChatMessages} />
                    </div>
                </div>
            )}

            {/* Toast notifications */}
            {toast && (
                <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
                    <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
                </div>
            )}
        </div>
    );
};

export default VideoRoom;
