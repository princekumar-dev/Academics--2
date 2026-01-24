import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'
import viteCompression from 'vite-plugin-compression'

export default defineConfig({
  plugins: (() => {
    const base = [react()]
    // Add a legacy bundle to support older Chrome/Edge versions that
    // do not understand newer language features (optional chaining, etc.).
    // This produces an additional set of legacy-compatible files.
    base.push(
      legacy({
        targets: ['defaults', 'not IE 11'],
        additionalLegacyPolyfills: ['regenerator-runtime/runtime']
      })
    )
    // On Windows some versions of vite-plugin-compression may produce
    // incorrect absolute paths for compressed artifacts. Disable by default
    // on Windows and enable via `ENABLE_COMPRESSION=true` when needed.
    const enableCompression = process.env.ENABLE_COMPRESSION === 'true' && process.platform !== 'win32'
    if (enableCompression) {
      base.push(
        viteCompression({
          algorithm: 'brotliCompress',
          ext: '.br',
          threshold: 10240,
          compressionOptions: { level: 11 }
        })
      )
      base.push(
        viteCompression({
          algorithm: 'gzip',
          ext: '.gz',
          threshold: 10240
        })
      )
    }
    return base
  })(),
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': {
        // For local development: use localhost
        // For testing with deployed backend: use Render URL
        target: process.env.VITE_USE_REMOTE_API === 'true' 
          ? 'https://academics-2-demo.onrender.com'
          : 'http://localhost:3001',
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
    cssCodeSplit: true,
    assetsInlineLimit: 4096,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom']
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: ({ name }) => {
          if (name && name.endsWith('.css')) return 'assets/css/[name]-[hash][extname]'
          return 'assets/[name]-[hash][extname]'
        }
      }
    },
    // Ensure CSS is properly minified and optimized
    cssMinify: true,
    // Force hash changes on every build for better cache busting
    chunkSizeWarningLimit: 1000
  },
  css: {
    postcss: './postcss.config.cjs',
    devSourcemap: true
  },
  base: '/',
  define: {
    'process.env': {}
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.config.js'
      ]
    }
  }
})