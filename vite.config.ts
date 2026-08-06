import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { execSync } from "child_process";
import { componentTagger } from "lovable-tagger";

const versionFile = path.resolve(__dirname, "./src/version.json");

function readVersionFile(): { version: string; anchorCommits: number } {
  try {
    const raw = JSON.parse(fs.readFileSync(versionFile, "utf-8"));
    return {
      version: raw.version || "6.00",
      anchorCommits: Number(raw.anchorCommits) || 0,
    };
  } catch {
    return { version: "6.00", anchorCommits: 0 };
  }
}

function commitCount(): number | null {
  try {
    return parseInt(execSync("git rev-list --count HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(), 10) || null;
  } catch {
    return null;
  }
}

/**
 * Version wird aus der Commit-Anzahl abgeleitet: jeder Publish enthält neue Commits,
 * dadurch erhöht sich die Version bei jedem Publish automatisch um 0.01 —
 * auch wenn das Dateisystem beim Build read-only ist.
 */
function resolveVersion(isProd: boolean): string {
  const { version, anchorCommits } = readVersionFile();
  const base = parseFloat(version) || 6.0;
  const count = commitCount();
  if (!count || !anchorCommits) return isProd ? (base + 0.01).toFixed(2) : base.toFixed(2);
  const delta = Math.max(0, count - anchorCommits);
  return (base + delta * 0.01).toFixed(2);
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const appVersion = resolveVersion(mode !== "development");


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
