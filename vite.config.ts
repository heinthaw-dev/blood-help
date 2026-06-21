import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
export default defineConfig({
  // basicSsl() serves the dev server over HTTPS so the app runs in a secure
  // context — required for geolocation, push, and service workers when testing
  // on a phone / LAN IP (http://localhost is exempt, http://192.168.x.x is not).
  plugins: [react(), tailwindcss(), basicSsl()],
  server: {
    // host: true exposes the server on the LAN so other devices (your phone) can reach it
    host: true,
    https: {},
  },
})
