import React from 'react';
import { LibraryItem } from '../../types/library';
import ItemIcon from './ItemIcon';
import { MoreVertical, Download, ExternalLink as ExternalLinkIcon, Folder } from 'lucide-react';
import { downloadFile } from '../../utils/downloadFile';

interface LibraryListProps {
    items: LibraryItem[];
    onNavigate: (folderId: string) => void;
    onDelete: (itemId: string) => void;
}

const LibraryList: React.FC<LibraryListProps> = ({ items, onNavigate, onDelete }) => {
    const handleItemClick = (item: LibraryItem) => {
        if (item.type === 'folder') {
            onNavigate(item.id);
        } else if (item.type === 'link') {
            window.open(item.externalUrl, '_blank');
        } else if (item.type === 'file') {
            // Download the file automatically instead of opening in new tab
            if (item.filePath) {
                downloadFile(item.filePath, item.title);
            }
        }
    };

    return (
        <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {items.map((item) => (
                        <tr
                            key={item.id}
                            className="hover:bg-gray-50 cursor-pointer transition-colors"
                            onClick={() => handleItemClick(item)}
                        >
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                    <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-lg bg-gray-100">
                                        <ItemIcon
                                            type={item.type}
                                            mimeType={item.type === 'file' ? item.mimeType : undefined}
                                            className="h-6 w-6"
                                        />
                                    </div>
                                    <div className="ml-4">
                                        <div className="text-sm font-medium text-gray-900">{item.title}</div>
                                        {item.description && <div className="text-sm text-gray-500">{item.description}</div>}
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {item.type === 'folder' ? 'Carpeta' : item.type === 'link' ? 'Enlace' : 'Archivo'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {new Date(item.createdAt).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <div className="flex items-center justify-end space-x-2" onClick={(e) => e.stopPropagation()}>
                                    {item.type === 'file' && (
                                        <button
                                            onClick={() => downloadFile(item.filePath!, item.title)}
                                            className="p-2 text-gray-400 hover:text-blue-600"
                                            title="Descargar archivo"
                                        >
                                            <Download size={18} />
                                        </button>
                                    )}
                                    {item.type === 'link' && (
                                        <a href={item.externalUrl} target="_blank" rel="noopener noreferrer" className="p-2 text-gray-400 hover:text-blue-600">
                                            <ExternalLinkIcon size={18} />
                                        </a>
                                    )}
                                    <button onClick={() => onDelete(item.id)} className="p-2 text-gray-400 hover:text-red-600">
                                        <MoreVertical size={18} />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                    {items.length === 0 && (
                        <tr>
                            <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                                <div className="flex flex-col items-center justify-center">
                                    <Folder className="h-12 w-12 text-gray-300 mb-3" />
                                    <p>Esta carpeta está vacía</p>
                                </div>
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
};

export default LibraryList;
