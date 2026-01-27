import { useState, useEffect, useCallback, useRef } from 'react';
import { RoomService } from '../services/RoomService';
import { RoomStatusResponse } from '../types';

const POLLING_INTERVAL = 30000; // 30 seconds

export function useRoomStatus(token: string | null) {
    const [statusData, setStatusData] = useState<RoomStatusResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    const fetchStatus = useCallback(async () => {
        if (!token) return;

        try {
            const data = await RoomService.getRoomsStatus(token);
            setStatusData(data);
            setError(null);
        } catch (err) {
            console.error('Error fetching room status:', err);
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, [token]);

    // Setup polling with visibility optimization
    useEffect(() => {
        if (!token) return;

        const startPolling = () => {
            fetchStatus();
            intervalRef.current = setInterval(fetchStatus, POLLING_INTERVAL);
        };

        const stopPolling = () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };

        const handleVisibilityChange = () => {
            if (document.hidden) {
                stopPolling();
            } else {
                startPolling();
            }
        };

        // Start polling immediately
        startPolling();

        // Pause polling when tab is hidden
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            stopPolling();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [token, fetchStatus]);

    return { statusData, loading, error, refetch: fetchStatus };
}
