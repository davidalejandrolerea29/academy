import { isDevPreview } from '../config/devPreview';

// Production requests retain the native fetch behavior. Preview data is loaded
// only for the explicitly enabled local development mode.
export const apiFetch: typeof fetch = (input, init) => {
    if (!isDevPreview) return globalThis.fetch(input, init);

    return import('../dev/previewApi').then(({ previewFetch }) => previewFetch(input, init));
};
