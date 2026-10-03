import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ command }) => ({
  base: command === "serve" ? "/" : "/fool-game/",
  plugins: [tailwindcss(), solidPlugin()],
  server: {
    port: 5188
  },
  build: {
    target: "esnext"
  }
}));
