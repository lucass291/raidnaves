import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(root, "."),
    },
  },
  test: {
    include: ["lib/**/*.test.ts", "app/**/*.test.ts"],
  },
});
