// VideoRoom component using Jitsi Meet
import React, { useEffect, useRef, useState } from 'react';
import { JitsiMeeting } from '@jitsi/react-sdk';
import { useAuth } from '../../contexts/AuthContext';
import { useCall } from '../../contexts/CallContext';
import ChatBox, { Message } from './ChatBox';
import Toast from './Toast';
import { createReverbWebSocketService, EchoChannel } from '../../services/ReverbWebSocketService';
import {
    PhoneOff, Minimize2, Maximize2, MessageSquare, X, Move
} from 'lucide-react';

interface VideoRoomJitsiProps {
    roomId: string;
    onCallEnded: () => void;
    isTeacher: boolean;
    isCallMinimized: boolean;
    toggleMinimizeCall: () => void;
    handleCallCleanup: () => void;
}

const VideoRoomJitsi: React.FC<VideoRoomJitsiProps> = ({
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
    const [participantCount, setParticipantCount] = useState(1);

    // Reverb for chat (optional - Jitsi has its own chat)
    const channelRef = useRef<EchoChannel | null>(null);
    const reverbServiceRef = useRef(createReverbWebSocketService(currentUser?.token || ''));

    // Widget dragging state
    const [widgetPosition, setWidgetPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const widgetRef = useRef<HTMLDivElement>(null);

    const JITSI_DOMAIN = import.meta.env.VITE_JITSI_DOMAIN || 'meet.jit.si';

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
    }, [isDragging, handlePointerMove]);

    // Jitsi API ready handler
    const handleApiReady = (api: any) => {
        setJitsiApi(api);
        console.log('[Jitsi] API ready');

        // Listen to participant events
        api.addEventListener('participantJoined', (event: any) => {
            console.log('[Jitsi] Participant joined:', event);
            setToast({ message: `${event.displayName} se unió a la llamada`, type: 'info' });
            setParticipantCount((prev) => prev + 1);
        });

        api.addEventListener('participantLeft', (event: any) => {
            console.log('[Jitsi] Participant left:', event);
            setToast({ message: `${event.displayName} salió de la llamada`, type: 'info' });
            setParticipantCount((prev) => Math.max(1, prev - 1));
        });

        api.addEventListener('videoConferenceJoined', (event: any) => {
            console.log('[Jitsi] Conference joined:', event);
            setToast({ message: 'Conectado a la sala', type: 'success' });
        });

        api.addEventListener('videoConferenceLeft', () => {
            console.log('[Jitsi] Conference left');
            handleEndCall();
        });

        api.addEventListener('readyToClose', () => {
            console.log('[Jitsi] Ready to close');
            handleEndCall();
        });
    };

    const handleEndCall = () => {
        console.log('[Jitsi] Ending call');

        if (jitsiApi) {
            try {
                jitsiApi.dispose();
            } catch (error) {
                console.error('[Jitsi] Error disposing API:', error);
            }
        }

        if (channelRef.current) {
            channelRef.current.leave();
            channelRef.current = null;
        }

        handleCallCleanup();
        onCallEnded();
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (jitsiApi) {
                try {
                    jitsiApi.dispose();
                } catch (error) {
                    console.error('[Jitsi] Error disposing on unmount:', error);
                }
            }
        };
    }, [jitsiApi]);

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

                {/* Jitsi iframe (minimized) */}
                <div className="w-full h-[calc(100%-40px)]">
                    <JitsiMeeting
                        domain={JITSI_DOMAIN}
                        roomName={`academy-room-${roomId}`}
                        configOverwrite={{
                            startWithAudioMuted: false,
                            startWithVideoMuted: false,
                            prejoinPageEnabled: false,
                            disableDeepLinking: true,
                        }}
                        interfaceConfigOverwrite={{
                            SHOW_JITSI_WATERMARK: false,
                            SHOW_WATERMARK_FOR_GUESTS: false,
                            DISABLE_JOIN_LEAVE_NOTIFICATIONS: false,
                        }}
                        userInfo={{
                            displayName: currentUser?.name || 'Usuario',
                            email: currentUser?.email,
                        }}
                        onApiReady={handleApiReady}
                        getIFrameRef={(iframeRef) => {
                            if (iframeRef) {
                                iframeRef.style.height = '100%';
                                iframeRef.style.width = '100%';
                            }
                        }}
                    />
                </div>
            </div>
        );
    }

    // Full screen view
    return (
        <div className="flex h-screen bg-gray-900">
            {/* Main video area */}
            <div className="flex-1 flex flex-col">
                {/* Jitsi Meeting */}
                <div className="flex-1 relative">
                    <JitsiMeeting
                        domain={JITSI_DOMAIN}
                        roomName={`academy-room-${roomId}`}
                        configOverwrite={{
                            startWithAudioMuted: false,
                            startWithVideoMuted: false,
                            prejoinPageEnabled: false,
                            disableDeepLinking: true,
                            enableWelcomePage: false,
                            enableClosePage: false,
                        }}
                        interfaceConfigOverwrite={{
                            SHOW_JITSI_WATERMARK: false,
                            SHOW_WATERMARK_FOR_GUESTS: false,
                            DISABLE_JOIN_LEAVE_NOTIFICATIONS: false,
                            TOOLBAR_BUTTONS: [
                                'microphone',
                                'camera',
                                'closedcaptions',
                                'desktop',
                                'fullscreen',
                                'fodeviceselection',
                                'hangup',
                                'profile',
                                'chat',
                                'recording',
                                'livestreaming',
                                'etherpad',
                                'sharedvideo',
                                'settings',
                                'raisehand',
                                'videoquality',
                                'filmstrip',
                                'feedback',
                                'stats',
                                'shortcuts',
                                'tileview',
                                'download',
                                'help',
                                'mute-everyone',
                            ],
                        }}
                        userInfo={{
                            displayName: currentUser?.name || 'Usuario',
                            email: currentUser?.email,
                        }}
                        onApiReady={handleApiReady}
                        getIFrameRef={(iframeRef) => {
                            if (iframeRef) {
                                iframeRef.style.height = '100%';
                                iframeRef.style.width = '100%';
                            }
                        }}
                    />

                    {/* Custom controls overlay (optional) */}
                    <div className="absolute top-4 right-4 flex gap-2 z-10">
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

            {/* Optional: Custom chat sidebar using Reverb */}
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
                            messages={chatMessages}
                            onSendMessage={(message) => {
                                // Implement Reverb chat if needed
                                console.log('Send message:', message);
                            }}
                            currentUserId={currentUser?.id || ''}
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

export default VideoRoomJitsi;
