import React, { useState, useEffect } from 'react';
import { Play, Calendar, Clock, Video, AlertCircle } from 'lucide-react';
import { DailyService, DailyRecording } from '../../services/DailyService';
import { useAuth } from '../../contexts/AuthContext';

interface RecordingsListProps {
    roomName?: string;
}

const RecordingsList: React.FC<RecordingsListProps> = ({ roomName }) => {
    const { currentUser } = useAuth();
    const [recordings, setRecordings] = useState<DailyRecording[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchRecordings = async () => {
            if (!currentUser?.token) {
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);
            try {
                const data = await DailyService.getRecordings(currentUser.token, roomName);
                // Sort by date descending (newest first)
                const sortedData = data.sort((a, b) =>
                    new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
                );
                setRecordings(sortedData);
            } catch (err) {
                console.error(err);
                setError('No se pudieron cargar las grabaciones. Por favor intenta más tarde.');
            } finally {
                setLoading(false);
            }
        };

        fetchRecordings();
    }, [currentUser?.token, roomName]);

    const formatDuration = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;

        const pad = (n: number) => n.toString().padStart(2, '0');
        if (h > 0) {
            return `${pad(h)}:${pad(m)}:${pad(s)}`;
        }
        return `${pad(m)}:${pad(s)}`;
    };

    const handleDownload = (link: string) => {
        window.open(link, '_blank');
    };

    if (!currentUser) {
        return <div className="p-4 text-center">Inicia sesión para ver las grabaciones.</div>;
    }

    return (
        <div className="bg-white rounded-lg shadow-md overflow-hidden animate-fade-in">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-800 flex items-center">
                    <Video className="w-5 h-5 mr-2 text-orange-500" />
                    Historial de Clases Grabadas
                </h2>
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                    {recordings.length} grabaciones
                </span>
            </div>

            {error && (
                <div className="p-4 bg-red-50 text-red-700 flex items-center border-l-4 border-red-500 mx-6 mt-4">
                    <AlertCircle className="w-5 h-5 mr-2" />
                    {error}
                </div>
            )}

            {loading ? (
                <div className="p-12 text-center text-gray-500">
                    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-orange-500 mx-auto mb-3"></div>
                    <p>Cargando grabaciones...</p>
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
                                <tr key={rec.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900">{rec.room_name}</div>
                                        <div className="text-xs text-gray-400 font-mono mt-1">{rec.id.substring(0, 8)}...</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-900 flex items-center">
                                            <Calendar className="w-4 h-4 mr-1.5 text-gray-400" />
                                            {new Date(rec.start_time).toLocaleDateString(undefined, {
                                                day: 'numeric', month: 'short', year: 'numeric'
                                            })}
                                        </div>
                                        <div className="text-sm text-gray-500 flex items-center mt-1">
                                            <Clock className="w-4 h-4 mr-1.5 text-gray-400" />
                                            {new Date(rec.start_time).toLocaleTimeString(undefined, {
                                                hour: '2-digit', minute: '2-digit'
                                            })}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                                        {formatDuration(rec.duration)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex justify-end space-x-3">
                                            <button
                                                onClick={() => handleDownload(rec.download_link)}
                                                className="text-blue-600 hover:text-blue-900 flex items-center px-3 py-1 rounded-md hover:bg-blue-50 transition-colors"
                                            >
                                                <Play className="w-4 h-4 mr-1" /> Ver / Descargar
                                            </button>

                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {!loading && recordings.length === 0 && !error && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                                        <div className="flex flex-col items-center justify-center">
                                            <Video className="w-12 h-12 text-gray-300 mb-2" />
                                            <p className="text-lg font-medium text-gray-600">No hay grabaciones disponibles</p>
                                            <p className="text-sm text-gray-400">Las grabaciones de tus clases aparecerán aquí.</p>
                                        </div>
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
