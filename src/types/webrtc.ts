export interface ConnectionStatus {
    isInChannel: boolean;
    hasPeerConnection: boolean;
    hasActiveStream: boolean;
    lastHeartbeat: number;
    connectionQuality: 'good' | 'poor' | 'disconnected';
}

export interface HeartbeatSignal {
    type: 'heartbeat';
    timestamp: number;
    hasVideo: boolean;
    hasAudio: boolean;
}

export interface ConnectionIssue {
    peerId: string;
    peerName: string;
    issue: 'no_peer_connection' | 'no_stream' | 'heartbeat_timeout';
    detectedAt: number;
}

export interface ConnectionMonitorResult {
    connectionStatuses: Record<string, ConnectionStatus>;
    issues: ConnectionIssue[];
    forceReconnect: (peerId: string) => Promise<void>;
}
