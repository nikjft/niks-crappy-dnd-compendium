import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      // Use the existing manifest.json from public/
      manifest: false,
      workbox: {
        // Cache app assets — exclude large XML source data files (fetched on-demand)
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        // Don't set a fallback page — the app uses in-page pane navigation, not hash routing
        navigateFallback: null,
        runtimeCaching: [
          // Dropbox API calls are always network-only (never cache auth/sync responses)
          {
            urlPattern: /^https:\/\/api\.dropboxapi\.com\//,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\/\/content\.dropboxapi\.com\//,
            handler: 'NetworkOnly',
          },
          // 5etools JSON imports are network-only (large files, user-triggered)
          {
            urlPattern: /^https:\/\/raw\.githubusercontent\.com\//,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
});
