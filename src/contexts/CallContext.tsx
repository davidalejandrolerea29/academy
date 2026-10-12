// src/contexts/CallContext.tsx
import React, { createContext, useContext, useState, ReactNode, useCallback, useMemo } from 'react'; // <-- Importa useCallback y useMemo
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

    // Envuelve las funciones en useCallback
    const startCall = useCallback((roomId: string) => {
        setActiveRoomId(roomId);
        setIsCallMinimized(false); // Al iniciar, siempre maximizada
        navigate(`/rooms/${roomId}`);
    }, [navigate]); // Dependencia: navigate

    const endCall = useCallback(() => {
        setActiveRoomId(null); // MUY IMPORTANTE: Limpiar el ID de la sala activa
        setIsCallMinimized(false); // Restablecer al finalizar
        navigate('/rooms'); // Navegar de vuelta al dashboard (salas de clase)
    }, [navigate]); // Dependencia: navigate

    const toggleMinimizeCall = useCallback(() => {
        setIsCallMinimized(prev => !prev);
    }, []); // Sin dependencias, solo usa el estado anterior

    // Envuelve el objeto de valor en useMemo
    const contextValue = useMemo(() => ({
        activeRoomId,
        isCallMinimized,
        startCall,
        endCall,
        toggleMinimizeCall
    }), [activeRoomId, isCallMinimized, startCall, endCall, toggleMinimizeCall]);
    // Las dependencias de useMemo son los valores que contiene el objeto.
    // Incluir las funciones useCallback aquí es clave porque sus referencias
    // solo cambiarán si sus *propias* dependencias cambian.

    return (
        <CallContext.Provider value={contextValue}> {/* Usa el valor memoizado */}
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