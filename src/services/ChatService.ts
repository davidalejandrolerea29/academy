import { UploadProgress } from './LibraryService';

const API_URL = import.meta.env.VITE_API_URL;

interface ChatUploadUrlResponse {
    upload_url: string;
    file_key: string;
    expires_in: number;
}

interface ChatConfirmUploadRequest {
    file_key: string;
    user_id: number;
    contact_id: number;
    content: string;
    size: number;
    mime_type: string;
}

export const ChatService = {
    /**
     * Generate pre-signed URL for chat file upload
     */
    generateUploadUrl: async (token: string, filename: string, contentType: string, size: number): Promise<ChatUploadUrlResponse> => {
        const response = await fetch(`${API_URL}/auth/privatechat/generate-upload-url`, {
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
     * Confirm upload with backend and create message
     */
    confirmUpload: async (token: string, request: ChatConfirmUploadRequest): Promise<any> => {
        const response = await fetch(`${API_URL}/auth/privatechat/confirm-upload`, {
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
        return data.data;
    },

    /**
     * Complete file upload flow for chat
     */
    uploadChatFile: async (
        token: string,
        userId: number,
        contactId: number,
        file: File,
        content: string,
        onProgress?: (progress: UploadProgress) => void
    ): Promise<any> => {
        try {
            // Step 1: Request pre-signed URL
            const { upload_url, file_key } = await ChatService.generateUploadUrl(
                token,
                file.name,
                file.type,
                file.size
            );

            // Step 2: Upload directly to S3
            await ChatService.uploadToS3(upload_url, file, onProgress);

            // Step 3: Confirm upload with backend and create message
            const message = await ChatService.confirmUpload(token, {
                file_key,
                user_id: userId,
                contact_id: contactId,
                content: content || '',
                size: file.size,
                mime_type: file.type,
            });

            return message;
        } catch (error: any) {
            console.error('Chat file upload error:', error);

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
};
