export type LibraryItemType = 'folder' | 'file' | 'link';

export interface BaseLibraryItem {
    id: string;
    parentId: string | null;
    userId: string;
    type: LibraryItemType;
    title: string;
    description?: string;
    createdAt: string;
    updatedAt: string;
}

export interface LibraryFolder extends BaseLibraryItem {
    type: 'folder';
}

export interface LibraryFile extends BaseLibraryItem {
    type: 'file';
    filePath: string;
    fileSize: number;
    mimeType: string;
}

export interface LibraryLink extends BaseLibraryItem {
    type: 'link';
    externalUrl: string;
}

export type LibraryItem = LibraryFolder | LibraryFile | LibraryLink;

export interface Breadcrumb {
    id: string;
    title: string;
}
