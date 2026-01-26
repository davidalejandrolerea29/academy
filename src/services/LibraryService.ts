import { LibraryItem, LibraryFolder, LibraryFile, LibraryLink } from '../types/library';

// Mock data to simulate initial state
let mockItems: LibraryItem[] = [
    {
        id: '1',
        parentId: null,
        userId: '1',
        type: 'folder',
        title: 'Material de Clase - Nivel 1',
        description: 'Recursos para principiantes',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    },
    {
        id: '2',
        parentId: null,
        userId: '1',
        type: 'folder',
        title: 'Gramática Avanzada',
        description: 'Recursos para estudiantes avanzados',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    },
    {
        id: '3',
        parentId: '1',
        userId: '1',
        type: 'file',
        title: 'Lista de Verbos Irregulares.pdf',
        description: 'Guía completa de verbos',
        filePath: 'https://example.com/verbos.pdf',
        fileSize: 1024 * 500, // 500KB
        mimeType: 'application/pdf',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    },
    {
        id: '4',
        parentId: '1',
        userId: '1',
        type: 'link',
        title: 'Video: Pronunciación Básica',
        description: 'Tutorial en YouTube',
        externalUrl: 'https://youtube.com/watch?v=123',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    },
];

export const LibraryService = {
    getItems: async (parentId: string | null = null): Promise<LibraryItem[]> => {
        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, 500));
        return mockItems.filter((item) => item.parentId === parentId);
    },

    createFolder: async (parentId: string | null, title: string): Promise<LibraryFolder> => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const newFolder: LibraryFolder = {
            id: Math.random().toString(36).substr(2, 9),
            parentId,
            userId: '1', // Mock user ID
            type: 'folder',
            title,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        mockItems.push(newFolder);
        return newFolder;
    },

    createLink: async (parentId: string | null, title: string, url: string): Promise<LibraryLink> => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const newLink: LibraryLink = {
            id: Math.random().toString(36).substr(2, 9),
            parentId,
            userId: '1',
            type: 'link',
            title,
            externalUrl: url,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        mockItems.push(newLink);
        return newLink;
    },

    uploadFile: async (parentId: string | null, file: File): Promise<LibraryFile> => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const newFile: LibraryFile = {
            id: Math.random().toString(36).substr(2, 9),
            parentId,
            userId: '1',
            type: 'file',
            title: file.name,
            filePath: URL.createObjectURL(file), // Mock URL
            fileSize: file.size,
            mimeType: file.type,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        mockItems.push(newFile);
        return newFile;
    },

    deleteItem: async (itemId: string): Promise<void> => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        // Recursive delete logic would go here for folders, for now simple filter
        mockItems = mockItems.filter(item => item.id !== itemId && item.parentId !== itemId);
    }
};
