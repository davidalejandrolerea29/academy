import React, { useState, useEffect } from 'react';
import { Play, Calendar, Clock, Video, AlertCircle, User as UserIcon, X, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const API_URL = import.meta.env.VITE_API_URL;

interface RecordingItem {
    id: number;
    room_id: number;
    room_name: string | null;
    teacher: string | null;
    size: number | null;
    duration: number | null;
    created_at: string;
    expires_at: string;
}

interface RecordingsListProps {
    roomName?: string;
}

const RecordingsList: React.FC<RecordingsListProps> = () => {
    const { currentUser } = useAuth();
    const [recordings, setRecordings] = useState<RecordingItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [playingId, setPlayingId] = useState<number | null>(null);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [loadingId, setLoadingId] = useState<number | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            if (!currentUser?.token) { setLoading(false); return; }
            setLoading(true); setError(null);
            try {
                const res = await fetch(`${API_URL}/auth/recordings`, {
                    headers: { Authorization: `Bearer ${currentUser.token}`, Accept: 'application/json' },
                });
                if (!res.ok) throw new Error('error');
                const data = await res.json();
                setRecordings(data.recordings || []);
            } catch {
                setError('No se pudieron cargar las grabaciones.');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [currentUser?.token]);

    const fmtDuration = (s: number | null) => {
        if (!s) return '—';
        const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
        const p = (n: number) => n.toString().padStart(2, '0');
        return h > 0 ? `${p(h)}:${p(m)}:${p(sec)}` : `${p(m)}:${p(sec)}`;
    };
    const fmtSize = (b: number | null) => b ? `${(b / 1024 / 1024).toFixed(0)} MB` : '—';
    const hoursLeft = (expires: string) => {
        const diff = new Date(expires).getTime() - Date.now();
        const h = Math.max(0, Math.floor(diff / 3600000));
        return h;
    };

    const play = async (rec: RecordingItem) => {
        if (!currentUser?.token) return;
        setLoadingId(rec.id);
        try {
            const res = await fetch(`${API_URL}/auth/recordings/${rec.id}/stream`, {
                headers: { Authorization: `Bearer ${currentUser.token}` },
            });
            if (!res.ok) throw new Error('error');
            const blob = await res.blob();
            if (videoUrl) URL.revokeObjectURL(videoUrl);
            setVideoUrl(URL.createObjectURL(blob));
            setPlayingId(rec.id);
        } catch {
            setError('No se pudo cargar el video (quizás ya expiró).');
            setTimeout(() => setError(null), 5000);
        } finally {
            setLoadingId(null);
        }
    };

    const closePlayer = () => {
        if (videoUrl) URL.revokeObjectURL(videoUrl);
        setVideoUrl(null);
        setPlayingId(null);
    };

    if (!currentUser) return <div className="p-4 text-center">Inicia sesión para ver las grabaciones.</div>;

    return (
        <div className="bg-white rounded-lg shadow-md overflow-hidden relative">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-800 flex items-center">
                    <Video className="w-5 h-5 mr-2 text-orange-500" />
                    Grabaciones de clases
                </h2>
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                    {recordings.length} · se borran a las 48h
                </span>
            </div>

            {error && (
                <div className="p-4 bg-red-50 text-red-700 flex items-center border-l-4 border-red-500 mx-6 mt-4">
                    <AlertCircle className="w-5 h-5 mr-2" /> {error}
                </div>
            )}

            {loading ? (
                <div className="p-12 text-center text-gray-500">
                    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-orange-500 mx-auto mb-3"></div>
                    <p>Cargando...</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sala / Profesor</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duración / Peso</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expira en</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {recordings.map((rec) => (
                                <tr key={rec.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-medium text-gray-900">{rec.room_name || `Sala ${rec.room_id}`}</div>
                                        {rec.teacher && (
                                            <div className="text-xs text-gray-500 flex items-center mt-1">
                                                <UserIcon className="w-3 h-3 mr-1" /> {rec.teacher}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-900 flex items-center">
                                            <Calendar className="w-4 h-4 mr-1.5 text-gray-400" />
                                            {new Date(rec.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                                        </div>
                                        <div className="text-sm text-gray-500 flex items-center mt-1">
                                            <Clock className="w-4 h-4 mr-1.5 text-gray-400" />
                                            {new Date(rec.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                                        {fmtDuration(rec.duration)} · {fmtSize(rec.size)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <span className={`px-2 py-1 rounded-full text-xs ${hoursLeft(rec.expires_at) <= 6 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                                            {hoursLeft(rec.expires_at)}h
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button
                                            onClick={() => play(rec)}
                                            disabled={loadingId === rec.id}
                                            className="text-orange-600 hover:text-orange-900 flex items-center ml-auto px-3 py-1 rounded-md hover:bg-orange-50 disabled:opacity-50 disabled:cursor-wait"
                                        >
                                            {loadingId === rec.id
                                                ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Cargando...</>
                                                : <><Play className="w-4 h-4 mr-1" /> Reproducir</>}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {recordings.length === 0 && !error && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                        <div className="flex flex-col items-center justify-center">
                                            <Video className="w-12 h-12 text-gray-300 mb-2" />
                                            <p className="text-lg font-medium text-gray-600">No hay grabaciones</p>
                                            <p className="text-sm text-gray-400">Las grabaciones de tus clases aparecen acá (se borran a las 48h).</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {videoUrl && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 p-4">
                    <div className="bg-gray-900 rounded-lg shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center p-4 bg-gray-800 border-b border-gray-700">
                            <h3 className="text-white font-medium truncate pr-4">
                                {recordings.find(r => r.id === playingId)?.room_name || 'Grabación'}
                            </h3>
                            <button onClick={closePlayer} className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-700">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="relative bg-black flex-grow flex items-center justify-center">
                            <video src={videoUrl} controls autoPlay playsInline className="w-full h-full max-h-[70vh]">
                                Tu navegador no soporta la reproducción de video.
                            </video>
                        </div>
                        <div className="p-4 bg-gray-800 flex justify-end">
                            <button onClick={closePlayer} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded text-sm">
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
