import { LibraryItem, LibraryFolder, LibraryFile, LibraryLink } from '../types/library';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL;

export const LibraryService = {
    getItems: async (token: string, parentId: string | null = null): Promise<LibraryItem[]> => {
        const url = new URL(`${API_URL}/auth/library`);
        if (parentId) {
            url.searchParams.append('parent_id', parentId);
        }

        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error('Failed to fetch library items');
        }

        const data = await response.json();
        return (data.data || []).map(transformItem);
    },

    createFolder: async (token: string, parentId: string | null, title: string): Promise<LibraryFolder> => {
        const response = await fetch(`${API_URL}/auth/library/folder`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                parent_id: parentId,
                title,
                type: 'folder',
            }),
        });

        if (!response.ok) {
            throw new Error('Failed to create folder');
        }

        const data = await response.json();
        return transformItem(data.folder) as LibraryFolder;
    },

    createLink: async (token: string, parentId: string | null, title: string, url: string): Promise<LibraryLink> => {
        const response = await fetch(`${API_URL}/auth/library/link`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                parent_id: parentId,
                title,
                external_url: url,
                type: 'link',
            }),
        });

        if (!response.ok) {
            throw new Error('Failed to create link');
        }

        const data = await response.json();
        return transformItem(data.link) as LibraryLink;
    },

    uploadFile: async (token: string, parentId: string | null, file: File, onProgress?: (progress: number) => void): Promise<LibraryFile> => {
        const formData = new FormData();
        if (parentId) formData.append('parent_id', parentId);
        formData.append('file', file);
        formData.append('title', file.name);
        formData.append('type', 'file');

        try {
            const response = await axios.post(`${API_URL}/auth/library/file`, formData, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json',
                    'Content-Type': 'multipart/form-data',
                },
                onUploadProgress: (progressEvent: any) => {
                    if (progressEvent.total && onProgress) {
                        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                        onProgress(percentCompleted);
                    }
                },
            });

            return transformItem(response.data.file) as LibraryFile;
        } catch (error: any) {
            console.error('Upload error:', error);
            throw new Error(error.response?.data?.message || 'Failed to upload file');
        }
    },

    deleteItem: async (token: string, itemId: string): Promise<void> => {
        const response = await fetch(`${API_URL}/auth/library/${itemId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error('Failed to delete item');
        }
    }
};

const transformItem = (item: any): LibraryItem => {
    const base = {
        id: item.id,
        parentId: item.parent_id,
        userId: item.user_id,
        title: item.title,
        description: item.description,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
    };

    if (item.type === 'folder') {
        return { ...base, type: 'folder' };
    } else if (item.type === 'link') {
        return {
            ...base,
            type: 'link',
            externalUrl: item.external_url,
        };
    } else { // file
        return {
            ...base,
            type: 'file',
            filePath: item.file_path,
            fileSize: item.size,
            mimeType: item.mime_type,
        };
    }
};
