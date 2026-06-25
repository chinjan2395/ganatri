/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SERVER_URL?: string;
  readonly VITE_DESIGN_SYSTEM_OWNER_EMAIL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
