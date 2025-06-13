
import { useEffect, useState } from 'react';

export const useMicVolume = (stream: MediaStream | null) => {
  const [volume, setVolume] = useState(0);

  useEffect(() => {
    if (!stream) return;

    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    source.connect(analyser);

    let animationFrameId: number;

    const updateVolume = () => {
      analyser.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      setVolume(avg);
      animationFrameId = requestAnimationFrame(updateVolume);
    };

    updateVolume();

    return () => {
      cancelAnimationFrame(animationFrameId);
      analyser.disconnect();
      source.disconnect();
      audioContext.close();
    };
  }, [stream]);

  return volume;
};
