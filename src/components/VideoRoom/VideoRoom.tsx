import React, { useEffect, useCallback, useState } from 'react';
import { DailyProvider, useDaily, useParticipantIds, useScreenShare, useLocalParticipant } from '@daily-co/daily-react';
import DailyIframe from '@daily-co/daily-js';
import { useAuth } from '../../contexts/AuthContext';
import ChatBox, { Message } from './ChatBox';
import Toast from './Toast';
import {
    PhoneOff, Minimize2, Maximize2, MessageSquare, X, Move, Mic, MicOff, Video, VideoOff, Monitor, MonitorOff
} from 'lucide-react';

interface VideoRoomProps {
    roomId: string;
    onCallEnded: () => void;
    isTeacher: boolean;
    isCallMinimized: boolean;
    toggleMinimizeCall: () => void;
    handleCallCleanup: () => void;
}

// Daily.co room component
const DailyVideoRoom: React.FC<Omit<VideoRoomProps, 'isTeacher'>> = ({
    roomId,
    onCallEnded,
    isCallMinimized,
    toggleMinimizeCall,
    handleCallCleanup,
}) => {
    const { currentUser } = useAuth();
    const callObject = useDaily();
    const participantIds = useParticipantIds();
    const { isSharingScreen, startScreenShare, stopScreenShare } = useScreenShare();
    const localParticipant = useLocalParticipant();

    const [isChatOpen, setIsChatOpen] = useState(false);
    const [chatMessages, setChatMessages] = useState<Message[]>([]);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
    const [isAudioEnabled, setIsAudioEnabled] = useState(true);
    const [isVideoEnabled, setIsVideoEnabled] = useState(true);

    // Widget dragging state
    const [widgetPosition, setWidgetPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    // Initialize widget position
    useEffect(() => {
        if (isCallMinimized && widgetPosition.x === 0 && widgetPosition.y === 0) {
            setWidgetPosition({
                x: window.innerWidth - 340,
                y: window.innerHeight - 260,
            });
        }
    }, [isCallMinimized, widgetPosition]);

    // Event listeners
    useEffect(() => {
        if (!callObject) return;

        const events = {
            'joined-meeting': () => {
                console.log('[Daily] Joined meeting');
                setToast({ message: 'Conectado a la sala', type: 'success' });
            },
            'participant-joined': (event: any) => {
                console.log('[Daily] Participant joined:', event);
                setToast({ message: `${event.participant.user_name} se unió`, type: 'info' });
            },
            'participant-left': (event: any) => {
                console.log('[Daily] Participant left:', event);
                setToast({ message: `${event.participant.user_name} salió`, type: 'info' });
            },
            'left-meeting': () => {
                console.log('[Daily] Left meeting');
                handleEndCall();
            },
        };

        Object.entries(events).forEach(([event, handler]) => {
            callObject.on(event as any, handler);
        });

        return () => {
            Object.entries(events).forEach(([event, handler]) => {
                callObject.off(event as any, handler);
            });
        };
    }, [callObject]);

    const handleEndCall = useCallback(() => {
        if (callObject) {
            callObject.leave();
        }
        handleCallCleanup();
        onCallEnded();
    }, [callObject, handleCallCleanup, onCallEnded]);

    const toggleAudio = useCallback(() => {
        if (callObject) {
            callObject.setLocalAudio(!isAudioEnabled);
            setIsAudioEnabled(!isAudioEnabled);
        }
    }, [callObject, isAudioEnabled]);

    const toggleVideo = useCallback(() => {
        if (callObject) {
            callObject.setLocalVideo(!isVideoEnabled);
            setIsVideoEnabled(!isVideoEnabled);
        }
    }, [callObject, isVideoEnabled]);

    const toggleScreenShare = useCallback(() => {
        if (isSharingScreen) {
            stopScreenShare();
        } else {
            startScreenShare();
        }
    }, [isSharingScreen, startScreenShare, stopScreenShare]);

    // Minimized widget view
    if (isCallMinimized) {
        return (
            <div
                className="fixed z-50 bg-gray-900 rounded-lg shadow-2xl overflow-hidden"
                style={{
                    left: `${widgetPosition.x}px`,
                    top: `${widgetPosition.y}px`,
                    width: '320px',
                    height: '240px',
                }}
            >
                <div className="bg-gray-800 p-2 flex items-center justify-between cursor-move">
                    <div className="flex items-center gap-2">
                        <Move className="w-4 h-4 text-gray-400" />
                        <span className="text-white text-sm font-medium">Llamada en curso</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={toggleMinimizeCall} className="p-1 hover:bg-gray-700 rounded">
                            <Maximize2 className="w-4 h-4 text-white" />
                        </button>
                        <button onClick={handleEndCall} className="p-1 hover:bg-red-600 rounded">
                            <PhoneOff className="w-4 h-4 text-white" />
                        </button>
                    </div>
                </div>
                <div className="w-full h-[calc(100%-40px)] bg-gray-950 flex items-center justify-center">
                    <p className="text-gray-400 text-sm">Llamada minimizada</p>
                </div>
            </div>
        );
    }

    // Full screen view
    return (
        <div className="flex h-screen bg-gray-900">
            <div className="flex-1 flex flex-col">
                {/* Video Grid */}
                <div className="flex-1 relative bg-gray-950 p-4">
                    <div className="grid grid-cols-2 gap-4 h-full">
                        {participantIds.map((id) => (
                            <div key={id} className="relative bg-gray-800 rounded-lg overflow-hidden">
                                <video
                                    id={`video-${id}`}
                                    autoPlay
                                    muted={id === localParticipant?.session_id}
                                    playsInline
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        ))}
                    </div>

                    {/* Controls overlay */}
                    <div className="absolute top-4 right-4 flex gap-2 z-10">
                        <button
                            onClick={() => setIsChatOpen(!isChatOpen)}
                            className="p-3 bg-gray-800 bg-opacity-75 hover:bg-opacity-100 rounded-full transition-all"
                        >
                            <MessageSquare className="w-5 h-5 text-white" />
                        </button>
                        <button
                            onClick={toggleMinimizeCall}
                            className="p-3 bg-gray-800 bg-opacity-75 hover:bg-opacity-100 rounded-full transition-all"
                        >
                            <Minimize2 className="w-5 h-5 text-white" />
                        </button>
                    </div>

                    {/* Bottom controls */}
                    <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex gap-4">
                        <button
                            onClick={toggleAudio}
                            className={`p-4 rounded-full transition-all ${isAudioEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'
                                }`}
                        >
                            {isAudioEnabled ? <Mic className="w-6 h-6 text-white" /> : <MicOff className="w-6 h-6 text-white" />}
                        </button>
                        <button
                            onClick={toggleVideo}
                            className={`p-4 rounded-full transition-all ${isVideoEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'
                                }`}
                        >
                            {isVideoEnabled ? <Video className="w-6 h-6 text-white" /> : <VideoOff className="w-6 h-6 text-white" />}
                        </button>
                        <button
                            onClick={toggleScreenShare}
                            className={`p-4 rounded-full transition-all ${isSharingScreen ? 'bg-orange-600 hover:bg-orange-700' : 'bg-gray-700 hover:bg-gray-600'
                                }`}
                        >
                            {isSharingScreen ? <MonitorOff className="w-6 h-6 text-white" /> : <Monitor className="w-6 h-6 text-white" />}
                        </button>
                        <button
                            onClick={handleEndCall}
                            className="p-4 bg-red-600 hover:bg-red-700 rounded-full transition-all"
                        >
                            <PhoneOff className="w-6 h-6 text-white" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Chat sidebar */}
            {isChatOpen && (
                <div className="w-80 bg-gray-800 border-l border-gray-700">
                    <div className="h-full flex flex-col">
                        <div className="p-4 bg-gray-900 border-b border-gray-700 flex items-center justify-between">
                            <h3 className="text-white font-semibold">Chat</h3>
                            <button onClick={() => setIsChatOpen(false)} className="p-1 hover:bg-gray-700 rounded">
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>
                        <ChatBox roomId={roomId} messages={chatMessages} setMessages={setChatMessages} />
                    </div>
                </div>
            )}

            {/* Toast */}
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

// Main component with Daily provider
const VideoRoom: React.FC<VideoRoomProps> = (props) => {
    const { currentUser } = useAuth();
    const { roomId } = props;
    const [callObject, setCallObject] = useState<DailyIframe | null>(null);

    useEffect(() => {
        // Get Daily domain from environment variable
        const dailyDomain = import.meta.env.VITE_DAILY_DOMAIN || 'academy.daily.co';
        const roomUrl = `https://${dailyDomain.includes('.') ? dailyDomain : `${dailyDomain}.daily.co`}/${roomId}`;

        const newCallObject = DailyIframe.createCallObject({
            url: roomUrl,
            userName: currentUser?.name || 'Usuario',
        });

        setCallObject(newCallObject);

        // Join the call
        newCallObject.join();

        return () => {
            newCallObject.destroy();
        };
    }, [roomId, currentUser]);

    if (!callObject) {
        return (
            <div className="flex h-screen bg-gray-900 items-center justify-center">
                <div className="text-white text-xl">Conectando a la sala...</div>
            </div>
        );
    }

    return (
        <DailyProvider callObject={callObject}>
            <DailyVideoRoom {...props} />
        </DailyProvider>
    );
};

export default VideoRoom;
