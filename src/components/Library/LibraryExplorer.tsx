import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { LibraryService } from '../../services/LibraryService';
import { LibraryItem, Breadcrumb } from '../../types/library';
import LibraryList from './LibraryList';
import LibraryGrid from './LibraryGrid';
import CreateModal from './CreateModal';
import {
    Search,
    Grid,
    List,
    Plus,
    ChevronRight,
    Home,
    Loader2
} from 'lucide-react';

const LibraryExplorer: React.FC = () => {
    const { currentUser } = useAuth();
    const [items, setItems] = useState<LibraryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPath, setCurrentPath] = useState<Breadcrumb[]>([]);
    const [currentPath, setCurrentPath] = useState<Breadcrumb[]>([]);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);

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
        setIsUploading(true);
        setUploadProgress(0);
        try {
            await LibraryService.uploadFile(currentUser.token, currentFolderId, file, (progress) => {
                setUploadProgress(progress);
            });
            loadItems(); // Reload to get fresh data/URLs
        } catch (error) {
            console.error('Error uploading file:', error);
            loadItems();
        } finally {
            setIsUploading(false);
            setUploadProgress(0);
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
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex flex-col space-y-4 mb-6">
                {/* Header */}
                <div className="flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-gray-900">Biblioteca</h1>
                    {isTeacherOrAdmin && (
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            <Plus size={20} className="mr-2" />
                            Nuevo
                        </button>
                    )}
                </div>

                {/* Toolbar */}
                <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 justify-between bg-white p-3 rounded-lg shadow-sm border border-gray-200">
                    {/* Breadcrumbs */}
                    <div className="flex items-center overflow-x-auto whitespace-nowrap scrollbar-hide">
                        <button
                            onClick={() => handleNavigateUp(-1)}
                            className={`p-1 hover:bg-gray-100 rounded text-gray-500 ${currentPath.length === 0 ? 'text-blue-600 font-semibold' : ''}`}
                        >
                            <Home size={18} />
                        </button>
                        {currentPath.map((item, index) => (
                            <div key={item.id} className="flex items-center">
                                <ChevronRight size={16} className="text-gray-400 mx-1" />
                                <button
                                    onClick={() => handleNavigateUp(index)}
                                    className={`text-sm hover:underline ${index === currentPath.length - 1 ? 'font-semibold text-blue-600' : 'text-gray-600'
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
                                className="pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none w-full sm:w-64"
                            />
                        </div>

                        {/* View Toggle */}
                        <div className="flex items-center bg-gray-100 rounded-lg p-1">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                <Grid size={18} />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                <List size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Upload Progress Bar */}
            {isUploading && (
                <div className="mb-4 bg-white p-4 rounded-lg shadow-sm border border-blue-100">
                    <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium text-blue-700">Subiendo archivo...</span>
                        <span className="text-sm font-medium text-blue-700">{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div
                            className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-in-out"
                            style={{ width: `${uploadProgress}%` }}
                        ></div>
                    </div>
                </div>
            )}

            {/* Content */}
            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="animate-spin text-blue-500" size={32} />
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
