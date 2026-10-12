import React from 'react';
import { ConnectionIssue } from '../../types/webrtc';
import { AlertCircle, RefreshCw, X } from 'lucide-react';

interface ConnectionAlertProps {
    issues: ConnectionIssue[];
    onReconnect: (peerId: string) => void;
    onDismiss: (peerId: string) => void;
}

const ConnectionAlert: React.FC<ConnectionAlertProps> = ({ issues, onReconnect, onDismiss }) => {
    if (issues.length === 0) return null;

    const getIssueMessage = (issue: ConnectionIssue): string => {
        switch (issue.issue) {
            case 'no_peer_connection':
                return `${issue.peerName} está en el aula pero no se puede establecer conexión`;
            case 'no_stream':
                return `${issue.peerName} está conectado pero no se puede ver su video`;
            case 'heartbeat_timeout':
                return `La conexión con ${issue.peerName} parece inestable`;
            default:
                return `Problema de conexión con ${issue.peerName}`;
        }
    };

    return (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 max-w-md w-full px-4">
            {issues.map((issue) => (
                <div
                    key={issue.peerId}
                    className="mb-2 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg shadow-lg flex items-start gap-3 animate-slideDown"
                >
                    <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />

                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-yellow-800">
                            Problema de Conexión
                        </p>
                        <p className="text-sm text-yellow-700 mt-1">
                            {getIssueMessage(issue)}
                        </p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                            onClick={() => onReconnect(issue.peerId)}
                            className="p-1.5 hover:bg-yellow-100 rounded-full transition-colors"
                            title="Intentar reconectar"
                        >
                            <RefreshCw className="w-4 h-4 text-yellow-600" />
                        </button>
                        <button
                            onClick={() => onDismiss(issue.peerId)}
                            className="p-1.5 hover:bg-yellow-100 rounded-full transition-colors"
                            title="Cerrar"
                        >
                            <X className="w-4 h-4 text-yellow-600" />
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ConnectionAlert;
