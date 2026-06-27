import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const moduleId = id.replace(/\\/g, '/');
          if (!moduleId.includes('node_modules')) return undefined;
          if (moduleId.includes('/node_modules/zrender/')) return 'zrender';
          if (moduleId.includes('/node_modules/echarts/') || moduleId.includes('/node_modules/echarts-for-react/')) return 'echarts';
          if (moduleId.includes('/node_modules/react/') || moduleId.includes('/node_modules/react-dom/') || moduleId.includes('/node_modules/scheduler/')) return 'react-vendor';
          if (moduleId.includes('/node_modules/lucide-react/')) return 'icons';
          return 'vendor';
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (_err, _req, res) => {
            if (!(res as any).headersSent) {
              (res as any).writeHead(502, { 'Content-Type': 'application/json' });
              (res as any).end(JSON.stringify({ error: 'Backend unavailable' }));
            }
          });
        },
      },
    },
  },
});
