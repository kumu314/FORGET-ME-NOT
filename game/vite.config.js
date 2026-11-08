import { defineConfig } from 'vite';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

function sourceRevision() {
  if (process.env.VITE_GIT_SHA) return process.env.VITE_GIT_SHA;
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: fileURLToPath(new URL('.', import.meta.url)), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch { return 'unknown'; } // Source archives without .git remain buildable.
}

export default defineConfig({
  // 相对路径，保证 GitHub Pages / Vercel 子路径静态托管都能直接打开
  base: './',
  define: { 'import.meta.env.VITE_GIT_SHA': JSON.stringify(sourceRevision()) },
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
