import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import DailyIframe from '@daily-co/daily-js';
import { MessageSquare, X, PhoneOff, Monitor, MonitorOff, Minimize2, Maximize2 } from 'lucide-react';
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
}) => {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const [callObject, setCallObject] = useState<any>(null);
    const [isCreatingRoom, setIsCreatingRoom] = useState(false);
    const [roomError, setRoomError] = useState<string | null>(null);
    const [chatMessages, setChatMessages] = useState<Message[]>([]);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
    const [participants, setParticipants] = useState<any[]>([]);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
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
                });

                setIsCreatingRoom(false);
                setToast({ message: 'Conectado a la sala', type: 'success' });

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

                call.on('left-meeting', () => {
                    console.log('[Daily] Left meeting');
                    handleEndCall();
                });

                // Initial participant update
                updateParticipants(call);

            } catch (error: any) {
                console.error('[Daily] Error creating room:', error);
                if (mounted) {
                    setRoomError(error.message || 'Error al crear la sala');
                    setIsCreatingRoom(false);
                }
            }
        };

        const updateParticipants = (call: any) => {
            const parts = call.participants();
            const participantList = Object.values(parts);
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

    // Update video elements when participants change
    useEffect(() => {
        if (!callObject) return;

        participants.forEach((participant: any) => {
            // Update both full-screen and minimized video elements
            const videoIds = [
                `video-${participant.session_id}`,
                `video-mini-${participant.session_id}`
            ];

            videoIds.forEach(videoId => {
                const videoEl = document.getElementById(videoId) as HTMLVideoElement;
                if (videoEl) {
                    const tracks = [];

                    // Check for screen share first (priority)
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
                        videoEl.srcObject = new MediaStream(tracks);
                    }
                }
            });
        });
    }, [participants, callObject, isCallMinimized]);

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
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="text-white text-sm font-medium">Sala: {roomId}</span>
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
        <div className="flex h-screen bg-gray-900 overflow-hidden">
            {/* Main video area */}
            <div className="flex-1 flex flex-col min-w-0 relative">
                {/* Video grid */}
                <div className="flex-1 relative bg-black p-4" ref={videoContainerRef}>
                    <div className={`grid gap-4 h-full ${participants.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                        {participants.map((participant: any) => (
                            <div key={participant.session_id} className="relative bg-gray-800 rounded-lg overflow-hidden">
                                <video
                                    id={`video-${participant.session_id}`}
                                    autoPlay
                                    playsInline
                                    muted={participant.local}
                                    className="w-full h-full object-cover"
                                />
                                <div className="absolute bottom-4 left-4 bg-black bg-opacity-60 px-3 py-2 rounded-lg">
                                    <span className="text-white font-medium">
                                        {participant.user_name || 'Usuario'}
                                        {participant.local && ' (Tú)'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Room info - Top Left */}
                <div className="absolute top-4 left-4 bg-black bg-opacity-60 px-4 py-2 rounded-lg z-50">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-white font-medium">Sala: {roomId}</span>
                        <span className="text-gray-300 text-sm">({participants.length} participante{participants.length !== 1 ? 's' : ''})</span>
                    </div>
                </div>

                {/* Floating controls overlay - Top Right */}
                <div className="absolute top-4 right-4 flex gap-2 z-50">
                    <button
                        onClick={toggleScreenShare}
                        className={`p-3 rounded-full transition-all shadow-lg ${isScreenSharing
                            ? 'bg-blue-600 hover:bg-blue-700'
                            : 'bg-gray-800 bg-opacity-75 hover:bg-opacity-100'
                            }`}
                        title={isScreenSharing ? 'Dejar de compartir' : 'Compartir pantalla'}
                    >
                        {isScreenSharing ? (
                            <MonitorOff className="w-5 h-5 text-white" />
                        ) : (
                            <Monitor className="w-5 h-5 text-white" />
                        )}
                    </button>

                    <button
                        onClick={toggleMinimizeCall}
                        className="p-3 bg-gray-800 bg-opacity-75 hover:bg-opacity-100 rounded-full transition-all shadow-lg"
                        title="Minimizar"
                    >
                        <Minimize2 className="w-5 h-5 text-white" />
                    </button>

                    <button
                        onClick={handleEndCall}
                        className="p-3 bg-red-600 hover:bg-red-700 rounded-full transition-all shadow-lg"
                        title="Colgar"
                    >
                        <PhoneOff className="w-5 h-5 text-white" />
                    </button>
                </div>
            </div>

            {/* Chat sidebar - ALWAYS OPEN */}
            <div className="w-96 bg-gray-800 border-l border-gray-700 flex flex-col flex-shrink-0">
                <div className="p-4 bg-gray-900 border-b border-gray-700 flex items-center justify-between flex-shrink-0">
                    <h3 className="text-white font-semibold text-lg">Chat</h3>
                </div>
                <div className="flex-1 min-h-0">
                    <ChatBox roomId={roomId} messages={chatMessages} setMessages={setChatMessages} />
                </div>
            </div>

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
