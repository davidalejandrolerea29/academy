/**
 * Downloads a file from a given URL
 * @param url - The URL of the file to download
 * @param filename - Optional custom filename for the download
 */
export const downloadFile = async (url: string, filename?: string): Promise<void> => {
    try {
        const response = await fetch(url);
        const blob = await response.blob();

        // Create a temporary URL for the blob
        const blobUrl = window.URL.createObjectURL(blob);

        // Create a temporary anchor element
        const link = document.createElement('a');
        link.href = blobUrl;

        // Set the download attribute with filename
        link.download = filename || url.split('/').pop() || 'download';

        // Append to body, click, and remove
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up the blob URL
        window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
        console.error('Error downloading file:', error);
        // Fallback: open in new tab if download fails
        window.open(url, '_blank');
    }
};
