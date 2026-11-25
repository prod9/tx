import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig(async () => {
  const migrations = await readD1Migrations("test/migrations");

  return {
    plugins: [
      cloudflareTest({
        miniflare: {
          compatibilityDate: "2026-11-01",
          d1Databases: ["DB"],
          bindings: { GREETING: "hello", TEST_MIGRATIONS: migrations },
        },
      }),
    ],
    test: {
      setupFiles: ["test/apply-migrations.ts"],
    },
  };
});
