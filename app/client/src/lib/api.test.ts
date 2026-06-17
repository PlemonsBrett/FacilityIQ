import { afterEach, describe, expect, test, vi } from "vitest";
import { fetchDashboardData } from "./api";

describe("fetchDashboardData", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubLocalStorage() {
    vi.stubGlobal("localStorage", {
      length: 0,
      getItem: vi.fn(() => null),
      key: vi.fn(() => null),
      removeItem: vi.fn(),
      setItem: vi.fn(),
    });
  }

  test("falls back to dummy dashboard data when the live dashboard API fails", async () => {
    stubLocalStorage();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok: false } as Response)),
    );

    const dashboard = await fetchDashboardData("analyst");

    expect(dashboard).not.toBeNull();
    expect(dashboard?.total).toBeGreaterThan(0);
    expect(dashboard?.distribution.length).toBeGreaterThan(0);
    expect(dashboard?.top3.length).toBeGreaterThan(0);
  });

  test("falls back to dummy dashboard data when the live dashboard payload is empty", async () => {
    stubLocalStorage();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          total: 0,
          contradictionCount: 0,
          avgScore: null,
          distribution: [],
          tierData: [],
          dimAvgs: [],
          typeBreakdown: [],
          top3: [],
          bottom3: [],
          shortlistedCount: 0,
          flaggedCount: 0,
        }),
      } as Response)),
    );

    const dashboard = await fetchDashboardData("analyst");

    expect(dashboard).not.toBeNull();
    expect(dashboard?.total).toBeGreaterThan(0);
    expect(dashboard?.distribution.length).toBeGreaterThan(0);
    expect(dashboard?.top3.length).toBeGreaterThan(0);
  });
});
