import { describe, expect, it } from "vitest";
import { DEFAULT_PROJECT } from "../lib/sampleData";
import { buildTemplateCharts, parseTemplate } from "../lib/templates";
import type { Project } from "../lib/types";

describe("template parsing", () => {
  it("parses headings, directives, and saved-entry references", () => {
    const template = {
      id: "t",
      name: "Test",
      source: "# Nouns\n@show locative\n{vir} {servus}"
    };

    const parsed = parseTemplate(template, DEFAULT_PROJECT.visibility);
    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.blocks[0].heading).toBe("Nouns");
    expect(parsed.blocks[0].references).toEqual(["vir", "servus"]);
    expect(parsed.blocks[0].visibilityOverrides.showLocative).toBe(true);
    expect(parsed.blocks[0].caseOverrides?.loc).toBe(true);
  });

  it("groups compatible entries into one chart with word columns", () => {
    const template = {
      id: "t",
      name: "Test",
      source: "# Second declension nouns\n{vir} {servus} {dominus} {dōnum}"
    };

    const rendered = buildTemplateCharts(DEFAULT_PROJECT, template);
    expect(rendered.diagnostics).toEqual([]);
    expect(rendered.blocks[0].sections).toHaveLength(1);
    expect(rendered.blocks[0].sections[0].columns.map((column) => column.groupLabel)).toContain("vir");
    expect(rendered.blocks[0].sections[0].rows.find((row) => row.key === "nom-pl")?.label).toBe("nom.pl.");
  });

  it("applies per-entry visibility and lets template directives override it", () => {
    const project: Project = {
      ...DEFAULT_PROJECT,
      entries: DEFAULT_PROJECT.entries.map((entry) =>
        entry.displayName === "servus" ? { ...entry, visibility: { cases: ["nom"], showLocative: false } } : entry
      )
    };

    const hidden = buildTemplateCharts(project, { id: "t", name: "Test", source: "{servus}" });
    expect(hidden.blocks[0].sections[0].rows.map((row) => row.label)).toEqual(["nom.sg.", "nom.pl."]);

    const overridden = buildTemplateCharts(project, { id: "t", name: "Test", source: "@show genitive\n{servus}" });
    expect(overridden.blocks[0].sections[0].rows.map((row) => row.label)).toEqual(["nom.sg.", "gen.sg.", "nom.pl.", "gen.pl."]);
  });

  it("reports missing entries", () => {
    const template = {
      id: "t",
      name: "Test",
      source: "{not-a-word}"
    };

    const rendered = buildTemplateCharts(DEFAULT_PROJECT, template);
    expect(rendered.diagnostics[0].message).toContain("Missing entry");
  });
});
