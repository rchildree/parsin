import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_PROJECT } from "../lib/sampleData";
import { importProject, loadProject, STORAGE_KEY } from "../lib/storage";

afterEach(() => {
  localStorage.clear();
});

describe("storage normalization", () => {
  it("strips legacy overrides during import", () => {
    const legacy = JSON.stringify({
      ...DEFAULT_PROJECT,
      entries: DEFAULT_PROJECT.entries.map((entry, index) => (index === 0 ? { ...entry, overrides: { stale: "value" } } : entry))
    });

    const project = importProject(legacy, DEFAULT_PROJECT);
    expect("overrides" in project.entries[0]).toBe(false);
  });

  it("strips legacy overrides from stored projects", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...DEFAULT_PROJECT,
        entries: DEFAULT_PROJECT.entries.map((entry, index) => (index === 0 ? { ...entry, overrides: { stale: "value" } } : entry))
      })
    );

    const project = loadProject(DEFAULT_PROJECT);
    expect("overrides" in project.entries[0]).toBe(false);
  });
});
