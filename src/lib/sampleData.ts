import { DEFAULT_CASES } from "./labels";
import { deriveNounStem, deriveVerbStems } from "./morphology";
import type { MorphEntry, Project, StyleRule, TemplateDocument, VerbEntry } from "./types";

const makeVerb = (
  id: string,
  lemma: string,
  conjugation: VerbEntry["conjugation"],
  first: string,
  infinitive: string,
  perfect: string,
  supine: string,
  extra: Partial<VerbEntry> = {}
): VerbEntry => {
  const stems = deriveVerbStems(conjugation, { first, infinitive, perfect, supine });
  return {
    id,
    pos: "verb",
    lemma,
    displayName: lemma,
    conjugation,
    principalParts: { first, infinitive, perfect, supine },
    ...stems,
    ...extra
  };
};

const entries: MorphEntry[] = [
  {
    id: "noun-vir",
    pos: "noun",
    lemma: "vir",
    displayName: "vir",
    declension: "2",
    gender: "m",
    nominative: "vir",
    genitive: "virī",
    stem: deriveNounStem("2", "virī")
  },
  {
    id: "noun-servus",
    pos: "noun",
    lemma: "servus",
    displayName: "servus",
    declension: "2",
    gender: "m",
    nominative: "servus",
    genitive: "servī",
    stem: deriveNounStem("2", "servī")
  },
  {
    id: "noun-dominus",
    pos: "noun",
    lemma: "dominus",
    displayName: "dominus",
    declension: "2",
    gender: "m",
    nominative: "dominus",
    genitive: "dominī",
    stem: deriveNounStem("2", "dominī")
  },
  {
    id: "noun-donum",
    pos: "noun",
    lemma: "dōnum",
    displayName: "dōnum",
    declension: "2",
    gender: "n",
    nominative: "dōnum",
    genitive: "dōnī",
    stem: deriveNounStem("2", "dōnī")
  },
  {
    id: "adj-bonus",
    pos: "adjective",
    lemma: "bonus",
    displayName: "bonus",
    adjectiveClass: "1-2",
    nominative: "bonus",
    feminineForm: "bona",
    neuterForm: "bonum",
    genitive: "bonī",
    stem: "bon",
    comparativeStem: "melior",
    superlativeStem: "optim",
    degrees: ["positive", "comparative", "superlative"]
  },
  {
    id: "pron-qui",
    pos: "pronoun",
    lemma: "quī quae quod",
    displayName: "quī",
    pronounType: "qui"
  },
  makeVerb("verb-amo", "amō", "1", "amō", "amāre", "amāvī", "amātum"),
  makeVerb("verb-sum", "sum", "irregular", "sum", "esse", "fuī", "futūrum", {
    irregularKey: "sum",
    presentStem: "s",
    perfectStem: "fu",
    supineStem: "futūr"
  })
];

const templates: TemplateDocument[] = [
  {
    id: "template-default",
    name: "Default charts",
    source: `# Second declension nouns
{vir} {servus} {dominus} {dōnum}

# Verb sample
@hide participles
{amō}`
  }
];

const styleRules: StyleRule[] = [
  { id: "style-labels", name: "Labels", target: "labels", cssText: "font-variant: small-caps; font-weight: bold" },
  { id: "style-noun-stems", name: "Noun stems", target: "noun-stems", cssText: "" },
  { id: "style-case-endings", name: "Case endings", target: "case-endings", cssText: "color: #b42318; font-weight: bold" },
  { id: "style-verb-present-stem", name: "Present system stem", target: "verb-present-stem", cssText: "" },
  { id: "style-verb-perfect-stem", name: "Perfect active stem", target: "verb-perfect-stem", cssText: "" },
  { id: "style-verb-supine-stem", name: "Perfect passive stem", target: "verb-supine-stem", cssText: "" },
  { id: "style-verb-tense-markers", name: "Tense markers", target: "verb-tense-markers", cssText: "" },
  { id: "style-verb-personal", name: "Personal endings", target: "verb-personal-endings", cssText: "color: #3179ff; font-weight: bold" }
];

export const DEFAULT_PROJECT: Project = {
  entries,
  templates,
  styleRules,
  selectedTemplateId: "template-default",
  visibility: {
    cases: DEFAULT_CASES,
    showLocative: false,
    showInfinitives: true,
    showParticiples: true,
    showImperatives: true,
    showIndicativeActive: true,
    showIndicativePassive: true,
    showSubjunctiveActive: true,
    showSubjunctivePassive: true
  }
};
