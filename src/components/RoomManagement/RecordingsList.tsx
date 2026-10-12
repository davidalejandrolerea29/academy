import React, { useState, useEffect } from 'react';
import { Play, Calendar, Clock, Video, AlertCircle, User as UserIcon, X, Loader2 } from 'lucide-react';
import { DailyService, DailyRecording } from '../../services/DailyService';
import { RoomService, RoomFrontend } from '../../services/RoomService';
import { useAuth } from '../../contexts/AuthContext';

interface RecordingsListProps {
    roomName?: string;
}

const RecordingsList: React.FC<RecordingsListProps> = ({ roomName }) => {
    const { currentUser } = useAuth();
    const [recordings, setRecordings] = useState<DailyRecording[]>([]);
    const [rooms, setRooms] = useState<RoomFrontend[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Video Player State
    const [selectedVideo, setSelectedVideo] = useState<DailyRecording | null>(null);
    const [loadingLinkId, setLoadingLinkId] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            if (!currentUser?.token) {
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);
            try {
                // Fetch both recordings and rooms in parallel
                const [recordingsData, roomsData] = await Promise.all([
                    DailyService.getRecordings(currentUser.token, roomName),
                    RoomService.getAll(currentUser.token)
                ]);

                // Sort recordings
                const sortedRecordings = recordingsData.sort((a, b) =>
                    new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
                );

                setRecordings(sortedRecordings);
                setRooms(roomsData);

            } catch (err) {
                console.error(err);
                setError('No se pudieron cargar las grabaciones. Por favor intenta más tarde.');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [currentUser?.token, roomName]);

    const getRecordingDate = (rec: DailyRecording) => {
        // Try multiple fields for the timestamp
        let val: string | number | undefined = rec.start_ts || rec.created_at || rec.start_time;

        // If val is missing or 0, return current date or handle gracefully
        if (!val) return new Date();

        // If it's a number (timestamp)
        if (typeof val === 'number') {
            // Heuristic: if small (seconds), multiply by 1000 to get ms
            if (val < 10000000000) {
                return new Date(val * 1000);
            }
            return new Date(val);
        }

        // If it's a string, let Date parse it
        return new Date(val);
    };

    const formatDuration = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;

        const pad = (n: number) => n.toString().padStart(2, '0');
        if (h > 0) {
            return pad(h) + ':' + pad(m) + ':' + pad(s);
        }
        return pad(m) + ':' + pad(s);
    };

    const getRoomDetails = (recordingRoomName: string) => {
        return rooms.find(r =>
            r.name === recordingRoomName ||
            String(r.id) === recordingRoomName ||
            recordingRoomName.includes(r.name)
        );
    };

    const handlePlayVideo = async (recording: DailyRecording) => {
        // If we already have the download link cached, play immediately
        if (recording.download_link) {
            setSelectedVideo(recording);
            return;
        }

        // Otherwise, fetch the link on-demand
        if (!currentUser?.token) return;

        setLoadingLinkId(recording.id);
        try {
            const link = await DailyService.getRecordingLink(currentUser.token, recording.id);
            if (link) {
                const updatedRecording = { ...recording, download_link: link };
                // Cache the link in state so we don't fetch it again
                setRecordings(prev => prev.map(r => r.id === recording.id ? updatedRecording : r));
                setSelectedVideo(updatedRecording);
            } else {
                setError('No se pudo obtener el enlace de la grabación.');
                setTimeout(() => setError(null), 5000);
            }
        } catch {
            setError('Error al obtener el enlace de la grabación.');
            setTimeout(() => setError(null), 5000);
        } finally {
            setLoadingLinkId(null);
        }
    };

    const closePlayer = () => {
        setSelectedVideo(null);
    };

    if (!currentUser) {
        return <div className="p-4 text-center">Inicia sesión para ver las grabaciones.</div>;
    }

    return (
        <div className="bg-white rounded-lg shadow-md overflow-hidden animate-fade-in relative">
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
                    <p>Cargando información...</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sala / Profesor</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha y Hora</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duración</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {recordings.map((rec) => {
                                const roomDetails = getRoomDetails(rec.room_name);

                                return (
                                    <tr key={rec.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">
                                                {roomDetails ? roomDetails.name : rec.room_name}
                                            </div>
                                            {roomDetails && roomDetails.teacher ? (
                                                <div className="text-xs text-gray-500 flex items-center mt-1">
                                                    <UserIcon className="w-3 h-3 mr-1" />
                                                    Prof: {roomDetails.teacher.name}
                                                </div>
                                            ) : (
                                                <div className="text-xs text-gray-400 font-mono mt-1">
                                                    ID: {rec.room_name}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900 flex items-center">
                                                <Calendar className="w-4 h-4 mr-1.5 text-gray-400" />
                                                {getRecordingDate(rec).toLocaleDateString(undefined, {
                                                    day: 'numeric', month: 'short', year: 'numeric'
                                                })}
                                            </div>
                                            <div className="text-sm text-gray-500 flex items-center mt-1">
                                                <Clock className="w-4 h-4 mr-1.5 text-gray-400" />
                                                {getRecordingDate(rec).toLocaleTimeString(undefined, {
                                                    hour: '2-digit', minute: '2-digit'
                                                })}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                                            {formatDuration(rec.duration)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                onClick={() => handlePlayVideo(rec)}
                                                disabled={loadingLinkId === rec.id}
                                                className="text-orange-600 hover:text-orange-900 flex items-center ml-auto px-3 py-1 rounded-md hover:bg-orange-50 transition-colors disabled:opacity-50 disabled:cursor-wait"
                                            >
                                                {loadingLinkId === rec.id ? (
                                                    <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Cargando...</>
                                                ) : (
                                                    <><Play className="w-4 h-4 mr-1" /> Reproducir</>
                                                )}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
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

            {/* Video Player Modal */}
            {selectedVideo && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 p-4">
                    <div className="bg-gray-900 rounded-lg shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center p-4 bg-gray-800 border-b border-gray-700">
                            <h3 className="text-white font-medium truncate pr-4">
                                {getRoomDetails(selectedVideo.room_name)?.name || selectedVideo.room_name}
                                <span className="text-gray-400 text-sm ml-2">
                                    ({getRecordingDate(selectedVideo).toLocaleDateString()})
                                </span>
                            </h3>
                            <button
                                onClick={closePlayer}
                                className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-700 transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="relative bg-black flex-grow flex items-center justify-center aspect-video">
                            {/* Loading spinner overlay */}
                            <div id="video-loading-spinner" className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                                <div className="flex flex-col items-center">
                                    <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
                                    <span className="text-gray-400 text-sm mt-2">Cargando video...</span>
                                </div>
                            </div>
                            <video
                                src={selectedVideo.download_link || ''}
                                controls
                                autoPlay
                                preload="auto"
                                playsInline
                                className="w-full h-full max-h-[70vh] relative z-20"
                                onPlaying={(e) => {
                                    // Ocultar spinner cuando empieza a reproducir
                                    const spinner = (e.target as HTMLVideoElement).parentElement?.querySelector('#video-loading-spinner');
                                    if (spinner) (spinner as HTMLElement).style.display = 'none';
                                }}
                                onWaiting={(e) => {
                                    // Mostrar spinner cuando está buffereando
                                    const spinner = (e.target as HTMLVideoElement).parentElement?.querySelector('#video-loading-spinner');
                                    if (spinner) (spinner as HTMLElement).style.display = 'flex';
                                }}
                                onError={(e) => console.error("Video Error:", e)}
                            >
                                Tu navegador no soporta la reproducción de video.
                            </video>
                        </div>
                        <div className="p-4 bg-gray-800 flex justify-end">
                            <a
                                href={selectedVideo.download_link}
                                target="_blank"
                                rel="noreferrer"
                                className="text-orange-400 hover:text-orange-300 text-sm underline mr-auto"
                            >
                                Abrir enlace directo de descarga
                            </a>
                            <button
                                onClick={closePlayer}
                                className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded text-sm transition-colors"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default RecordingsList;
