import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["img/**/*"],
      manifest: {
        name: "T.V2",
        short_name: "T.V2",
        description: "Trading education and tools",
        theme_color: "#09090b",
        background_color: "#09090b",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/icons/icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-api",
              expiration: { maxEntries: 50, maxAgeSeconds: 300 },
            },
          },
          {
            urlPattern: /^https:\/\/image\.mux\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "mux-thumbnails",
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
          {
            urlPattern: /^https:\/\/stream\.mux\.com\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "mux-streams",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
