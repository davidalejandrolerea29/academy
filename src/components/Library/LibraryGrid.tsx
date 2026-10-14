import React from 'react';
import { LibraryItem } from '../../types/library';
import ItemIcon from './ItemIcon';
import { MoreVertical } from 'lucide-react';
import { LibraryService } from '../../services/LibraryService';
import { useAuth } from '../../contexts/AuthContext';
import { isDevPreview } from '../../config/devPreview';

interface LibraryGridProps {
    items: LibraryItem[];
    onNavigate: (folderId: string) => void;
    onDelete: (itemId: string) => void;
}

const LibraryGrid: React.FC<LibraryGridProps> = ({ items, onNavigate, onDelete }) => {
    const { currentUser } = useAuth();

    const handleDownload = async (item: LibraryItem) => {
        if (isDevPreview) return;
        if (!currentUser?.token) return;

        if (item.type !== 'file' || !item.filePath) return;

        try {
            const url = await LibraryService.getDownloadUrl(currentUser.token, item.id);
            window.open(url, '_blank');
        } catch (error) {
            console.error('Error downloading file:', error);
            alert('Error al descargar el archivo. Por favor intente nuevamente.');
        }
    };

    const handleItemClick = (item: LibraryItem) => {
        if (item.type === 'folder') {
            onNavigate(item.id);
        } else if (item.type === 'link') {
            if (isDevPreview) return;
            window.open(item.externalUrl, '_blank');
        } else if (item.type === 'file') {
            handleDownload(item);
        }
    };

    return (
        <div className="ui-page-enter grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {items.map((item) => (
                <div
                    key={item.id}
                    className="ui-card group relative bg-white border border-gray-200 rounded-2xl p-4 cursor-pointer flex flex-col items-center text-center"
                    onClick={() => handleItemClick(item)}
                >
                    <div className="h-16 w-16 mb-3 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl group-hover:from-blue-50 group-hover:to-blue-100 transition-colors duration-200 motion-reduce:transition-none">
                        <ItemIcon
                            type={item.type}
                            mimeType={item.type === 'file' ? item.mimeType : undefined}
                            className="h-8 w-8"
                        />
                    </div>

                    <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 w-full mb-1">
                        {item.title}
                    </h3>

                    <p className="text-xs text-gray-500 w-full truncate">
                        {item.type === 'folder' ? 'Carpeta' : item.type === 'link' ? 'Link' : 'Archivo'}
                    </p>

                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(item.id);
                        }}
                        className="ui-interactive absolute top-2 right-2 p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                    >
                        <MoreVertical size={16} />
                    </button>
                </div>
            ))}
            {items.length === 0 && (
                <div className="ui-surface ui-feedback col-span-full py-12 flex flex-col items-center justify-center text-gray-500 bg-white rounded-2xl border border-dashed border-gray-200">
                    <div className="bg-blue-50 p-4 rounded-2xl mb-3">
                        <ItemIcon type="folder" className="h-8 w-8 text-gray-400" />
                    </div>
                    <p className="font-medium">Carpeta vacía</p>
                </div>
            )}
        </div>
    );
};

export default LibraryGrid;
