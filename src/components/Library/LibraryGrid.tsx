import React from 'react';
import { LibraryItem } from '../../types/library';
import ItemIcon from './ItemIcon';
import { MoreVertical } from 'lucide-react';
import { downloadFile } from '../../utils/downloadFile';

interface LibraryGridProps {
    items: LibraryItem[];
    onNavigate: (folderId: string) => void;
    onDelete: (itemId: string) => void;
}

const LibraryGrid: React.FC<LibraryGridProps> = ({ items, onNavigate, onDelete }) => {
    const handleItemClick = (item: LibraryItem) => {
        if (item.type === 'folder') {
            onNavigate(item.id);
        } else if (item.type === 'link') {
            window.open(item.externalUrl, '_blank');
        } else if (item.type === 'file') {
            if (item.filePath) {
                // Download the file automatically instead of opening in new tab
                downloadFile(item.filePath, item.title);
            } else {
                alert('No se pudo obtener la ruta del archivo. Por favor contacte al soporte.');
            }
        }
    };

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {items.map((item) => (
                <div
                    key={item.id}
                    className="group relative bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer flex flex-col items-center text-center"
                    onClick={() => handleItemClick(item)}
                >
                    <div className="h-16 w-16 mb-3 flex items-center justify-center bg-gray-50 rounded-full group-hover:bg-blue-50 transition-colors">
                        <ItemIcon
                            type={item.type}
                            mimeType={item.type === 'file' ? item.mimeType : undefined}
                            className="h-8 w-8"
                        />
                    </div>

                    <h3 className="text-sm font-medium text-gray-900 line-clamp-2 w-full mb-1">
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
                        className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <MoreVertical size={16} />
                    </button>
                </div>
            ))}
            {items.length === 0 && (
                <div className="col-span-full py-12 flex flex-col items-center justify-center text-gray-500">
                    <div className="bg-gray-100 p-4 rounded-full mb-3">
                        <ItemIcon type="folder" className="h-8 w-8 text-gray-400" />
                    </div>
                    <p>Carpeta vacía</p>
                </div>
            )}
        </div>
    );
};

export default LibraryGrid;
