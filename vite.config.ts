import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  build: {
    // Schwere Libs in eigene Chunks splitten — sie laden nur dann,
    // wenn eine Seite sie wirklich braucht (Charts, PDFs, Excel-Exports).
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-query": ["@tanstack/react-query"],
          "vendor-charts": ["recharts"],
          "vendor-pdf": ["jspdf", "jspdf-autotable"],
          "vendor-excel": ["xlsx"],
          "vendor-icons": ["lucide-react"],
          "vendor-dates": ["date-fns"],
        },
      },
    },
    // Warnschwelle hochsetzen, damit die Vendor-Chunks (recharts, xlsx) keine Warnings werfen.
    chunkSizeWarningLimit: 1200,
  },
}));
