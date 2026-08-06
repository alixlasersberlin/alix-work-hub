import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";

const versionFile = path.resolve(__dirname, "./src/version.json");

function readVersion(): string {
  try {
    return JSON.parse(fs.readFileSync(versionFile, "utf-8")).version || "6.00";
  } catch {
    return "6.00";
  }
}

// Erhöht die App-Version bei jedem Production-Build (Publish) automatisch um 0.01.
function bumpVersion(): string {
  const next = (parseFloat(readVersion()) + 0.01).toFixed(2);
  try {
    fs.writeFileSync(versionFile, JSON.stringify({ version: next }, null, 2) + "\n");
  } catch {
    /* read-only FS: Version landet trotzdem korrekt im Bundle */
  }
  return next;
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const appVersion = mode === "development" ? readVersion() : bumpVersion();

  return {
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
    },
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
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
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
      // Warnschwelle hochsetzen, damit die Vendor-Chunks keine Warnings werfen.
      chunkSizeWarningLimit: 1200,
    },
  };
});
