import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // New service worker activates automatically on next visit.
      registerType: 'autoUpdate',
      includeAssets: ['favicon-16x16.png', 'favicon-32x32.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Card Collection Tracker',
        short_name: 'Card Tracker',
        description:
          'Personal TCG collection tracker with cached prices and a portfolio value chart.',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache the app shell only. We deliberately do NOT runtime-cache
        // Supabase/TCG responses — prices must come fresh from the DB cache, not
        // a stale service-worker copy.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: '/index.html',
      },
      // Service worker stays off during `vite dev` to avoid caching headaches.
      devOptions: { enabled: false },
    }),
  ],
  server: {
    port: 5173,
  },
});
