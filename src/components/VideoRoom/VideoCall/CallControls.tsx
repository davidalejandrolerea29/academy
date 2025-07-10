// components/VideoCall/CallControls.tsx
import React from 'react';
import { Mic, MicOff, Video, VideoOff, ScreenShare, MessageSquare, Maximize2, Minimize2, PhoneOff, X, ChevronRight, ChevronLeft } from 'lucide-react';

interface CallControlsProps {
  micEnabled: boolean;
  videoEnabled: boolean;
  isSharingScreen: boolean;
  isCallMinimized: boolean;
  isChatOpenMobile?: boolean; // Opcional, para el botón de chat en móvil
  isChatOpenDesktop?: boolean; // Opcional, para el botón de chat en desktop
  toggleMic: () => void;
  toggleVideo: () => void;
  toggleScreenShare: () => void;
  toggleMinimizeCall: () => void;
  handleCallCleanup: () => void;
  // isTeacher: boolean; // Si esto es global o se pasa, incluir
  // isRecording: boolean; // Si esto es global o se pasa, incluir
  // toggleRecording: () => void; // Si esto es global o se pasa, incluir
  onToggleChatMobile?: () => void; // Solo si este conjunto de controles tiene el botón de chat móvil
  onToggleChatDesktop?: () => void; // Solo si este conjunto de controles tiene el botón de chat de escritorio
    variant: 'mobile-main' | 'desktop-side' | 'mobile-widget' | 'desktop-widget-full' | 'desktop-chat-toggle' | 'desktop-main';
}

export const CallControls: React.FC<CallControlsProps> = ({
  micEnabled,
  videoEnabled,
  isSharingScreen,
  isCallMinimized,
  toggleMic,
  toggleVideo,
  toggleScreenShare,
  toggleMinimizeCall,
  handleCallCleanup,
  onToggleChatMobile,
  onToggleChatDesktop,
  isChatOpenMobile,
  isChatOpenDesktop,
  variant,
  // isTeacher, toggleRecording, isRecording // Descomenta si los usas
}) => {
  const buttonClass = (size: string) => `${size} rounded-full flex items-center justify-center bg-gray-700 hover:bg-gray-600`;
  const redButtonClass = (size: string) => `${size} rounded-full flex items-center justify-center bg-red-600 hover:bg-red-700`;
  const orangeButtonClass = (size: string) => `${size} rounded-full flex items-center justify-center bg-orange-600 hover:bg-orange-700`;

  // commonButtons AHORA SOLO INCLUYE MIC Y VIDEO
  const commonButtons = (buttonSize: string, iconSize: number) => (
    <>
      <button
        onClick={toggleMic}
        className={buttonClass(buttonSize)}
        title={micEnabled ? 'Silenciar micrófono' : 'Activar micrófono'}
      >
        {micEnabled ? <Mic size={iconSize} /> : <MicOff size={iconSize} />}
      </button>

      <button
        onClick={toggleVideo}
        className={buttonClass(buttonSize)}
        title={videoEnabled ? 'Apagar cámara' : 'Encender cámara'}
      >
        {videoEnabled ? <Video size={iconSize} /> : <VideoOff size={iconSize} />}
      </button>

      {/* {isTeacher && (
        <button
          onClick={toggleRecording}
          className={buttonClass(buttonSize)}
          title={isRecording ? 'Detener grabación' : 'Iniciar grabación'}
        >
          <StopCircle size={iconSize} className={isRecording ? 'text-red-500' : ''} />
        </button>
      )} */}
    </>
  );

  switch (variant) {
    case 'mobile-main':
      return (
        <div className="flex md:hidden justify-center gap-2 p-3 bg-black bg-opacity-80 w-full flex-wrap">
          {commonButtons('w-12 h-12', 20)}
          {/* El botón de ScreenShare NO está aquí */}
          {onToggleChatMobile && (
            <button
              onClick={onToggleChatMobile}
              className={orangeButtonClass('w-12 h-12')}
              title="Abrir/Cerrar Chat"
            >
              <MessageSquare size={20} />
            </button>
          )}
          <button
            onClick={toggleMinimizeCall}
            className={buttonClass('w-12 h-12')}
            title={isCallMinimized ? 'Maximizar llamada' : 'Minimizar llamada'}
          >
            {isCallMinimized ? <Maximize2 size={20} /> : <Minimize2 size={20} />}
          </button>
          <button
            onClick={handleCallCleanup}
            className={redButtonClass('w-12 h-12')}
            title="Colgar"
          >
            <PhoneOff size={20} />
          </button>
        </div>
      );

    case 'desktop-side':
      return (
        <div className="flex justify-center gap-2 p-3 bg-black bg-opacity-80 border-b border-gray-700 flex-wrap">
          {commonButtons('w-12 h-12', 20)}
          {/* Añadir ScreenShare específicamente para desktop-side si lo quieres aquí */}
          <button
            onClick={toggleScreenShare}
            className={buttonClass('w-12 h-12')}
            title={isSharingScreen ? 'Detener compartir pantalla' : 'Compartir pantalla'}
          >
            <ScreenShare size={20} />
          </button>
          {onToggleChatMobile && ( // Este es para cerrar el overlay en móvil
            <button
              onClick={onToggleChatMobile}
              className={buttonClass('w-12 h-12') + ' md:hidden'} // Solo visible en móvil
              title="Cerrar Chat"
            >
              <X size={20} />
            </button>
          )}
          <button
            onClick={toggleMinimizeCall}
            className={buttonClass('w-12 h-12') + ' hidden md:flex'} // Solo visible en desktop
            title={isCallMinimized ? 'Maximizar llamada' : 'Minimizar llamada'}
          >
            {isCallMinimized ? <Maximize2 size={20} /> : <Minimize2 size={20} />}
          </button>
          <button
            onClick={handleCallCleanup}
            className={redButtonClass('w-12 h-12')}
            title="Colgar"
          >
            <PhoneOff size={20} />
          </button>
        </div>
      );

    case 'desktop-chat-toggle':
        return (
            <div className={`
                hidden md:flex flex-col justify-center items-center h-full
                w-10 bg-gray-800 border-l border-gray-700
                transition-all duration-300 ease-in-out
            `}>
                {onToggleChatDesktop && (
                    <button
                        onClick={onToggleChatDesktop}
                        className="w-10 h-20 rounded-l-lg flex items-center justify-center bg-gray-700 hover:bg-gray-600 focus:outline-none"
                        title={isChatOpenDesktop ? 'Ocultar Chat' : 'Mostrar Chat'}
                    >
                        {isChatOpenDesktop ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
                    </button>
                )}
            </div>
        );

    case 'desktop-widget-full':
      return (
        <div className="flex justify-center gap-2 p-3 bg-gray-800 border-t border-gray-700 flex-wrap pointer-events-auto">
          {commonButtons('w-10 h-10', 18)}
          {/* Añadir ScreenShare específicamente para desktop-widget-full */}
          <button
            onClick={toggleScreenShare}
            className={buttonClass('w-10 h-10')}
            title={isSharingScreen ? 'Detener compartir pantalla' : 'Compartir pantalla'}
          >
            <ScreenShare size={18} />
          </button>
          <button
            onClick={toggleMinimizeCall}
            className={buttonClass('w-10 h-10')}
            title="Maximizar llamada"
          >
            <Maximize2 size={18} />
          </button>
          <button
            onClick={handleCallCleanup}
            className={redButtonClass('w-10 h-10')}
            title="Colgar"
          >
            <PhoneOff size={18} />
          </button>
        </div>
      );

    case 'desktop-main':
      return (
        <div className="hidden md:flex justify-center gap-4 p-4 bg-gray-900 border-t border-gray-700 w-full flex-wrap">
          {commonButtons('w-14 h-14', 24)} {/* Botones un poco más grandes para la vista principal */}
          {/* Añadir ScreenShare específicamente para desktop-main */}
          <button
            onClick={toggleScreenShare}
            className={buttonClass('w-14 h-14')}
            title={isSharingScreen ? 'Detener compartir pantalla' : 'Compartir pantalla'}
          >
            <ScreenShare size={24} />
          </button>
          <button
            onClick={toggleMinimizeCall}
            className={buttonClass('w-14 h-14')}
            title={isCallMinimized ? 'Maximizar llamada' : 'Minimizar llamada'}
          >
            {isCallMinimized ? <Maximize2 size={24} /> : <Minimize2 size={24} />}
          </button>
          <button
            onClick={handleCallCleanup}
            className={redButtonClass('w-14 h-14')}
            title="Colgar"
          >
            <PhoneOff size={24} />
          </button>
        </div>
      );
    default:
      return null;
  }
};