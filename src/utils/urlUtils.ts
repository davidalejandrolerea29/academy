/**
 * Validates if a URL is a valid S3 URL from our bucket
 */
export const isValidS3Url = (url: string | null | undefined): boolean => {
    if (!url) return false;
    return url.startsWith('https://englishteachersh.s3.us-east-2.amazonaws.com');
};

/**
 * Gets a safe image URL, handling full S3 URLs and legacy paths
 * @param url The URL or path from the backend
 * @param fallbackUrl Optional fallback URL if the input is invalid
 */
export const getImageUrl = (url: string | null | undefined, fallbackUrl: string = '/default-avatar.png'): string => {
    if (!url) return fallbackUrl;

    // If it's already a full URL (S3 or other), return it
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
    }

    // If it's a data URL, return it
    if (url.startsWith('data:')) {
        return url;
    }

    // For legacy local paths, we might need to prepend API_URL, 
    // but the goal is to move away from this. 
    // If the backend returns a relative path, it might be a legacy leftover.
    // We'll log a warning in dev mode
    if (import.meta.env.DEV) {
        console.warn('Legacy relative path detected:', url);
    }

    // Attempt to construct a full URL if it's a relative path (fallback logic)
    // This assumes it's a local storage path
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
    // Remove /api/v1 suffix to get base URL if needed, depending on how storage is served
    // But ideally, we shouldn't reach here if backend is returning S3 URLs

    return url;
};
