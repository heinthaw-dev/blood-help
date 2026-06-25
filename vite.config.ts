import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // injectManifest: src/firebase-messaging-sw.js is the SW entry point.
      // vite-plugin-pwa replaces self.__WB_MANIFEST with the precache list at build time.
      // Firebase requires the SW to be named firebase-messaging-sw.js at the site root.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'firebase-messaging-sw.js',
      injectRegister: 'auto',
      manifest: {
        name: 'Blood Help',
        short_name: 'Blood Help',
        description: 'Connect blood donors and patients in Myanmar',
        theme_color: '#D13E2F',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      devOptions: {
        enabled: true,
        type: 'classic',
      },
    }),
  ],
  server: {
    // localhost is a secure context even over HTTP — SW, push, and geolocation all work.
    // Re-add basicSsl() + https:{} when testing on a real device over LAN IP.
    host: true,
  },
})
