import React, { useEffect, useState } from 'react';
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
  const [jwtToken, setJwtToken] = useState<string | null>(null); // 👈 token para JaaS

  const JAA_APP_ID = import.meta.env.VITE_JAA_APP_ID;
  const JAA_APP_SECRET = import.meta.env.VITE_JAA_APP_SECRET;

  useEffect(() => {
    const fetchRoom = async () => {
      if (!roomId || !currentUser) return;

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_URL}/auth/rooms?user_id=${currentUser.id}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          setError('No se pudo obtener la sala o no tienes permiso');
          setLoading(false);
          return;
        }

        const rooms: Room[] = await response.json();
        const roomData = rooms.find(r => r.id === Number(roomId));

        if (!roomData) {
          setError('Sala no encontrada o no tienes permiso');
          setLoading(false);
          return;
        }

        const parsedRoom: Room = {
          ...roomData,
          start_time: new Date(roomData.start_time),
          end_time: new Date(roomData.end_time),
        };

        const canJoin =
          currentUser.role_description === 'Admin' ||
          parsedRoom.teacher_id === currentUser.id ||
          parsedRoom.participants?.includes(currentUser.id.toString());

        if (!canJoin) {
          setError('No tienes permiso para entrar a esta sala');
          setLoading(false);
          return;
        }

        setRoom(parsedRoom);
        setIsTeacher(currentUser.role_description === 'teacher' || currentUser.role_description === 'Admin');
        setIsRecording(parsedRoom.is_recording);

        // ✅ Generar JWT para JaaS
        // Obtener JWT desde el servidor
const jwtResponse = await fetch(`${API_URL}/auth/jitsi/token`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({
    roomId: parsedRoom.name,
    name: currentUser.name,
    user_id: currentUser.id,
    email: currentUser.email,
  }),
});

if (!jwtResponse.ok) {
  setError('Error al obtener el token de Jitsi');
  setLoading(false);
  return;
}
console.log('la respuesta', jwtResponse)

const { token: serverJwtToken } = await jwtResponse.json();
setJwtToken(serverJwtToken);


      } catch (err) {
        console.error('Error fetching room:', err);
        setError('Error al cargar la sala');
      } finally {
        setLoading(false);
      }
    };

    fetchRoom();
  }, [roomId, currentUser]);

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

  if (loading || !jwtToken) {
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
    <div className="flex flex-col h-screen">
      <div className="bg-white shadow-sm p-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">{room.name}</h1>
          <p className="text-sm text-gray-500">{room.description}</p>
        </div>
        {isTeacher && (
          <button
            onClick={toggleRecording}
            className={`flex items-center px-4 py-2 rounded-md text-white ${
              isRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'
            }`}
          >
            {isRecording ? (
              <>
                <VideoOff className="w-5 h-5 mr-2" />
                Detener Grabación
              </>
            ) : (
              <>
                <Video className="w-5 h-5 mr-2" />
                Iniciar Grabación
              </>
            )}
          </button>
        )}
      </div>

      <div className="flex-1">
        <JitsiMeeting
          domain="8x8.vc"
     roomName={`${import.meta.env.VITE_JAA_APP_ID}/${room.name}`}


          jwt={jwtToken}
          configOverwrite={{
            startWithAudioMuted: true,
            startWithVideoMuted: true,
            prejoinPageEnabled: false,
            disableInviteFunctions: true,
            enableWelcomePage: false,
            requireDisplayName: false,
            disableDeepLinking: true,
            enableAuthentication: false,
            enableUserRolesBasedOnToken: true,
          }}
          interfaceConfigOverwrite={{
            TOOLBAR_BUTTONS: ['microphone', 'camera', 'raisehand', 'hangup', 'tileview'],
            SETTINGS_SECTIONS: ['devices', 'language', 'moderator'],
            SHOW_JITSI_WATERMARK: false,
            DEFAULT_LANGUAGE: 'es',
          }}
          userInfo={{
            email: currentUser?.email || '',
            displayName: currentUser?.name || 'Invitado'
          }}
          getIFrameRef={(iframeRef) => {
            iframeRef.style.height = '100%';
          }}
        />
      </div>
    </div>
  );
};

export default VideoRoom;
