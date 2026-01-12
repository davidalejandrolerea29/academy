import React, { useState, useEffect, useRef } from 'react';
import DailyIframe from '@daily-co/daily-js';
import { MessageSquare, X, PhoneOff, Monitor, MonitorOff } from 'lucide-react';
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
}) => {
    const { currentUser } = useAuth();
    const [callObject, setCallObject] = useState<any>(null);
    const [isCreatingRoom, setIsCreatingRoom] = useState(false);
    const [roomError, setRoomError] = useState<string | null>(null);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [chatMessages, setChatMessages] = useState<Message[]>([]);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
    const [participants, setParticipants] = useState<any[]>([]);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const videoContainerRef = useRef<HTMLDivElement>(null);

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
        if (!callObject || !videoContainerRef.current) return;

        participants.forEach((participant: any) => {
            const videoEl = document.getElementById(`video-${participant.session_id}`) as HTMLVideoElement;
            if (videoEl && participant.tracks?.video?.persistentTrack) {
                const stream = new MediaStream([participant.tracks.video.persistentTrack]);
                if (participant.tracks?.audio?.persistentTrack && !participant.local) {
                    stream.addTrack(participant.tracks.audio.persistentTrack);
                }
                videoEl.srcObject = stream;
            }
        });
    }, [participants, callObject]);

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

        // Navigate back to rooms list
        window.location.href = '/rooms';
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

    return (
        <div className="flex h-screen bg-gray-900 overflow-hidden">
            {/* Main video area */}
            <div className="flex-1 flex flex-col min-w-0">
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

                {/* Bottom control bar */}
                <div className="bg-gray-800 border-t border-gray-700 p-4 flex-shrink-0">
                    <div className="flex items-center justify-between max-w-4xl mx-auto">
                        {/* Left side - Room info */}
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="text-white font-medium">Sala: {roomId}</span>
                            <span className="text-gray-400 text-sm">({participants.length} participante{participants.length !== 1 ? 's' : ''})</span>
                        </div>

                        {/* Center - Main controls */}
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setIsChatOpen(!isChatOpen)}
                                className={`p-3 rounded-lg transition-all ${isChatOpen
                                    ? 'bg-orange-600 hover:bg-orange-700'
                                    : 'bg-gray-700 hover:bg-gray-600'
                                    }`}
                                title="Chat"
                            >
                                <MessageSquare className="w-5 h-5 text-white" />
                            </button>

                            <button
                                onClick={toggleScreenShare}
                                className={`p-3 rounded-lg transition-all ${isScreenSharing
                                    ? 'bg-blue-600 hover:bg-blue-700'
                                    : 'bg-gray-700 hover:bg-gray-600'
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
                                onClick={handleEndCall}
                                className="p-3 bg-red-600 hover:bg-red-700 rounded-lg transition-all"
                                title="Colgar"
                            >
                                <PhoneOff className="w-5 h-5 text-white" />
                            </button>
                        </div>

                        {/* Right side - User info */}
                        <div className="text-gray-400 text-sm">
                            {currentUser?.name || 'Usuario'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Chat sidebar */}
            {isChatOpen && (
                <div className="w-96 bg-gray-800 border-l border-gray-700 flex flex-col flex-shrink-0">
                    <div className="p-4 bg-gray-900 border-b border-gray-700 flex items-center justify-between flex-shrink-0">
                        <h3 className="text-white font-semibold text-lg">Chat</h3>
                        <button
                            onClick={() => setIsChatOpen(false)}
                            className="p-2 hover:bg-gray-700 rounded-lg transition-all"
                        >
                            <X className="w-5 h-5 text-gray-400" />
                        </button>
                    </div>
                    <div className="flex-1 min-h-0">
                        <ChatBox roomId={roomId} messages={chatMessages} setMessages={setChatMessages} />
                    </div>
                </div>
            )}

            {/* Toast notifications */}
            {toast && (
                <div className="fixed top-4 right-4 z-50">
                    <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
                </div>
            )}
        </div>
    );
};

export default VideoRoom;
