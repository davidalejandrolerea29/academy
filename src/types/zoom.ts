// Types for Zoom Video SDK integration
import type ZoomVideo from '@zoom/videosdk';

export interface ZoomParticipant {
    userId: number;
    displayName: string;
    audio: 'computer' | 'phone' | 'voip' | '';
    muted: boolean;
    bVideoOn: boolean;
    sharerOn: boolean;
    sharerPause: boolean;
}

export interface ZoomSessionConfig {
    sessionName: string;
    sessionPasscode?: string;
    userName: string;
    userIdentity?: string;
    token: string;
}

export interface ZoomStreamState {
    userId: number;
    displayName: string;
    videoEnabled: boolean;
    audioEnabled: boolean;
    isSharing: boolean;
    videoElement?: HTMLVideoElement | HTMLCanvasElement;
    shareElement?: HTMLVideoElement | HTMLCanvasElement;
}

export interface UseZoomVideoResult {
    client: typeof ZoomVideo | null;
    isInSession: boolean;
    participants: Map<number, ZoomStreamState>;
    localUserId: number | null;
    isVideoOn: boolean;
    isAudioOn: boolean;
    isSharingScreen: boolean;

    // Actions
    joinSession: (config: ZoomSessionConfig) => Promise<void>;
    leaveSession: () => Promise<void>;
    toggleVideo: () => Promise<void>;
    toggleAudio: () => Promise<void>;
    startScreenShare: () => Promise<void>;
    stopScreenShare: () => Promise<void>;

    // Error state
    error: string | null;
}

export interface ZoomTokenResponse {
    token: string;
    sessionName: string;
}

export interface ZoomSessionInfo {
    sessionId: string;
    sessionName: string;
    sessionPasscode?: string;
    createdAt: string;
}
