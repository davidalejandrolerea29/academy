// components/VideoCall/ChatPanel.tsx
import React from 'react';
import ChatBox from '../ChatBox'; // Ajusta esta ruta según donde tengas tu ChatBox

interface ChatPanelProps {
  roomId: string;
  isChatOpenMobile: boolean;
  isChatOpenDesktop: boolean;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ roomId, isChatOpenMobile, isChatOpenDesktop }) => {
  return (
    <div className={`
        md:flex md:flex-col md:border-r md:border-gray-700 md:bg-gray-900
        transition-all duration-300 ease-in-out
        ${isChatOpenMobile ? 'fixed inset-0 z-50' : 'hidden'}
        ${isChatOpenDesktop ? 'md:w-80' : 'md:w-0 md:overflow-hidden'}
    `}>
        {/* Los controles irán aquí arriba si los incluyes en este panel, o se inyectarán como children */}
        {/* Por ahora, asumimos que los controles se manejan por separado o como prop children */}

        {/* Chat lateral (solo renderizado si isChatOpenDesktop es true para evitar render innecesario) */}
        {isChatOpenDesktop && (
            <div className="flex-grow flex flex-col py-2 md:py-8 justify-end overflow-hidden">
                {roomId && <ChatBox roomId={roomId} />}
            </div>
        )}
    </div>
  );
};