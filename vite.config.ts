import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['@google/genai'],
  },
  build: {
    // Ensure production build does not use eval-based source maps
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'recharts', 'xlsx', 'lucide-react', '@google/genai'],
        },
      },
    },
  },
});