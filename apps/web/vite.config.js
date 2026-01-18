import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5175,
        host: '0.0.0.0', // Allow external connections for ngrok
        allowedHosts: [
            'c46872e6d739.ngrok-free.app',
            '9538501d3d45.ngrok-free.app',
            '.ngrok-free.app', // Allow all ngrok subdomains
        ],
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
});
