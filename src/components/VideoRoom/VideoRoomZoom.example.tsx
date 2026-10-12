// Example VideoRoom component using Zoom Video SDK
// This is a simplified version showing how to integrate Zoom SDK
// You can adapt your existing VideoRoom.tsx based on this pattern

import React, { useEffect, useState } from 'react';
import { useZoomVideo } from '../../hooks/useZoomVideo';
import { useAuth } from '../../contexts/AuthContext';
import ZoomVideoCanvas from './ZoomVideoCanvas';
import ChatBox, { Message } from './ChatBox';
import Toast from './Toast';
import {
    Video, VideoOff, Mic, MicOff, ScreenShare, StopCircle,
    MessageSquare, PhoneOff, Users
} from 'lucide-react';

interface VideoRoomZoomProps {
    roomId: string;
    onCallEnded: () => void;
    isTeacher: boolean;
}

export const VideoRoomZoom: React.FC<VideoRoomZoomProps> = ({
    roomId,
    onCallEnded,
    isTeacher,
}) => {
    const { currentUser } = useAuth();
    const [chatMessages, setChatMessages] = useState<Message[]>([]);
    const [isChatOpen, setIsChatOpen] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

    const {
        isInSession,
        participants,
        localUserId,
        isVideoOn,
        isAudioOn,
        isSharingScreen,
        toggleVideo,
        toggleAudio,
        startScreenShare,
        stopScreenShare,
        leaveSession,
        error,
    } = useZoomVideo({
        roomId,
        currentUser: currentUser ? {
            id: currentUser.id,
            name: currentUser.name,
            token: currentUser.token,
        } : null,
        onParticipantJoined: (name) => {
            setToast({ message: `${name} se unió a la llamada`, type: 'info' });
        },
        onParticipantLeft: (name) => {
            setToast({ message: `${name} salió de la llamada`, type: 'info' });
        },
    });

    const handleEndCall = async () => {
        try {
            await leaveSession();
            onCallEnded();
        } catch (err) {
            console.error('Error ending call:', err);
        }
    };

    const handleToggleScreenShare = async () => {
        try {
            if (isSharingScreen) {
                await stopScreenShare();
            } else {
                await startScreenShare();
            }
        } catch (err) {
            console.error('Error toggling screen share:', err);
            setToast({ message: 'Error al compartir pantalla', type: 'error' });
        }
    };

    // Show error toast
    useEffect(() => {
        if (error) {
            setToast({ message: error, type: 'error' });
        }
    }, [error]);

    if (!isInSession) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-900">
                <div className="text-white text-xl">Conectando a la sesión...</div>
            </div>
        );
    }

    const participantsList = Array.from(participants.values());
    const totalParticipants = participantsList.length + 1; // +1 for local user

    return (
        <div className="flex h-screen bg-gray-900">
            {/* Main video area */}
            <div className="flex-1 flex flex-col">
                {/* Video grid */}
                <div className="flex-1 p-4 grid gap-4" style={{
                    gridTemplateColumns: totalParticipants === 1 ? '1fr' :
                        totalParticipants === 2 ? 'repeat(2, 1fr)' :
                            totalParticipants <= 4 ? 'repeat(2, 1fr)' :
                                'repeat(3, 1fr)',
                    gridTemplateRows: totalParticipants <= 2 ? '1fr' :
                        totalParticipants <= 4 ? 'repeat(2, 1fr)' :
                            'repeat(auto-fill, minmax(200px, 1fr))',
                }}>
                    {/* Local video */}
                    {localUserId && (
                        <div className="relative bg-gray-800 rounded-lg overflow-hidden">
                            <ZoomVideoCanvas
                                userId={localUserId}
                                className="w-full h-full"
                            />
                            <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 px-2 py-1 rounded text-white text-sm">
                                {currentUser?.name} (Tú)
                            </div>
                            {!isVideoOn && (
                                <div className="absolute inset-0 flex items-center justify-center bg-gray-700">
                                    <VideoOff className="w-16 h-16 text-gray-400" />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Remote participants */}
                    {participantsList.map((participant) => (
                        <div key={participant.userId} className="relative bg-gray-800 rounded-lg overflow-hidden">
                            {participant.videoEnabled ? (
                                <ZoomVideoCanvas
                                    userId={participant.userId}
                                    className="w-full h-full"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gray-700">
                                    <VideoOff className="w-16 h-16 text-gray-400" />
                                </div>
                            )}
                            <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 px-2 py-1 rounded text-white text-sm">
                                {participant.displayName}
                            </div>
                            {!participant.audioEnabled && (
                                <div className="absolute top-2 right-2 bg-red-500 p-1 rounded">
                                    <MicOff className="w-4 h-4 text-white" />
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Controls */}
                <div className="bg-gray-800 p-4 flex items-center justify-center gap-4">
                    {/* Video toggle */}
                    <button
                        onClick={toggleVideo}
                        className={`p-4 rounded-full ${isVideoOn ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'}`}
                        title={isVideoOn ? 'Apagar cámara' : 'Encender cámara'}
                    >
                        {isVideoOn ? <Video className="w-6 h-6 text-white" /> : <VideoOff className="w-6 h-6 text-white" />}
                    </button>

                    {/* Audio toggle */}
                    <button
                        onClick={toggleAudio}
                        className={`p-4 rounded-full ${isAudioOn ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'}`}
                        title={isAudioOn ? 'Silenciar' : 'Activar micrófono'}
                    >
                        {isAudioOn ? <Mic className="w-6 h-6 text-white" /> : <MicOff className="w-6 h-6 text-white" />}
                    </button>

                    {/* Screen share */}
                    <button
                        onClick={handleToggleScreenShare}
                        className={`p-4 rounded-full ${isSharingScreen ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 hover:bg-gray-600'}`}
                        title={isSharingScreen ? 'Dejar de compartir' : 'Compartir pantalla'}
                    >
                        {isSharingScreen ? <StopCircle className="w-6 h-6 text-white" /> : <ScreenShare className="w-6 h-6 text-white" />}
                    </button>

                    {/* Chat toggle */}
                    <button
                        onClick={() => setIsChatOpen(!isChatOpen)}
                        className="p-4 rounded-full bg-gray-700 hover:bg-gray-600"
                        title="Chat"
                    >
                        <MessageSquare className="w-6 h-6 text-white" />
                    </button>

                    {/* Participants count */}
                    <div className="flex items-center gap-2 px-4 py-2 bg-gray-700 rounded-full">
                        <Users className="w-5 h-5 text-white" />
                        <span className="text-white">{totalParticipants}</span>
                    </div>

                    {/* End call */}
                    <button
                        onClick={handleEndCall}
                        className="p-4 rounded-full bg-red-600 hover:bg-red-700"
                        title="Colgar"
                    >
                        <PhoneOff className="w-6 h-6 text-white" />
                    </button>
                </div>
            </div>

            {/* Chat sidebar */}
            {isChatOpen && (
                <div className="w-80 bg-gray-800 border-l border-gray-700">
                    <ChatBox
                        messages={chatMessages}
                        onSendMessage={(message) => {
                            // You can still use Reverb for chat
                            // or implement Zoom SDK chat if needed
                            console.log('Send message:', message);
                        }}
                        currentUserId={currentUser?.id || ''}
                    />
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

            {/* Hidden canvas for screen sharing */}
            <canvas id="screen-share-canvas" style={{ display: 'none' }} />
        </div>
    );
};

export default VideoRoomZoom;
