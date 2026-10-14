import React, { useState, useRef } from 'react';
import { Dialog } from '@headlessui/react';
import { FolderPlus, Link as LinkIcon, Upload, X } from 'lucide-react';
import BrandLoader from '../UI/BrandLoader';

interface CreateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreateFolder: (name: string) => Promise<void>;
    onCreateLink: (name: string, url: string) => Promise<void>;
    onUploadFile: (file: File) => Promise<void>;
}

type Mode = 'folder' | 'link' | 'file';

const CreateModal: React.FC<CreateModalProps> = ({
    isOpen,
    onClose,
    onCreateFolder,
    onCreateLink,
    onUploadFile
}) => {
    const [mode, setMode] = useState<Mode>('folder');
    const [name, setName] = useState('');
    const [url, setUrl] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            if (mode === 'folder') {
                await onCreateFolder(name);
            } else if (mode === 'link') {
                await onCreateLink(name, url);
            }
            onClose();
            resetForm();
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setIsSubmitting(true);
            try {
                await onUploadFile(e.target.files[0]);
                onClose();
                resetForm();
            } catch (error) {
                console.error(error);
            } finally {
                setIsSubmitting(false);
            }
        }
    };

    const resetForm = () => {
        setName('');
        setUrl('');
        setMode('folder');
    };

    return (
        <Dialog open={isOpen} onClose={onClose} className="relative z-50">
            <div className="ui-feedback fixed inset-0 bg-gray-950/50 backdrop-blur-sm" aria-hidden="true" />

            <div className="fixed inset-0 flex items-center justify-center p-4">
                <Dialog.Panel className="ui-modal-panel w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-gray-100">
                    <div className="flex justify-between items-center mb-6">
                        <Dialog.Title className="text-lg font-semibold tracking-tight text-gray-900">Nuevo Elemento</Dialog.Title>
                        <button onClick={onClose} className="ui-interactive text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="flex space-x-4 mb-6">
                        <button
                            onClick={() => setMode('folder')}
                            className={`ui-interactive flex-1 flex flex-col items-center p-3 rounded-xl border ${mode === 'folder' ? 'border-blue-500 bg-blue-50 text-blue-600 shadow-sm' : 'border-gray-200 hover:bg-gray-50'
                                }`}
                        >
                            <FolderPlus className="mb-2" />
                            <span className="text-sm">Carpeta</span>
                        </button>
                        <button
                            onClick={() => setMode('link')}
                            className={`ui-interactive flex-1 flex flex-col items-center p-3 rounded-xl border ${mode === 'link' ? 'border-blue-500 bg-blue-50 text-blue-600 shadow-sm' : 'border-gray-200 hover:bg-gray-50'
                                }`}
                        >
                            <LinkIcon className="mb-2" />
                            <span className="text-sm">Enlace</span>
                        </button>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className={`ui-interactive flex-1 flex flex-col items-center p-3 rounded-xl border ${mode === 'file' ? 'border-blue-500 bg-blue-50 text-blue-600 shadow-sm' : 'border-gray-200 hover:bg-gray-50'
                                }`}
                        >
                            <Upload className="mb-2" />
                            <span className="text-sm">Archivo</span>
                        </button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            onChange={handleFileChange}
                        />
                    </div>

                    <form onSubmit={handleSubmit}>
                        {mode === 'folder' && (
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la carpeta</label>
                                <input
                                    type="text"
                                    required
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="ui-interactive w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="Ej: Material de Matemáticas"
                                />
                            </div>
                        )}

                        {mode === 'link' && (
                            <>
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                                    <input
                                        type="text"
                                        required
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="ui-interactive w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="Ej: Video Explicativo"
                                    />
                                </div>
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
                                    <input
                                        type="url"
                                        required
                                        value={url}
                                        onChange={(e) => setUrl(e.target.value)}
                                        className="ui-interactive w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="https://..."
                                    />
                                </div>
                            </>
                        )}

                        <div className="flex justify-end space-x-3 mt-6">
                            <button
                                type="button"
                                onClick={onClose}
                                className="ui-interactive px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200"
                            >
                                Cancelar
                            </button>
                            {mode !== 'file' && (
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="ui-interactive px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl shadow-sm hover:bg-blue-700 hover:shadow-md disabled:opacity-50"
                                >
                                    {isSubmitting ? <BrandLoader inline size="sm" tone="dark" label="Creando..." /> : 'Crear'}
                                </button>
                            )}
                        </div>
                    </form>
                </Dialog.Panel>
            </div>
        </Dialog>
    );
};

export default CreateModal;
