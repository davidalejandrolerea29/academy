import React, { useEffect, useRef, useState } from 'react';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTeacher, setIsTeacher] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);


  useEffect(() => {
    if (!roomId || !currentUser) return;

    const channel = window.Echo.join(`video-room.${roomId}`);

    channel.listen('.signal', async ({ from, data }) => {
      if (from === currentUser.id) return;

      console.log('Signal received:', data);

      if (data.type === 'offer') {
        await handleOffer(data);
      } else if (data.type === 'answer') {
        await handleAnswer(data);
      } else if (data.type === 'candidate') {
        await handleCandidate(data);
      }
    });

    return () => {
      window.Echo.leave(`video-room.${roomId}`);
    };
  }, [roomId, currentUser]);
  useEffect(() => {
    const startMedia = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
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

const sendSignal = (data: any) => {
  window.Echo.connector.pusher.send_event(
    'signal',
    {
      from: currentUser.id,
      data,
    },
    `presence-video-room.${roomId}`
  );
};

const startCall = async () => {
  const pc = await createConnection();

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


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-4">
        <Shield className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Error de Acceso</h1>
        <p className="text-gray-600">{error}</p>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-4">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Sala no encontrada</h1>
      </div>
    );
  }

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
  </div>
  );
};

export default VideoRoom;
