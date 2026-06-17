import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Databricks Apps packaging", () => {
  it("builds deploy artifacts before starting the compiled server", () => {
    const packageJson = JSON.parse(
      readFileSync(join(process.cwd(), "package.json"), "utf8"),
    ) as { scripts?: Record<string, string> };
    const startScript = packageJson.scripts?.start ?? "";

    expect(startScript).toContain("npm run build:server");
    expect(startScript).toContain("npm run build:client");
    expect(startScript).toContain("node --env-file-if-exists=./.env ./dist/server.js");
  });
});
