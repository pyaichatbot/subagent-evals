import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@subagent-evals/core": resolve(__dirname, "packages/core/src/index.ts"),
      "@subagent-evals/report-html": resolve(
        __dirname,
        "packages/report-html/src/index.ts"
      )
    }
  },
  test: {
    environment: "node",
    include: ["packages/*/test/**/*.test.ts"]
  }
});
