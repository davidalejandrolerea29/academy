// components/VideoCall/MinimizedWidget.tsx
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Move, Maximize2, PhoneOff, ScreenShare, Users } from 'lucide-react';
import RemoteVideo from '../RemoteVideo'; // Asegúrate de que esta ruta sea correcta
import { CallControls } from './CallControls'; // Reutilizamos CallControls

interface MinimizedWidgetProps {
  currentScreenShareStream: MediaStream | null;
  currentScreenShareOwnerId: string | null;
  currentScreenShareOwnerName: string | null;
  isSharingScreen: boolean;
  isAnyScreenSharing: boolean; // Nueva prop
  localStream: MediaStream | null;
  currentUser: { id: string; name: string } | null;
  videoEnabled: boolean;
  micEnabled: boolean;
  participants: Record<string, any>; // Usa el tipo correcto para ParticipantState
  toggleMinimizeCall: () => void;
  handleCallCleanup: () => void;
  toggleMic: () => void;
  toggleVideo: () => void;
  toggleScreenShare: () => void;
 isCallMinimized: boolean; 
  // isTeacher: boolean;
  // isRecording: boolean;
  // toggleRecording: () => void;
}

export const MinimizedWidget: React.FC<MinimizedWidgetProps> = ({
  currentScreenShareStream,
  currentScreenShareOwnerId,
  currentScreenShareOwnerName,
  isSharingScreen,
  isAnyScreenSharing,
  localStream,
  currentUser,
  videoEnabled,
  micEnabled,
  participants,
  toggleMinimizeCall,
  handleCallCleanup,
  toggleMic,
  toggleVideo,
  toggleScreenShare,
  isCallMinimized,
  // isTeacher, isRecording, toggleRecording
}) => {
  const widgetDesktopRef = useRef<HTMLDivElement>(null);
  const widgetMobileRef = useRef<HTMLDivElement>(null);
  const [widgetPosition, setWidgetPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const offset = useRef({ x: 0, y: 0 });

  const handleDragStart = useCallback((clientX: number, clientY: number, ref: React.RefObject<HTMLDivElement>) => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      offset.current = {
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
      setIsDragging(true);
    }
  }, []);

  const handleDrag = useCallback((clientX: number, clientY: number, ref: React.RefObject<HTMLDivElement>) => {
    if (isDragging && ref.current) {
      let newX = clientX - offset.current.x;
      let newY = clientY - offset.current.y;

      // Clamp to screen boundaries
      newX = Math.max(0, Math.min(newX, window.innerWidth - ref.current.offsetWidth));
      newY = Math.max(0, Math.min(newY, window.innerHeight - ref.current.offsetHeight));

      setWidgetPosition({ x: newX, y: newY });
    }
  }, [isDragging]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDragButtonMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); // Evitar selección de texto
    const targetRef = window.innerWidth >= 768 ? widgetDesktopRef : widgetMobileRef;
    handleDragStart(e.clientX, e.clientY, targetRef);
  }, [handleDragStart]);

  const handleDragButtonTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      e.preventDefault(); // Evitar scroll
      const targetRef = window.innerWidth >= 768 ? widgetDesktopRef : widgetMobileRef;
      handleDragStart(e.touches[0].clientX, e.touches[0].clientY, targetRef);
    }
  }, [handleDragStart]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const targetRef = window.innerWidth >= 768 ? widgetDesktopRef : widgetMobileRef;
      handleDrag(e.clientX, e.clientY, targetRef);
    };
    const handleMouseUp = () => handleDragEnd();
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const targetRef = window.innerWidth >= 768 ? widgetDesktopRef : widgetMobileRef;
        handleDrag(e.touches[0].clientX, e.touches[0].clientY, targetRef);
      }
    };
    const handleTouchEnd = () => handleDragEnd();

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleTouchEnd);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, handleDrag, handleDragEnd]);

  // Posicionar el widget por defecto en la esquina inferior derecha al montar
  useEffect(() => {
    const setInitialPosition = () => {
      const isDesktop = window.innerWidth >= 768;
      const ref = isDesktop ? widgetDesktopRef : widgetMobileRef;
      if (ref.current) {
        setWidgetPosition({
          x: window.innerWidth - ref.current.offsetWidth - 16, // 16px from right
          y: window.innerHeight - ref.current.offsetHeight - 16, // 16px from bottom
        });
      }
    };

    setInitialPosition();
    window.addEventListener('resize', setInitialPosition);
    return () => window.removeEventListener('resize', setInitialPosition);
  }, []);

  return (
    <>
      {/* Widget minimizado en DESKTOP (muestra cámaras y más controles) */}
      <div
        ref={widgetDesktopRef}
        className={`
            hidden md:flex fixed z-40
            w-[320px] h-[400px] rounded-lg shadow-xl overflow-hidden bg-gray-950 flex-col
            transition-shadow duration-200 hover:shadow-2xl
        `}
        style={{
          left: `${widgetPosition.x}px`,
          top: `${widgetPosition.y}px`,
        }}
      >
        {/* Botón/barra de arrastre para DESKTOP (parte superior) - FUERA del div de videos */}
        <div
          className={`
              flex justify-center items-center h-10 bg-gray-800 border-b border-gray-700
              ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}
          `}
          onMouseDown={handleDragButtonMouseDown}
          onTouchStart={handleDragButtonTouchStart}
          title="Arrastrar widget"
        >
          <Move size={20} className="text-gray-400" />
        </div>
        {/* Contenido de videos en miniatura para desktop minimizado */}
        <div className="flex-1 flex flex-col bg-gray-950 rounded-lg overflow-hidden p-2 pointer-events-none">
          {/* Pantalla compartida principal en miniatura (si aplica) */}
          {currentScreenShareStream ? (
            <div className="w-full h-3/4 mb-2 bg-gray-800 rounded-md flex items-center justify-center overflow-hidden">
              <RemoteVideo
                stream={currentScreenShareStream}
                participantId={`${currentScreenShareOwnerId}-screen-mini`}
                participantName={currentScreenShareOwnerName}
                videoEnabled={true}
                micEnabled={currentScreenShareStream.getAudioTracks().length > 0}
                isLocal={isSharingScreen}
                volume={0}
                isScreenShare={true}
                className="w-full h-full object-contain"
              />
            </div>
          ) : isAnyScreenSharing ? (
            <div className="w-full h-3/4 mb-2 bg-gray-800 rounded-md flex items-center justify-center overflow-hidden text-gray-500 text-center">
              <ScreenShare className="w-8 h-8 mx-auto mb-1" />
              <p className="text-sm">Cargando pantalla...</p>
            </div>
          ) : null}


          {/* Miniaturas de cámaras de participantes (local + remotos) Y OTRAS PANTALLAS COMPARTIDAS */}
          <div className={`w-full ${currentScreenShareStream || isAnyScreenSharing ? 'h-1/4' : 'flex-grow'} grid grid-cols-2 gap-1 overflow-y-auto`}>
            {localStream && videoEnabled && (
              <RemoteVideo
                stream={localStream}
                participantId={currentUser?.id || 'local-mini'}
                participantName={`${currentUser?.name || 'Tú'}`}
                videoEnabled={videoEnabled}
                micEnabled={micEnabled}
                isLocal={true}
                volume={0}
                isScreenShare={false}
                className="w-full h-full object-cover rounded-sm"
              />
            )}

            {Object.values(participants).map(participant => (
              <React.Fragment key={participant.id + '-mini'}>
                {participant.cameraStream && participant.videoEnabled && (
                  <RemoteVideo
                    key={participant.id + '-camera-mini'}
                    stream={participant.cameraStream!}
                    participantId={participant.id}
                    participantName={participant.name}
                    videoEnabled={participant.videoEnabled}
                    micEnabled={participant.micEnabled}
                    isLocal={false}
                    volume={0}
                    isScreenShare={false}
                    className="w-full h-full object-cover rounded-sm"
                  />
                )}
                {/* Asegurarse de no mostrar la pantalla del "owner" si ya es la principal */}
                {participant.screenStream && participant.id !== currentScreenShareOwnerId && (
                  <RemoteVideo
                    key={participant.id + '-screen-mini'}
                    stream={participant.screenStream!}
                    participantId={participant.id}
                    participantName={`${participant.name} (Pantalla)`}
                    videoEnabled={true}
                    micEnabled={participant.screenStream?.getAudioTracks().length > 0}
                    isLocal={false}
                    volume={0}
                    isScreenShare={true}
                    className="w-full h-full object-cover rounded-sm"
                  />
                )}
              </React.Fragment>
            ))}

            {!localStream && Object.values(participants).filter(p => p.cameraStream).length === 0 && !currentScreenShareStream && !isAnyScreenSharing && (
              <div className="col-span-full flex flex-col items-center justify-center text-gray-500">
                <Users className="w-8 h-8 mb-2" />
                <p className="text-xs text-center">Nadie con video activo.</p>
              </div>
            )}
          </div>
        </div>
        {/* Controles del widget minimizado grande (recuperados) */}
        <CallControls
          variant="desktop-widget-full"
          micEnabled={micEnabled}
          videoEnabled={videoEnabled}
          isSharingScreen={isSharingScreen}
          isCallMinimized={isCallMinimized}
          toggleMic={toggleMic}
          toggleVideo={toggleVideo}
          toggleScreenShare={toggleScreenShare}
          toggleMinimizeCall={toggleMinimizeCall}
          handleCallCleanup={handleCallCleanup}
          // isTeacher={isTeacher}
          // isRecording={isRecording}
          // toggleRecording={toggleRecording}
        />
      </div>

      {/* Widget minimizado en MOBILE (solo iconos y contador) */}
      <div
        ref={widgetMobileRef}
        className={`
            md:hidden fixed z-50 flex flex-col p-2 bg-gray-900 rounded-lg shadow-lg
            w-36 h-24
            ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}
        `}
        style={{
          left: widgetPosition.x === 0 ? 'auto' : `${widgetPosition.x}px`,
          top: widgetPosition.y === 0 ? 'auto' : `${widgetPosition.y}px`,
          right: widgetPosition.x === 0 ? '16px' : 'auto',
          bottom: widgetPosition.y === 0 ? '16px' : 'auto',
        }}
      >
        {/* Botón de arrastre para MOBILE (en la parte superior para fácil acceso) - FUERA del div de contenido */}
        <button
          onMouseDown={handleDragButtonMouseDown}
          onTouchStart={handleDragButtonTouchStart}
          className={`absolute top-0 right-0 m-1 w-8 h-8 rounded-full flex items-center justify-center bg-blue-600 hover:bg-blue-700 z-10
              ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}
          `}
          title="Arrastrar widget"
        >
          <Move size={14} />
        </button>

        {/* Contenido del widget minimizado */}
        <div className="flex items-center justify-center flex-grow text-gray-400 text-sm pointer-events-none">
          {currentScreenShareStream ? (
            <div className="flex flex-col items-center">
              <ScreenShare className="w-6 h-6 mb-1" />
              <p>Compartiendo</p>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <Users className="w-6 h-6 mb-1" />
              <p>{(Object.values(participants).filter(p => p.cameraStream).length + (localStream && videoEnabled ? 1 : 0))} en llamada</p>
            </div>
          )}
        </div>
        {/* Botón de Maximizar en el widget minimizado móvil */}
        <button
          onClick={toggleMinimizeCall}
          className="absolute bottom-2 left-2 w-8 h-8 rounded-full flex items-center justify-center bg-gray-700 hover:bg-gray-600 pointer-events-auto"
          title="Maximizar llamada"
        >
          <Maximize2 size={16} />
        </button>
        {/* Botón de Colgar en el widget minimizado móvil */}
        <button
          onClick={handleCallCleanup}
          className="absolute bottom-2 right-2 w-8 h-8 rounded-full flex items-center justify-center bg-red-600 hover:bg-red-700 pointer-events-auto"
          title="Colgar"
        >
          <PhoneOff size={16} />
        </button>
      </div>
    </>
  );
};