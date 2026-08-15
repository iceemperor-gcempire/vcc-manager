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

  // 테스트 러너 (#808) — 그동안 프론트엔드에 러너가 없어 UI 로직을 가드할 방법이 없었다.
  // 작업 히스토리 이원화(#794) 정리처럼 회귀 위험이 큰 리팩터의 전제 조건이다.
  //
  // esbuild loader 설정(위)을 그대로 쓰므로 .js 안의 JSX 도 그대로 처리된다.
  test: {
    environment: 'jsdom',
    globals: true,                      // describe/it/expect 를 import 없이
    setupFiles: './src/setupTests.js',
    include: ['src/**/*.{test,spec}.{js,jsx}'],
    css: false,
  },
});
