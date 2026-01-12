// Wrapper service for Zoom Video SDK
import ZoomVideo, {
    VideoClient,
    Stream,
    Participant,
    VideoQuality
} from '@zoom/videosdk';
import type { ZoomSessionConfig, ZoomStreamState } from '../types/zoom';

export class ZoomVideoSDKService {
    private client: typeof VideoClient | null = null;
    private stream: typeof Stream | null = null;
    private mediaStream: MediaStream | null = null;
    private isInitialized = false;

    constructor() {
        console.log('[ZoomVideoSDK] Service initialized');
    }

    /**
     * Initialize the Zoom Video SDK client
     */
    public async init(): Promise<typeof VideoClient> {
        if (this.isInitialized && this.client) {
            return this.client;
        }

        try {
            this.client = ZoomVideo.createClient();
            await this.client.init('en-US', 'Global', { patchJsMedia: true });
            this.isInitialized = true;
            console.log('[ZoomVideoSDK] Client initialized successfully');
            return this.client;
        } catch (error) {
            console.error('[ZoomVideoSDK] Failed to initialize client:', error);
            throw error;
        }
    }

    /**
     * Join a Zoom session
     */
    public async joinSession(config: ZoomSessionConfig): Promise<void> {
        if (!this.client) {
            await this.init();
        }

        try {
            await this.client!.join(
                config.sessionName,
                config.token,
                config.userName,
                config.sessionPasscode
            );

            this.stream = this.client!.getMediaStream();
            console.log('[ZoomVideoSDK] Joined session successfully:', config.sessionName);
        } catch (error) {
            console.error('[ZoomVideoSDK] Failed to join session:', error);
            throw error;
        }
    }

    /**
     * Leave the current session
     */
    public async leaveSession(): Promise<void> {
        try {
            if (this.stream) {
                // Stop all media before leaving
                await this.stopVideo();
                await this.stopAudio();
                if (await this.stream.isShareScreenOn()) {
                    await this.stopScreenShare();
                }
            }

            if (this.client) {
                await this.client.leave();
                console.log('[ZoomVideoSDK] Left session successfully');
            }

            this.stream = null;
            this.mediaStream = null;
        } catch (error) {
            console.error('[ZoomVideoSDK] Error leaving session:', error);
            throw error;
        }
    }

    /**
     * Start video
     */
    public async startVideo(videoElement?: HTMLVideoElement): Promise<void> {
        if (!this.stream) {
            throw new Error('Not in a session');
        }

        try {
            if (videoElement) {
                await this.stream.startVideo({ videoElement });
            } else {
                await this.stream.startVideo();
            }
            console.log('[ZoomVideoSDK] Video started');
        } catch (error) {
            console.error('[ZoomVideoSDK] Failed to start video:', error);
            throw error;
        }
    }

    /**
     * Stop video
     */
    public async stopVideo(): Promise<void> {
        if (!this.stream) return;

        try {
            await this.stream.stopVideo();
            console.log('[ZoomVideoSDK] Video stopped');
        } catch (error) {
            console.error('[ZoomVideoSDK] Failed to stop video:', error);
            throw error;
        }
    }

    /**
     * Start audio (unmute)
     */
    public async startAudio(): Promise<void> {
        if (!this.stream) {
            throw new Error('Not in a session');
        }

        try {
            await this.stream.startAudio();
            console.log('[ZoomVideoSDK] Audio started');
        } catch (error) {
            console.error('[ZoomVideoSDK] Failed to start audio:', error);
            throw error;
        }
    }

    /**
     * Stop audio (mute)
     */
    public async stopAudio(): Promise<void> {
        if (!this.stream) return;

        try {
            await this.stream.muteAudio();
            console.log('[ZoomVideoSDK] Audio muted');
        } catch (error) {
            console.error('[ZoomVideoSDK] Failed to mute audio:', error);
            throw error;
        }
    }

    /**
     * Start screen sharing
     */
    public async startScreenShare(): Promise<void> {
        if (!this.stream) {
            throw new Error('Not in a session');
        }

        try {
            await this.stream.startShareScreen(document.querySelector('#screen-share-canvas') as HTMLCanvasElement);
            console.log('[ZoomVideoSDK] Screen sharing started');
        } catch (error) {
            console.error('[ZoomVideoSDK] Failed to start screen sharing:', error);
            throw error;
        }
    }

    /**
     * Stop screen sharing
     */
    public async stopScreenShare(): Promise<void> {
        if (!this.stream) return;

        try {
            await this.stream.stopShareScreen();
            console.log('[ZoomVideoSDK] Screen sharing stopped');
        } catch (error) {
            console.error('[ZoomVideoSDK] Failed to stop screen sharing:', error);
            throw error;
        }
    }

    /**
     * Render video for a participant
     */
    public async renderVideo(
        canvas: HTMLCanvasElement,
        userId: number,
        width: number,
        height: number,
        quality?: VideoQuality
    ): Promise<void> {
        if (!this.stream) {
            throw new Error('Not in a session');
        }

        try {
            await this.stream.renderVideo(
                canvas,
                userId,
                width,
                height,
                0,
                0,
                quality || VideoQuality.Video_360P
            );
        } catch (error) {
            console.error('[ZoomVideoSDK] Failed to render video:', error);
            throw error;
        }
    }

    /**
     * Stop rendering video for a participant
     */
    public async stopRenderVideo(canvas: HTMLCanvasElement, userId: number): Promise<void> {
        if (!this.stream) return;

        try {
            await this.stream.stopRenderVideo(canvas, userId);
        } catch (error) {
            console.error('[ZoomVideoSDK] Failed to stop rendering video:', error);
        }
    }

    /**
     * Get all participants in the session
     */
    public getParticipants(): Participant[] {
        if (!this.client) return [];
        return this.client.getAllUser();
    }

    /**
     * Get current user info
     */
    public getCurrentUser(): Participant | null {
        if (!this.client) return null;
        return this.client.getCurrentUserInfo();
    }

    /**
     * Check if video is on
     */
    public isVideoOn(): boolean {
        if (!this.stream) return false;
        return this.stream.isCapturingVideo();
    }

    /**
     * Check if audio is on
     */
    public isAudioOn(): boolean {
        if (!this.stream) return false;
        return !this.stream.isAudioMuted();
    }

    /**
     * Check if screen sharing is on
     */
    public async isScreenShareOn(): Promise<boolean> {
        if (!this.stream) return false;
        return await this.stream.isShareScreenOn();
    }

    /**
     * Get the media stream instance
     */
    public getStream(): typeof Stream | null {
        return this.stream;
    }

    /**
     * Get the client instance
     */
    public getClient(): typeof VideoClient | null {
        return this.client;
    }

    /**
     * Destroy the service and cleanup
     */
    public async destroy(): Promise<void> {
        try {
            await this.leaveSession();
            this.client = null;
            this.stream = null;
            this.mediaStream = null;
            this.isInitialized = false;
            console.log('[ZoomVideoSDK] Service destroyed');
        } catch (error) {
            console.error('[ZoomVideoSDK] Error destroying service:', error);
        }
    }
}

// Export singleton instance
let zoomServiceInstance: ZoomVideoSDKService | null = null;

export const getZoomVideoSDKService = (): ZoomVideoSDKService => {
    if (!zoomServiceInstance) {
        zoomServiceInstance = new ZoomVideoSDKService();
    }
    return zoomServiceInstance;
};
