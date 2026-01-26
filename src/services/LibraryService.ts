import { LibraryItem, LibraryFolder, LibraryFile, LibraryLink } from '../types/library';

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
        return data.items || [];
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
        return { ...data.folder, type: 'folder' };
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
        return { ...data.link, type: 'link' };
    },

    uploadFile: async (token: string, parentId: string | null, file: File): Promise<LibraryFile> => {
        const formData = new FormData();
        if (parentId) formData.append('parent_id', parentId);
        formData.append('file', file);

        const response = await fetch(`${API_URL}/auth/library/file`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
                // Content-Type header is not set manually for FormData, browser sets it with boundary
            },
            body: formData,
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || 'Failed to upload file');
        }

        const data = await response.json();
        return { ...data.file, type: 'file' };
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
