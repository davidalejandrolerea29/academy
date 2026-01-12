// Service to handle Zoom JWT token generation via backend
import axios from 'axios';
import type { ZoomTokenResponse, ZoomSessionInfo } from '../types/zoom';

const API_URL = import.meta.env.VITE_API_URL;

export class ZoomTokenService {
    private static instance: ZoomTokenService;
    private token: string;

    private constructor(authToken: string) {
        this.token = authToken;
    }

    public static getInstance(authToken: string): ZoomTokenService {
        if (!ZoomTokenService.instance) {
            ZoomTokenService.instance = new ZoomTokenService(authToken);
        } else {
            ZoomTokenService.instance.token = authToken;
        }
        return ZoomTokenService.instance;
    }

    /**
     * Generate a Zoom Video SDK JWT token from the backend
     * @param sessionName - The name of the session to join
     * @param role - User role (0 = participant, 1 = host)
     */
    public async generateToken(
        sessionName: string,
        role: 0 | 1 = 0
    ): Promise<ZoomTokenResponse> {
        try {
            const response = await axios.post<ZoomTokenResponse>(
                `${API_URL}/zoom/generate-token`,
                {
                    sessionName,
                    role,
                },
                {
                    headers: {
                        Authorization: `Bearer ${this.token}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            return response.data;
        } catch (error: any) {
            console.error('[ZoomTokenService] Error generating token:', error);
            throw new Error(
                error.response?.data?.message || 'Failed to generate Zoom token'
            );
        }
    }

    /**
     * Create a new Zoom session on the backend
     * @param sessionName - The name of the session
     * @param sessionPasscode - Optional passcode for the session
     */
    public async createSession(
        sessionName: string,
        sessionPasscode?: string
    ): Promise<ZoomSessionInfo> {
        try {
            const response = await axios.post<ZoomSessionInfo>(
                `${API_URL}/zoom/create-session`,
                {
                    sessionName,
                    sessionPasscode,
                },
                {
                    headers: {
                        Authorization: `Bearer ${this.token}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            return response.data;
        } catch (error: any) {
            console.error('[ZoomTokenService] Error creating session:', error);
            throw new Error(
                error.response?.data?.message || 'Failed to create Zoom session'
            );
        }
    }

    /**
     * End a Zoom session on the backend
     * @param sessionId - The ID of the session to end
     */
    public async endSession(sessionId: string): Promise<void> {
        try {
            await axios.post(
                `${API_URL}/zoom/end-session`,
                { sessionId },
                {
                    headers: {
                        Authorization: `Bearer ${this.token}`,
                        'Content-Type': 'application/json',
                    },
                }
            );
        } catch (error: any) {
            console.error('[ZoomTokenService] Error ending session:', error);
            throw new Error(
                error.response?.data?.message || 'Failed to end Zoom session'
            );
        }
    }

    /**
     * Update the authentication token
     */
    public updateToken(newToken: string): void {
        this.token = newToken;
    }
}

// Export a factory function
export const createZoomTokenService = (authToken: string): ZoomTokenService => {
    return ZoomTokenService.getInstance(authToken);
};
