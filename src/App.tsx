import { useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_CASES, CASE_LABELS, CASE_ORDER } from "./lib/labels";
import {
  deriveAdjectiveStem,
  deriveNounDeclension,
  deriveNounStem,
  deriveVerbConjugation,
  deriveVerbStems,
  detectIrregularVerb
} from "./lib/morphology";
import { DEFAULT_PROJECT } from "./lib/sampleData";
import { exportProject, importProject, loadProject, saveProject } from "./lib/storage";
import { sanitizeCssText, styleErrors, styleForRole } from "./lib/styleRules";
import { buildTemplateCharts } from "./lib/templates";
import type { ChartSection, GeneratedCell, LatinCase, MorphEntry, NounEntry, Project, SegmentRole, StyleRule, VerbEntry } from "./lib/types";
import { uid } from "./lib/utils";

const STYLE_TARGETS: StyleRule["target"][] = [
  "labels",
  "case-endings",
  "verb-stems",
  "verb-tense-markers",
  "verb-thematics",
  "verb-personal-endings"
];

const PRONOUN_LABELS: Record<string, string> = {
  "": "",
  ego: "ego",
  tu: "tū",
  sui: "suī",
  qui: "quī quae quod",
  is: "is ea id",
  hic: "hic haec hoc",
  ille: "ille illa illud",
  iste: "iste ista istud",
  ipse: "ipse ipsa ipsum",
  idem: "īdem eadem idem",
  aliquis: "aliquis aliquid",
  quisque: "quisque quidque"
};

export default function App() {
  const [project, setProject] = useState<Project>(() => loadProject(DEFAULT_PROJECT));
  const [selectedEntryId, setSelectedEntryId] = useState(project.entries[0]?.id || "");
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(true);
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => saveProject(project), [project]);

  const selectedTemplate = project.templates.find((template) => template.id === project.selectedTemplateId) || project.templates[0];
  const rendered = useMemo(() => buildTemplateCharts(project, selectedTemplate), [project, selectedTemplate]);
  const selectedEntry = project.entries.find((entry) => entry.id === selectedEntryId) || project.entries[0];
  const cssErrors = styleErrors(project.styleRules);
  const diagnostics = [...rendered.diagnostics, ...cssErrors.map((message) => ({ line: 0, message }))];
  const hasDiagnostics = diagnostics.length > 0;

  useEffect(() => {
    if (hasDiagnostics) setDiagnosticsOpen(true);
  }, [hasDiagnostics]);

  function updateProject(updater: (project: Project) => Project) {
    setProject((current) => updater(current));
  }

  function updateEntry(entry: MorphEntry) {
    updateProject((current) => ({
      ...current,
      entries: current.entries.map((candidate) => (candidate.id === entry.id ? entry : candidate))
    }));
  }

  function addEntry(pos: MorphEntry["pos"]) {
    const entry = createEntry(pos);
    updateProject((current) => ({ ...current, entries: [...current.entries, entry] }));
    setSelectedEntryId(entry.id);
  }

  function removeEntry(id: string) {
    updateProject((current) => ({ ...current, entries: current.entries.filter((entry) => entry.id !== id) }));
    setSelectedEntryId(project.entries.find((entry) => entry.id !== id)?.id || "");
  }

  function setCellOverride(cell: GeneratedCell) {
    const nextValue = window.prompt(
      `Override ${cell.entryLemma} ${Object.values(cell.slot).join(" ")}\nGenerated: ${cell.generatedText}\nLeave blank to remove the override.`,
      cell.override || cell.displayText
    );
    if (nextValue === null) return;

    updateProject((current) => ({
      ...current,
      entries: current.entries.map((entry) => {
        if (entry.id !== cell.entryId) return entry;
        const overrides = { ...entry.overrides };
        if (nextValue.trim()) overrides[cell.key] = nextValue.trim();
        else delete overrides[cell.key];
        return { ...entry, overrides } as MorphEntry;
      })
    }));
  }

  async function copyCharts() {
    const node = chartRef.current;
    if (!node) return;
    const text = node.innerText;
    const html = node.innerHTML;

    if ("ClipboardItem" in window) {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([text], { type: "text/plain" })
        })
      ]);
    } else {
      await navigator.clipboard.writeText(text);
    }
  }

  function downloadProject() {
    const blob = new Blob([exportProject(project)], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = "latin-chart-project.json";
    link.click();
    URL.revokeObjectURL(href);
  }

  async function handleImport(file: File | undefined) {
    if (!file) return;
    try {
      const next = importProject(await file.text());
      setProject(next);
      setSelectedEntryId(next.entries[0]?.id || "");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not import project JSON.");
    }
  }

  return (
    <main className="app-shell">
      <section className="toolbar">
        <div>
          <h1>Latin Chart Workbench</h1>
          <p>Generate declension and conjugation charts from supplied stems, principal parts, templates, and style rules.</p>
        </div>
        <div className="toolbar-actions">
          <button onClick={copyCharts}>Copy charts</button>
          <button onClick={() => window.print()}>Print</button>
          <button onClick={downloadProject}>Export JSON</button>
          <label className="file-button">
            Import JSON
            <input type="file" accept="application/json" onChange={(event) => handleImport(event.target.files?.[0])} />
          </label>
        </div>
      </section>

      <section className="workspace">
        <section className="top-workspace">
          <section className="panel entry-panel" aria-label="Saved entries">
          <div className="add-entry-area">
            <h2>Chart words</h2>
            <div className="entry-buttons">
              <button onClick={() => addEntry("noun")}>+ Noun</button>
              <button onClick={() => addEntry("adjective")}>+ Adjective</button>
              <button onClick={() => addEntry("pronoun")}>+ Pronoun</button>
              <button onClick={() => addEntry("verb")}>+ Verb</button>
            </div>
          </div>
          <div className="entry-list">
            {project.entries.map((entry) => (
              <div className={entry.id === selectedEntry?.id ? "entry-item is-selected" : "entry-item"} key={entry.id}>
                <button className="entry-select" onClick={() => setSelectedEntryId(entry.id)}>
                  <span>{entry.displayName || `(untitled ${entry.pos})`}</span>
                  <small>{entry.pos}</small>
                </button>
                <button
                  type="button"
                  className="icon-button danger"
                  aria-label={`Delete ${entry.displayName || entry.pos}`}
                  title="Delete"
                  onClick={() => removeEntry(entry.id)}
                >
                  🗑
                </button>
              </div>
            ))}
          </div>
          {selectedEntry ? (
            <EntryEditor entry={selectedEntry} defaultVisibility={project.visibility} onChange={updateEntry} />
          ) : null}
          </section>
          <TemplatePanel project={project} setProject={setProject} />
          <StylePanel project={project} setProject={setProject} />
        </section>

        <section className="charts-area">
          <section className="chart-preview" ref={chartRef} aria-label="Generated charts">
            {rendered.blocks.length === 0 ? (
              <div className="empty-state">Add saved-entry references like {"{vir}"} to render a chart.</div>
            ) : (
              rendered.blocks.map((block) => (
                <div className="chart-block" key={block.id}>
                  <h2>{block.heading}</h2>
                  {block.sections.map((section) => (
                    <ChartTable key={section.id} section={section} styleRules={project.styleRules} onCellOverride={setCellOverride} />
                  ))}
                </div>
              ))
            )}
          </section>
        </section>
      </section>

      {hasDiagnostics && diagnosticsOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Template and style diagnostics">
          <div className="diagnostic-modal">
            <h2>Fix before rendering cleanly</h2>
            <ul>
              {diagnostics.map((diagnostic, index) => (
                <li key={`${diagnostic.message}-${index}`}>
                  {diagnostic.line ? `Line ${diagnostic.line}: ` : ""}
                  {diagnostic.message}
                </li>
              ))}
            </ul>
            <button onClick={() => setDiagnosticsOpen(false)}>Review anyway</button>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function createEntry(pos: MorphEntry["pos"]): MorphEntry {
  const id = uid(pos);
  if (pos === "noun") {
    return {
      id,
      pos,
      lemma: "",
      displayName: "",
      declension: "1",
      gender: "f",
      nominative: "",
      genitive: "",
      stem: "",
      overrides: {}
    };
  }
  if (pos === "adjective") {
    return {
      id,
      pos,
      lemma: "",
      displayName: "",
      adjectiveClass: "1-2",
      pronominal: false,
      nominative: "",
      feminineForm: "",
      neuterForm: "",
      genitive: "",
      stem: "",
      comparativeStem: "",
      superlativeStem: "",
      degrees: ["positive"],
      overrides: {}
    };
  }
  if (pos === "pronoun") {
    return {
      id,
      pos,
      lemma: "",
      displayName: "",
      pronounType: "",
      overrides: {}
    };
  }
  const principalParts = { first: "", infinitive: "", perfect: "", supine: "" };
  return {
    id,
    pos,
    lemma: "",
    displayName: "",
    conjugation: "irregular",
    principalParts,
    presentStem: "",
    perfectStem: "",
    supineStem: "",
    overrides: {}
  };
}

function withAutoName<T extends MorphEntry>(entry: T, _oldSource: string, nextSource: string): T {
  return {
    ...entry,
    displayName: nextSource,
    lemma: nextSource
  };
}

function declensionLabel(declension: NounEntry["declension"]): string {
  const labels: Record<NounEntry["declension"], string> = {
    "1": "1st declension",
    "2": "2nd declension",
    "3": "3rd declension",
    "4": "4th declension",
    "5": "5th declension"
  };
  return labels[declension];
}

function deriveAoStem(masculine: string, feminine: string, neuter: string): string {
  const f = feminine.trim();
  const n = neuter.trim();
  const m = masculine.trim();
  if (f.endsWith("a")) return f.slice(0, -1);
  if (n.endsWith("um")) return n.slice(0, -2);
  if (m.endsWith("us")) return m.slice(0, -2);
  return m;
}

function adjectiveClassLabel(adjectiveClass: Extract<MorphEntry, { pos: "adjective" }>["adjectiveClass"]): string {
  return adjectiveClass === "1-2" ? "A/O adjective" : "C/I adjective";
}

function conjugationLabel(entry: Extract<MorphEntry, { pos: "verb" }>): string {
  if (!entry.principalParts.first && !entry.principalParts.infinitive) return "conj. ?";
  if (entry.irregularKey) return entry.irregularKey;

  const first = entry.principalParts.first.trim();
  const second = entry.principalParts.infinitive.trim();
  if ((first.endsWith("ō") || first.endsWith("o")) && (second.endsWith("āre") || second.endsWith("are"))) return "Ā conjugation";
  if (first.endsWith("eō") && second.endsWith("ēre")) return "Ē conjugation";
  if ((first.endsWith("iō") || first.endsWith("io")) && second.endsWith("ere")) return "E/I conjugation";
  if ((first.endsWith("ō") || first.endsWith("o")) && second.endsWith("ere")) return "Ĕ conjugation";
  if ((first.endsWith("iō") || first.endsWith("io")) && (second.endsWith("īre") || second.endsWith("ire"))) return "Ī conjugation";

  return `${entry.conjugation} conjugation`;
}

function EntryEditor({
  entry,
  defaultVisibility,
  onChange
}: {
  entry: MorphEntry;
  defaultVisibility: Project["visibility"];
  onChange: (entry: MorphEntry) => void;
}) {
  return (
    <form className="entry-editor" onSubmit={(event) => event.preventDefault()}>
      <h3>Edit {entry.pos}</h3>
      <div className="derived-name-line">
        <span>Chart label</span>
        <strong>{entry.displayName || "derived automatically"}</strong>
      </div>
      {entry.pos === "noun" ? <NounFields entry={entry} onChange={onChange} /> : null}
      {entry.pos === "adjective" ? <AdjectiveFields entry={entry} onChange={onChange} /> : null}
      {entry.pos === "pronoun" ? <PronounFields entry={entry} onChange={onChange} /> : null}
      {entry.pos === "verb" ? <VerbFields entry={entry} onChange={onChange} /> : null}
      <EntryVisibilityControls entry={entry} defaultVisibility={defaultVisibility} onChange={onChange} />
      <div className="danger-row">
        <span>{Object.keys(entry.overrides).length} overrides</span>
        <button type="button" onClick={() => onChange({ ...entry, overrides: {} } as MorphEntry)}>
          Clear overrides
        </button>
      </div>
    </form>
  );
}

function NounFields({ entry, onChange }: { entry: Extract<MorphEntry, { pos: "noun" }>; onChange: (entry: MorphEntry) => void }) {
  function updateNominative(nominative: string) {
    onChange({ ...withAutoName(entry, entry.nominative, nominative), nominative });
  }

  function updateGenitive(genitive: string) {
    onChange({ ...entry, genitive, declension: deriveNounDeclension(genitive) });
  }

  return (
    <>
      <div className="three-field-line">
        <label>
          nom.sg.
          <input value={entry.nominative} onChange={(event) => updateNominative(event.target.value)} />
        </label>
        <label>
          gen.sg. {entry.genitive ? `(${declensionLabel(entry.declension)})` : ""}
          <input value={entry.genitive} onChange={(event) => updateGenitive(event.target.value)} />
        </label>
        <label>
          Gender
          <select value={entry.gender} onChange={(event) => onChange({ ...entry, gender: event.target.value as NounEntry["gender"] })}>
            <option value="m">m.</option>
            <option value="f">f.</option>
            <option value="n">n.</option>
          </select>
        </label>
      </div>
      <div className="noun-stem-line">
        <button type="button" onClick={() => onChange({ ...entry, stem: deriveNounStem(entry.declension, entry.genitive) })}>
          Derive stems
        </button>
        <label>
          stem
          <input value={entry.stem} onChange={(event) => onChange({ ...entry, stem: event.target.value })} />
        </label>
        <label className="checkbox-row">
          <input type="checkbox" checked={Boolean(entry.iStem)} onChange={(event) => onChange({ ...entry, iStem: event.target.checked })} />
          i-stem
        </label>
      </div>
      <p className="hint">Start with the genitive singular; add the nominative singular where the stem or nominative form is not predictable.</p>
    </>
  );
}

function AdjectiveFields({ entry, onChange }: { entry: Extract<MorphEntry, { pos: "adjective" }>; onChange: (entry: MorphEntry) => void }) {
  function toggleDegree(degree: "positive" | "comparative" | "superlative", checked: boolean) {
    const next: Array<"positive" | "comparative" | "superlative"> = checked
      ? Array.from(new Set([...entry.degrees, degree]))
      : entry.degrees.filter((candidate) => candidate !== degree);
    const nextEntry: Extract<MorphEntry, { pos: "adjective" }> = {
      ...entry,
      degrees: next.length ? next : ["positive"]
    };
    if (checked && degree === "comparative" && !nextEntry.comparativeStem) nextEntry.comparativeStem = `${nextEntry.stem}ior`;
    if (checked && degree === "superlative" && !nextEntry.superlativeStem) nextEntry.superlativeStem = `${nextEntry.stem}issim`;
    onChange(nextEntry);
  }

  function updateNominative(nominative: string) {
    onChange({ ...withAutoName(entry, entry.nominative || "", nominative), nominative });
  }

  function updateGenitive(genitive: string) {
    onChange({
      ...entry,
      genitive,
      stem: deriveAdjectiveStem(genitive || "")
    });
  }

  return (
    <>
      <label>
        adjective type
        <select
          value={entry.adjectiveClass}
          onChange={(event) =>
            onChange({
              ...entry,
              adjectiveClass: event.target.value as "1-2" | "3",
              ...(event.target.value === "3" ? { pronominal: false } : {})
            })
          }
        >
          <option value="1-2">A/O adjective</option>
          <option value="3">C/I adjective</option>
        </select>
      </label>
      {entry.adjectiveClass === "1-2" ? (
        <label className="checkbox-row">
          <input type="checkbox" checked={Boolean(entry.pronominal)} onChange={(event) => onChange({ ...entry, pronominal: event.target.checked })} />
          pronominal decl.
        </label>
      ) : null}
      <div className={entry.adjectiveClass === "1-2" ? "three-field-line" : "four-field-line"}>
        <label>
          M
          <input value={entry.nominative || ""} onChange={(event) => updateNominative(event.target.value)} />
        </label>
        <label>
          F
          <input value={entry.feminineForm || ""} onChange={(event) => onChange({ ...entry, feminineForm: event.target.value })} />
        </label>
        <label>
          N
          <input value={entry.neuterForm || ""} onChange={(event) => onChange({ ...entry, neuterForm: event.target.value })} />
        </label>
        {entry.adjectiveClass === "3" ? (
          <label>
            gen.sg.
            <input value={entry.genitive || ""} onChange={(event) => updateGenitive(event.target.value)} />
          </label>
        ) : null}
      </div>
      <div className="derive-line adjective-derive-line">
        <span className="derived-chip">{adjectiveClassLabel(entry.adjectiveClass)}</span>
        <label>
          positive stem
          <input value={entry.stem} onChange={(event) => onChange({ ...entry, stem: event.target.value })} />
        </label>
        <button
          type="button"
          onClick={() =>
            onChange({
              ...entry,
              stem:
                entry.adjectiveClass === "3"
                  ? deriveAdjectiveStem(entry.genitive || "")
                  : deriveAoStem(entry.nominative || "", entry.feminineForm || "", entry.neuterForm || "")
            })
          }
        >
          Derive stems
        </button>
      </div>
      <div className="two-field-line">
        <label>
          comparative stem
          <input value={entry.comparativeStem || ""} onChange={(event) => onChange({ ...entry, comparativeStem: event.target.value })} />
        </label>
        <label>
          superlative stem
          <input value={entry.superlativeStem || ""} onChange={(event) => onChange({ ...entry, superlativeStem: event.target.value })} />
        </label>
      </div>
      <div className="inline-checks">
        {(["positive", "comparative", "superlative"] as const).map((degree) => (
          <label className="checkbox-row" key={degree}>
            <input type="checkbox" checked={entry.degrees.includes(degree)} onChange={(event) => toggleDegree(degree, event.target.checked)} />
            {degree}
          </label>
        ))}
      </div>
    </>
  );
}

function PronounFields({ entry, onChange }: { entry: Extract<MorphEntry, { pos: "pronoun" }>; onChange: (entry: MorphEntry) => void }) {
  function updateParadigm(pronounType: typeof entry.pronounType) {
    const label = PRONOUN_LABELS[pronounType] || "";
    onChange({ ...withAutoName(entry, PRONOUN_LABELS[entry.pronounType] || "", label), pronounType });
  }

  return (
    <div className="two-field-line pronoun-line">
      <label>
        paradigm
        <select value={entry.pronounType} onChange={(event) => updateParadigm(event.target.value as typeof entry.pronounType)}>
          <option value="">choose...</option>
          {["ego", "tu", "sui", "qui", "is", "hic", "ille", "iste", "ipse", "idem", "aliquis", "quisque"].map((type) => (
          <option key={type} value={type}>
            {PRONOUN_LABELS[type]}
          </option>
        ))}
        </select>
      </label>
      <span className="derived-chip">{entry.pronounType ? "named paradigm" : "paradigm ?"}</span>
    </div>
  );
}

function VerbFields({ entry, onChange }: { entry: Extract<MorphEntry, { pos: "verb" }>; onChange: (entry: MorphEntry) => void }) {
  function updateParts(part: keyof VerbEntry["principalParts"], value: string) {
    const principalParts = { ...entry.principalParts, [part]: value };
    const irregularKey = detectIrregularVerb(principalParts.first, principalParts.infinitive);
    const conjugation = irregularKey ? "irregular" : deriveVerbConjugation(principalParts.infinitive, principalParts.first);
    const namedEntry = part === "first" ? withAutoName(entry, entry.principalParts.first, value) : entry;
    onChange({ ...namedEntry, principalParts, conjugation, irregularKey });
  }

  function rederive() {
    const irregularKey = detectIrregularVerb(entry.principalParts.first, entry.principalParts.infinitive);
    const conjugation = irregularKey ? "irregular" : deriveVerbConjugation(entry.principalParts.infinitive, entry.principalParts.first);
    onChange({ ...entry, conjugation, irregularKey, ...deriveVerbStems(conjugation, entry.principalParts) });
  }

  return (
    <>
      <div className="principal-parts-line">
        {(["first", "infinitive", "perfect", "supine"] as const).map((part, index) => (
          <label key={part}>
            {index + 1}
            <input value={entry.principalParts[part]} onChange={(event) => updateParts(part, event.target.value)} />
          </label>
        ))}
      </div>
      <div className="derive-line verb-derive-line">
        <span className="derived-chip">
          {conjugationLabel(entry)}
        </span>
        <button type="button" onClick={rederive}>
          Derive stems
        </button>
        <label>
          pres. act. sys.
          <input value={entry.presentStem} onChange={(event) => onChange({ ...entry, presentStem: event.target.value })} />
        </label>
        <label>
          pf. act. sys.
          <input value={entry.perfectStem} onChange={(event) => onChange({ ...entry, perfectStem: event.target.value })} />
        </label>
        <label>
          t-stem
          <input value={entry.supineStem} onChange={(event) => onChange({ ...entry, supineStem: event.target.value })} />
        </label>
        <label className="checkbox-row">
          <input type="checkbox" checked={Boolean(entry.deponent)} onChange={(event) => onChange({ ...entry, deponent: event.target.checked })} />
          deponent
        </label>
      </div>
    </>
  );
}

function EntryVisibilityControls({
  entry,
  defaultVisibility,
  onChange
}: {
  entry: MorphEntry;
  defaultVisibility: Project["visibility"];
  onChange: (entry: MorphEntry) => void;
}) {
  const visibility = { ...defaultVisibility, ...entry.visibility, cases: entry.visibility?.cases || defaultVisibility.cases };

  function updateVisibility(nextVisibility: Partial<Project["visibility"]>) {
    onChange({ ...entry, visibility: { ...entry.visibility, ...nextVisibility } } as MorphEntry);
  }

  function toggleCase(latinCase: LatinCase, checked: boolean) {
    const nextCases = new Set(visibility.cases.length ? visibility.cases : DEFAULT_CASES);
    if (checked) nextCases.add(latinCase);
    else nextCases.delete(latinCase);
    updateVisibility({
      cases: CASE_ORDER.filter((candidate) => nextCases.has(candidate)),
      showLocative: latinCase === "loc" ? checked : visibility.showLocative
    });
  }

  if (entry.pos === "verb") {
    return (
      <fieldset className="visibility-box">
        <legend>Include</legend>
        <div className="check-grid">
          {[
            ["showIndicativeActive", "indic. act."],
            ["showIndicativePassive", "indic. pass."],
            ["showSubjunctiveActive", "subj. act."],
            ["showSubjunctivePassive", "subj. pass."],
            ["showInfinitives", "infinitives"],
            ["showParticiples", "participles"],
            ["showImperatives", "imperatives"]
          ].map(([key, label]) => (
            <label className="checkbox-row" key={key}>
              <input
                type="checkbox"
                checked={Boolean(visibility[key as keyof typeof visibility])}
                onChange={(event) => updateVisibility({ [key]: event.target.checked })}
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  return (
    <fieldset className="visibility-box">
      <legend>Include</legend>
      <div className="inline-checks case-checks">
        {CASE_ORDER.map((latinCase) => (
          <label className="checkbox-row" key={latinCase}>
            <input
              type="checkbox"
              checked={visibility.cases.includes(latinCase) && (latinCase !== "loc" || visibility.showLocative)}
              onChange={(event) => toggleCase(latinCase, event.target.checked)}
            />
            {CASE_LABELS[latinCase]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function CollapsiblePanel({
  title,
  actions,
  className = "",
  children
}: {
  title: string;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);

  return (
    <section className={`panel collapsible-panel ${className} ${open ? "is-open" : "is-collapsed"}`}>
      <div className="panel-header">
        <button className="collapse-toggle" type="button" onClick={() => setOpen((current) => !current)} aria-expanded={open}>
          <span aria-hidden="true">{open ? "▾" : "▸"}</span>
          {title}
        </button>
        {actions}
      </div>
      {open ? <div className="collapsible-body">{children}</div> : null}
    </section>
  );
}

function TemplatePanel({ project, setProject }: { project: Project; setProject: (project: Project) => void }) {
  const template = project.templates.find((candidate) => candidate.id === project.selectedTemplateId) || project.templates[0];

  function updateTemplate(source: string) {
    setProject({
      ...project,
      templates: project.templates.map((candidate) => (candidate.id === template.id ? { ...candidate, source } : candidate))
    });
  }

  return (
    <CollapsiblePanel
      title="Template"
      className="template-panel"
      actions={
        <button
          onClick={() => {
            const next = { id: uid("template"), name: "New template", source: "# New chart\n{vir}" };
            setProject({ ...project, templates: [...project.templates, next], selectedTemplateId: next.id });
          }}
        >
          New
        </button>
      }
    >
      <select value={template.id} onChange={(event) => setProject({ ...project, selectedTemplateId: event.target.value })}>
        {project.templates.map((candidate) => (
          <option key={candidate.id} value={candidate.id}>
            {candidate.name}
          </option>
        ))}
      </select>
      <textarea value={template.source} onChange={(event) => updateTemplate(event.target.value)} spellCheck={false} />
      <p className="hint">Use headings, saved-entry references like {"{vir}"}, and directives such as @show locative or @hide participles.</p>
    </CollapsiblePanel>
  );
}

function StylePanel({ project, setProject }: { project: Project; setProject: (project: Project) => void }) {
  function updateRule(rule: StyleRule) {
    setProject({ ...project, styleRules: project.styleRules.map((candidate) => (candidate.id === rule.id ? rule : candidate)) });
  }

  function deleteRule(id: string) {
    setProject({ ...project, styleRules: project.styleRules.filter((rule) => rule.id !== id) });
  }

  return (
    <CollapsiblePanel
      title="Styles"
      className="style-panel"
      actions={
        <button
          onClick={() =>
            setProject({
              ...project,
              styleRules: [...project.styleRules, { id: uid("style"), name: "New style", target: "case-endings", cssText: "color: #b42318" }]
            })
          }
        >
          Add
        </button>
      }
    >
      {project.styleRules.map((rule) => {
        const validation = sanitizeCssText(rule.cssText);
        return (
          <div className="style-rule" key={rule.id}>
            <div className="style-rule-header">
              <label>
                Name
                <input value={rule.name} onChange={(event) => updateRule({ ...rule, name: event.target.value })} aria-label="Style name" />
              </label>
              <label>
                Target
                <select value={rule.target} onChange={(event) => updateRule({ ...rule, target: event.target.value as StyleRule["target"] })}>
                  {STYLE_TARGETS.map((target) => (
                    <option key={target} value={target}>
                      {target}
                    </option>
                  ))}
                </select>
              </label>
              <label className="checkbox-row style-enabled">
                <input
                  type="checkbox"
                  checked={rule.enabled !== false}
                  onChange={(event) => updateRule({ ...rule, enabled: event.target.checked })}
                />
                enabled
              </label>
              <button type="button" className="danger" onClick={() => deleteRule(rule.id)}>
                Delete
              </button>
            </div>
            <label>
              CSS declarations
              <textarea
                className="style-css"
                value={rule.cssText}
                onChange={(event) => updateRule({ ...rule, cssText: event.target.value })}
                aria-label="CSS declarations"
              />
            </label>
            <div className="style-preview-row">
              <span className="style-preview" style={cssTextToStyle(validation.cssText)}>
                Preview
              </span>
              {validation.errors.length ? (
                <small className="error-text">{validation.errors.join(" ")}</small>
              ) : (
                <small>{validation.cssText || "No declarations"}</small>
              )}
            </div>
          </div>
        );
      })}
    </CollapsiblePanel>
  );
}

function ChartTable({ section, styleRules, onCellOverride }: { section: ChartSection; styleRules: StyleRule[]; onCellOverride: (cell: GeneratedCell) => void }) {
  const labelStyle = cssTextToStyle(styleForRole("label", styleRules));
  const hasSubLabels = section.rows.some((row) => row.subLabel);
  const labelColumnCount = hasSubLabels ? 2 : 1;
  const columnGroups = buildColumnGroups(section.columns);
  const hideLowerHeaderRow =
    section.signature.startsWith("case-grid:noun:") &&
    section.columns.every((column) => column.label.trim() === "") &&
    section.columns.some((column) => Boolean(column.groupLabel));

  return (
    <table className={`latin-chart ${section.kind}`}>
      <caption>{section.title}</caption>
      <thead>
        {section.columns.some((column) => column.groupLabel) ? (
          <tr>
            <th className="grammar-label corner" style={labelStyle} colSpan={labelColumnCount}>
              {section.kind === "finite-verb" ? "tense" : ""}
            </th>
            {columnGroups.map((group) => (
              <th className="grammar-label group-label" style={labelStyle} key={group.key} colSpan={group.colSpan}>
                {group.label}
              </th>
            ))}
          </tr>
        ) : null}
        {!hideLowerHeaderRow ? (
          <tr>
            <th className="grammar-label corner" style={labelStyle}>
              {section.kind === "finite-verb" ? "tense" : section.kind === "forms-list" ? "form" : ""}
            </th>
            {hasSubLabels ? (
              <th className="grammar-label corner" style={labelStyle}>
                {section.kind === "finite-verb" ? "person" : "number"}
              </th>
            ) : null}
            {section.columns.map((column, columnIndex) => (
              <th
                className={["grammar-label", columnDividerClass(section, columnIndex)].filter(Boolean).join(" ")}
                style={labelStyle}
                key={column.key}
              >
                {column.label}
              </th>
            ))}
          </tr>
        ) : null}
      </thead>
      <tbody>
        {section.rows.map((row, rowIndex) => (
          <tr className={rowDividerClass(section, row, rowIndex)} key={row.key}>
            {section.kind !== "finite-verb" || row.labelRowSpan ? (
              <th className="grammar-label row-label" style={labelStyle} rowSpan={row.labelRowSpan}>
                {row.label}
              </th>
            ) : null}
            {hasSubLabels ? (
              <th className="grammar-label row-label sub-label" style={labelStyle}>
                {row.subLabel}
              </th>
            ) : null}
            {buildRenderableCells(section, row).map(({ cell, startIndex, colSpan }) => (
              <td
                key={cell.key}
                className={[
                  cell.override ? "has-override" : "",
                  cellBackgroundClass(cell, section),
                  columnDividerClass(section, startIndex)
                ]
                  .filter(Boolean)
                  .join(" ")}
                colSpan={colSpan}
                onClick={() => onCellOverride(cell)}
                title={cell.override ? `Generated: ${cell.generatedText}` : "Click to override"}
              >
                {cell.override ? (
                  cell.displayText
                ) : (
                  cell.segments.map((segment, index) => (
                    <span
                      key={`${segment.role}-${index}-${segment.text}`}
                      className={["segment", `segment-${segment.role}`, segment.tone ? `segment-tone-${segment.tone}` : ""].filter(Boolean).join(" ")}
                      style={cssTextToStyle(styleForSegment(segment.role, section.kind, styleRules))}
                      title={segment.label}
                    >
                      {segment.text}
                    </span>
                  ))
                )}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function buildRenderableCells(
  section: ChartSection,
  row: ChartSection["rows"][number]
): Array<{ cell: GeneratedCell; startIndex: number; colSpan: number }> {
  if (!section.signature.startsWith("adjective:")) {
    return row.cells.map((cell, index) => ({ cell, startIndex: index, colSpan: 1 }));
  }

  const rendered: Array<{ cell: GeneratedCell; startIndex: number; colSpan: number }> = [];
  let index = 0;

  while (index < row.cells.length) {
    const cell = row.cells[index];
    const group = section.columns[index]?.groupLabel || "__single__";
    let colSpan = 1;

    while (
      index + colSpan < row.cells.length &&
      (section.columns[index + colSpan]?.groupLabel || "__single__") === group &&
      row.cells[index + colSpan].displayText === cell.displayText
    ) {
      colSpan += 1;
    }

    rendered.push({ cell, startIndex: index, colSpan });
    index += colSpan;
  }

  return rendered;
}

function columnDividerClass(section: ChartSection, columnIndex: number): string {
  if (section.kind === "finite-verb" && columnIndex > 0) return "major-left-divider";
  return "";
}

function rowDividerClass(section: ChartSection, row: ChartSection["rows"][number], rowIndex: number): string {
  if (section.kind === "finite-verb") {
    return row.labelRowSpan && rowIndex > 0 ? "major-top-divider" : "";
  }

  if (section.kind === "case-grid" && row.label.endsWith("pl.") && rowIndex > 0) {
    const previous = section.rows[rowIndex - 1];
    if (previous && previous.label.endsWith("sg.")) return "major-top-divider";
  }

  return "";
}

function cellBackgroundClass(cell: GeneratedCell, section: ChartSection): string {
  if (section.kind === "finite-verb") {
    if (cell.generatedText === "—") return "";
    if (cell.slot.voice === "active" && ["pf", "plupf", "futpf"].includes(cell.slot.tense || "")) return "cell-stem-secondary";
    if (cell.slot.voice === "passive" && ["pf", "plupf", "futpf"].includes(cell.slot.tense || "")) return "cell-stem-tertiary";
  }

  if (section.kind === "forms-list") {
    if (cell.slot.label === "perfect active") return "cell-stem-secondary";
    if (["perfect passive", "future active"].includes(cell.slot.label || "")) return "cell-stem-tertiary";
  }

  return "";
}

function buildColumnGroups(columns: ChartSection["columns"]): Array<{ key: string; label: string; colSpan: number }> {
  const groups: Array<{ key: string; label: string; colSpan: number }> = [];
  for (const column of columns) {
    const label = column.groupLabel || "";
    const last = groups.at(-1);
    if (last && last.label === label) last.colSpan += 1;
    else groups.push({ key: `${label}-${groups.length}`, label, colSpan: 1 });
  }
  return groups;
}

function styleForSegment(role: SegmentRole, kind: ChartSection["kind"], rules: StyleRule[]): string | undefined {
  if (role === "ending" && kind === "case-grid") return styleForRole(role, rules);
  if (["stem", "tenseMood", "thematic", "personal"].includes(role) && kind !== "case-grid") return styleForRole(role, rules);
  return undefined;
}

function cssTextToStyle(cssText: string | undefined): React.CSSProperties | undefined {
  if (!cssText) return undefined;
  return Object.fromEntries(
    cssText
      .split(";")
      .map((declaration) => declaration.trim())
      .filter(Boolean)
      .map((declaration) => {
        const [property, ...valueParts] = declaration.split(":");
        const camelCase = property.trim().replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
        return [camelCase, valueParts.join(":").trim()];
      })
  ) as React.CSSProperties;
}
