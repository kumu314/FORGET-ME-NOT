import { defineConfig } from 'vite';

export default defineConfig({
  // 相对路径，保证 GitHub Pages / Vercel 子路径静态托管都能直接打开
  base: './',
  server: {
    host: true, // 局域网联调：手机同网段可直接扫码打开
    port: 5173,
    strictPort: true,
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsInlineLimit: 0,
  },
});
