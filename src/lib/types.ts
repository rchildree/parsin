export type PartOfSpeech = "noun" | "adjective" | "pronoun" | "verb";
export type LatinCase = "nom" | "gen" | "dat" | "acc" | "abl" | "voc" | "loc";
export type LatinNumber = "sg" | "pl";
export type Gender = "m" | "f" | "n";
export type Person = "1" | "2" | "3";
export type VerbTense = "pres" | "impf" | "fut" | "pf" | "plupf" | "futpf";
export type VerbMood = "indicative" | "subjunctive";
export type VerbVoice = "active" | "passive";
export type SegmentRole = "stem" | "ending" | "tenseMood" | "thematic" | "personal" | "auxiliary" | "label" | "form";

export interface TextSegment {
  text: string;
  role: SegmentRole;
  label: string;
  tone?: "secondary" | "tertiary";
}

export interface GeneratedCell {
  key: string;
  entryId: string;
  entryLemma: string;
  slot: Record<string, string>;
  segments: TextSegment[];
  generatedText: string;
  displayText: string;
}

export interface ChartColumn {
  key: string;
  label: string;
  groupLabel?: string;
  entryId?: string;
  entryLemma?: string;
}

export interface ChartRow {
  key: string;
  label: string;
  subLabel?: string;
  labelRowSpan?: number;
  cells: GeneratedCell[];
}

export interface ChartSection {
  id: string;
  title: string;
  kind: "case-grid" | "finite-verb" | "forms-list";
  signature: string;
  columns: ChartColumn[];
  rows: ChartRow[];
}

export interface VisibilitySettings {
  cases: LatinCase[];
  showLocative: boolean;
  showInfinitives: boolean;
  showParticiples: boolean;
  showImperatives: boolean;
  showIndicativeActive: boolean;
  showIndicativePassive: boolean;
  showSubjunctiveActive: boolean;
  showSubjunctivePassive: boolean;
}

export interface BaseEntry {
  id: string;
  lemma: string;
  displayName: string;
  pos: PartOfSpeech;
  visibility?: Partial<VisibilitySettings>;
}

export interface NounEntry extends BaseEntry {
  pos: "noun";
  declension: "1" | "2" | "3" | "4" | "5";
  gender: Gender;
  nominative: string;
  genitive: string;
  stem: string;
  iStem?: boolean;
}

export interface AdjectiveEntry extends BaseEntry {
  pos: "adjective";
  adjectiveClass: "" | "1-2" | "3";
  pronominal?: boolean;
  nominative?: string;
  feminineForm?: string;
  neuterForm?: string;
  genitive?: string;
  stem: string;
  neuterStem?: string;
  comparativeStem?: string;
  superlativeStem?: string;
  degrees: Array<"positive" | "comparative" | "superlative">;
}

export type PronounType =
  | ""
  | "ego"
  | "tu"
  | "sui"
  | "qui"
  | "is"
  | "hic"
  | "ille"
  | "iste"
  | "ipse"
  | "idem"
  | "aliquis"
  | "quisque";

export interface PronounEntry extends BaseEntry {
  pos: "pronoun";
  pronounType: PronounType;
}

export interface VerbEntry extends BaseEntry {
  pos: "verb";
  conjugation: "1" | "2" | "3" | "3io" | "4" | "irregular";
  principalParts: {
    first: string;
    infinitive: string;
    perfect: string;
    supine: string;
  };
  presentStem: string;
  perfectStem: string;
  supineStem: string;
  deponent?: boolean;
  irregularKey?: "sum" | "possum" | "eo" | "fero" | "volo" | "nolo" | "malo";
}

export type MorphEntry = NounEntry | AdjectiveEntry | PronounEntry | VerbEntry;

export interface StyleRule {
  id: string;
  name: string;
  target:
    | "labels"
    | "case-endings"
    | "noun-stems"
    | "verb-stems"
    | "verb-tense-markers"
    | "verb-thematics"
    | "verb-personal-endings"
    | "verb-present-stem"
    | "verb-perfect-stem"
    | "verb-supine-stem";
  cssText: string;
  enabled?: boolean;
}

export interface TemplateDocument {
  id: string;
  name: string;
  source: string;
}

export interface Project {
  entries: MorphEntry[];
  templates: TemplateDocument[];
  styleRules: StyleRule[];
  visibility: VisibilitySettings;
  selectedTemplateId: string;
}

export interface Diagnostic {
  line: number;
  message: string;
}

export interface TemplateBlock {
  id: string;
  heading: string;
  references: string[];
  visibilityOverrides: Partial<VisibilitySettings>;
  caseOverrides?: Partial<Record<LatinCase, boolean>>;
}

export interface RenderedTemplate {
  diagnostics: Diagnostic[];
  blocks: TemplateBlock[];
}
