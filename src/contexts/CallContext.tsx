// src/contexts/CallContext.tsx
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

interface CallContextType {
  activeRoomId: string | null;
  isCallMinimized: boolean;
  startCall: (roomId: string) => void;
  endCall: () => void;
  toggleMinimizeCall: () => void;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export const CallProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
    const [isCallMinimized, setIsCallMinimized] = useState<boolean>(false);
    const navigate = useNavigate();

    const startCall = (roomId: string) => {
        setActiveRoomId(roomId);
        setIsCallMinimized(false); // Al iniciar, siempre maximizada
        navigate(`/rooms/${roomId}`);
    };

    const endCall = () => {
        setActiveRoomId(null); // MUY IMPORTANTE: Limpiar el ID de la sala activa
        setIsCallMinimized(false); // Restablecer al finalizar
        navigate('/rooms'); // Navegar de vuelta al dashboard (salas de clase)
    };

    const toggleMinimizeCall = () => {
        setIsCallMinimized(prev => !prev);
    };

    return (
        <CallContext.Provider value={{ activeRoomId, isCallMinimized, startCall, endCall, toggleMinimizeCall }}>
        {children}
        </CallContext.Provider>
    );
};

export const useCall = () => {
  const context = useContext(CallContext);
  if (context === undefined) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
};