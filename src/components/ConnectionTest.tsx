import React, { useEffect, useState } from "react";
import { Wifi, WifiOff, Loader } from "lucide-react";

interface Props {
  fileUrl?: string; // URL de un archivo pequeño para medir velocidad real
  fileSizeMB?: number; // Tamaño del archivo en MB
}

const ConnectionTest: React.FC<Props> = ({
  fileUrl,
  fileSizeMB = 1, // por defecto 1 MB
}) => {
  const [speed, setSpeed] = useState<number | null>(null);
  const [ping, setPing] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const measureSpeed = async () => {
    setLoading(true);
    setError(false);

    try {
      // --- Medición de ping ---
      let pingTime: number | null = null;
      if (fileUrl) {
        const pingStart = performance.now();
        await fetch(fileUrl, { method: "HEAD", cache: "no-store" });
        const pingEnd = performance.now();
        pingTime = Math.round(pingEnd - pingStart);
        setPing(pingTime);
      }

      // --- Medición de velocidad ---
      if (fileUrl) {
        const start = performance.now();
        const res = await fetch(fileUrl, { cache: "no-store" });
        await res.blob();
        const end = performance.now();

        const duration = (end - start) / 1000; // segundos
        const mbps = (fileSizeMB * 8) / duration;
        setSpeed(Number(mbps.toFixed(2)));
      } else if ((navigator as any).connection) {
        // fallback: velocidad estimada del navegador
        const conn = (navigator as any).connection;
        setSpeed(conn.downlink); // en Mbps
        setPing(conn.rtt); // en ms
      } else {
        setSpeed(null);
        setPing(null);
      }
    } catch (e) {
      console.error("Error midiendo velocidad:", e);
      setError(true);
    }

    setLoading(false);
  };

  useEffect(() => {
    measureSpeed();
    const interval = setInterval(measureSpeed, 60000); // cada 1 minuto
    return () => clearInterval(interval);
  }, []);
useEffect(() => {
  console.log("Speed:", speed, "Mbps | Ping:", ping, "ms");
}, [speed, ping]);
  if (loading) {
    return (
      <span className="flex items-center text-yellow-500 text-sm font-medium animate-pulse">
        <Loader className="w-4 h-4 mr-1" />
        Midiendo...
      </span>
    );
  }

  if (error) {
    return (
      <span className="flex items-center text-red-500 text-sm font-medium">
        <WifiOff className="w-4 h-4 mr-1" />
        Error
      </span>
    );
  }

  return (
    <span className="flex items-center text-sm font-medium text-gray-700 space-x-2">
      <Wifi className="w-4 h-4 text-green-600" />
      <span>{speed ? `${speed} Mbps` : "N/A"}</span>
      {ping !== null && <span>⏱ {ping} ms</span>}
    </span>
  );
};

export default ConnectionTest;
