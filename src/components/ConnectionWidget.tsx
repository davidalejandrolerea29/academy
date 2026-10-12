
import React, { useState } from "react";
import { Wifi, WifiOff, Loader, AlertCircle } from "lucide-react";
import ConnectionTest from "./ConnectionTest";
import { ReverbWebSocketService } from "../services/ReverbWebSocketService";

interface Props {
  webSocketConnected: boolean;
  isConnecting: boolean;
  reverbService?: ReverbWebSocketService | null;
  onStatusChange?: (status: "good" | "warning" | "error") => void;
}

const ConnectionWidget: React.FC<Props> = ({
  webSocketConnected,
  isConnecting,
  onStatusChange,
}) => {
  const [connectionStatus, setConnectionStatus] = useState<"good" | "warning" | "error">("good");

  const handleStatusChange = (status: "good" | "warning" | "error") => {
    setConnectionStatus(status);
    if (onStatusChange) onStatusChange(status);
  };

  const getWebSocketIndicator = () => {
    if (isConnecting) {
      return (
        <span className="flex items-center text-yellow-500 text-xs font-medium animate-pulse">
          <Loader className="w-3 h-3 mr-1" />
          Conectando...
        </span>
      );
    }
    if (webSocketConnected) {
      return (
        <span className="flex items-center text-green-600 text-xs font-medium">
          <Wifi className="w-3 h-3 mr-1" />
          Conectado
        </span>
      );
    }
    return (
      <span className="flex items-center text-red-500 text-xs font-medium">
        <WifiOff className="w-3 h-3 mr-1" />
        Desconectado
      </span>
    );
  };

  return (
   <div className="w-full p-3 bg-white shadow rounded-md border border-gray-200 flex flex-col space-y-2 text-center text-xs font-sans">
  <div>{getWebSocketIndicator()}</div>

  <ConnectionTest
    fileUrl="/api/speed-test"
    fileSizeMB={1}
    onStatusChange={handleStatusChange}
  />

  {(connectionStatus === "warning" || connectionStatus === "error") && (
    <div
      className={`flex items-center justify-center space-x-1 p-2 rounded-md shadow ${
        connectionStatus === "warning" ? "bg-yellow-100 text-yellow-600" : "bg-red-100 text-red-600"
      }`}
    >
      <AlertCircle className="w-3 h-3" />
      <span>
        {connectionStatus === "warning"
          ? "Tu conexión es baja, la videollamada puede fallar."
          : "No se pudo medir la velocidad. Videollamada inestable."}
      </span>
    </div>
  )}
</div>

  );
};

export default ConnectionWidget;
