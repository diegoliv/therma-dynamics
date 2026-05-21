import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  build: {
    outDir: "dist-webflow",
    emptyOutDir: true,
    lib: {
      entry: "src/embed.jsx",
      name: "ThermaDynamicsBundle",
      formats: ["iife"],
      fileName: () => "therma-dynamics.js",
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
