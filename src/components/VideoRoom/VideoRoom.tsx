import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createReverbWebSocketService, EchoChannel } from '../../services/ReverbWebSocketService';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Room } from '../../types';
import { useMicVolume } from '../../hooks/useMicVolume';

import { Video, VideoOff, Mic, MicOff, ScreenShare, StopCircle, MessageSquare, PhoneOff } from 'lucide-react';

// Componente pequeño para el video remoto
// Esto es opcional, pero ayuda a mantener el componente principal más limpio
interface RemoteVideoProps {
  stream: MediaStream | null;
  name: string;
}

const RemoteVideo: React.FC<RemoteVideoProps> = ({ stream, name }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]); // Solo actualiza si el stream cambia

  return (
    <div className="relative rounded-xl overflow-hidden border border-gray-700 shadow-lg aspect-video bg-black">
      <video ref={videoRef} autoPlay className="w-full h-full object-cover" />
      <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 px-3 py-1 text-sm rounded text-white">
        {name}
      </div>
      {/* Puedes añadir un indicador de micrófono/video deshabilitado para el remoto aquí si tienes esa información */}
    </div>
  );
};


const VideoRoom: React.FC = () => {
  const API_URL = import.meta.env.VITE_API_URL;
  const navigate = useNavigate();

  const { roomId } = useParams<{ roomId: string }>();
  const { currentUser } = useAuth();
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTeacher, setIsTeacher] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [messages, setMessages] = useState<{ sender: string; text: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const localVideoRef = useRef<HTMLVideoElement>(null);
  // remoteVideoRef ya no se usará directamente para cada video, sino el nuevo estado de streams remotos
  // const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const [peerConnections, setPeerConnections] = useState<Record<string, RTCPeerConnection>>({});
  // --- NUEVO ESTADO PARA ALMACENAR LOS STREAMS REMOTOS ---
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});


  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [channel, setChannel] = useState<EchoChannel | null>(null);
  const [participants, setParticipants] = useState<Record<string, { name: string }>>({});
  const [micEnabled, setMicEnabled] = useState(true);
  const [volume, setVolume] = useState(0);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const volume2 = useMicVolume(localStream);

  // Asegúrate de que este useEffect solo se ejecute una vez para obtener el stream
  useEffect(() => {
    const startMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        console.log('Local stream tracks:', stream.getTracks());
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Error al acceder a los medios:", err);
      }
    };
    startMedia();

    // Limpieza al desmontar para parar el stream local
    return () => {
      localStream?.getTracks().forEach(track => track.stop());
      // También limpia los streams remotos al salir de la sala
      Object.values(remoteStreams).forEach(stream => stream.getTracks().forEach(track => track.stop()));
      setRemoteStreams({});
    };
  }, []);

  const toggleVideo = () => {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    if (!videoTrack) return;
    videoTrack.enabled = !videoTrack.enabled;
    setVideoEnabled(videoTrack.enabled);

    // Notificar a los demás participantes sobre el cambio de estado del video
    channel?.whisper('toggle-video', {
      id: currentUser?.id,
      enabled: videoTrack.enabled,
    });
  };

  const toggleMic = () => {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (!audioTrack) return;
    audioTrack.enabled = !audioTrack.enabled;
    setMicEnabled(audioTrack.enabled);

    // Notificar a los demás participantes sobre el cambio de estado del micrófono
    channel?.whisper('toggle-mic', {
      id: currentUser?.id,
      enabled: audioTrack.enabled,
    });
  };

  const toggleScreenShare = async () => {
    if (!localStream) return;

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = screenStream.getVideoTracks()[0];

      Object.values(peerConnections).forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(screenTrack);
        }
      });

      screenTrack.onended = () => {
        const videoTrack = localStream.getVideoTracks()[0];
        Object.values(peerConnections).forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) {
            sender.replaceTrack(videoTrack);
          }
        });
        setVideoEnabled(true);
      };
      setVideoEnabled(false);
    } catch (error) {
      console.error("Error sharing screen:", error);
      setVideoEnabled(true);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const msg = { sender: currentUser?.name || 'Invitado', text: chatInput };
    setMessages(prev => [...prev, msg]);
    setChatInput('');
    channel?.whisper('chat-message', msg);
  };

  useEffect(() => {
    if (channel) {
      const chatListener = (msg: { sender: string; text: string }) => {
        setMessages(prev => [...prev, msg]);
      };
      channel.listenForWhisper('chat-message', chatListener);

      // Opcional: Listeners para cambios de estado de Mic/Video de otros
      channel.listenForWhisper('toggle-video', ({ id, enabled }: { id: string; enabled: boolean }) => {
        setParticipants(prev => ({
          ...prev,
          [id]: { ...prev[id], videoEnabled: enabled }
        }));
      });
      channel.listenForWhisper('toggle-mic', ({ id, enabled }: { id: string; enabled: boolean }) => {
        setParticipants(prev => ({
          ...prev,
          [id]: { ...prev[id], micEnabled: enabled }
        }));
      });

      return () => {
        // La limpieza del canal suele manejar esto, pero si no, aquí irían
        // channel.stopListeningForWhisper('chat-message', chatListener);
      };
    }
  }, [channel, currentUser?.id]); // Añade currentUser.id como dependencia para `handleSendMessage` si no está cubierto

  const endCall = () => {
    localStream?.getTracks().forEach(track => track.stop());
    Object.values(peerConnections).forEach(pc => pc.close());
    setPeerConnections({});
    setRemoteStreams({}); // Limpia los streams remotos
    setParticipants({});
    setMessages([]);
    setIsRecording(false);
    channel?.leave();
    setChannel(null);
    navigate('/rooms');
  };

  useEffect(() => {
    if (!localStream) return;
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
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

  const sendSignal = useCallback((toId: string, data: any) => {
    if (!channel) {
      console.warn("Cannot send signal: channel is not ready.");
      return;
    }
    channel.whisper('Signal', {
      to: toId,
      from: currentUser?.id,
      data,
    });
  }, [channel, currentUser?.id]);

  useEffect(() => {
    console.log("current user", currentUser);
    if (!roomId || !currentUser) return;

    if (channel) {
        console.log("Ya existe un canal, no se unirá de nuevo.");
        return;
    }

    const reverbService = createReverbWebSocketService(currentUser.token);
    let currentChannel: EchoChannel | null = null;

    console.log("Intentando unirse al canal", `video-room.${roomId}`);
    reverbService.join(`video-room.${roomId}`)
      .then((joinedChannel: EchoChannel) => {
        currentChannel = joinedChannel;
        setChannel(joinedChannel);
        console.log("Canal obtenido y estado actualizado:", joinedChannel);

        joinedChannel.subscribed(() => {
          console.log("✅ Suscrito correctamente al canal video room.");
          joinedChannel.whisper('user-joined', {
            id: currentUser.id,
            name: currentUser.name,
            // Opcional: enviar estado inicial de mic/video
            videoEnabled: videoEnabled,
            micEnabled: micEnabled,
          });
        });

        joinedChannel.error((err: any) => {
          console.error("❌ Error en canal de video-room:", err);
        });

        joinedChannel.listenForWhisper('user-joined', async ({ id, name, videoEnabled: remoteVideoEnabled, micEnabled: remoteMicEnabled }: { id: string; name: string; videoEnabled?: boolean; micEnabled?: boolean }) => {
          console.log('[user-joined] recibido:', { id, name });
          if (id === currentUser.id) return;

          setParticipants((prev) => {
            if (prev[id]) {
              console.log(`[user-joined] Usuario ${id} ya está en la lista de participantes.`);
              return prev;
            }
            const updated = { ...prev, [id]: { name, videoEnabled: remoteVideoEnabled, micEnabled: remoteMicEnabled } };
            console.log('[user-joined] Añadiendo nuevo participante:', updated);
            return updated;
          });

          const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });

          if (localStream) {
            localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
          }

          pc.onicecandidate = (event) => {
            if (event.candidate) {
              sendSignal(id, { type: 'candidate', candidate: event.candidate });
            }
          };

          // --- CLAVE: MANEJAR EL STREAM REMOTO EN ontrack ---
          pc.ontrack = (event) => {
            console.log(`[ontrack] Recibiendo stream de ${id}`, event.streams[0]);
            // Almacenar el stream remoto en el estado
            setRemoteStreams(prev => ({ ...prev, [id]: event.streams[0] }));
          };

          pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
              console.log(`RTC PeerConnection for ${id} disconnected or failed.`);
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
              // --- Eliminar el stream remoto cuando la conexión se pierde ---
              setRemoteStreams(prev => {
                const copy = { ...prev };
                delete copy[id];
                return copy;
              });
            }
          };

          setPeerConnections(prev => ({ ...prev, [id]: pc }));

          if (isTeacher) { // O si es el que inició la llamada/oferta
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            sendSignal(id, { type: 'offer', sdp: offer.sdp });
          }
        });

        joinedChannel.listenForWhisper('Signal', async ({ to, from, data }: { to: string; from: string; data: any }) => {
          console.log('[Signal] recibido:', { to, from, data });
          if (to !== currentUser.id) return;

          setPeerConnections(prevPeerConnections => {
            let pc = prevPeerConnections[from];
            if (!pc) {
              console.warn(`Creating new PeerConnection for ${from} on the fly for received signal.`);
              pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
              if (localStream) {
                localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
              }

              pc.onicecandidate = (event) => {
                if (event.candidate) {
                  sendSignal(from, { type: 'candidate', candidate: event.candidate });
                }
              };
              // --- CLAVE: MANEJAR EL STREAM REMOTO EN ontrack (también aquí si el PC se crea tarde) ---
              pc.ontrack = (event) => {
                console.log(`[ontrack] Recibiendo stream (creado tarde) de ${from}`, event.streams[0]);
                setRemoteStreams(p => ({ ...p, [from]: event.streams[0] }));
              };

              pc.onconnectionstatechange = () => {
                if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                  pc.close();
                  setPeerConnections(p => { const copy = { ...p }; delete copy[from]; return copy; });
                  setParticipants(p => { const copy = { ...p }; delete copy[from]; return copy; });
                  // --- Eliminar el stream remoto ---
                  setRemoteStreams(p => { const copy = { ...p }; delete copy[from]; return copy; });
                }
              };
            }

            const processSignal = async () => {
              try {
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
                    if (data.candidate && (pc.remoteDescription || data.candidate.sdpMid)) {
                      await pc.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(e => console.error("Error adding ICE candidate:", e, data.candidate));
                    }
                    break;
                }
              } catch (e) {
                console.error("Error processing WebRTC signal:", e);
              }
            };
            processSignal();

            return { ...prevPeerConnections, [from]: pc };
          });
        });

        joinedChannel.listen('UserLeft', ({ id }: { id: string }) => {
          console.log('[UserLeft] Usuario salió:', id);
          setParticipants((prev) => {
            const updated = { ...prev };
            delete updated[id];
            console.log('[UserLeft] Participantes después de salir:', updated);
            return updated;
          });
          setPeerConnections(prev => {
            const copy = { ...prev };
            if (copy[id]) {
              copy[id].close();
              delete copy[id];
            }
            return copy;
          });
          // --- Eliminar el stream remoto del estado cuando el usuario se va ---
          setRemoteStreams(prev => {
            const copy = { ...prev };
            delete copy[id];
            return copy;
          });
        });

      })
      .catch(error => {
        console.error("❌ Error al unirse al canal video-room:", error);
        setChannel(null);
        setError("No se pudo conectar a la sala de video.");
        setLoading(false);
      });

    return () => {
      console.log("Limpiando useEffect de conexión al canal.");
      if (currentChannel) {
        currentChannel.leave();
      }
      Object.values(peerConnections).forEach(pc => pc.close());
      setPeerConnections({});
      setRemoteStreams({}); // Limpia los streams remotos en la limpieza del efecto
    };
  }, [roomId, currentUser, localStream, sendSignal]); // Agregamos `localStream` y `sendSignal` a las dependencias.
                                                     // `localStream` es necesario porque se usa en el setup del PC.
                                                     // `sendSignal` es una useCallback, así que su cambio es controlado.


  // Aquí puedes añadir la función toggleRecording si la necesitas
  const toggleRecording = () => {
    console.log("Función de grabación no implementada aún.");
    setIsRecording(prev => !prev);
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-white bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        <p className="ml-4">Cargando sala de video...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-500 bg-gray-900">
        <p>Error: {error}</p>
        <button onClick={() => navigate('/rooms')} className="ml-4 px-4 py-2 bg-blue-600 rounded">Volver a Salas</button>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-black text-white">
      {/* Videollamada principal */}
      <div className="flex flex-col flex-1 relative">

        {/* Grid de videos */}
       <div className="flex-1 flex items-center justify-center bg-gray-950">
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-6xl p-4">

    {/* Video local */}
    <div className="relative rounded-xl overflow-hidden border border-gray-700 shadow-lg aspect-video bg-black">
      <video ref={localVideoRef} autoPlay muted className="w-full h-full object-cover" />
      <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 px-3 py-1 text-sm rounded text-white">
        Tú
      </div>
       {micEnabled && (
   <div className="absolute top-2 right-2 flex gap-[2px] items-end h-6">
    {Array.from({ length: 5 }).map((_, i) => {
      const level = (volume2 / 255) * 5;
      const barHeight = i < level ? (i + 1) * 4 : 2;
      return (
        <div
  key={i}
  className="w-1 bg-white transition-all duration-100"
  style={{ height: `${barHeight}px` }}
/>

      );
    })}
  </div>
)}
    </div>


    {/* Videos remotos (ahora usando RemoteVideo y los streams del estado) */}
    {Object.entries(participants).map(([id, participantData]) => {
      if (id === currentUser?.id) return null; // No renderizar el video local aquí
      const remoteStream = remoteStreams[id] || null;
      return (
        <RemoteVideo key={id} stream={remoteStream} name={participantData.name} />
      );
    })}
  </div>
</div>

        {/* Controles */}
        <div className="flex justify-center gap-4 p-4 border-t border-gray-700 bg-black bg-opacity-80">
          <button
            onClick={toggleMic}
            className="w-12 h-12 rounded-full flex items-center justify-center bg-gray-700 hover:bg-gray-600"
          >
            {micEnabled ? <Mic size={20} /> : <MicOff size={20} />}
          </button>

          <button
            onClick={toggleVideo}
            className="w-12 h-12 rounded-full flex items-center justify-center bg-gray-700 hover:bg-gray-600"
          >
            {videoEnabled ? <Video size={20} /> : <VideoOff size={20} />}
          </button>

          <button
            onClick={toggleScreenShare}
            className="w-12 h-12 rounded-full flex items-center justify-center bg-gray-700 hover:bg-gray-600"
          >
            <ScreenShare size={20} />
          </button>

          {isTeacher && (
            <button
              onClick={toggleRecording} // Ahora el onClick está presente
              className="w-12 h-12 rounded-full flex items-center justify-center bg-gray-700 hover:bg-gray-600"
            >
              <StopCircle size={20} className={isRecording ? 'text-red-500' : ''} />
            </button>
          )}

          <button
            onClick={endCall}
            className="w-12 h-12 rounded-full flex items-center justify-center bg-red-600 hover:bg-red-700"
          >
            <PhoneOff size={20} />
          </button>
        </div>
      </div>

      {/* Chat lateral */}
      <div className="w-80 border-l border-gray-700 bg-gray-900 flex flex-col">
        <div className="p-4 border-b border-gray-700 text-lg font-semibold flex items-center gap-2">
          <MessageSquare size={20} /> Chat
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {messages.map((msg, idx) => (
            <div key={idx} className="bg-gray-800 p-2 rounded">
              <div className="text-xs text-gray-400">{msg.sender}</div>
              <div className="text-sm">{msg.text}</div>
            </div>
          ))}
        </div>
        <form
          onSubmit={handleSendMessage}
          className="p-4 border-t border-gray-700 flex gap-2"
        >
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            className="flex-1 p-2 rounded bg-gray-800 text-white"
            placeholder="Escribe un mensaje..."
          />
          <button type="submit" className="bg-blue-600 px-4 py-2 rounded hover:bg-blue-700">
            Enviar
          </button>
        </form>
      </div>
    </div>
  );
};

export default VideoRoom;