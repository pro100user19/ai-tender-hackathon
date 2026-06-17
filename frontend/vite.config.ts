import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    fs: {
      strict: false,
    },
    proxy: {
      "/api": "http://127.0.0.1:8000",
      "/process": "http://127.0.0.1:8000",
      "/static": "http://127.0.0.1:8000",
      "/tenders": "http://127.0.0.1:8000",
    },
  },
  build: {
    emptyOutDir: true,
    outDir: "../prozorro_quality/static/dashboard",
    rollupOptions: {
      input: "src/main.tsx",
      output: {
        entryFileNames: "dashboard.js",
        chunkFileNames: "dashboard-[hash].js",
        assetFileNames: "dashboard.[ext]",
      },
    },
  },
});
