import { parse } from "dotenv";
import { readFileSync } from "node:fs";
import { defineConfig } from "vitest/config";

const testEnv = parse(readFileSync(".env.test"));

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    fileParallelism: false,
    env: testEnv,
  },
});
