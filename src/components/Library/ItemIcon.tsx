import React from 'react';
import { Folder, FileText, Image, File, ExternalLink, Video, Music } from 'lucide-react';
import { LibraryItemType } from '../../types/library';

interface ItemIconProps {
    type: LibraryItemType;
    mimeType?: string;
    className?: string;
}

const ItemIcon: React.FC<ItemIconProps> = ({ type, mimeType, className = '' }) => {
    if (type === 'folder') {
        return <Folder className={`text-blue-500 fill-current ${className}`} />;
    }

    if (type === 'link') {
        return <ExternalLink className={`text-purple-500 ${className}`} />;
    }

    // Handle file types based on MimeType
    if (mimeType?.startsWith('image/')) {
        return <Image className={`text-green-500 ${className}`} />;
    }

    if (mimeType?.startsWith('video/')) {
        return <Video className={`text-red-500 ${className}`} />;
    }

    if (mimeType?.startsWith('audio/')) {
        return <Music className={`text-pink-500 ${className}`} />;
    }

    if (mimeType === 'application/pdf') {
        return <FileText className={`text-red-500 ${className}`} />;
    }

    return <File className={`text-gray-500 ${className}`} />;
};

export default ItemIcon;
