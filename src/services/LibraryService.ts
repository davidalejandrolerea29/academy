import { LibraryItem, LibraryFolder, LibraryFile, LibraryLink } from '../types/library';

const API_URL = import.meta.env.VITE_API_URL;

interface UploadUrlResponse {
    upload_url: string;
    file_key: string;
    expires_in: number;
}

interface ConfirmUploadRequest {
    file_key: string;
    title: string;
    parent_id: string | null;
    size: number;
    mime_type: string;
    description?: string;
}

export interface UploadProgress {
    percent: number;
    loaded: number;
    total: number;
}

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

    /**
     * Generate pre-signed URL for direct S3 upload
     */
    generateUploadUrl: async (token: string, filename: string, contentType: string, size: number): Promise<UploadUrlResponse> => {
        const response = await fetch(`${API_URL}/auth/library/generate-upload-url`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                filename,
                content_type: contentType,
                size,
            }),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || 'Failed to generate upload URL');
        }

        return await response.json();
    },

    /**
     * Upload file directly to S3 using pre-signed URL
     */
    uploadToS3: async (uploadUrl: string, file: File, onProgress?: (progress: UploadProgress) => void): Promise<void> => {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            // Track upload progress
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable && onProgress) {
                    const percent = Math.round((e.loaded / e.total) * 100);
                    onProgress({
                        percent,
                        loaded: e.loaded,
                        total: e.total,
                    });
                }
            });

            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve();
                } else {
                    reject(new Error(`S3 upload failed with status ${xhr.status}`));
                }
            });

            xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
            xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));

            xhr.open('PUT', uploadUrl);
            xhr.setRequestHeader('Content-Type', file.type);
            xhr.send(file);
        });
    },

    /**
     * Confirm upload with backend after successful S3 upload
     */
    confirmUpload: async (token: string, request: ConfirmUploadRequest): Promise<LibraryFile> => {
        const response = await fetch(`${API_URL}/auth/library/confirm-upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify(request),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || 'Failed to confirm upload');
        }

        const data = await response.json();
        return transformItem(data.data) as LibraryFile;
    },

    /**
     * Upload file using direct S3 upload (new flow)
     */
    uploadFile: async (
        token: string,
        parentId: string | null,
        file: File,
        onProgress?: (progress: UploadProgress) => void
    ): Promise<LibraryFile> => {
        try {
            // Step 1: Request pre-signed URL
            const { upload_url, file_key } = await LibraryService.generateUploadUrl(
                token,
                file.name,
                file.type,
                file.size
            );

            // Step 2: Upload directly to S3
            await LibraryService.uploadToS3(upload_url, file, onProgress);

            // Step 3: Confirm upload with backend
            const result = await LibraryService.confirmUpload(token, {
                file_key,
                title: file.name,
                parent_id: parentId,
                size: file.size,
                mime_type: file.type,
                description: '',
            });

            return result;
        } catch (error: any) {
            console.error('Upload error:', error);

            // Provide user-friendly error messages
            let message = 'Failed to upload file';
            if (error.message.includes('403')) {
                message = 'No tienes permisos para subir archivos';
            } else if (error.message.includes('404')) {
                message = 'El archivo no se pudo verificar en el servidor';
            } else if (error.message.includes('Network')) {
                message = 'Error de conexión. Verifica tu internet';
            } else if (error.message) {
                message = error.message;
            }

            throw new Error(message);
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
