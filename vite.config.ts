import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  // Safely resolve public Supabase configuration from any of the standard conventions:
  // 1. Client Vite-prefixed: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY / VITE_SUPABASE_PUBLISHABLE_KEY
  // 2. Sovereign / Vercel integration: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY / SUPABASE_ANON_KEY
  // NEVER expose server-only credentials (SUPABASE_SECRET_KEY, service_role, DATABASE_URL).
  const publicSupabaseUrl =
    env.VITE_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    env.SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    '';

  const publicSupabaseAnonKey =
    env.VITE_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    '';

  // Defense-in-depth: Strictly verify that the key is a public/anon key and NOT a privileged secret
  const isKeySafe =
    publicSupabaseAnonKey &&
    !publicSupabaseAnonKey.includes('service_role') &&
    !publicSupabaseAnonKey.startsWith('sb_secret_') &&
    !publicSupabaseAnonKey.startsWith('sk_');
  const safeAnonKey = isKeySafe ? publicSupabaseAnonKey : '';

  const isUrlSafe = Boolean(publicSupabaseUrl && publicSupabaseUrl.startsWith('http'));
  const safeUrl = isUrlSafe ? publicSupabaseUrl : '';

  return {
    plugins: [react(), tailwindcss()],
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(safeUrl),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(safeAnonKey),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(safeAnonKey),
      'import.meta.env.SUPABASE_URL': JSON.stringify(safeUrl),
      'import.meta.env.SUPABASE_PUBLISHABLE_KEY': JSON.stringify(safeAnonKey),
      'import.meta.env.SUPABASE_ANON_KEY': JSON.stringify(safeAnonKey),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('react') || id.includes('react-dom') || id.includes('scheduler')) {
                return 'vendor-react';
              }
              if (id.includes('@supabase')) {
                return 'vendor-supabase';
              }
              if (id.includes('lucide-react')) {
                return 'vendor-icons';
              }
              return 'vendor-libs';
            }
          },
        },
      },
      chunkSizeWarningLimit: 600,
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
