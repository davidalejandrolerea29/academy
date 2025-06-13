import React, { useEffect, useRef, useState } from 'react';
import { createEcho } from '../../config-reverb/echo'; // ruta correcta
import { JitsiMeeting } from '@jitsi/react-sdk';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Room } from '../../types';
import { Shield, Video, VideoOff } from 'lucide-react';

const VideoRoom: React.FC = () => {
  const API_URL = import.meta.env.VITE_API_URL;
const token = localStorage.getItem('token');
  const { roomId } = useParams<{ roomId: string }>();
  const { currentUser } = useAuth();
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTeacher, setIsTeacher] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
const [peerConnections, setPeerConnections] = useState<Record<string, RTCPeerConnection>>({});

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
const [channel, setChannel] = useState<any>(null);
const [participants, setParticipants] = useState<Record<string, { name: string }>>({});
const [micEnabled, setMicEnabled] = useState(true);
const [volume, setVolume] = useState(0);
const [videoEnabled, setVideoEnabled] = useState(true);

const toggleVideo = () => {
  if (!localStream) return;

  const videoTrack = localStream.getVideoTracks()[0];
  if (!videoTrack) return;

  videoTrack.enabled = !videoTrack.enabled;
  setVideoEnabled(videoTrack.enabled);
};

const toggleMic = () => {
  if (!localStream) return;

  const audioTrack = localStream.getAudioTracks()[0];
  if (!audioTrack) return;

  audioTrack.enabled = !audioTrack.enabled;
  setMicEnabled(audioTrack.enabled);
};


useEffect(() => {
  if (!localStream) return;

  const audioContext = new AudioContext();
  const analyser = audioContext.createAnalyser();
  const microphone = audioContext.createMediaStreamSource(localStream);
  microphone.connect(analyser);

  analyser.fftSize = 512;
  const dataArray = new Uint8Array(analyser.frequencyBinCount);

  const updateVolume = () => {
    analyser.getByteFrequencyData(dataArray);
    let values = 0;
    for (let i = 0; i < dataArray.length; i++) {
      values += dataArray[i];
    }
    const average = values / dataArray.length;
    setVolume(average);

    requestAnimationFrame(updateVolume);
  };

  updateVolume();

  return () => {
    analyser.disconnect();
    microphone.disconnect();
    audioContext.close();
  };
}, [localStream]);
useEffect(() => {
  console.log('🔄 Lista de participantes actualizada:', participants);
}, [participants]);

useEffect(() => {
  console.log("current user", currentUser)
  if (!roomId || !currentUser) return;

 const echo = createEcho(currentUser.token); // o el token donde lo tengas guardado
const ch = echo.join(`video-room.${roomId}`);
console.log("canal ", ch)
  setChannel(ch);
 console.log("luego de asignar")
  ch.subscribed(() => {
    console.log("✅ Suscrito correctamente al canal video room.");
    
    // Avisar que me uní (enviar mi nombre e id)
    ch.whisper('user-joined', {
      id: currentUser.id,
      name: currentUser.name,  // Asumo que tienes el nombre en currentUser
    });
  });
ch.error((err) => {
  console.error("❌ Error al suscribirse al canal:", err);
});


ch.listenForWhisper('user-joined', async ({ id, name }) => {
 console.log('[user-joined] recibido:', { id, name });

  if (id === currentUser.id) return;

  setParticipants((prev) => {
    if (prev[id]) {
      console.log(`[user-joined] Usuario ${id} ya está en la lista de participantes.`);
      return prev;
    }
    const updated = { ...prev, [id]: { name } };
    console.log('[user-joined] Añadiendo nuevo participante:', updated);
    return updated;
  });

  // Crear nueva conexión para este usuario remoto
  const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });

  localStream?.getTracks().forEach(track => pc.addTrack(track, localStream));

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      sendSignal(id, {
        type: 'candidate',
        candidate: event.candidate,
      });
    }
  };

  pc.ontrack = (event) => {
    // Aquí deberías manejar video remoto de ese participante
    // Por ejemplo, podrías crear refs o video elementos dinámicos para cada uno
  };

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
      pc.close();
      setPeerConnections(prev => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
      setParticipants(prev => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    }
  };

  setPeerConnections(prev => ({ ...prev, [id]: pc }));

  // El que se une no inicia llamada, pero si soy yo el admin u originador, iniciaría oferta
  if (isTeacher) {  // O la condición que defina quien inicia la llamada
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    sendSignal(id, { type: 'offer', sdp: offer.sdp });
  }
});

ch.listenForWhisper('Signal', async ({ to, from, data }) => {
  if (to !== currentUser.id) return; // Ignorar señales que no son para mí

  let pc = peerConnections[from];
  if (!pc) {
    // Crear conexión para este usuario remoto (como arriba)
    // (O extraer función para evitar repetir código)
  }

  switch (data.type) {
    case 'offer':
      await pc.setRemoteDescription(new RTCSessionDescription(data));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendSignal(from, { type: 'answer', sdp: answer.sdp });
      break;
    case 'answer':
      await pc.setRemoteDescription(new RTCSessionDescription(data));
      break;
    case 'candidate':
      await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      break;
  }
});

  // También escuchar cuando un usuario se va (opcional)
  ch.listen('UserLeft', ({ id }) => {
    console.log('[UserLeft] Usuario salió:', id);
    setParticipants((prev) => {
      const updated = { ...prev };
      delete updated[id];
      console.log('[UserLeft] Participantes después de salir:', updated);
      return updated;
    });
  });


  return () => {
    Echo.leave(`video-room.${roomId}`);
    setChannel(null);
    setParticipants([]);
  };
}, [roomId, currentUser]);

  useEffect(() => {
    const startMedia = async () => {
      
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      console.log('Local stream tracks:', stream.getTracks());

      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    };

    startMedia();
  }, []);


  const toggleRecording = async () => {
    if (!room || !isTeacher) return;

    try {
      const newRecordingState = !isRecording;

      await supabase
        .from('rooms')
        .update({ is_recording: newRecordingState })
        .eq('id', room.id);

      setIsRecording(newRecordingState);
    } catch (err) {
      console.error('Error toggling recording:', err);
    }
  };

  const createConnection = async () => {
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  });

  localStream?.getTracks().forEach((track) => pc.addTrack(track, localStream));

  pc.ontrack = (event) => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = event.streams[0];
    }
  };

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      sendSignal({
        type: 'candidate',
        candidate: event.candidate,
      });
    }
  };

  setPeerConnection(pc);
  return pc;
};

const sendSignal = (toId: string, data: any) => {
  if (!channel) return;
  channel.whisper('Signal', {
    to: toId,
    from: currentUser.id,
    data,
  });
};

const startCall = async () => {
  console.log('Iniciando llamada...');
 const pc = await createConnection();
  if (!pc) {
    console.error('No se pudo crear conexión');
    return;
  }
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  sendSignal({ type: 'offer', sdp: offer.sdp });
};

const handleOffer = async (data: any) => {
  const pc = await createConnection();
  await pc.setRemoteDescription(new RTCSessionDescription(data));

  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  sendSignal({ type: 'answer', sdp: answer.sdp });
};

const handleAnswer = async (data: any) => {
  if (peerConnection) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data));
  }
};

const handleCandidate = async (data: any) => {
  if (peerConnection) {
    await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
  }
};


  // if (loading) {
  //   return (
  //     <div className="flex items-center justify-center min-h-screen">
  //       <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
  //     </div>
  //   );
  // }

  // if (error) {
  //   return (
  //     <div className="flex flex-col items-center justify-center min-h-screen px-4">
  //       <Shield className="w-16 h-16 text-red-500 mb-4" />
  //       <h1 className="text-2xl font-bold text-gray-800 mb-2">Error de Acceso</h1>
  //       <p className="text-gray-600">{error}</p>
  //     </div>
  //   );
  // }

  // if (!room) {
  //   return (
  //     <div className="flex flex-col items-center justify-center min-h-screen px-4">
  //       <h1 className="text-2xl font-bold text-gray-800 mb-2">Sala no encontrada</h1>
  //     </div>
  //   );
  // }

  return (
    <div>
      <div className="flex gap-4 p-4">
        <div className="w-1/2">
          <h2 className="text-lg font-bold">Tu cámara</h2>
          <video ref={localVideoRef} autoPlay muted className="w-full rounded-lg" />
        </div>
        <div className="w-1/2">
          <h2 className="text-lg font-bold">Remoto</h2>
          <video ref={remoteVideoRef} autoPlay className="w-full rounded-lg" />
        </div>
      </div>

      <div className="flex justify-center mt-4">
        <button
          onClick={startCall}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Iniciar llamada
        </button>
      </div>

      <button
        onClick={toggleMic}
        className={`px-4 py-2 rounded ${
          micEnabled ? 'bg-green-600' : 'bg-red-600'
        } text-white`}
      >
        {micEnabled ? 'Mic ON' : 'Mic OFF'}
      </button>
      <button
        onClick={toggleVideo}
        className={`px-4 py-2 rounded ${
          videoEnabled ? 'bg-green-600' : 'bg-red-600'
        } text-white ml-2`}
      >
        {videoEnabled ? <Video size={16} /> : <VideoOff size={16} />} {/* iconos de lucide-react */}
        {' '}
        {videoEnabled ? 'Video ON' : 'Video OFF'}
      </button>

      <div className="volume-indicator" style={{ width: '100%', background: '#ddd', height: '10px', borderRadius: '5px' }}>
        <div
          style={{
            width: `${(volume / 255) * 100}%`,
            height: '10px',
            background: 'limegreen',
            borderRadius: '5px',
            transition: 'width 0.1s',
          }}
        />
      </div>

      <div className="p-4">
        <h2 className="font-bold">Participantes:</h2>
        <ul className="list-disc ml-5">
          {Object.entries(participants).map(([id, { name }]) => (
            <li key={id}>{name}</li>
          ))}
        </ul>
      </div>


  </div>
  );
};

export default VideoRoom;
