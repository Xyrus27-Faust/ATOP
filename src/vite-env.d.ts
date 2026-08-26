/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_GOOGLE_CLIENT_ID: string
  readonly VITE_FEATURE_SCORING?: string
  readonly VITE_FEATURE_FINALS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
