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
    overrides: {},
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
    stem: deriveNounStem("2", "virī"),
    overrides: {}
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
    stem: deriveNounStem("2", "servī"),
    overrides: {}
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
    stem: deriveNounStem("2", "dominī"),
    overrides: {}
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
    stem: deriveNounStem("2", "dōnī"),
    overrides: {}
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
    degrees: ["positive", "comparative", "superlative"],
    overrides: {}
  },
  {
    id: "pron-qui",
    pos: "pronoun",
    lemma: "quī quae quod",
    displayName: "quī",
    pronounType: "qui",
    overrides: {}
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
  {
    id: "style-labels",
    name: "Small-caps labels",
    target: "labels",
    cssText: "font-weight: 700"
  },
  {
    id: "style-case-endings",
    name: "Case endings",
    target: "case-endings",
    cssText: "color: #b42318; font-weight: 700"
  },
  {
    id: "style-verb-personal",
    name: "Verb personal endings",
    target: "verb-personal-endings",
    cssText: "color: #0f6b55; font-weight: 700"
  }
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
