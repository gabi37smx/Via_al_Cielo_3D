/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL del proyecto de Supabase (https://xxxx.supabase.co). */
  readonly VITE_SUPABASE_URL?: string;
  /** Clave publishable (pública) de Supabase. NUNCA la secreta. */
  readonly VITE_SUPABASE_CLAVE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
