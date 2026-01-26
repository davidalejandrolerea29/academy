import React, { useState, useEffect } from 'react';
import { Play, Download, Calendar, Clock, Video } from 'lucide-react';


interface Recording {
    id: string;
    roomId: string; // The room where it was recorded
    roomName: string;
    startTime: string; // ISO Date
    duration: number; // seconds
    url: string; // Download/View URL
    size: number; // bytes
}

// Mock data
const MOCK_RECORDINGS: Recording[] = [
    {
        id: 'rec_1',
        roomId: 'room_a',
        roomName: 'Clase de Inglés Básico',
        startTime: new Date(Date.now() - 86400000).toISOString(),
        duration: 3600,
        url: '#',
        size: 1024 * 1024 * 50
    },
    {
        id: 'rec_2',
        roomId: 'room_b',
        roomName: 'Conversación Avanzada',
        startTime: new Date(Date.now() - 172800000).toISOString(),
        duration: 2700,
        url: '#',
        size: 1024 * 1024 * 35
    }
];

const RecordingsList: React.FC = () => {
    const [recordings, setRecordings] = useState<Recording[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Simulate API fetch
        const fetchRecordings = async () => {
            setLoading(true);
            await new Promise(r => setTimeout(r, 800));
            setRecordings(MOCK_RECORDINGS);
            setLoading(false);
        };
        fetchRecordings();
    }, []);

    const formatDuration = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h > 0 ? h + 'h ' : ''}${m}m ${s}s`;
    };

    return (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-800 flex items-center">
                    <Video className="w-5 h-5 mr-2 text-blue-500" />
                    Grabaciones de Clases
                </h2>
            </div>

            {loading ? (
                <div className="p-8 text-center text-gray-500">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto mb-2"></div>
                    Cargando grabaciones...
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sala / Clase</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha y Hora</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duración</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {recordings.map((rec) => (
                                <tr key={rec.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900">{rec.roomName}</div>
                                        <div className="text-sm text-gray-500">ID: {rec.roomId}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-900 flex items-center">
                                            <Calendar className="w-4 h-4 mr-1 text-gray-400" />
                                            {new Date(rec.startTime).toLocaleDateString()}
                                        </div>
                                        <div className="text-sm text-gray-500 flex items-center mt-1">
                                            <Clock className="w-4 h-4 mr-1 text-gray-400" />
                                            {new Date(rec.startTime).toLocaleTimeString()}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {formatDuration(rec.duration)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex justify-end space-x-3">
                                            <button className="text-blue-600 hover:text-blue-900 flex items-center" title="Reproducir">
                                                <Play className="w-4 h-4 mr-1" /> Ver
                                            </button>
                                            <button className="text-gray-600 hover:text-gray-900 flex items-center" title="Descargar">
                                                <Download className="w-4 h-4 mr-1" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {recordings.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                                        No hay grabaciones disponibles.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default RecordingsList;
