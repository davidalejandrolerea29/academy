// src/components/RemoteVideo.tsx

import React, { useEffect, useRef, useState } from 'react';
import { Video, VideoOff, Mic, MicOff, ScreenShare, Maximize } from 'lucide-react';

// Define las props que RemoteVideo espera recibir
interface RemoteVideoProps {
  stream: MediaStream | null; // Cambiado a MediaStream | null para mayor robustez
  participantId: string;
  participantName: string;
  videoEnabled: boolean;
  micEnabled: boolean; // Indica si el micrófono del participante está activo
  isLocal: boolean;
  volume: number; // Aunque ya no lo uses directamente para mutear, lo mantengo por si es relevante en otro lado
  isScreenShare: boolean;
  className?: string; // Permitir clases CSS adicionales para el contenedor
  onSelectMain?: (streamId: string | null) => void; // Callback para seleccionar este stream como principal
  isSelectedMain?: boolean; // Indica si este stream es actualmente el principal seleccionado
  showSelectButton?: boolean;
}

const RemoteVideoComponent: React.FC<RemoteVideoProps> = ({
  stream,
  participantId,
  participantName,
  videoEnabled,
  micEnabled, // Desestructuramos para usarlo en la lógica de muteo
  isLocal,
  volume,
  isScreenShare,
  className,
  onSelectMain,
  isSelectedMain,
  showSelectButton,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const showVideoContent = isScreenShare ? true : videoEnabled; // Determina si se muestra el video o el placeholder

  // Log para ver cuándo se renderiza el componente
  // console.log(`[RemoteVideo RENDER] Componente RemoteVideo renderizando para ${participantName} (ID: ${participantId}) ${isScreenShare ? '(SCREEN SHARE)' : ''}`);

  useEffect(() => {
    // console.log(`[RemoteVideo DEBUG] --- INICIO useEffect para ${participantName} (ID: ${participantId}) ---`);
    // console.log(`[RemoteVideo DEBUG] Prop 'stream' recibida:`, stream ? stream.id : 'null');
    // console.log(`[RemoteVideo DEBUG] Prop 'videoEnabled' recibida:`, videoEnabled);
    // console.log(`[RemoteVideo DEBUG] Prop 'micEnabled' recibida:`, micEnabled);
    // console.log(`[RemoteVideo DEBUG] Prop 'isScreenShare' recibida:`, isScreenShare);
    // console.log(`[RemoteVideo DEBUG] Valor de videoRef.current al inicio:`, videoRef.current);

    if (!videoRef.current) {
      console.error(`[RemoteVideo DEBUG] videoRef.current es NULO para ${participantName}. El elemento <video> no está disponible.`);
      return;
    }

    if (!stream) {
      // console.warn(`[RemoteVideo DEBUG] El stream es NULO para ${participantName}. No se puede asignar srcObject.`);
      videoRef.current.srcObject = null;
      return;
    }

    videoRef.current.srcObject = stream;
    // --- Lógica de Muteo Simplificada ---
    // Si es tu stream local de cámara, siempre muteado para evitar eco.
    // Si es cualquier tipo de pantalla compartida (tuya o de otros), también muteado para evitar eco.
    // Si es un stream de cámara remoto, muteado solo si su micEnabled es false.
    if (isLocal || isScreenShare) {
        videoRef.current.muted = true;
    } else {
        videoRef.current.muted = !micEnabled; // Audio de remoto, muteado si su micrófono está apagado
    }


    // console.log(`[RemoteVideo DEBUG] Asignando srcObject para ${participantName}. Tracks:`, stream.getTracks().map(t => t.kind));

    // stream.getTracks().forEach(track => {
    //   console.log(`[RemoteVideo Track Debug for ${participantName}] Kind: ${track.kind}, ID: ${track.id}, Label: ${track.label}, Enabled: ${track.enabled}, ReadyState: ${track.readyState}`);
    //   if (track.kind === 'video') {
    //     const settings = track.getSettings();
    //     console.log(`[RemoteVideo Video Track Settings for ${participantName}] Width: ${settings?.width}, Height: ${settings?.height}, FrameRate: ${settings?.frameRate}, AspectRatio: ${settings?.aspectRatio}`);
    //   }
    // });

    // if (stream.getVideoTracks().length > 0) {
    //   console.log(`[RemoteVideo DEBUG] Video track de ${participantName} habilitado:`, stream.getVideoTracks()[0].enabled);
    // }
    // if (stream.getAudioTracks().length > 0) {
    //   console.log(`[RemoteVideo DEBUG] Audio track de ${participantName} habilitado:`, stream.getAudioTracks()[0].enabled);
    // }

    const checkVideoState = () => {
      if (videoRef.current) {
        // console.log(`[RemoteVideo State for ${participantName}] videoWidth: ${videoRef.current.videoWidth}, videoHeight: ${videoRef.current.videoHeight}, paused: ${videoRef.current.paused}, muted: ${videoRef.current.muted}, readyState: ${videoRef.current.readyState}, networkState: ${videoRef.current.networkState}`);
      }
    };

    videoRef.current.onloadedmetadata = () => {
        // console.log(`[RemoteVideo DEBUG] onloadedmetadata para ${participantName} DISPARADO.`);
        // console.log(`[RemoteVideo DEBUG] onloadedmetadata - videoWidth: ${videoRef.current?.videoWidth}, videoHeight: ${videoRef.current?.videoHeight}`);
        checkVideoState();
        videoRef.current?.play().catch(e => {
            console.warn(`[RemoteVideo DEBUG] Error al intentar reproducir video de ${participantName} (ID: ${participantId}) en onloadedmetadata:`, e);
            if (e.name === 'NotAllowedError') {
                console.log(`[RemoteVideo DEBUG] Autoplay BLOQUEADO para ${participantName}.`);
            }
        });
    };

    videoRef.current.onplay = () => {
      // console.log(`[RemoteVideo DEBUG] onplay para ${participantName} DISPARADO. El video ESTÁ INTENTANDO REPRODUCIRSE.`);
      checkVideoState();
    };

    videoRef.current.onplaying = () => {
      // console.log(`[RemoteVideo DEBUG] onplaying para ${participantName} DISPARADO. El video SE ESTÁ REPRODUCIENDO ACTIVAMENTE.`);
      checkVideoState();
    };

    videoRef.current.onpause = () => {
      // console.log(`[RemoteVideo DEBUG] onpause para ${participantName} DISPARADO. El video está PAUSADO.`);
      checkVideoState();
    };

    videoRef.current.onerror = (event) => {
      console.error(`[RemoteVideo DEBUG] ERROR EN EL VIDEO DE ${participantName} (ID: ${participantId}):`, event);
      checkVideoState();
    };

    // Intenta reproducir al montar o actualizar
    videoRef.current.play().catch(e => {
      console.warn(`[RemoteVideo DEBUG] Error al intentar reproducir video de ${participantName} (ID: ${participantId}) en inicial:`, e);
      if (e.name === 'NotAllowedError') {
        console.log(`[RemoteVideo DEBUG] Autoplay bloqueado para ${participantName}.`);
      }
    });

    const currentVideoRef = videoRef.current;
    return () => {
      if (currentVideoRef) {
        currentVideoRef.onloadedmetadata = null;
        currentVideoRef.onplay = null;
        currentVideoRef.onplaying = null;
        currentVideoRef.onpause = null;
        currentVideoRef.onerror = null;
        currentVideoRef.srcObject = null; // Limpiar srcObject al desmontar
      }
    };
  }, [stream, participantName, participantId, micEnabled, videoEnabled, isLocal, isScreenShare]); // `isMuted` eliminado de las dependencias

  const handleSelectClick = () => {
    if (onSelectMain) {
        onSelectMain(isSelectedMain ? null : participantId);
    }
  };
  const screenShareBorderClass = isScreenShare ? 'border-4 border-blue-500' : '';
  const videoObjectFitClass = isScreenShare ? 'object-contain' : 'object-cover';

  return (
    <div className={`relative bg-gray-800 rounded-lg overflow-hidden aspect-video ${className || ''} ${screenShareBorderClass}`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        // Lógica de muteo definida en el useEffect, pero también se puede establecer aquí directamente si es más simple
        // Si es local o es pantalla compartida, siempre muteado.
        // Si es remoto, muteado solo si su micEnabled es false.
        muted={isLocal || isScreenShare ? true : !micEnabled}
        className={`w-full h-full ${videoObjectFitClass}`}
      ></video>

      {!showVideoContent && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          <VideoOff size={48} className="text-gray-500" />
        </div>
      )}

      <div className="absolute bottom-2 left-2 text-white text-sm bg-black bg-opacity-50 px-2 py-1 rounded">
        {participantName}
      </div>

      {/* Botón de mute/unmute ELIMINADO de aquí */}

      {showSelectButton && onSelectMain && (
        <button
            onClick={handleSelectClick}
            className={`
                absolute top-2 right-2 bg-gray-800 bg-opacity-70 text-white p-1 rounded-full text-xs z-10
                ${isSelectedMain ? 'bg-yellow-600' : 'hover:bg-gray-600'}
            `}
            title={isSelectedMain ? 'Quitar de la pantalla principal' : 'Ver en pantalla principal'}
        >
            <Maximize size={16} />
        </button>
      )}

      {/* Iconos de micrófono y video */}
      <div className="absolute top-2 right-2 flex space-x-1">
        {micEnabled ? (
          <Mic size={16} className="text-green-400" />
        ) : (
          <MicOff size={16} className="text-red-500" />
        )}
        {videoEnabled ? (
          <Video size={16} className="text-green-400" />
        ) : (
          <VideoOff size={16} className="text-red-500" />
        )}
        {isScreenShare && (
          <ScreenShare size={16} className="text-blue-400" title="Compartiendo pantalla" />
        )}
      </div>

      {/* Barra de volumen (solo para el micrófono de tu propio stream local) */}
      {isLocal && !isScreenShare && (
        <div className="absolute bottom-2 right-2 w-16 h-1 bg-gray-600 rounded">
          <div
            className="h-full bg-orange-500 rounded"
            style={{ width: `${volume * 100}%` }}
          ></div>
        </div>
      )}
    </div>
  );
};

// Envuelve el componente con React.memo para optimizar los re-renders
const RemoteVideo = React.memo(RemoteVideoComponent, (prevProps, nextProps) => {
  return (
    prevProps.participantId === nextProps.participantId &&
    prevProps.participantName === nextProps.participantName &&
    (prevProps.stream ? prevProps.stream.id : null) === (nextProps.stream ? nextProps.stream.id : null) &&
    prevProps.videoEnabled === nextProps.videoEnabled &&
    prevProps.micEnabled === nextProps.micEnabled && // Asegúrate de incluir micEnabled aquí
    prevProps.isLocal === nextProps.isLocal &&
    prevProps.isScreenShare === nextProps.isScreenShare &&
    prevProps.className === nextProps.className
  );
});

export default RemoteVideo;