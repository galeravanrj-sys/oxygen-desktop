import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/oxygen-desktop/",

  build: {
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
});
