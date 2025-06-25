// src/components/RemoteVideo.tsx

import React, { useEffect, useRef, useState } from 'react';
import { Video, VideoOff, Mic, MicOff, ScreenShare } from 'lucide-react'; // Importa los íconos necesarios

// Define las props que RemoteVideo espera recibir
interface RemoteVideoProps {
  stream: MediaStream;
  participantId: string; // Nuevo nombre
  participantName: string; // Nuevo nombre
  videoEnabled: boolean;
  micEnabled: boolean;
  isLocal: boolean;
  volume: number; // Para mostrar el volumen del micrófono
  isScreenShare: boolean; // Nuevo prop
}

const RemoteVideoComponent: React.FC<RemoteVideoProps> = ({
  stream,
  participantId,   // ¡AQUÍ ESTÁ EL CAMBIO!
  participantName, // ¡AQUÍ ESTÁ EL CAMBIO!
  videoEnabled,
  micEnabled,
  isLocal,
  volume,
  isScreenShare,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const showVideo = isScreenShare ? true : videoEnabled; // La pantalla siempre se muestra si está activa
  const [isMuted, setIsMuted] = useState(false); // Puedes volver a true para que el autoplay funcione sin interacción

  // Log para ver cuándo se renderiza el componente
  // Este log SÍ se imprimirá cada vez que se renderice, pero React.memo ayudará a controlarlo
  console.log(`[RemoteVideo RENDER] Componente RemoteVideo renderizando para ${participantName} (ID: ${participantId})`);

  useEffect(() => {
    // AHORA USA participantName y participantId
    console.log(`[RemoteVideo DEBUG] --- INICIO useEffect para ${participantName} (ID: ${participantId}) ---`);
    console.log(`[RemoteVideo DEBUG] Prop 'stream' recibida:`, stream ? stream.id : 'null');
    console.log(`[RemoteVideo DEBUG] Prop 'videoEnabled' recibida:`, videoEnabled);
    console.log(`[RemoteVideo DEBUG] Prop 'micEnabled' recibida:`, micEnabled);
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

    // El resto de tu lógica de useEffect...
    console.log(`[RemoteVideo DEBUG] Tracks en el stream para ${participantName}:`, stream.getTracks().map(t => ({
      kind: t.kind,
      id: t.id,
      label: t.label,
      enabled: t.enabled,
      readyState: t.readyState
    })));

    if (stream.getVideoTracks().length === 0) {
      console.warn(`[RemoteVideo DEBUG] El stream para ${participantName} NO TIENE TRACKS DE VIDEO.`);
    }
    if (stream.getAudioTracks().length === 0) {
      console.warn(`[RemoteVideo DEBUG] El stream para ${participantName} NO TIENE TRACKS DE AUDIO.`);
    }

    videoRef.current.srcObject = stream;
    // Esto es importante para el autoplay. Si quieres que se reproduzca audio, la primera vez DEBE estar muteado.
    // Luego el usuario puede desmutearlo con el botón.
    // videoRef.current.muted = isMuted; // Quita esto, ya lo controlas con el prop `muted={isLocal}`

    console.log(`[RemoteVideo DEBUG] Asignando srcObject para ${participantName}. Tracks:`, stream.getTracks().map(t => t.kind));

    stream.getTracks().forEach(track => {
      // AHORA USA participantName
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
        // AHORA USA participantName
        console.log(`[RemoteVideo State for ${participantName}] videoWidth: ${videoRef.current.videoWidth}, videoHeight: ${videoRef.current.videoHeight}, paused: ${videoRef.current.paused}, muted: ${videoRef.current.muted}, readyState: ${videoRef.current.readyState}, networkState: ${videoRef.current.networkState}`);
      }
    };

    videoRef.current.onloadedmetadata = () => {
        // AHORA USA participantName y participantId
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
      // AHORA USA participantName
      console.log(`[RemoteVideo DEBUG] onplay para ${participantName} DISPARADO. El video ESTÁ INTENTANDO REPRODUCIRSE.`);
      checkVideoState();
    };

    videoRef.current.onplaying = () => {
      // AHORA USA participantName
      console.log(`[RemoteVideo DEBUG] onplaying para ${participantName} DISPARADO. El video SE ESTÁ REPRODUCIENDO ACTIVAMENTE.`);
      checkVideoState();
    };

    videoRef.current.onpause = () => {
      // AHORA USA participantName
      console.log(`[RemoteVideo DEBUG] onpause para ${participantName} DISPARADO. El video está PAUSADO.`);
      checkVideoState();
    };

    videoRef.current.onerror = (event) => {
      // AHORA USA participantName y participantId
      console.error(`[RemoteVideo DEBUG] ERROR EN EL VIDEO DE ${participantName} (ID: ${participantId}):`, event);
      checkVideoState();
    };

    videoRef.current.play().catch(e => {
      // AHORA USA participantName y participantId
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
 }, [stream, participantName, participantId, isMuted, videoEnabled, micEnabled, isLocal, isScreenShare]); // <-- ELIMINA `volume` de aquí si no se usa para un efecto directo que requiera re-ejecución con cada cambio de volumen.

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
      if (!videoRef.current.muted) {
        videoRef.current.play().catch(e => console.warn(`Error al reproducir después de desmutear:`, e));
      }
    }
  };

return (
    <div className={`relative bg-gray-800 rounded-lg overflow-hidden aspect-video ${!showVideo ? 'hidden' : ''}`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline // Importante para iOS
        muted={isLocal} // Controla la mutación inicial
        className="w-full h-full object-cover"
        style={{ display: showVideo ? 'block' : 'none' }} // Controla la visibilidad del elemento video
      ></video>

      {!showVideo && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          <VideoOff size={48} className="text-gray-500" />
        </div>
      )}

      {/* Nombre del participante */}
      <div className="absolute bottom-2 left-2 text-white text-sm bg-black bg-opacity-50 px-2 py-1 rounded">
        {participantName}
      </div>

      {/* Botón de mute/unmute para el audio de los REMOTOS (no local, a menos que sea el stream local que quieres mutearte) */}
      {!isLocal && ( // Solo muestra el botón de mute para streams remotos
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
        {videoEnabled ? (
          <Video size={16} className="text-green-400" />
        ) : (
          <VideoOff size={16} className="text-red-500" />
        )}
        {/* Indicador de pantalla compartida */}
        {isScreenShare && (
          <ScreenShare size={16} className="text-blue-400" title="Compartiendo pantalla" />
        )}
      </div>

      {/* Barra de volumen (solo para el micrófono, no para la pantalla compartida) */}
      {!isScreenShare && (
        <div className="absolute bottom-2 right-2 w-16 h-1 bg-gray-600 rounded">
          <div
            className="h-full bg-blue-500 rounded"
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
    // prevProps.volume === nextProps.volume && // <-- ELIMINA ESTA LÍNEA
    prevProps.isScreenShare === nextProps.isScreenShare
  );
});

export default RemoteVideo;