import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/* Two builds from one source:
 *   npm run build        -> dist/        the website (absolute asset paths)
 *   npm run build:embed  -> dist-embed/  loaded by the desktop app and the
 *                                        VS Code webview (relative paths)
 */
export default defineConfig(({ mode }) => {
  const embed = mode === 'embed'
  return {
    plugins: [react()],
    base: embed ? './' : '/',
    build: {
      outDir: embed ? 'dist-embed' : 'dist',
      emptyOutDir: true,
      // Inline nothing as data: URIs that a strict webview CSP would block.
      assetsInlineLimit: embed ? 0 : 4096,
      rollupOptions: {
        output: {
          // Stable vendor chunks: cached across deploys and shared by pages.
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined
            if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler|@remix-run)\//.test(id)) return 'vendor-react'
            if (/node_modules\/(chart\.js|react-chartjs-2|@kurkle)\//.test(id)) return 'vendor-chartjs'
            return undefined
          },
        },
      },
    },
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: 'http://localhost:5000',
          changeOrigin: true,
        },
      },
    },
  }
})
