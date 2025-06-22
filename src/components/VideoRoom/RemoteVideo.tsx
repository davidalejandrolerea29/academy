// src/components/RemoteVideo.tsx

import React, { useEffect, useRef, useState } from 'react';
import { Video, VideoOff, Mic, MicOff } from 'lucide-react'; // Importa los íconos necesarios

// Define las props que RemoteVideo espera recibir
interface RemoteVideoProps {
  stream: MediaStream | null;
  name: string;
  id: string;
  videoEnabled: boolean;
  micEnabled: boolean;
}

const RemoteVideoComponent: React.FC<RemoteVideoProps> = ({ stream, name, id, videoEnabled, micEnabled }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(false); // Puedes volver a true para que el autoplay funcione sin interacción

  // Log para ver cuándo se renderiza el componente
  // Este log SÍ se imprimirá cada vez que se renderice, pero React.memo ayudará a controlarlo
  console.log(`[RemoteVideo RENDER] Componente RemoteVideo renderizando para ${name} (ID: ${id})`);

  useEffect(() => {
    console.log(`[RemoteVideo DEBUG] --- INICIO useEffect para ${name} (ID: ${id}) ---`);
    console.log(`[RemoteVideo DEBUG] Prop 'stream' recibida:`, stream ? stream.id : 'null');
    console.log(`[RemoteVideo DEBUG] Prop 'videoEnabled' recibida:`, videoEnabled);
    console.log(`[RemoteVideo DEBUG] Prop 'micEnabled' recibida:`, micEnabled);
    console.log(`[RemoteVideo DEBUG] Valor de videoRef.current al inicio:`, videoRef.current);

    if (!videoRef.current) {
      console.error(`[RemoteVideo DEBUG] videoRef.current es NULO para ${name}. El elemento <video> no está disponible.`);
      return;
    }

    if (!stream) {
      console.warn(`[RemoteVideo DEBUG] El stream es NULO para ${name}. No se puede asignar srcObject.`);
      videoRef.current.srcObject = null;
      return;
    }

    // El resto de tu lógica de useEffect...
    console.log(`[RemoteVideo DEBUG] Tracks en el stream para ${name}:`, stream.getTracks().map(t => ({
      kind: t.kind,
      id: t.id,
      label: t.label,
      enabled: t.enabled,
      readyState: t.readyState
    })));

    if (stream.getVideoTracks().length === 0) {
      console.warn(`[RemoteVideo DEBUG] El stream para ${name} NO TIENE TRACKS DE VIDEO.`);
    }
    if (stream.getAudioTracks().length === 0) {
      console.warn(`[RemoteVideo DEBUG] El stream para ${name} NO TIENE TRACKS DE AUDIO.`);
    }

    videoRef.current.srcObject = stream;
    videoRef.current.muted = isMuted;

    console.log(`[RemoteVideo DEBUG] Asignando srcObject para ${name}. Tracks:`, stream.getTracks().map(t => t.kind));

    stream.getTracks().forEach(track => {
      console.log(`[RemoteVideo Track Debug for ${name}] Kind: ${track.kind}, ID: ${track.id}, Label: ${track.label}, Enabled: ${track.enabled}, ReadyState: ${track.readyState}`);
      if (track.kind === 'video') {
        const settings = track.getSettings();
        console.log(`[RemoteVideo Video Track Settings for ${name}] Width: ${settings.width}, Height: ${settings.height}, FrameRate: ${settings.frameRate}, AspectRatio: ${settings.aspectRatio}`);
      }
    });

    if (stream.getVideoTracks().length > 0) {
      console.log(`[RemoteVideo DEBUG] Video track de ${name} habilitado:`, stream.getVideoTracks()[0].enabled);
    }
    if (stream.getAudioTracks().length > 0) {
      console.log(`[RemoteVideo DEBUG] Audio track de ${name} habilitado:`, stream.getAudioTracks()[0].enabled);
    }

    const checkVideoState = () => {
      if (videoRef.current) {
        console.log(`[RemoteVideo State for ${name}] videoWidth: ${videoRef.current.videoWidth}, videoHeight: ${videoRef.current.videoHeight}, paused: ${videoRef.current.paused}, muted: ${videoRef.current.muted}, readyState: ${videoRef.current.readyState}, networkState: ${videoRef.current.networkState}`);
      }
    };

    videoRef.current.onloadedmetadata = () => {
        console.log(`[RemoteVideo DEBUG] onloadedmetadata para ${name} DISPARADO.`);
        console.log(`[RemoteVideo DEBUG] onloadedmetadata - videoWidth: ${videoRef.current?.videoWidth}, videoHeight: ${videoRef.current?.videoHeight}`);
        checkVideoState();
        videoRef.current?.play().catch(e => {
            console.warn(`[RemoteVideo DEBUG] Error al intentar reproducir video de ${name} (ID: ${id}) en onloadedmetadata:`, e);
            if (e.name === 'NotAllowedError') {
                console.log(`[RemoteVideo DEBUG] Autoplay BLOQUEADO para ${name}.`);
            }
        });
    };

    videoRef.current.onplay = () => {
      console.log(`[RemoteVideo DEBUG] onplay para ${name} DISPARADO. El video ESTÁ INTENTANDO REPRODUCIRSE.`);
      checkVideoState();
    };

    videoRef.current.onplaying = () => {
      console.log(`[RemoteVideo DEBUG] onplaying para ${name} DISPARADO. El video SE ESTÁ REPRODUCIENDO ACTIVAMENTE.`);
      checkVideoState();
    };

    videoRef.current.onpause = () => {
      console.log(`[RemoteVideo DEBUG] onpause para ${name} DISPARADO. El video está PAUSADO.`);
      checkVideoState();
    };

    videoRef.current.onerror = (event) => {
      console.error(`[RemoteVideo DEBUG] ERROR EN EL VIDEO DE ${name} (ID: ${id}):`, event);
      checkVideoState();
    };

    videoRef.current.play().catch(e => {
      console.warn(`[RemoteVideo DEBUG] Error al intentar reproducir video de ${name} (ID: ${id}) en inicial:`, e);
      if (e.name === 'NotAllowedError') {
        console.log(`[RemoteVideo DEBUG] Autoplay bloqueado para ${name}.`);
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
  }, [stream, name, id, isMuted, videoEnabled, micEnabled]);

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
    <div className="relative rounded-xl overflow-hidden border border-gray-700 shadow-lg aspect-video bg-black">
      {/* El elemento de video real */}
      <video ref={videoRef} autoPlay muted={isMuted} playsInline className="w-full h-full object-cover" data-remote-id={id} />

      {/* Capa para indicar cámara apagada si el VIDEO del remoto está deshabilitado */}
      {!videoEnabled && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-75 text-gray-400">
          <VideoOff size={48} />
        </div>
      )}

      <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 px-3 py-1 text-sm rounded text-white">
        {name}
      </div>

      <button
        onClick={toggleMute}
        className="absolute top-2 left-2 bg-gray-800 bg-opacity-70 text-white p-1 rounded-full text-xs z-10"
      >
        {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
      </button>

      {!micEnabled && (
        <div className="absolute top-2 right-2 bg-gray-800 bg-opacity-70 text-white p-1 rounded-full text-xs z-10">
          <MicOff size={16} />
        </div>
      )}
    </div>
  );
};

// Envuelve el componente con React.memo para optimizar los re-renders
const RemoteVideo = React.memo(RemoteVideoComponent, (prevProps, nextProps) => {
  // Compara solo las props que deberían causar un re-render
  // Lo más importante: compara la ID del stream, NO la referencia completa del objeto
  return (
    prevProps.id === nextProps.id &&
    prevProps.name === nextProps.name &&
    (prevProps.stream ? prevProps.stream.id : null) === (nextProps.stream ? nextProps.stream.id : null) && // CLAVE
    prevProps.videoEnabled === nextProps.videoEnabled &&
    prevProps.micEnabled === nextProps.micEnabled
  );
});

export default RemoteVideo;