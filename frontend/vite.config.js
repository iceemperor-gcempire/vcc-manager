import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// CRA → Vite 마이그레이션 (#526 ❶)
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'build', // Dockerfile.frontend 가 /app/frontend/build 를 COPY — CRA 시절 경로 유지
  },
  // CRA 관행으로 .js 파일에 JSX 가 들어있음 — esbuild 가 src/*.js 를 jsx 로 처리
  esbuild: {
    loader: 'jsx',
    include: /src\/.*\.js$/,
    exclude: [],
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: { '.js': 'jsx' },
    },
  },
  define: {
    global: 'globalThis', // CRA 글로벌 shim 의존 라이브러리 대비
  },
  server: { port: 3000 },
});
