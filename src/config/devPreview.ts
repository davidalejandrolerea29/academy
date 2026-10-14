import type { User } from '../types';

// Preview access is opt-in and is always disabled in production builds.
export const isDevPreview = import.meta.env.DEV && import.meta.env.VITE_DEV_PREVIEW === 'true';

export const previewUser: User = {
  id: 9000,
  name: 'Vista previa local',
  email: 'preview@example.invalid',
  role_id: 1,
  role_description: 'Admin',
  role: { id: 1, description: 'Admin', created_at: '', updated_at: '' },
  must_change_password: false,
  token: 'local-design-preview',
};
