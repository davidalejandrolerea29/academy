import { Room } from '../types';

const API_URL = import.meta.env.VITE_API_URL;

// We extend the base Room type to include frontend specific fields if needed
export interface RoomFrontend extends Omit<Room, 'start_time' | 'end_time'> {
    start_time: string; // The API returns date strings
    end_time: string;
    teacher?: {
        id: number;
        name: string;
    };
    participants?: any[];
}

export const RoomService = {
    getAll: async (token: string): Promise<RoomFrontend[]> => {
        const response = await fetch(`${API_URL}/auth/rooms`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
        });

        if (!response.ok) {
            throw new Error('Error fetching rooms');
        }

        const data = await response.json();
        return data;
    },

    getById: async (token: string, roomId: string): Promise<RoomFrontend> => {
        const response = await fetch(`${API_URL}/auth/rooms/${roomId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
        });

        if (!response.ok) {
            throw new Error('Error fetching room details');
        }

        return await response.json();
    }
};
