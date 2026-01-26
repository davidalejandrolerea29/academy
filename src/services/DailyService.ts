const API_URL = import.meta.env.VITE_API_URL;

export interface DailyRecording {
    id: string;
    room_name: string;
    start_time: string;
    start_ts?: number; // Raw timestamp from Daily
    created_at?: number; // Creation timestamp
    duration: number;
    download_link: string;
}

interface RecordingsResponse {
    success: boolean;
    recordings: DailyRecording[];
}

export const DailyService = {
    getRecordings: async (token: string, roomName?: string): Promise<DailyRecording[]> => {
        try {
            const url = new URL(`${API_URL}/auth/daily/recordings`);
            if (roomName) {
                url.searchParams.append('room_name', roomName);
            }

            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json',
                },
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Error al obtener las grabaciones');
            }

            const data: RecordingsResponse = await response.json();
            return data.recordings || [];
        } catch (error) {
            console.error('Error fetching recordings:', error);
            throw error;
        }
    }
};
