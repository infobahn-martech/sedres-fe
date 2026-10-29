import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  base: "/",
  build: {
    outDir: "dist",
    rollupOptions: {
      output: {
        manualChunks: {
          mui: ["@mui/material", "@mui/x-date-pickers", "@emotion/react", "@emotion/styled"],
          quill: ["quill", "quill-table-better", "react-quill", "react-quill-new"],
          pdf: ["pdfjs-dist"],
          dates: ["moment", "dayjs", "date-fns"],
          msal: ["@azure/msal-browser", "@azure/msal-react"],
          bootstrap: ["react-bootstrap"],
        },
      },
    },
  },
});