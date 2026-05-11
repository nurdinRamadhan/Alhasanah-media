// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // Inisialisasi Tailwind v4 disini
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;

          if (
            id.includes("react") ||
            id.includes("react-dom") ||
            id.includes("scheduler") ||
            id.includes("@refinedev") ||
            id.includes("antd") ||
            id.includes("@ant-design")
          ) {
            return "vendor-ui";
          }

          if (id.includes("exceljs") || id.includes("file-saver")) {
            return "vendor-export-excel";
          }

          if (id.includes("jspdf") || id.includes("html2canvas") || id.includes("dompurify")) {
            return "vendor-export-pdf";
          }

          if (id.includes("@antv") || id.includes("maplibre-gl")) {
            return "vendor-map";
          }

          if (id.includes("recharts") || id.includes("d3-")) {
            return "vendor-charts";
          }

        },
      },
    },
  },
});
