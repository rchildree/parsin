import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DEFAULT_CASES, CASE_LABELS, CASE_ORDER } from "./lib/labels";
import {
  displayVerbPresentSystemStem,
  deriveAdjectiveStem,
  inferDeponentVerb,
  deriveNounDeclension,
  deriveNounStem,
  deriveVerbConjugation,
  deriveVerbStems,
  detectIrregularVerb
} from "./lib/morphology";
import { DEFAULT_PROJECT } from "./lib/sampleData";
import { exportProject, importProject, loadProject, saveProject } from "./lib/storage";
import { styleErrors, styleForTarget } from "./lib/styleRules";
import { buildTemplateCharts } from "./lib/templates";
import type { ChartSection, GeneratedCell, LatinCase, MorphEntry, NounEntry, Project, PronounType, SegmentRole, StyleRule, VerbEntry } from "./lib/types";
import { uid } from "./lib/utils";

const STYLE_TARGET_GROUPS: Array<{ label: string; targets: StyleRule["target"][] }> = [
  { label: "All charts", targets: ["labels"] },
  { label: "Noun & adjective", targets: ["noun-stems", "case-endings"] },
  { label: "Verb", targets: ["verb-present-stem", "verb-perfect-stem", "verb-supine-stem", "verb-tense-markers", "verb-personal-endings"] }
];

const STYLE_TARGET_LABELS: Record<string, string> = {
  "labels": "Labels",
  "case-endings": "Case endings",
  "noun-stems": "Noun stems",
  "verb-stems": "Verb stems",
  "verb-tense-markers": "Tense/mood markers",
  "verb-thematics": "Thematic vowels",
  "verb-personal-endings": "Personal endings",
  "verb-present-stem": "Present system stem",
  "verb-perfect-stem": "Perfect active stem",
  "verb-supine-stem": "Perfect passive stem"
};

const PRONOUN_LABELS: Record<PronounType, string> = {
  "": "",
  ego: "ego",
  nos: "nōs",
  tu: "tū",
  vos: "vōs",
  sui: "suī",
  qui: "quī quae quod",
  quis: "quis quid",
  quisquis: "quisquis quidquid",
  quidam: "quīdam quaedam quoddam",
  is: "is ea id",
  hic: "hic haec hoc",
  ille: "ille illa illud",
  iste: "iste ista istud",
  ipse: "ipse ipsa ipsum",
  idem: "īdem eadem idem",
  uterque: "uterque utraque utrumque",
  aliquis: "aliquis aliquid",
  quisque: "quisque quidque"
};

const PRONOUN_OPTIONS: Exclude<PronounType, "">[] = [
  "ego",
  "nos",
  "tu",
  "vos",
  "sui",
  "qui",
  "quis",
  "quisquis",
  "quidam",
  "is",
  "hic",
  "ille",
  "iste",
  "ipse",
  "idem",
  "uterque",
  "aliquis",
  "quisque"
];

export default function App() {
  const [project, setProject] = useState<Project>(() => loadProject(DEFAULT_PROJECT));
  const [editorMode, setEditorMode] = useState<"add" | "edit" | null>(null);
  const [draftEntry, setDraftEntry] = useState<MorphEntry | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(true);
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => saveProject(project), [project]);

  const rendered = useMemo(() => buildTemplateCharts(project, project.template), [project]);
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

  function removeEntry(id: string) {
    updateProject((current) => ({ ...current, entries: current.entries.filter((entry) => entry.id !== id) }));
    if (editingEntryId === id) cancelEditor();
  }

  function openAddEditor(pos: MorphEntry["pos"]) {
    setDraftEntry(createEntry(pos));
    setEditorMode("add");
    setEditingEntryId(null);
  }

  function openEditEditor(id: string) {
    setEditingEntryId(id);
    setEditorMode("edit");
    setDraftEntry(null);
  }

  function commitDraft() {
    if (draftEntry) updateProject((current) => ({ ...current, entries: [...current.entries, draftEntry] }));
    setDraftEntry(null);
    setEditorMode(null);
  }

  function cancelEditor() {
    setDraftEntry(null);
    setEditorMode(null);
    setEditingEntryId(null);
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
      const next = importProject(await file.text(), DEFAULT_PROJECT);
      setProject(next);
      cancelEditor();
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
        </div>
      </section>

      <section className="workspace">
        <section className="top-workspace">
          <section className="panel entry-panel" aria-label="Add words for charts">
            <h2>Add words for charts</h2>
            {(["noun", "adjective", "pronoun", "verb"] as const).map((pos) => {
              const POS_LABEL: Record<typeof pos, string> = { noun: "Nouns", adjective: "Adjectives", pronoun: "Pronouns", verb: "Verbs" };
              const typeEntries = project.entries
                .filter((e) => e.pos === pos)
                .slice()
                .sort((a, b) => (a.displayName || a.lemma).localeCompare(b.displayName || b.lemma));
              return (
                <fieldset className="word-group" key={pos}>
                  <legend className="word-group-legend">
                    {POS_LABEL[pos]}
                    <button
                      type="button"
                      className="add-word-button"
                      aria-label={`Add ${pos}`}
                      title={`Add ${pos}`}
                      onClick={() => openAddEditor(pos)}
                    >
                      +
                    </button>
                  </legend>
                  <div className="word-chips">
                    {typeEntries.map((entry) => (
                      <span
                        key={entry.id}
                        className={`word-chip${editingEntryId === entry.id ? " is-active" : ""}`}
                        onClick={() => openEditEditor(entry.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === "Enter" && openEditEditor(entry.id)}
                      >
                        {entry.displayName || `(untitled)`}
                        <button
                          type="button"
                          title={`Delete ${entry.displayName || entry.pos}`}
                          onClick={(e) => { e.stopPropagation(); removeEntry(entry.id); }}
                        >×</button>
                      </span>
                    ))}
                  </div>
                </fieldset>
              );
            })}
            {editorMode && (
              <div className="entry-editor-dock">
                {editorMode === "add" && draftEntry ? (
                  <EntryEditor
                    entry={draftEntry}
                    defaultVisibility={project.visibility}
                    onChange={setDraftEntry}
                    onSubmit={commitDraft}
                    footer={
                      <div className="editor-actions">
                        <button type="submit">Add {draftEntry.pos}</button>
                        <button type="button" onClick={cancelEditor}>Cancel</button>
                      </div>
                    }
                  />
                ) : editorMode === "edit" && editingEntryId ? (() => {
                  const entry = project.entries.find((e) => e.id === editingEntryId);
                  return entry ? (
                    <EntryEditor
                      entry={entry}
                      defaultVisibility={project.visibility}
                      onChange={updateEntry}
                      footer={
                        <div className="editor-actions">
                          <button type="button" onClick={cancelEditor}>Done</button>
                        </div>
                      }
                    />
                  ) : null;
                })() : null}
              </div>
            )}
          </section>
          <section className="right-stack">
            <TemplatePanel project={project} setProject={setProject} />
            <StylePanel project={project} setProject={setProject} />
          </section>
        </section>

        <section className="charts-area">
          <section className="chart-preview" ref={chartRef} aria-label="Generated charts">
            {rendered.rows.length === 0 ? (
              <div className="empty-state">Type {"{word}"} references in the Chart builder to render charts.</div>
            ) : (
              rendered.rows.map((row) => (
                <div className="chart-row-group" key={row.id}>
                  {row.heading ? <h2 className="chart-section-heading">{row.heading}</h2> : null}
                  <div className="chart-row">
                    {row.blocks.map((block) => (
                      <div className="chart-block" key={block.id}>
                        {block.sections.map((section) => (
                          <ChartTable key={section.id} section={section} styleRules={project.styleRules} />
                        ))}
                      </div>
                    ))}
                  </div>
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
      stem: ""
    };
  }
  if (pos === "adjective") {
    return {
      id,
      pos,
      lemma: "",
      displayName: "",
      adjectiveClass: "",
      pronominal: false,
      nominative: "",
      feminineForm: "",
      neuterForm: "",
      genitive: "",
      stem: "",
      comparativeStem: "",
      superlativeStem: "",
      degrees: ["positive"]
    };
  }
  if (pos === "pronoun") {
    return {
      id,
      pos,
      lemma: "",
      displayName: "",
      pronounType: ""
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
    supineStem: ""
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
    "1": "A decl.",
    "2": "O decl.",
    "3": "C/I decl.",
    "4": "U decl.",
    "5": "E decl."
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

function deriveAoStemIfPossible(masculine: string, feminine: string, neuter: string): string {
  const f = feminine.trim();
  const n = neuter.trim();
  const m = masculine.trim();
  if (f.endsWith("a")) return f.slice(0, -1);
  if (n.endsWith("um")) return n.slice(0, -2);
  if (m.endsWith("us")) return m.slice(0, -2);
  return "";
}

function adjectiveClassLabel(adjectiveClass: Extract<MorphEntry, { pos: "adjective" }>["adjectiveClass"]): string {
  if (adjectiveClass === "1-2") return "A/O adjective";
  if (adjectiveClass === "3") return "C/I adjective";
  return "needs more information";
}

function conjugationLabel(entry: Extract<MorphEntry, { pos: "verb" }>): string {
  if (!entry.principalParts.first && !entry.principalParts.infinitive) return "conj. ?";
  if (entry.irregularKey) return entry.irregularKey;

  const first = entry.principalParts.first.trim();
  const second = entry.principalParts.infinitive.trim();
  if ((first.endsWith("ō") || first.endsWith("o")) && (second.endsWith("āre") || second.endsWith("are"))) return "Ā conj.";
  if (first.endsWith("eō") && second.endsWith("ēre")) return "Ē conj.";
  if ((first.endsWith("iō") || first.endsWith("io")) && second.endsWith("ere")) return "E/I conj.";
  if ((first.endsWith("ō") || first.endsWith("o")) && second.endsWith("ere")) return "Ĕ conj.";
  if ((first.endsWith("iō") || first.endsWith("io")) && (second.endsWith("īre") || second.endsWith("ire"))) return "Ī conj.";

  return `${entry.conjugation} conj.`;
}

function adoptDerivedValue(currentValue: string, previousDerivedValue: string, nextDerivedValue: string): string {
  return !currentValue || currentValue === previousDerivedValue ? nextDerivedValue : currentValue;
}

function deriveAdjectiveStemIfPossible(entry: Pick<Extract<MorphEntry, { pos: "adjective" }>, "adjectiveClass" | "genitive" | "nominative" | "feminineForm" | "neuterForm">): string {
  if (!entry.adjectiveClass) return "";
  if (entry.adjectiveClass === "3") return entry.genitive?.trim() ? deriveAdjectiveStem(entry.genitive) : "";
  return deriveAoStemIfPossible(entry.nominative || "", entry.feminineForm || "", entry.neuterForm || "");
}

function syncAdjectiveStem(
  previous: Extract<MorphEntry, { pos: "adjective" }>,
  next: Extract<MorphEntry, { pos: "adjective" }>
): Extract<MorphEntry, { pos: "adjective" }> {
  const previousDerived = deriveAdjectiveStemIfPossible(previous);
  const nextDerived = deriveAdjectiveStemIfPossible(next);
  return {
    ...next,
    stem: adoptDerivedValue(previous.stem, previousDerived, nextDerived)
  };
}

function deriveVerbMeta(principalParts: VerbEntry["principalParts"]): Pick<VerbEntry, "conjugation" | "irregularKey"> {
  const irregularKey = detectIrregularVerb(principalParts.first, principalParts.infinitive);
  const conjugation = irregularKey ? "irregular" : deriveVerbConjugation(principalParts.infinitive, principalParts.first);
  return { conjugation, irregularKey };
}

function deriveVerbStemsIfPossible(
  conjugation: VerbEntry["conjugation"],
  principalParts: VerbEntry["principalParts"]
): Pick<VerbEntry, "presentStem" | "perfectStem" | "supineStem"> {
  const derived = deriveVerbStems(conjugation, principalParts);
  return {
    presentStem: principalParts.infinitive.trim() ? derived.presentStem : "",
    perfectStem: principalParts.perfect.trim() ? derived.perfectStem : "",
    supineStem: principalParts.supine.trim() ? derived.supineStem : ""
  };
}

function syncVerbStems(previous: Extract<MorphEntry, { pos: "verb" }>, next: Extract<MorphEntry, { pos: "verb" }>): Extract<MorphEntry, { pos: "verb" }> {
  const previousDerived = deriveVerbStemsIfPossible(previous.conjugation, previous.principalParts);
  const nextDerived = deriveVerbStemsIfPossible(next.conjugation, next.principalParts);
  const previousDeponent = inferDeponentVerb(previous.principalParts);
  const nextDeponent = inferDeponentVerb(next.principalParts);
  const visibility = { ...next.visibility };

  if (nextDeponent) {
    if (visibility.showIndicativeActive === undefined || visibility.showIndicativeActive === !previousDeponent) {
      visibility.showIndicativeActive = false;
    }
    if (visibility.showSubjunctiveActive === undefined || visibility.showSubjunctiveActive === !previousDeponent) {
      visibility.showSubjunctiveActive = false;
    }
  } else {
    if (visibility.showIndicativeActive === false && (previous.visibility?.showIndicativeActive === undefined || previous.visibility?.showIndicativeActive === false)) {
      delete visibility.showIndicativeActive;
    }
    if (visibility.showSubjunctiveActive === false && (previous.visibility?.showSubjunctiveActive === undefined || previous.visibility?.showSubjunctiveActive === false)) {
      delete visibility.showSubjunctiveActive;
    }
  }

  return {
    ...next,
    presentStem: adoptDerivedValue(previous.presentStem, previousDerived.presentStem, nextDerived.presentStem),
    perfectStem: adoptDerivedValue(previous.perfectStem, previousDerived.perfectStem, nextDerived.perfectStem),
    supineStem: adoptDerivedValue(previous.supineStem, previousDerived.supineStem, nextDerived.supineStem),
    deponent: nextDeponent,
    visibility
  };
}

function nounStemStatus(entry: Extract<MorphEntry, { pos: "noun" }>): string {
  return entry.genitive.trim() ? declensionLabel(entry.declension) : "needs more information";
}

function adjectiveStemStatus(entry: Extract<MorphEntry, { pos: "adjective" }>): string {
  return deriveAdjectiveStemIfPossible(entry) ? adjectiveClassLabel(entry.adjectiveClass) : "needs more information";
}

function verbStemStatus(entry: Extract<MorphEntry, { pos: "verb" }>): string {
  return entry.principalParts.first.trim() || entry.principalParts.infinitive.trim() ? conjugationLabel(entry) : "needs more information";
}

function pedagogicalVerbStem(entry: Extract<MorphEntry, { pos: "verb" }>): string {
  return displayVerbPresentSystemStem(entry);
}

function EntryEditor({
  entry,
  defaultVisibility,
  onChange,
  onSubmit,
  footer
}: {
  entry: MorphEntry;
  defaultVisibility: Project["visibility"];
  onChange: (entry: MorphEntry) => void;
  onSubmit?: () => void;
  footer?: ReactNode;
}) {
  return (
    <form
      className="entry-editor"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.();
      }}
    >
      <h3>Edit {entry.pos}</h3>
      <div className="derived-name-line">
        <span>Chart label</span>
        <strong>{entry.displayName || "—"}</strong>
      </div>
      {entry.pos === "noun" ? <NounFields entry={entry} onChange={onChange} /> : null}
      {entry.pos === "adjective" ? <AdjectiveFields entry={entry} onChange={onChange} /> : null}
      {entry.pos === "pronoun" ? <PronounFields entry={entry} onChange={onChange} /> : null}
      {entry.pos === "verb" ? <VerbFields entry={entry} onChange={onChange} /> : null}
      <EntryVisibilityControls entry={entry} defaultVisibility={defaultVisibility} onChange={onChange} />
      {footer}
    </form>
  );
}

function NounFields({ entry, onChange }: { entry: Extract<MorphEntry, { pos: "noun" }>; onChange: (entry: MorphEntry) => void }) {
  function updateNominative(nominative: string) {
    onChange({ ...withAutoName(entry, entry.nominative, nominative), nominative });
  }

  function updateGenitive(genitive: string) {
    const declension = deriveNounDeclension(genitive);
    const previousDerived = entry.genitive.trim() ? deriveNounStem(entry.declension, entry.genitive) : "";
    const nextDerived = genitive.trim() ? deriveNounStem(declension, genitive) : "";
    onChange({ ...entry, genitive, declension, stem: adoptDerivedValue(entry.stem, previousDerived, nextDerived) });
  }

  return (
    <>
      <div className="three-field-line">
        <label>
          nom.sg.
          <input value={entry.nominative} onChange={(event) => updateNominative(event.target.value)} />
        </label>
        <label>
          gen.sg.
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
        <label>
          stem ({nounStemStatus(entry)})
          <input value={entry.stem} onChange={(event) => onChange({ ...entry, stem: event.target.value })} />
        </label>
        <label className={`checkbox-row${entry.declension !== "3" ? " is-disabled" : ""}`}>
          <input
            type="checkbox"
            checked={Boolean(entry.iStem)}
            disabled={entry.declension !== "3"}
            onChange={(event) => onChange({ ...entry, iStem: event.target.checked })}
          />
          i-stem
        </label>
      </div>
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
    onChange(syncAdjectiveStem(entry, { ...withAutoName(entry, entry.nominative || "", nominative), nominative }));
  }

  function updateGenitive(genitive: string) {
    onChange(syncAdjectiveStem(entry, { ...entry, genitive }));
  }

  return (
    <>
      <label>
        adjective type
        <select
          value={entry.adjectiveClass}
          onChange={(event) =>
            onChange(
              syncAdjectiveStem(entry, {
                ...entry,
                adjectiveClass: event.target.value as "" | "1-2" | "3"
              })
            )
          }
        >
          <option value="">choose...</option>
          <option value="1-2">A/O adjective</option>
          <option value="3">C/I adjective</option>
        </select>
      </label>
      <div className={entry.adjectiveClass === "1-2" ? "three-field-line" : "four-field-line"}>
        <label>
          M
          <input disabled={!entry.adjectiveClass} value={entry.nominative || ""} onChange={(event) => updateNominative(event.target.value)} />
        </label>
        <label>
          F
          <input disabled={!entry.adjectiveClass} value={entry.feminineForm || ""} onChange={(event) => onChange(syncAdjectiveStem(entry, { ...entry, feminineForm: event.target.value }))} />
        </label>
        <label>
          N
          <input disabled={!entry.adjectiveClass} value={entry.neuterForm || ""} onChange={(event) => onChange(syncAdjectiveStem(entry, { ...entry, neuterForm: event.target.value }))} />
        </label>
        {entry.adjectiveClass === "3" ? (
          <label>
            gen.sg.
            <input value={entry.genitive || ""} onChange={(event) => updateGenitive(event.target.value)} />
          </label>
        ) : null}
      </div>
      <div className="derive-line adjective-derive-line">
        <label>
          positive stem ({adjectiveStemStatus(entry)})
          <input value={entry.stem} onChange={(event) => onChange({ ...entry, stem: event.target.value })} />
        </label>
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
          {PRONOUN_OPTIONS.map((type) => (
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
  const inferredDeponent = inferDeponentVerb({ ...entry.principalParts, perfect: "", supine: "" });

  function updateParts(part: keyof VerbEntry["principalParts"], value: string) {
    const principalParts = { ...entry.principalParts, [part]: value };
    const namedEntry = part === "first" ? withAutoName(entry, entry.principalParts.first, value) : entry;
    const nextEntry = { ...namedEntry, principalParts, ...deriveVerbMeta(principalParts) };
    onChange(syncVerbStems(entry, nextEntry));
  }

  return (
    <>
      <div className="principal-parts-line">
        {(["first", "infinitive", "perfect", "supine"] as const).map((part, index) => (
          <label key={part}>
            {index + 1}
            <input
              disabled={part === "perfect" && inferredDeponent}
              value={entry.principalParts[part]}
              onChange={(event) => updateParts(part, event.target.value)}
            />
          </label>
        ))}
      </div>
      <div className="derive-line verb-derive-line">
        <label>
          pres. sys. stem ({verbStemStatus(entry)})
          <input className="readonly-field" value={pedagogicalVerbStem(entry)} readOnly />
        </label>
        <label>
          pf. act. sys. stem
          <input value={entry.perfectStem} onChange={(event) => onChange({ ...entry, perfectStem: event.target.value })} />
        </label>
        <label>
          t-stem
          <input value={entry.supineStem} onChange={(event) => onChange({ ...entry, supineStem: event.target.value })} />
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
        <div className="verb-include-grid">
          {[
            [
              ["showIndicativeActive", "indic. act."],
              ["showIndicativePassive", "indic. pass."],
              ["showSubjunctiveActive", "subj. act."],
              ["showSubjunctivePassive", "subj. pass."]
            ],
            [
              ["showInfinitives", "infinitives"],
              ["showParticiples", "participles"],
              ["showImperatives", "imperatives"]
            ]
          ].map((row, rowIndex) => (
            <div className={`verb-include-row verb-include-row-${rowIndex + 1}`} key={`verb-include-row-${rowIndex + 1}`}>
              {row.map(([key, label]) => (
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

function TemplatePanel({
  project,
  setProject
}: {
  project: Project;
  setProject: (project: Project) => void;
}) {
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <CollapsiblePanel title="Chart builder" className="template-panel">
      <textarea
        className="template-source"
        value={project.template.source}
        rows={8}
        spellCheck={false}
        onChange={(e) => setProject({ ...project, template: { ...project.template, source: e.target.value } })}
      />
      <div className="template-help">
        <button type="button" className="template-help-toggle" onClick={() => setHelpOpen((v) => !v)}>
          {helpOpen ? "▾" : "▸"} How to build a chart template
        </button>
        {helpOpen && (
          <ul className="template-help-body">
            <li>Add words on the left for use in charts.</li>
            <li><code>{"{word}"}</code> renders a chart for that word. Match the spelling on the left.</li>
            <li>Words on the same line separated by a space appear <strong>side by side</strong> as separate charts.</li>
            <li>Words on the same line with <strong>no space</strong> between them (<code>{"{word1}{word2}"}</code>) are <strong>merged into one chart</strong> — works best when both words share the same type and visible forms.</li>
            <li>Start a line with <code>#</code> to add a heading above the next row of charts: <code># Second declension</code></li>
            <li>Blank lines are ignored.</li>
          </ul>
        )}
      </div>
    </CollapsiblePanel>
  );
}

function StylePanel({ project, setProject }: { project: Project; setProject: (project: Project) => void }) {
  function getRuleForTarget(target: StyleRule["target"]): StyleRule {
    return (
      project.styleRules.find((r) => r.target === target) ?? {
        id: `style-${target}`,
        name: STYLE_TARGET_LABELS[target] ?? target,
        target,
        cssText: "",
        enabled: true
      }
    );
  }

  function updateRule(rule: StyleRule) {
    const exists = project.styleRules.some((r) => r.target === rule.target);
    const nextRules = exists
      ? project.styleRules.map((r) => (r.target === rule.target ? rule : r))
      : [...project.styleRules, rule];
    setProject({ ...project, styleRules: nextRules });
  }

  function renderStyleRow(target: StyleRule["target"]) {
    const rule = getRuleForTarget(target);
    const parsed = parseStyleRule(rule.cssText);
    function updateCss(patch: Partial<ParsedStyle>) {
      updateRule({ ...rule, cssText: buildStyleCss({ ...parsed, ...patch }) });
    }
    return (
      <div className="style-row" key={target}>
        <span className="style-row-label">{STYLE_TARGET_LABELS[target]}</span>
        <div className="style-controls">
          <button
            type="button"
            className={`style-toggle bold-toggle${parsed.bold ? " is-active" : ""}`}
            onClick={() => updateCss({ bold: !parsed.bold })}
            title="Bold"
          >B</button>
          <button
            type="button"
            className={`style-toggle italic-toggle${parsed.italic ? " is-active" : ""}`}
            onClick={() => updateCss({ italic: !parsed.italic })}
            title="Italic"
          >I</button>
          <button
            type="button"
            className={`style-toggle small-caps-toggle${parsed.smallCaps ? " is-active" : ""}`}
            onClick={() => updateCss({ smallCaps: !parsed.smallCaps })}
            title="Small caps"
          >Sc</button>
          <div className="style-color-wrap">
            <label className="color-swatch" title={parsed.color ? `Text: ${parsed.color}` : "Click to set text color"}>
              <input
                type="color"
                value={parsed.color || "#b42318"}
                onChange={(event) => updateCss({ color: event.target.value })}
              />
              <span className={`color-dot${parsed.color ? " has-color" : ""}`} style={parsed.color ? { background: parsed.color } : undefined} />
            </label>
            <button
              type="button"
              className="color-clear"
              onClick={() => updateCss({ color: "" })}
              title="Remove text color"
              style={{ visibility: parsed.color ? "visible" : "hidden" }}
            >✕</button>
            <label className="color-swatch" title={parsed.background ? `Background: ${parsed.background}` : "Click to set background color"}>
              <input
                type="color"
                value={parsed.background || "#ffeb80"}
                onChange={(event) => updateCss({ background: event.target.value })}
              />
              <span className={`color-dot bg-dot${parsed.background ? " has-color" : ""}`} style={parsed.background ? { background: parsed.background } : undefined} />
            </label>
            <button
              type="button"
              className="color-clear"
              onClick={() => updateCss({ background: "" })}
              title="Remove background color"
              style={{ visibility: parsed.background ? "visible" : "hidden" }}
            >✕</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <CollapsiblePanel title="Styles" className="style-panel">
      <div className="style-list">
        {STYLE_TARGET_GROUPS.map((group) => (
          <div key={group.label}>
            <div className="style-group-label">{group.label}</div>
            {group.targets.map((target) => renderStyleRow(target))}
          </div>
        ))}
      </div>
    </CollapsiblePanel>
  );
}

function ChartTable({ section, styleRules }: { section: ChartSection; styleRules: StyleRule[] }) {
  const labelStyle = cssTextToStyle(styleForTarget("labels", styleRules));
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
            <th className="grammar-label corner" style={labelStyle} colSpan={labelColumnCount} />
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
                  cellBackgroundClass(cell, section),
                  columnDividerClass(section, startIndex)
                ]
                  .filter(Boolean)
                  .join(" ")}
                colSpan={colSpan}
                style={cellBackgroundStyle(cell, section, styleRules)}
              >
                {cell.segments.map((segment, index) => (
                  <span
                    key={`${segment.role}-${index}-${segment.text}`}
                    className={["segment", `segment-${segment.role}`, segment.tone ? `segment-tone-${segment.tone}` : ""].filter(Boolean).join(" ")}
                    style={cssTextToStyle(styleForSegment(segment.role, segment.tone, section.kind, styleRules))}
                    title={segment.label}
                  >
                    {segment.text}
                  </span>
                ))}
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

function styleForSegment(role: SegmentRole, tone: "secondary" | "tertiary" | undefined, kind: ChartSection["kind"], rules: StyleRule[]): string | undefined {
  if (role === "ending" && kind === "case-grid") return styleForTarget("case-endings", rules);
  if (role === "stem" && kind === "case-grid") return styleForTarget("noun-stems", rules);
  if (role === "stem" && kind !== "case-grid") {
    if (!tone) return styleForTarget("verb-present-stem", rules);
    if (tone === "secondary") return styleForTarget("verb-perfect-stem", rules);
    if (tone === "tertiary") return styleForTarget("verb-supine-stem", rules);
  }
  if (role === "tenseMood" && kind !== "case-grid") return styleForTarget("verb-tense-markers", rules);
  if (role === "personal" && kind !== "case-grid") return styleForTarget("verb-personal-endings", rules);
  return undefined;
}

function lightenHex(hex: string, amount = 0.88): string {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgb(${Math.round(r + (255 - r) * amount)},${Math.round(g + (255 - g) * amount)},${Math.round(b + (255 - b) * amount)})`;
}

function getRuleColor(target: StyleRule["target"], rules: StyleRule[]): string {
  const rule = rules.find((r) => r.target === target && r.enabled !== false);
  return rule ? parseStyleRule(rule.cssText).color : "";
}

function cellBackgroundStyle(cell: GeneratedCell, section: ChartSection, rules: StyleRule[]): React.CSSProperties | undefined {
  if (section.kind === "finite-verb" && cell.generatedText !== "—") {
    if (cell.slot.voice === "active" && ["pf", "plupf", "futpf"].includes(cell.slot.tense || "")) {
      const color = getRuleColor("verb-perfect-stem", rules);
      if (color) return { background: lightenHex(color) };
    }
    if (cell.slot.voice === "passive" && ["pf", "plupf", "futpf"].includes(cell.slot.tense || "")) {
      const color = getRuleColor("verb-supine-stem", rules);
      if (color) return { background: lightenHex(color) };
    }
  }
  if (section.kind === "forms-list") {
    if (cell.slot.label === "perfect active") {
      const color = getRuleColor("verb-perfect-stem", rules);
      if (color) return { background: lightenHex(color) };
    }
    if (["perfect passive", "future active"].includes(cell.slot.label || "")) {
      const color = getRuleColor("verb-supine-stem", rules);
      if (color) return { background: lightenHex(color) };
    }
  }
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

interface ParsedStyle {
  bold: boolean;
  italic: boolean;
  smallCaps: boolean;
  color: string;
  background: string;
}

function parseStyleRule(cssText: string): ParsedStyle {
  const decls: Record<string, string> = {};
  for (const raw of cssText.split(";")) {
    const decl = raw.trim();
    if (!decl) continue;
    const i = decl.indexOf(":");
    if (i === -1) continue;
    decls[decl.slice(0, i).trim().toLowerCase()] = decl.slice(i + 1).trim();
  }
  return {
    bold: decls["font-weight"] === "bold" || decls["font-weight"] === "700",
    italic: decls["font-style"] === "italic",
    smallCaps: !!decls["font-variant"]?.includes("small-caps"),
    color: decls["color"] || "",
    background: decls["background-color"] || decls["background"] || ""
  };
}

function buildStyleCss({ bold, italic, smallCaps, color, background }: ParsedStyle): string {
  const parts: string[] = [];
  parts.push(bold ? "font-weight: bold" : "font-weight: normal");
  parts.push(italic ? "font-style: italic" : "font-style: normal");
  if (smallCaps) parts.push("font-variant: small-caps");
  if (color) parts.push(`color: ${color}`);
  if (background) parts.push(`background-color: ${background}`);
  return parts.join("; ");
}
