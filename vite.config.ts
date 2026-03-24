
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react()],
    define: {
      // Explicitly expose these non-VITE_ prefixed variables to the client
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      'process.env.GROQ_API_KEY': JSON.stringify(env.GROQ_API_KEY),
    },
    server: {
      host: 'localhost',
      port: 5175,
      strictPort: true,
      proxy: {
        '/api/chat': {
          target: 'https://api.groq.com',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api\/chat/, '/openai/v1/chat/completions'),
        },
        '/api/github-models': {
          target: 'https://models.inference.ai.azure.com',
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/api\/github-models/, '/chat/completions'),
        },
        '/api/github-device-code': {
          target: 'https://github.com',
          changeOrigin: true,
          secure: true,
          rewrite: () => '/login/device/code',
        },
        '/api/github-oauth-token': {
          target: 'https://github.com',
          changeOrigin: true,
          secure: true,
          rewrite: () => '/login/oauth/access_token',
        },
        '/api/github-user': {
          target: 'https://api.github.com',
          changeOrigin: true,
          secure: true,
          rewrite: () => '/user',
        },
        '/api/smartsheet': {
          target: 'https://api.smartsheet.com',
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/api\/smartsheet/, '/2.0'),
        },
      },
    },
    optimizeDeps: {
      include: ['@google/genai'],
    },
    build: {
      // Ensure production build does not use eval-based source maps
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return;

            if (id.includes('react') || id.includes('scheduler')) return 'react-vendor';
            if (id.includes('@supabase')) return 'supabase-vendor';
            if (id.includes('lucide-react')) return 'icons-vendor';
            if (id.includes('recharts') || id.includes('/d3-')) return 'charts-vendor';
            if (id.includes('xlsx')) return 'xlsx-vendor';
            if (id.includes('@google/genai')) return 'ai-vendor';

            return 'vendor';
          },
        },
      },
    },
  };
});
