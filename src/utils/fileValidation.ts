/**
 * File validation utilities for library uploads
 */

// Maximum file size: 500MB
export const MAX_FILE_SIZE = 500 * 1024 * 1024;

// Allowed file types
export const ALLOWED_FILE_TYPES = [
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',

    // Images
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',

    // Videos
    'video/mp4',
    'video/webm',
    'video/quicktime',

    // Audio
    'audio/mpeg',
    'audio/wav',
    'audio/ogg',

    // Archives
    'application/zip',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
];

export interface FileValidationResult {
    valid: boolean;
    error?: string;
}

/**
 * Validates a file for upload
 * @param file - File to validate
 * @returns Validation result
 */
export function validateFile(file: File): FileValidationResult {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
        return {
            valid: false,
            error: `El archivo excede el límite de ${formatBytes(MAX_FILE_SIZE)}`,
        };
    }

    // Check file type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        return {
            valid: false,
            error: `Tipo de archivo no permitido: ${file.type || 'desconocido'}`,
        };
    }

    return { valid: true };
}

/**
 * Formats bytes to human-readable string
 * @param bytes - Number of bytes
 * @param decimals - Number of decimal places
 * @returns Formatted string (e.g., "1.5 MB")
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Gets file extension from filename
 * @param filename - Name of the file
 * @returns File extension (e.g., "pdf")
 */
export function getFileExtension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}
