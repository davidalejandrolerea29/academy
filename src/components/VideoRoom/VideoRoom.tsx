import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import ChatBox, { Message } from './ChatBox';
import Toast from './Toast';
import {
    PhoneOff, Minimize2, Maximize2, MessageSquare, X, Move
} from 'lucide-react';

// Declarar el tipo global de JitsiMeetExternalAPI
declare global {
    interface Window {
        JitsiMeetExternalAPI: any;
    }
}

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
    isTeacher,
    isCallMinimized,
    toggleMinimizeCall,
    handleCallCleanup,
}) => {
    const { currentUser } = useAuth();
    const [jitsiApi, setJitsiApi] = useState<any>(null);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [chatMessages, setChatMessages] = useState<Message[]>([]);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
    const jitsiContainerRef = useRef<HTMLDivElement>(null);

    // Widget dragging state
    const [widgetPosition, setWidgetPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const widgetRef = useRef<HTMLDivElement>(null);

    const JITSI_DOMAIN = 'meet.jit.si';

    // Initialize widget position when minimized
    useEffect(() => {
        if (isCallMinimized && widgetPosition.x === 0 && widgetPosition.y === 0) {
            const widgetWidth = 320;
            const widgetHeight = 240;
            setWidgetPosition({
                x: window.innerWidth - widgetWidth - 20,
                y: window.innerHeight - widgetHeight - 20,
            });
        }
    }, [isCallMinimized, widgetPosition]);

    // Dragging handlers
    const startDragging = (clientX: number, clientY: number) => {
        if (!widgetRef.current) return;
        const rect = widgetRef.current.getBoundingClientRect();
        setDragOffset({
            x: clientX - rect.left,
            y: clientY - rect.top,
        });
        setIsDragging(true);
    };

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
        if (!isDragging) return;
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        const newX = clientX - dragOffset.x;
        const newY = clientY - dragOffset.y;

        const widgetWidth = widgetRef.current?.offsetWidth || 320;
        const widgetHeight = widgetRef.current?.offsetHeight || 240;

        const maxX = window.innerWidth - widgetWidth;
        const maxY = window.innerHeight - widgetHeight;

        setWidgetPosition({
            x: Math.max(0, Math.min(newX, maxX)),
            y: Math.max(0, Math.min(newY, maxY)),
        });

        if ('touches' in e) {
            e.preventDefault();
        }
    };

    const stopDragging = () => {
        setIsDragging(false);
    };

    useEffect(() => {
        if (isDragging) {
            document.addEventListener('mousemove', handlePointerMove);
            document.addEventListener('mouseup', stopDragging);
            document.addEventListener('touchmove', handlePointerMove, { passive: false });
            document.addEventListener('touchend', stopDragging);

            return () => {
                document.removeEventListener('mousemove', handlePointerMove);
                document.removeEventListener('mouseup', stopDragging);
                document.removeEventListener('touchmove', handlePointerMove);
                document.removeEventListener('touchend', stopDragging);
            };
        }
    }, [isDragging]);

    // Initialize Jitsi External API
    useEffect(() => {
        if (!jitsiContainerRef.current || !window.JitsiMeetExternalAPI) {
            console.error('[Jitsi] External API not loaded');
            return;
        }

        const options = {
            roomName: `academy-room-${roomId}`,
            width: '100%',
            height: '100%',
            parentNode: jitsiContainerRef.current,
            configOverwrite: {
                startWithAudioMuted: false,
                startWithVideoMuted: false,
                prejoinPageEnabled: false,
                disableDeepLinking: true,
            },
            interfaceConfigOverwrite: {
                SHOW_JITSI_WATERMARK: false,
                SHOW_WATERMARK_FOR_GUESTS: false,
            },
            userInfo: {
                displayName: currentUser?.name || 'Usuario',
                email: currentUser?.email || '',
            },
        };

        const api = new window.JitsiMeetExternalAPI(JITSI_DOMAIN, options);
        setJitsiApi(api);

        // Event listeners
        api.addEventListener('videoConferenceJoined', () => {
            console.log('[Jitsi] Conference joined');
            setToast({ message: 'Conectado a la sala', type: 'success' });
        });

        api.addEventListener('participantJoined', (event: any) => {
            console.log('[Jitsi] Participant joined:', event);
            setToast({ message: `${event.displayName} se unió`, type: 'info' });
        });

        api.addEventListener('participantLeft', (event: any) => {
            console.log('[Jitsi] Participant left:', event);
            setToast({ message: `${event.displayName} salió`, type: 'info' });
        });

        api.addEventListener('videoConferenceLeft', () => {
            console.log('[Jitsi] Conference left');
            handleEndCall();
        });

        api.addEventListener('readyToClose', () => {
            console.log('[Jitsi] Ready to close');
            handleEndCall();
        });

        return () => {
            if (api) {
                api.dispose();
            }
        };
    }, [roomId, currentUser]);

    const handleEndCall = () => {
        console.log('[Jitsi] Ending call');

        if (jitsiApi) {
            try {
                jitsiApi.dispose();
            } catch (error) {
                console.error('[Jitsi] Error disposing API:', error);
            }
        }

        handleCallCleanup();
        onCallEnded();
    };

    // Minimized widget view
    if (isCallMinimized) {
        return (
            <div
                ref={widgetRef}
                className="fixed z-50 bg-gray-900 rounded-lg shadow-2xl overflow-hidden"
                style={{
                    left: `${widgetPosition.x}px`,
                    top: `${widgetPosition.y}px`,
                    width: '320px',
                    height: '240px',
                }}
            >
                {/* Drag handle */}
                <div
                    className="bg-gray-800 p-2 flex items-center justify-between cursor-move"
                    onMouseDown={(e) => startDragging(e.clientX, e.clientY)}
                    onTouchStart={(e) => startDragging(e.touches[0].clientX, e.touches[0].clientY)}
                >
                    <div className="flex items-center gap-2">
                        <Move className="w-4 h-4 text-gray-400" />
                        <span className="text-white text-sm font-medium">Llamada en curso</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={toggleMinimizeCall}
                            className="p-1 hover:bg-gray-700 rounded"
                            title="Maximizar"
                        >
                            <Maximize2 className="w-4 h-4 text-white" />
                        </button>
                        <button
                            onClick={handleEndCall}
                            className="p-1 hover:bg-red-600 rounded"
                            title="Colgar"
                        >
                            <PhoneOff className="w-4 h-4 text-white" />
                        </button>
                    </div>
                </div>

                {/* Jitsi container (minimized) */}
                <div ref={jitsiContainerRef} className="w-full h-[calc(100%-40px)]" />
            </div>
        );
    }

    // Full screen view
    return (
        <div className="flex h-screen bg-gray-900">
            {/* Main video area */}
            <div className="flex-1 flex flex-col">
                {/* Jitsi Meeting Container */}
                <div className="flex-1 relative">
                    <div ref={jitsiContainerRef} className="w-full h-full" />

                    {/* Custom controls overlay */}
                    <div className="absolute top-4 right-4 flex gap-2 z-10">
                        <button
                            onClick={() => setIsChatOpen(!isChatOpen)}
                            className="p-3 bg-gray-800 bg-opacity-75 hover:bg-opacity-100 rounded-full transition-all"
                            title="Chat"
                        >
                            <MessageSquare className="w-5 h-5 text-white" />
                        </button>
                        <button
                            onClick={toggleMinimizeCall}
                            className="p-3 bg-gray-800 bg-opacity-75 hover:bg-opacity-100 rounded-full transition-all"
                            title="Minimizar"
                        >
                            <Minimize2 className="w-5 h-5 text-white" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Chat sidebar using existing ChatBox */}
            {isChatOpen && (
                <div className="w-80 bg-gray-800 border-l border-gray-700">
                    <div className="h-full flex flex-col">
                        <div className="p-4 bg-gray-900 border-b border-gray-700 flex items-center justify-between">
                            <h3 className="text-white font-semibold">Chat</h3>
                            <button
                                onClick={() => setIsChatOpen(false)}
                                className="p-1 hover:bg-gray-700 rounded"
                            >
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>
                        <ChatBox
                            roomId={roomId}
                            messages={chatMessages}
                            setMessages={setChatMessages}
                        />
                    </div>
                </div>
            )}

            {/* Toast notifications */}
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
        </div>
    );
};

export default VideoRoom;
