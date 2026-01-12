import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import ChatBox, { Message } from './ChatBox';
import Toast from './Toast';
import { MessageSquare, X, ExternalLink } from 'lucide-react';

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
}) => {
    const { currentUser } = useAuth();
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [chatMessages, setChatMessages] = useState<Message[]>([]);
    const [jitsiWindow, setJitsiWindow] = useState<Window | null>(null);

    const openJitsiInNewWindow = () => {
        const jitsiUrl = `https://meet.jit.si/academy-room-${roomId}#userInfo.displayName="${encodeURIComponent(currentUser?.name || 'Usuario')}"`;

        const width = 1200;
        const height = 800;
        const left = (window.screen.width - width) / 2;
        const top = (window.screen.height - height) / 2;

        const newWindow = window.open(
            jitsiUrl,
            'JitsiMeet',
            `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
        );

        setJitsiWindow(newWindow);

        // Check if window was closed
        const checkClosed = setInterval(() => {
            if (newWindow && newWindow.closed) {
                clearInterval(checkClosed);
                setJitsiWindow(null);
                onCallEnded();
            }
        }, 1000);
    };

    return (
        <div className="flex h-screen bg-gray-900">
            {/* Main area */}
            <div className="flex-1 flex flex-col items-center justify-center p-8">
                <div className="max-w-2xl w-full bg-gray-800 rounded-lg shadow-2xl p-8">
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold text-white mb-4">
                            Sala de Videollamada
                        </h1>
                        <p className="text-gray-400 mb-2">
                            Sala: <span className="text-orange-500 font-mono">academy-room-{roomId}</span>
                        </p>
                        <p className="text-gray-400">
                            Usuario: <span className="text-blue-400">{currentUser?.name}</span>
                        </p>
                    </div>

                    <div className="space-y-4">
                        {!jitsiWindow ? (
                            <>
                                <button
                                    onClick={openJitsiInNewWindow}
                                    className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-4 px-6 rounded-lg flex items-center justify-center gap-3 transition-all transform hover:scale-105"
                                >
                                    <ExternalLink className="w-6 h-6" />
                                    Unirse a la Videollamada
                                </button>

                                <div className="bg-blue-900 bg-opacity-30 border border-blue-500 rounded-lg p-4">
                                    <p className="text-blue-300 text-sm">
                                        💡 <strong>Nota:</strong> La videollamada se abrirá en una nueva ventana usando Jitsi Meet.
                                        Esto evita problemas de bloqueo de recursos.
                                    </p>
                                </div>
                            </>
                        ) : (
                            <div className="bg-green-900 bg-opacity-30 border border-green-500 rounded-lg p-6 text-center">
                                <p className="text-green-300 text-lg mb-4">
                                    ✅ Videollamada activa en otra ventana
                                </p>
                                <p className="text-gray-400 text-sm mb-4">
                                    Si no ves la ventana, búscala en tu barra de tareas o minimizada.
                                </p>
                                <button
                                    onClick={() => jitsiWindow?.focus()}
                                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg"
                                >
                                    Enfocar Ventana
                                </button>
                            </div>
                        )}

                        <button
                            onClick={() => setIsChatOpen(!isChatOpen)}
                            className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg flex items-center justify-center gap-3 transition-all"
                        >
                            <MessageSquare className="w-5 h-5" />
                            {isChatOpen ? 'Ocultar Chat' : 'Abrir Chat'}
                        </button>
                    </div>

                    <div className="mt-8 bg-yellow-900 bg-opacity-30 border border-yellow-500 rounded-lg p-4">
                        <p className="text-yellow-300 text-sm">
                            ⚠️ <strong>Solución Temporal:</strong> Debido a problemas de bloqueo de recursos (AdBlock, extensiones),
                            la videollamada se abre en una ventana separada. Esto garantiza que Jitsi funcione correctamente.
                        </p>
                    </div>
                </div>
            </div>

            {/* Chat sidebar */}
            {isChatOpen && (
                <div className="w-96 bg-gray-800 border-l border-gray-700 shadow-2xl">
                    <div className="h-full flex flex-col">
                        <div className="p-4 bg-gray-900 border-b border-gray-700 flex items-center justify-between">
                            <h3 className="text-white font-semibold flex items-center gap-2">
                                <MessageSquare className="w-5 h-5" />
                                Chat de la Sala
                            </h3>
                            <button
                                onClick={() => setIsChatOpen(false)}
                                className="p-1 hover:bg-gray-700 rounded transition-all"
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
        </div>
    );
};

export default VideoRoom;
