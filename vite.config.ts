import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === "android" ? "/" : "/oxygen-desktop/",
  clearScreen: false,
  server: {
    ...(mode === "android" ? { port: 1420, strictPort: true, host: process.env.TAURI_DEV_HOST || "0.0.0.0", hmr: process.env.TAURI_DEV_HOST ? { host: process.env.TAURI_DEV_HOST, protocol: "ws", port: 1421 } : undefined } : {}),
    watch: { ignored: ["**/src-tauri/**"] },
  },

  build: {
    outDir: mode === "android" ? "dist-android" : "dist",
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "react-vendor",
              test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
            },
            {
              name: "motion-vendor",
              test: /node_modules[\\/](framer-motion|motion)[\\/]/,
            },
            {
              name: "supabase-vendor",
              test: /node_modules[\\/](@supabase|@realtime)[\\/]/,
            },
            {
              name: "icons-vendor",
              test: /node_modules[\\/]lucide-react[\\/]/,
            },
          ],
        },
      },
    },
  },
}));
