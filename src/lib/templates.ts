import { CASE_ORDER, DEFAULT_CASES } from "./labels";
import { generateEntrySections } from "./morphology";
import type { ChartColumn, ChartRow, ChartSection, Diagnostic, LatinCase, MorphEntry, Project, RenderedTemplate, TemplateBlock, TemplateDocument, VisibilitySettings } from "./types";

export interface RenderedChartBlock {
  id: string;
  heading: string;
  sections: ChartSection[];
}

export interface TemplateChartResult {
  diagnostics: Diagnostic[];
  blocks: RenderedChartBlock[];
}

const CASE_WORDS: Record<string, LatinCase> = {
  nom: "nom",
  "nom.": "nom",
  nominative: "nom",
  gen: "gen",
  "gen.": "gen",
  genitive: "gen",
  dat: "dat",
  "dat.": "dat",
  dative: "dat",
  acc: "acc",
  "acc.": "acc",
  accusative: "acc",
  abl: "abl",
  "abl.": "abl",
  ablative: "abl",
  voc: "voc",
  "voc.": "voc",
  vocative: "voc",
  loc: "loc",
  "loc.": "loc",
  locative: "loc"
};

export function parseTemplate(template: TemplateDocument, baseVisibility: VisibilitySettings): RenderedTemplate {
  const diagnostics: Diagnostic[] = [];
  const blocks: TemplateBlock[] = [];
  const lines = template.source.split(/\r?\n/);
  let heading = template.name || "Charts";
  let visibilityOverrides: Partial<VisibilitySettings> = {};
  let caseOverrides: Partial<Record<LatinCase, boolean>> = {};

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmed = line.trim();
    if (!trimmed) return;

    if (trimmed.startsWith("#")) {
      heading = trimmed.replace(/^#+\s*/, "") || heading;
      return;
    }

    if (trimmed.startsWith("@")) {
      const nextOverrides = applyDirective(trimmed, visibilityOverrides, caseOverrides);
      if (!nextOverrides) diagnostics.push({ line: lineNumber, message: `Unknown directive: ${trimmed}` });
      else {
        visibilityOverrides = nextOverrides.visibilityOverrides;
        caseOverrides = nextOverrides.caseOverrides;
      }
      return;
    }

    const references = [...trimmed.matchAll(/\{([^}]+)\}/g)].map((match) => match[1].trim()).filter(Boolean);
    if (references.length === 0) {
      diagnostics.push({ line: lineNumber, message: "No saved entry references found. Use {entry name}." });
      return;
    }

    blocks.push({
      id: `${template.id}-${lineNumber}`,
      heading,
      references,
      visibilityOverrides: cloneVisibilityOverrides(visibilityOverrides),
      caseOverrides: { ...caseOverrides }
    });
  });

  return { diagnostics, blocks };
}

export function buildTemplateCharts(project: Project, template: TemplateDocument): TemplateChartResult {
  const parsed = parseTemplate(template, project.visibility);
  const diagnostics = [...parsed.diagnostics];
  const blocks = parsed.blocks.map((block) => {
    const entries = block.references
      .map((reference) => {
        const entry = findEntry(project.entries, reference);
        if (!entry) diagnostics.push({ line: 0, message: `Missing entry: ${reference}` });
        return entry;
      })
      .filter((entry): entry is MorphEntry => Boolean(entry));

    const sectionsBySignature = new Map<string, ChartSection[]>();
    for (const entry of entries) {
      const visibility = resolveEntryVisibility(project.visibility, entry, block.visibilityOverrides, block.caseOverrides);
      for (const section of generateEntrySections(entry, visibility)) {
        const list = sectionsBySignature.get(section.signature) || [];
        list.push(section);
        sectionsBySignature.set(section.signature, list);
      }
    }

    return {
      id: block.id,
      heading: block.heading,
      sections: [...sectionsBySignature.values()].map((sections) => mergeCompatibleSections(sections))
    };
  });

  return { diagnostics, blocks };
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

function cloneVisibilityOverrides(visibility: Partial<VisibilitySettings>): Partial<VisibilitySettings> {
  return {
    ...visibility,
    cases: visibility.cases ? [...visibility.cases] : undefined
  };
}

function findEntry(entries: MorphEntry[], reference: string): MorphEntry | undefined {
  const normalized = reference.toLocaleLowerCase();
  return entries.find(
    (entry) => entry.displayName.toLocaleLowerCase() === normalized || entry.lemma.toLocaleLowerCase() === normalized
  );
}

function applyDirective(
  directive: string,
  visibility: Partial<VisibilitySettings>,
  caseOverrides: Partial<Record<LatinCase, boolean>>
): { visibilityOverrides: Partial<VisibilitySettings>; caseOverrides: Partial<Record<LatinCase, boolean>> } | undefined {
  const [command, ...rest] = directive.slice(1).toLocaleLowerCase().split(/\s+/);
  const target = rest.join(" ");
  const next = cloneVisibilityOverrides(visibility);
  const nextCaseOverrides = { ...caseOverrides };

  if (!["show", "hide"].includes(command)) return undefined;
  const shouldShow = command === "show";

  if (["infinitive", "infinitives"].includes(target)) {
    next.showInfinitives = shouldShow;
    return { visibilityOverrides: next, caseOverrides: nextCaseOverrides };
  }
  if (["participle", "participles"].includes(target)) {
    next.showParticiples = shouldShow;
    return { visibilityOverrides: next, caseOverrides: nextCaseOverrides };
  }
  if (["imperative", "imperatives"].includes(target)) {
    next.showImperatives = shouldShow;
    return { visibilityOverrides: next, caseOverrides: nextCaseOverrides };
  }
  if (["indic active", "indic act", "indic. act.", "indicative active"].includes(target)) {
    next.showIndicativeActive = shouldShow;
    return { visibilityOverrides: next, caseOverrides: nextCaseOverrides };
  }
  if (["indic passive", "indic pass", "indic. pass.", "indicative passive"].includes(target)) {
    next.showIndicativePassive = shouldShow;
    return { visibilityOverrides: next, caseOverrides: nextCaseOverrides };
  }
  if (["subj active", "subj act", "subj. act.", "subjunctive active"].includes(target)) {
    next.showSubjunctiveActive = shouldShow;
    return { visibilityOverrides: next, caseOverrides: nextCaseOverrides };
  }
  if (["subj passive", "subj pass", "subj. pass.", "subjunctive passive"].includes(target)) {
    next.showSubjunctivePassive = shouldShow;
    return { visibilityOverrides: next, caseOverrides: nextCaseOverrides };
  }
  if (["locative", "loc", "loc."].includes(target)) {
    next.showLocative = shouldShow;
    nextCaseOverrides.loc = shouldShow;
    return { visibilityOverrides: next, caseOverrides: nextCaseOverrides };
  }
  if (target === "all cases") {
    next.cases = shouldShow ? [...CASE_ORDER] : [];
    next.showLocative = shouldShow;
    return { visibilityOverrides: next, caseOverrides: nextCaseOverrides };
  }

  const latinCase = CASE_WORDS[target];
  if (latinCase) {
    nextCaseOverrides[latinCase] = shouldShow;
    if (latinCase === "loc") next.showLocative = shouldShow;
    return { visibilityOverrides: next, caseOverrides: nextCaseOverrides };
  }

  return undefined;
}

function setCaseVisibility(cases: LatinCase[], latinCase: LatinCase, shouldShow: boolean): LatinCase[] {
  const existing = new Set(cases.length ? cases : DEFAULT_CASES);
  if (shouldShow) existing.add(latinCase);
  else existing.delete(latinCase);
  return CASE_ORDER.filter((caseName) => existing.has(caseName));
}

function mergeCompatibleSections(sections: ChartSection[]): ChartSection {
  const [first] = sections;
  const shouldUseGroupHeaders = sections.length > 1 && first.kind === "case-grid";
  const columns: ChartColumn[] = sections.flatMap((section) =>
    section.columns.map((column) => ({
      ...column,
      key: `${section.id}-${column.key}`,
      groupLabel: shouldUseGroupHeaders ? section.title : undefined,
      label: shouldUseGroupHeaders && section.columns.length === 1 ? "" : column.label
    }))
  );

  const rowKeys = Array.from(new Set(sections.flatMap((section) => section.rows.map((row) => row.key))));
  const rows: ChartRow[] = rowKeys.map((rowKey) => {
    const label = sections.find((section) => section.rows.some((row) => row.key === rowKey))?.rows.find((row) => row.key === rowKey)?.label || rowKey;
    const sourceRow = sections.find((section) => section.rows.some((row) => row.key === rowKey))?.rows.find((row) => row.key === rowKey);
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
