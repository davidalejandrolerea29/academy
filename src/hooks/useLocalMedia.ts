import { useState, useEffect, useRef, useCallback } from 'react';

interface UseLocalMediaReturn {
  localStream: MediaStream | null;
  localVideoRef: React.RefObject<HTMLVideoElement>;
  micEnabled: boolean;
  videoEnabled: boolean;
  toggleMic: () => void;
  toggleVideo: () => void;
  stopLocalStream: () => void;
  error: string | null;
}

export const useLocalMedia = (): UseLocalMediaReturn => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [micEnabled, setMicEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  // Obtener el stream local (cámara y micrófono)
  useEffect(() => {
    const getMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        const videoTrack = stream.getVideoTracks()[0];
        const audioTrack = stream.getAudioTracks()[0];

        setVideoEnabled(videoTrack?.enabled || false);
        setMicEnabled(audioTrack?.enabled || false);

      } catch (err) {
        console.error("Error al acceder a los medios:", err);
        setError("No se pudo acceder a la cámara o micrófono. Asegúrate de dar permisos.");
      }
    };

    if (!localStream) {
      getMedia();
    }

    // Cleanup: Detener tracks cuando el componente se desmonte o el hook se "reinicie"
    return () => {
      if (localStream) {
        console.log("🟡 Deteniendo tracks de localStream en cleanup de useLocalMedia.");
        localStream.getTracks().forEach(track => track.stop());
        setLocalStream(null); // Limpiar el estado del stream
      }
    };
  }, [localStream]); // Vuelve a ejecutar si localStream cambia (aunque no debería en este efecto)

  // Función para alternar el micrófono
  const toggleMic = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMicEnabled(audioTrack.enabled);
        console.log(`[Local Media] Micrófono: ${audioTrack.enabled ? 'ENCENDIDO' : 'APAGADO'}`);
      }
    }
  }, [localStream]);

  // Función para alternar el video
  const toggleVideo = useCallback(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoEnabled(videoTrack.enabled);
        console.log(`[Local Media] Video: ${videoTrack.enabled ? 'ENCENDIDO' : 'APAGADO'}`);
      }
    }
  }, [localStream]);

  // Función para detener todos los tracks del stream local
  const stopLocalStream = useCallback(() => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
      console.log("[Local Media] Todos los tracks locales detenidos.");
    }
  }, [localStream]);


  return {
    localStream,
    localVideoRef,
    micEnabled,
    videoEnabled,
    toggleMic,
    toggleVideo,
    stopLocalStream,
    error,
  };
};