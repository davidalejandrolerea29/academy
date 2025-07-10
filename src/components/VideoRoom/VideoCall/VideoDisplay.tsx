// components/VideoCall/VideoDisplay.tsx
import React from 'react';
import { ScreenShare, Users } from 'lucide-react';
import RemoteVideo from '../RemoteVideo'; // Asegúrate de que esta ruta sea correcta

interface VideoDisplayProps {
  currentScreenShareStream: MediaStream | null;
  currentScreenShareOwnerId: string | null;
  currentScreenShareOwnerName: string | null;
  isSharingScreen: boolean;
  allActiveStreams: MediaStream[];
  localStream: MediaStream | null;
  currentUser: { id: string; name: string } | null;
  videoEnabled: boolean;
  micEnabled: boolean;
  volume: number; // Suponiendo que `volume` es para el audio local
  participants: Record<string, any>; // Usa el tipo correcto para ParticipantState
}

export const VideoDisplay: React.FC<VideoDisplayProps> = ({
  currentScreenShareStream,
  currentScreenShareOwnerId,
  currentScreenShareOwnerName,
  isSharingScreen,
  allActiveStreams,
  localStream,
  currentUser,
  videoEnabled,
  micEnabled,
  volume,
  participants,
}) => {
  const totalVideosInGrid = (localStream && videoEnabled ? 1 : 0) +
    Object.values(participants).filter(p => p.cameraStream && p.videoEnabled).length;

  let gridColsClass = "grid-cols-1";
  if (totalVideosInGrid === 2) gridColsClass = "grid-cols-1 sm:grid-cols-2";
  else if (totalVideosInGrid === 3) gridColsClass = "grid-cols-1 sm:grid-cols-3 md:grid-cols-3";
  else if (totalVideosInGrid === 4) gridColsClass = "grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4";
  else if (totalVideosInGrid >= 5) gridColsClass = "grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";

  return (
    <div className="flex-grow relative p-2 md:p-4 bg-gray-950">
      {/* Aquí podrías incluir el RecordingIndicator si `isRecording` es una prop que se pasa aquí */}
      {/* <RecordingIndicator isRecording={isRecording} /> */}

      {currentScreenShareStream ? (
        <>
          {/* Video PRINCIPAL: La pantalla compartida (propia o remota) */}
          <div className="w-full flex-grow flex items-center justify-center bg-gray-800 rounded-lg overflow-hidden mb-2 md:mb-4 max-h-[70vh]">
            <RemoteVideo
              stream={currentScreenShareStream}
              participantId={`${currentScreenShareOwnerId}-screen`}
              participantName={currentScreenShareOwnerName}
              videoEnabled={true}
              micEnabled={currentScreenShareStream.getAudioTracks().length > 0}
              isLocal={isSharingScreen}
              volume={0}
              isScreenShare={true}
            />
          </div>
          {/* Miniaturas de otros participantes (cámaras y otras pantallas) */}
          {allActiveStreams.length > 0 && (
            <div className="w-full flex gap-2 md:gap-3 flex-shrink-0 overflow-x-auto p-1 md:p-2 scrollbar-hide">
              {/* Tu cámara local (siempre visible si localStream existe y videoEnabled) */}
              {localStream && videoEnabled && (
                <div className="flex-none w-36 h-24 sm:w-48 sm:h-32 md:w-56 md:h-36 lg:w-64 lg:h-40">
                  <RemoteVideo
                    stream={localStream}
                    participantId={currentUser?.id || 'local'}
                    participantName={`${currentUser?.name || 'Tú'} (Yo)`}
                    videoEnabled={videoEnabled}
                    micEnabled={micEnabled}
                    isLocal={true}
                    volume={volume}
                    isScreenShare={false}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              {/* Cámaras de participantes remotos y otras PANTALLAS COMPARTIDAS */}
              {Object.values(participants).map(participant => (
                <React.Fragment key={participant.id}>
                  {participant.cameraStream && participant.videoEnabled && (
                    <div className="flex-none w-36 h-24 sm:w-48 sm:h-32 md:w-56 md:h-36 lg:w-64 lg:h-40">
                      <RemoteVideo
                        key={participant.id + '-camera'}
                        stream={participant.cameraStream!}
                        participantId={participant.id}
                        participantName={participant.name}
                        videoEnabled={participant.videoEnabled}
                        micEnabled={participant.micEnabled}
                        isLocal={false}
                        volume={0}
                        isScreenShare={false}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  {participant.screenStream && participant.id !== currentScreenShareOwnerId && (
                    <div className="flex-none w-36 h-24 sm:w-48 sm:h-32 md:w-56 md:h-36 lg:w-64 lg:h-40">
                      <RemoteVideo
                        key={participant.id + '-screen'}
                        stream={participant.screenStream!}
                        participantId={participant.id}
                        participantName={`${participant.name} (Pantalla)`}
                        videoEnabled={true}
                        micEnabled={participant.screenStream?.getAudioTracks().length > 0}
                        isLocal={false}
                        volume={0}
                        isScreenShare={true}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center p-2">
          <div className={`w-full h-full grid ${gridColsClass} gap-3 md:gap-4 auto-rows-fr`}>
            {localStream && videoEnabled && (
              <RemoteVideo
                stream={localStream}
                participantId={currentUser?.id || 'local'}
                participantName={`${currentUser?.name || 'Tú'} (Yo)`}
                videoEnabled={videoEnabled}
                micEnabled={micEnabled}
                isLocal={true}
                volume={volume}
                isScreenShare={false}
              />
            )}
            {Object.values(participants)
              .filter(p => p.cameraStream && p.videoEnabled)
              .map(participant => (
                <RemoteVideo
                  key={participant.id}
                  stream={participant.cameraStream!}
                  participantId={participant.id}
                  participantName={participant.name}
                  videoEnabled={participant.videoEnabled}
                  micEnabled={participant.micEnabled}
                  isLocal={false}
                  volume={0}
                  isScreenShare={false}
                />
              ))}
          </div>
        </div>
      )}
    </div>
  );
};