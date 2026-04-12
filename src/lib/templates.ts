import { CASE_ORDER } from "./labels";
import { generateEntrySections } from "./morphology";
import type { ChartColumn, ChartRow, ChartSection, Diagnostic, LatinCase, MorphEntry, Project, TemplateDocument, VisibilitySettings } from "./types";

export interface RenderedChartBlock {
  id: string;
  heading: string;
  sections: ChartSection[];
}

export interface RenderedChartRow {
  id: string;
  heading?: string;
  blocks: RenderedChartBlock[];
}

export interface TemplateChartResult {
  diagnostics: Diagnostic[];
  rows: RenderedChartRow[];
}

interface ParsedRow {
  heading?: string;
  groups: string[][];
}

function parseTemplate(source: string): ParsedRow[] {
  const lines = source.split("\n");
  let pendingHeading: string | undefined;
  const result: ParsedRow[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith("#")) {
      pendingHeading = line.slice(1).trim() || undefined;
      continue;
    }

    const groups: string[][] = [];
    const regex = /\{([^}]+)\}/g;
    let match;
    let currentGroup: string[] = [];
    let previousMatchEnd = 0;

    while ((match = regex.exec(line)) !== null) {
      const separator = line.slice(previousMatchEnd, match.index);
      if (separator.trim()) {
        currentGroup = [];
      } else if (separator.includes(" ") || separator.includes("\t")) {
        if (currentGroup.length > 0) groups.push(currentGroup);
        currentGroup = [];
      }

      const ref = match[1].trim();
      if (ref) currentGroup.push(ref);
      previousMatchEnd = regex.lastIndex;
    }

    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }

    if (groups.length > 0) {
      result.push({ heading: pendingHeading, groups });
      pendingHeading = undefined;
    }
  }

  return result;
}

function findEntry(entries: MorphEntry[], ref: string): MorphEntry | undefined {
  const lower = ref.toLowerCase();
  return entries.find(
    (e) =>
      e.displayName === ref ||
      e.lemma === ref ||
      e.displayName.toLowerCase() === lower ||
      e.lemma.toLowerCase() === lower
  );
}

export function buildTemplateCharts(project: Project, template: TemplateDocument): TemplateChartResult {
  const diagnostics: Diagnostic[] = [];
  const parsed = parseTemplate(template.source);

  const rows: RenderedChartRow[] = parsed
    .map((parsedRow, rowIndex) => ({
      id: `row-${rowIndex}`,
      heading: parsedRow.heading,
      blocks: parsedRow.groups
        .map((refs, blockIndex) => {
          const entries = refs
            .map((ref) => {
              const entry = findEntry(project.entries, ref);
              if (!entry) diagnostics.push({ line: rowIndex + 1, message: `"{${ref}}" not found` });
              return entry;
            })
            .filter((e): e is MorphEntry => Boolean(e));

          const sectionsBySignature = new Map<string, ChartSection[]>();
          for (const entry of entries) {
            const visibility = resolveEntryVisibility(project.visibility, entry);
            for (const section of generateEntrySections(entry, visibility)) {
              const list = sectionsBySignature.get(section.signature) ?? [];
              list.push(section);
              sectionsBySignature.set(section.signature, list);
            }
          }

          return {
            id: `block-${rowIndex}-${blockIndex}`,
            heading: "",
            sections: [...sectionsBySignature.values()].map((sections) => mergeCompatibleSections(sections))
          };
        })
        .filter((b) => b.sections.length > 0)
    }))
    .filter((r) => r.blocks.length > 0);

  return { diagnostics, rows };
}

export function resolveEntryVisibility(
  projectVisibility: VisibilitySettings,
  entry: MorphEntry,
  visibilityOverrides: Partial<VisibilitySettings> = {},
  caseOverrides: Partial<Record<LatinCase, boolean>> = {}
): VisibilitySettings {
  const base = {
    ...projectVisibility,
    ...entry.visibility,
    ...visibilityOverrides,
    cases: [...(visibilityOverrides.cases || entry.visibility?.cases || projectVisibility.cases)]
  };
  const cases = new Set(base.cases);
  for (const [latinCase, shouldShow] of Object.entries(caseOverrides) as Array<[LatinCase, boolean]>) {
    if (shouldShow) cases.add(latinCase);
    else cases.delete(latinCase);
  }

  return {
    ...base,
    cases: CASE_ORDER.filter((latinCase) => cases.has(latinCase)),
    showLocative: caseOverrides.loc ?? base.showLocative
  };
}

function mergeCompatibleSections(sections: ChartSection[]): ChartSection {
  const [first] = sections;
  const shouldUseGroupHeaders = sections.length > 1;
  const columns: ChartColumn[] = sections.flatMap((section) => {
    const groupLabel = shouldUseGroupHeaders
      ? (section.columns[0]?.entryLemma || section.title)
      : undefined;
    return section.columns.map((column) => ({
      ...column,
      key: `${section.id}-${column.key}`,
      groupLabel,
      label: shouldUseGroupHeaders && section.columns.length === 1 ? "" : column.label
    }));
  });

  const rowKeys = Array.from(new Set(sections.flatMap((section) => section.rows.map((row) => row.key))));
  const rows: ChartRow[] = rowKeys.map((rowKey) => {
    const label =
      sections.find((section) => section.rows.some((row) => row.key === rowKey))?.rows.find((row) => row.key === rowKey)
        ?.label || rowKey;
    const sourceRow = sections
      .find((section) => section.rows.some((row) => row.key === rowKey))
      ?.rows.find((row) => row.key === rowKey);
    const subLabel = sourceRow?.subLabel;
    const labelRowSpan = sourceRow?.labelRowSpan;
    const cells = sections.flatMap((section) => {
      const row = section.rows.find((candidate) => candidate.key === rowKey);
      if (row) return row.cells;
      return section.columns.map((column) => ({
        key: `${section.id}-${rowKey}-${column.key}-empty`,
        entryId: column.entryId || section.id,
        entryLemma: column.entryLemma || section.title,
        slot: {},
        segments: [{ text: "—", role: "form" as const, label: "not applicable" }],
        generatedText: "—",
        displayText: "—"
      }));
    });

    return { key: rowKey, label, subLabel, labelRowSpan, cells };
  });

  return {
    ...first,
    id: sections.map((section) => section.id).join("+"),
    title: sections.map((section) => section.title).join(", "),
    columns,
    rows
  };
}
