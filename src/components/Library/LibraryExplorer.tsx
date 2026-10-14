import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { LibraryService, UploadProgress } from '../../services/LibraryService';
import { LibraryItem, Breadcrumb } from '../../types/library';
import { validateFile, formatBytes } from '../../utils/fileValidation';
import LibraryList from './LibraryList';
import LibraryGrid from './LibraryGrid';
import CreateModal from './CreateModal';
import BrandLoader from '../UI/BrandLoader';
import {
    Search,
    Grid,
    List,
    Plus,
    ChevronRight,
    Home,
    AlertCircle
} from 'lucide-react';

const LibraryExplorer: React.FC = () => {
    const { currentUser } = useAuth();
    const [items, setItems] = useState<LibraryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPath, setCurrentPath] = useState<Breadcrumb[]>([]);

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<UploadProgress>({ percent: 0, loaded: 0, total: 0 });
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);

    // Derived state
    const currentFolderId = currentPath.length > 0 ? currentPath[currentPath.length - 1].id : null;
    const isTeacherOrAdmin = currentUser?.role?.description === 'Teacher' || currentUser?.role?.description === 'Admin';
    // Mock role check if currentUser is undefined for dev
    // const isTeacherOrAdmin = true; 

    useEffect(() => {
        loadItems();
    }, [currentFolderId]);

    const loadItems = async () => {
        if (!currentUser?.token) return;
        setLoading(true);
        try {
            const data = await LibraryService.getItems(currentUser.token, currentFolderId);
            setItems(data);
        } catch (error) {
            console.error('Failed to load library items:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleNavigate = (folderId: string) => {
        const folder = items.find(i => i.id === folderId);
        if (folder) {
            setCurrentPath([...currentPath, { id: folder.id, title: folder.title }]);
            setSearchQuery(''); // Clear search on navigation
        }
    };

    const handleNavigateUp = (index: number) => {
        if (index === -1) {
            setCurrentPath([]);
        } else {
            setCurrentPath(currentPath.slice(0, index + 1));
        }
        setSearchQuery('');
    };

    const filteredItems = items.filter(item =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleCreateFolder = async (name: string) => {
        if (!currentUser?.token) return;
        try {
            const newFolder = await LibraryService.createFolder(currentUser.token, currentFolderId, name);
            setItems(prev => [...prev, newFolder]);
        } catch (error) {
            console.error('Error creating folder:', error);
            loadItems();
        }
    };

    const handleCreateLink = async (name: string, url: string) => {
        if (!currentUser?.token) return;
        try {
            const newLink = await LibraryService.createLink(currentUser.token, currentFolderId, name, url);
            setItems(prev => [...prev, newLink]);
        } catch (error) {
            console.error('Error creating link:', error);
            loadItems();
        }
    };

    const handleUploadFile = async (file: File) => {
        if (!currentUser?.token) return;

        // Validate file before upload
        const validation = validateFile(file);
        if (!validation.valid) {
            setUploadError(validation.error || 'Invalid file');
            setTimeout(() => setUploadError(null), 5000);
            return;
        }

        setIsUploading(true);
        setUploadProgress({ percent: 0, loaded: 0, total: file.size });
        setUploadError(null);

        try {
            await LibraryService.uploadFile(currentUser.token, currentFolderId, file, (progress) => {
                setUploadProgress(progress);
            });
            loadItems(); // Reload to get fresh data/URLs
        } catch (error: any) {
            console.error('Error uploading file:', error);
            setUploadError(error.message || 'Error al subir el archivo');
            setTimeout(() => setUploadError(null), 5000);
        } finally {
            setIsUploading(false);
            setUploadProgress({ percent: 0, loaded: 0, total: 0 });
        }
    };

    const handleDeleteItem = async (itemId: string) => {
        if (!currentUser?.token) return;
        if (window.confirm('¿Estás seguro de eliminar este elemento?')) {
            await LibraryService.deleteItem(currentUser.token, itemId);
            loadItems();
        }
    };

    return (
        <div className="ui-page-enter p-6 max-w-7xl mx-auto">
            <div className="flex flex-col space-y-4 mb-6">
                {/* Header */}
                <div className="flex justify-between items-center">
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900">Biblioteca</h1>
                    {isTeacherOrAdmin && (
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="ui-interactive flex items-center px-4 py-2 bg-blue-600 text-white rounded-xl shadow-sm hover:bg-blue-700 hover:shadow-md"
                        >
                            <Plus size={20} className="mr-2" />
                            Nuevo
                        </button>
                    )}
                </div>

                {/* Toolbar */}
                <div className="ui-surface flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 justify-between bg-white p-3 rounded-xl border border-gray-200">
                    {/* Breadcrumbs */}
                    <div className="flex items-center overflow-x-auto whitespace-nowrap scrollbar-hide">
                        <button
                            onClick={() => handleNavigateUp(-1)}
                            className={`ui-interactive p-1 hover:bg-blue-50 rounded-lg text-gray-500 ${currentPath.length === 0 ? 'text-blue-600 font-semibold' : ''}`}
                        >
                            <Home size={18} />
                        </button>
                        {currentPath.map((item, index) => (
                            <div key={item.id} className="flex items-center">
                                <ChevronRight size={16} className="text-gray-400 mx-1" />
                                <button
                                    onClick={() => handleNavigateUp(index)}
                                    className={`ui-interactive text-sm hover:text-blue-600 hover:underline rounded ${index === currentPath.length - 1 ? 'font-semibold text-blue-600' : 'text-gray-600'
                                        }`}
                                >
                                    {item.title}
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="flex items-center space-x-3">
                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder="Buscar..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="ui-interactive pl-10 pr-4 py-2 border border-gray-200 bg-gray-50 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none w-full sm:w-64"
                            />
                        </div>

                        {/* View Toggle */}
                        <div className="flex items-center bg-gray-100 rounded-xl p-1 border border-gray-200/70">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`ui-interactive p-1.5 rounded-lg ${viewMode === 'grid' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-white/60'}`}
                            >
                                <Grid size={18} />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`ui-interactive p-1.5 rounded-lg ${viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-white/60'}`}
                            >
                                <List size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Upload Progress Bar */}
            {isUploading && (
                <div className="ui-feedback mb-4 bg-blue-50/60 p-4 rounded-xl shadow-sm border border-blue-100">
                    <div className="flex justify-between mb-1">
                        <BrandLoader inline size="sm" label="Subiendo archivo..." className="text-blue-700" />
                        <span className="text-sm font-medium text-blue-700">
                            {uploadProgress.percent}% ({formatBytes(uploadProgress.loaded)} / {formatBytes(uploadProgress.total)})
                        </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div
                            className="bg-blue-600 h-2.5 rounded-full transition-[width] duration-300 ease-in-out motion-reduce:transition-none"
                            style={{ width: `${uploadProgress.percent}%` }}
                        ></div>
                    </div>
                </div>
            )}

            {/* Upload Error */}
            {uploadError && (
                <div className="ui-feedback mb-4 bg-red-50 p-4 rounded-xl shadow-sm border border-red-200">
                    <div className="flex items-center">
                        <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                        <span className="text-sm font-medium text-red-800">{uploadError}</span>
                    </div>
                </div>
            )}

            {/* Content */}
            {loading ? (
                <div className="ui-surface flex justify-center items-center h-64 bg-white rounded-xl border border-gray-200">
                    <BrandLoader label="Cargando biblioteca..." />
                </div>
            ) : (
                <>
                    {viewMode === 'grid' ? (
                        <LibraryGrid
                            items={filteredItems}
                            onNavigate={handleNavigate}
                            onDelete={isTeacherOrAdmin ? handleDeleteItem : () => { }}
                        />
                    ) : (
                        <LibraryList
                            items={filteredItems}
                            onNavigate={handleNavigate}
                            onDelete={isTeacherOrAdmin ? handleDeleteItem : () => { }}
                        />
                    )}
                </>
            )}

            <CreateModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onCreateFolder={handleCreateFolder}
                onCreateLink={handleCreateLink}
                onUploadFile={handleUploadFile}
            />
        </div>
    );
};

export default LibraryExplorer;
