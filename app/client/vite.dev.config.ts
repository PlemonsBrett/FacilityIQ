import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

// Standalone client-only dev server for verifying frontend-only work (e.g. the
// splash screen) WITHOUT the Databricks/Lakebase backend. The /api/* calls will
// 404, which is fine — the splash overlays the app. Run with:
//   npx vite --config client/vite.dev.config.ts
// then open http://localhost:5173/?splash=on
export default defineConfig({
  root: __dirname,
  plugins: [react(), tailwindcss()],
  server: { port: 5173, open: false },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
