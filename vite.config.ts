
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
      proxy: {
        '/api/chat': {
          target: 'https://api.groq.com',
          changeOrigin: true,
          secure: false, // Useful if the target has self-signed certs (unlikely for Groq but good for robustness)
          rewrite: (path) => path.replace(/^\/api\/chat/, '/openai/v1/chat/completions'),
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
          manualChunks: {
            vendor: ['react', 'react-dom', 'recharts', 'xlsx', 'lucide-react', '@google/genai'],
          },
        },
      },
    },
  };
});
