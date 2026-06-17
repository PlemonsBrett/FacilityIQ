import { describe, expect, it } from "vitest";
import { facilityIqSchemaStatements } from "./schemaInit";

describe("facilityIqSchemaStatements", () => {
  it("uses idempotent DDL and does not drop the app schema", () => {
    const sql = facilityIqSchemaStatements.join("\n");

    expect(sql).toContain("CREATE SCHEMA IF NOT EXISTS facilityiq");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS facilityiq.user_actions");
    expect(sql).not.toMatch(/\bDROP\s+SCHEMA\b/i);
  });
});
