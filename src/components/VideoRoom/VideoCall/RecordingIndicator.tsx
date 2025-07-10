// components/VideoCall/RecordingIndicator.tsx
import React from 'react';
import { Dot } from 'lucide-react';

interface RecordingIndicatorProps {
  isRecording: boolean;
}

export const RecordingIndicator: React.FC<RecordingIndicatorProps> = ({ isRecording }) => {
  if (!isRecording) return null; // No renderizar si no está grabando

  return (
    <div className="absolute top-4 left-4 z-10 flex items-center bg-gray-800 bg-opacity-75 px-2 py-1 rounded-full text-sm font-semibold md:px-3 md:py-1">
      <Dot className="w-5 h-5 text-red-500 mr-0 md:mr-2 animate-pulse-custom" />
      <span className="hidden md:inline">Grabando</span>
    </div>
  );
};