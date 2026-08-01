import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/favicon.ico", "icons/apple-touch-icon.png"],
      manifest: {
        name: "CarWash Pro — إدارة مغسلة السيارات",
        short_name: "CarWash Pro",
        description: "نظام إدارة احترافي لمغاسل السيارات — تتبع السيارات، الموظفين، المصاريف والتقارير",
        theme_color: "#0A0D10",
        background_color: "#0A0D10",
        display: "standalone",
        orientation: "portrait-primary",
        start_url: "/",
        scope: "/",
        dir: "rtl",
        lang: "ar",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        // App shell + static assets: cache-first for instant offline load.
        // Supabase API calls are intentionally NOT cached here — the app's
        // own IndexedDB + sync queue (src/lib) is the offline data layer.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === "https://fonts.googleapis.com",
            handler: "StaleWhileRevalidate",
            options: { cacheName: "google-fonts-stylesheets" }
          },
          {
            urlPattern: ({ url }) => url.origin === "https://fonts.gstatic.com",
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-webfonts",
              expiration: { maxAgeSeconds: 60 * 60 * 24 * 365 }
            }
          },
          {
            // Supabase Storage photo URLs: cache-first once fetched so
            // photos remain viewable offline after first load.
            urlPattern: ({ url }) => url.pathname.includes("/storage/v1/object/public/"),
            handler: "CacheFirst",
            options: {
              cacheName: "carwash-photos",
              expiration: { maxEntries: 2000, maxAgeSeconds: 60 * 60 * 24 * 365 }
            }
          }
        ]
      },
      devOptions: { enabled: true }
    })
  ],
  server: { port: 5173 },
  build: { outDir: "dist", sourcemap: false }
});
