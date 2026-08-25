

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
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