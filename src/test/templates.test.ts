import { describe, expect, it } from "vitest";
import { DEFAULT_PROJECT } from "../lib/sampleData";
import { buildTemplateCharts } from "../lib/templates";
import type { Project, TemplateDocument } from "../lib/types";

const makeTemplate = (source: string): TemplateDocument => ({ id: "t", source });

describe("buildTemplateCharts", () => {
  it("groups adjacent {word}{word} tokens into one merged chart", () => {
    const template = makeTemplate("{vir}{servus}{dominus}{dōnum}");

    const rendered = buildTemplateCharts(DEFAULT_PROJECT, template);
    expect(rendered.diagnostics).toEqual([]);
    const block = rendered.rows[0].blocks[0];
    expect(block.sections).toHaveLength(1);
    expect(block.sections[0].columns.map((c) => c.groupLabel)).toContain("vir");
    expect(block.sections[0].rows.find((r) => r.key === "nom-pl")?.label).toBe("nom.pl.");
  });

  it("keeps space-separated words as separate side-by-side blocks on the same row", () => {
    const template = makeTemplate("{vir} {servus}");

    const rendered = buildTemplateCharts(DEFAULT_PROJECT, template);
    expect(rendered.rows).toHaveLength(1);
    expect(rendered.rows[0].blocks).toHaveLength(2);
    expect(rendered.rows[0].blocks[0].sections[0].title).toBe("vir");
    expect(rendered.rows[0].blocks[1].sections[0].title).toBe("servus");
  });

  it("applies per-entry visibility", () => {
    const project: Project = {
      ...DEFAULT_PROJECT,
      entries: DEFAULT_PROJECT.entries.map((entry) =>
        entry.displayName === "servus" ? { ...entry, visibility: { cases: ["nom"], showLocative: false } } : entry
      )
    };

    const template = makeTemplate("{servus}");
    const rendered = buildTemplateCharts(project, template);
    expect(rendered.rows[0].blocks[0].sections[0].rows.map((r) => r.label)).toEqual(["nom.sg.", "nom.pl."]);
  });

  it("adds a diagnostic for references not found in the project", () => {
    const template = makeTemplate("{notaword}");
    const rendered = buildTemplateCharts(DEFAULT_PROJECT, template);
    expect(rendered.diagnostics.length).toBeGreaterThan(0);
    expect(rendered.rows).toHaveLength(0);
  });
});
