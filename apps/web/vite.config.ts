import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

function servePublicServiceWorker(): Plugin {
  return {
    name: 'serve-public-service-worker',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0]
        if (url !== '/sw.js') {
          next()
          return
        }

        const filePath = path.resolve(__dirname, 'public/sw.js')
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
        fs.createReadStream(filePath).pipe(res)
      })
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), servePublicServiceWorker()],
  server: {
    port: 5175,
    host: '0.0.0.0',  // Allow external connections for ngrok
    allowedHosts: [
      '1528-2a00-a041-f229-9200-d412-a218-85b1-3796.ngrok-free.app',
      '59b3-2a00-a041-f229-9200-211f-de6c-3c1e-20.ngrok-free.app',
      'c46872e6d739.ngrok-free.app',
      '9538501d3d45.ngrok-free.app',
      '.ngrok-free.app', // Allow all ngrok subdomains
    ],
    // Same-origin API calls in dev — avoids CORS when backend is on :4000
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Public directory files are automatically copied to dist
  publicDir: 'public',
})

