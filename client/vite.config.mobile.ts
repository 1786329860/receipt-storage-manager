import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    __MOBILE_API_BASE__: JSON.stringify('https://career.aixiaolv.icu'),
  },
  build: {
    outDir: 'dist-mobile',
    emptyOutDir: true,
    target: 'es2019',
  },
});
