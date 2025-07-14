// src/components/RemoteVideo.tsx

import React, { useEffect, useRef, useState } from 'react';
import { Video, VideoOff, Mic, MicOff, ScreenShare } from 'lucide-react';

// Define las props que RemoteVideo espera recibir
interface RemoteVideoProps {
  stream: MediaStream;
  participantId: string;
  participantName: string;
  videoEnabled: boolean;
  micEnabled: boolean;
  isLocal: boolean;
  volume: number;
  isScreenShare: boolean;
  className?: string; // Permitir clases CSS adicionales para el contenedor
}

const RemoteVideoComponent: React.FC<RemoteVideoProps> = ({
  stream,
  participantId,
  participantName,
  videoEnabled,
  micEnabled,
  isLocal,
  volume,
  isScreenShare,
  className, // Aceptar className
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  // showVideo ahora solo depende de videoEnabled (para cámara) o si es pantalla compartida
  const showVideoContent = isScreenShare ? true : videoEnabled; // Determina si se muestra el video o el placeholder
  const [isMuted, setIsMuted] = useState(isLocal); // Inicializa isMuted basado en isLocal

  // Log para ver cuándo se renderiza el componente
  console.log(`[RemoteVideo RENDER] Componente RemoteVideo renderizando para ${participantName} (ID: ${participantId})`);

  useEffect(() => {
    console.log(`[RemoteVideo DEBUG] --- INICIO useEffect para ${participantName} (ID: ${participantId}) ---`);
    console.log(`[RemoteVideo DEBUG] Prop 'stream' recibida:`, stream ? stream.id : 'null');
    console.log(`[RemoteVideo DEBUG] Prop 'videoEnabled' recibida:`, videoEnabled);
    console.log(`[RemoteVideo DEBUG] Prop 'micEnabled' recibida:`, micEnabled);
    console.log(`[RemoteVideo DEBUG] Prop 'isScreenShare' recibida:`, isScreenShare); // Añadir log de esta prop
    console.log(`[RemoteVideo DEBUG] Valor de videoRef.current al inicio:`, videoRef.current);

    if (!videoRef.current) {
      console.error(`[RemoteVideo DEBUG] videoRef.current es NULO para ${participantName}. El elemento <video> no está disponible.`);
      return;
    }

    if (!stream) {
      console.warn(`[RemoteVideo DEBUG] El stream es NULO para ${participantName}. No se puede asignar srcObject.`);
      videoRef.current.srcObject = null;
      return;
    }

    videoRef.current.srcObject = stream;
    videoRef.current.muted = isMuted; // Asigna el estado de mute basado en el estado interno

    console.log(`[RemoteVideo DEBUG] Asignando srcObject para ${participantName}. Tracks:`, stream.getTracks().map(t => t.kind));

    stream.getTracks().forEach(track => {
      console.log(`[RemoteVideo Track Debug for ${participantName}] Kind: ${track.kind}, ID: ${track.id}, Label: ${track.label}, Enabled: ${track.enabled}, ReadyState: ${track.readyState}`);
      if (track.kind === 'video') {
        const settings = track.getSettings();
        console.log(`[RemoteVideo Video Track Settings for ${participantName}] Width: ${settings.width}, Height: ${settings.height}, FrameRate: ${settings.frameRate}, AspectRatio: ${settings.aspectRatio}`);
      }
    });

    if (stream.getVideoTracks().length > 0) {
      console.log(`[RemoteVideo DEBUG] Video track de ${participantName} habilitado:`, stream.getVideoTracks()[0].enabled);
    }
    if (stream.getAudioTracks().length > 0) {
      console.log(`[RemoteVideo DEBUG] Audio track de ${participantName} habilitado:`, stream.getAudioTracks()[0].enabled);
    }

    const checkVideoState = () => {
      if (videoRef.current) {
        console.log(`[RemoteVideo State for ${participantName}] videoWidth: ${videoRef.current.videoWidth}, videoHeight: ${videoRef.current.videoHeight}, paused: ${videoRef.current.paused}, muted: ${videoRef.current.muted}, readyState: ${videoRef.current.readyState}, networkState: ${videoRef.current.networkState}`);
      }
    };

    videoRef.current.onloadedmetadata = () => {
        console.log(`[RemoteVideo DEBUG] onloadedmetadata para ${participantName} DISPARADO.`);
        console.log(`[RemoteVideo DEBUG] onloadedmetadata - videoWidth: ${videoRef.current?.videoWidth}, videoHeight: ${videoRef.current?.videoHeight}`);
        checkVideoState();
        videoRef.current?.play().catch(e => {
            console.warn(`[RemoteVideo DEBUG] Error al intentar reproducir video de ${participantName} (ID: ${participantId}) en onloadedmetadata:`, e);
            if (e.name === 'NotAllowedError') {
                console.log(`[RemoteVideo DEBUG] Autoplay BLOQUEADO para ${participantName}.`);
            }
        });
    };

    videoRef.current.onplay = () => {
      console.log(`[RemoteVideo DEBUG] onplay para ${participantName} DISPARADO. El video ESTÁ INTENTANDO REPRODUCIRSE.`);
      checkVideoState();
    };

    videoRef.current.onplaying = () => {
      console.log(`[RemoteVideo DEBUG] onplaying para ${participantName} DISPARADO. El video SE ESTÁ REPRODUCIENDO ACTIVAMENTE.`);
      checkVideoState();
    };

    videoRef.current.onpause = () => {
      console.log(`[RemoteVideo DEBUG] onpause para ${participantName} DISPARADO. El video está PAUSADO.`);
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
      }
    };
  }, [stream, participantName, participantId, isMuted, videoEnabled, micEnabled, isLocal, isScreenShare]);

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
      if (!videoRef.current.muted) {
        videoRef.current.play().catch(e => console.warn(`Error al reproducir después de desmutear:`, e));
      }
    }
  };

  // --- ¡CAMBIO CRUCIAL AQUÍ! ---
  // Define la clase de object-fit basada en la prop isScreenShare
  const videoObjectFitClass = isScreenShare ? 'object-contain' : 'object-cover';

  return (
    // Agrega `className` aquí para permitir estilos desde el padre
    // Asegúrate de que este div padre tiene un `aspect-video` o dimensiones que permitan el escalado.
    <div className={`relative bg-gray-800 rounded-lg overflow-hidden aspect-video ${className || ''}`}>
      {/* El elemento video solo se muestra si showVideoContent es true */}
      {showVideoContent && stream && stream.getVideoTracks().length > 0 ? ( // Solo renderiza <video> si hay contenido de video
        <video
          ref={videoRef}
          autoPlay
          playsInline // Importante para iOS
          muted={isLocal || isMuted} // Mutea si es local O si el usuario lo ha muteado manualmente
          // Si es local Y NO es pantalla compartida, aplicar espejo
          style={{ transform: (isLocal && !isScreenShare) ? 'scaleX(-1)' : 'none' }}
          // --- ¡APLICA LA CLASE DINÁMICA AQUÍ! ---
          className={`w-full h-full ${videoObjectFitClass}`}
        ></video>
      ) : (
        // Placeholder con ícono de VideoOff si no hay video o video está deshabilitado
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          {isScreenShare ? (
            // Si es una pantalla compartida pero no hay video, mostrar un ícono de compartir pantalla
            <ScreenShare size={48} className="text-gray-500" />
          ) : (
            // Si es una cámara y está deshabilitada, mostrar VideoOff
            <VideoOff size={48} className="text-gray-500" />
          )}
        </div>
      )}

      {/* Nombre del participante */}
      <div className="absolute bottom-2 left-2 text-white text-sm bg-black bg-opacity-50 px-2 py-1 rounded">
        {participantName}
      </div>

      {/* Botón de mute/unmute para el audio de los REMOTOS (no local) */}
      {/* Solo se muestra si NO es pantalla compartida y NO es el stream local */}
      {!isScreenShare && !isLocal && (
        <button
            onClick={toggleMute}
            className="absolute top-2 left-2 bg-gray-800 bg-opacity-70 text-white p-1 rounded-full text-xs z-10"
        >
            {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
        </button>
      )}

      {/* Iconos de micrófono y video */}
      <div className="absolute top-2 right-2 flex space-x-1">
        {micEnabled ? (
          <Mic size={16} className="text-green-400" />
        ) : (
          <MicOff size={16} className="text-red-500" />
        )}
        {videoEnabled ? ( // El icono de Video/VideoOff debe reflejar si el track de la cámara está habilitado
          <Video size={16} className="text-green-400" />
        ) : (
          <VideoOff size={16} className="text-red-500" />
        )}
        {/* Indicador de pantalla compartida */}
        {isScreenShare && (
          <ScreenShare size={16} className="text-blue-400" title="Compartiendo pantalla" />
        )}
      </div>

      {/* Barra de volumen (solo para el micrófono de tu propio stream local) */}
      {isLocal && !isScreenShare && ( // Solo para tu propio micrófono
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
    prevProps.micEnabled === nextProps.micEnabled &&
    prevProps.isLocal === nextProps.isLocal &&
    prevProps.isScreenShare === nextProps.isScreenShare &&
    prevProps.className === nextProps.className
    // No comparamos `volume` ni `isMuted` en `React.memo` si sus cambios no requieren un re-render
    // del DOM del video en sí, lo cual es manejado por el useEffect.
  );
});

export default RemoteVideo;