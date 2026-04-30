import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // sockjs-client lê process.env.NODE_ENV literal no source — em Web Worker
  // `process` não existe e dispara ReferenceError. Substituímos em build
  // pra que a referência some do bundle.
  define: {
    'process.env.NODE_ENV': JSON.stringify(mode === 'lib' ? 'production' : 'development'),
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  ...(mode === 'lib' && {
    build: {
      emptyOutDir: false,
      lib: {
        entry: resolve(__dirname, 'src/index.ts'),
        name: 'ChatbotWidget',
        formats: ['es', 'cjs'],
        fileName: (fmt) => `index.${fmt}.js`,
      },
      rollupOptions: {
        external: ['react', 'react-dom', 'react/jsx-runtime'],
        output: {
          globals: {
            react: 'React',
            'react-dom': 'ReactDOM',
          },
        },
      },
    },
  }),
}))
