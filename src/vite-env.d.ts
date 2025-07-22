/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_TWILIO_ACCOUNT_SID: string;
  readonly VITE_TWILIO_AUTH_TOKEN: string;
  // Agrega aquí cualquier otra variable de entorno que uses con VITE_
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}