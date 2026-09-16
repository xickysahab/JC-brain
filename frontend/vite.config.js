import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  /* Motion is pre-bundled by Vite in dev; without dedupe its copy of React
     resolves separately from the app's and every hook inside a <motion.*>
     throws "Invalid hook call". */
  resolve: { dedupe: ['react', 'react-dom'] },
  optimizeDeps: { include: ['motion/react', 'react', 'react-dom', 'react-dom/client'] },
  server: {
    port: 5180,
    strictPort: true,
    // The API sets an httpOnly cookie, so in dev the browser must see one
    // origin. Vercel does the same job in production via vercel.json.
    proxy: { '/api': { target: process.env.API_URL || 'http://localhost:4000', changeOrigin: true } }
  }
});
