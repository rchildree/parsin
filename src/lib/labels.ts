import type { LatinCase, LatinNumber, Person, VerbTense } from "./types";

export const CASE_ORDER: LatinCase[] = ["nom", "gen", "dat", "acc", "abl", "voc", "loc"];
export const DEFAULT_CASES: LatinCase[] = ["nom", "gen", "dat", "acc", "abl", "voc"];
export const NUMBER_ORDER: LatinNumber[] = ["sg", "pl"];
export const PERSON_ORDER: Person[] = ["1", "2", "3"];
export const TENSE_ORDER: VerbTense[] = ["pres", "impf", "fut", "pf", "plupf", "futpf"];

export const CASE_LABELS: Record<LatinCase, string> = {
  nom: "nom.",
  gen: "gen.",
  dat: "dat.",
  acc: "acc.",
  abl: "abl.",
  voc: "voc.",
  loc: "loc."
};

export const NUMBER_LABELS: Record<LatinNumber, string> = {
  sg: "sg.",
  pl: "pl."
};

export const TENSE_LABELS: Record<VerbTense, string> = {
  pres: "pres.",
  impf: "impf.",
  fut: "fut.",
  pf: "pf.",
  plupf: "plupf.",
  futpf: "fut. pf."
};

export const PERSON_LABELS: Record<Person, string> = {
  "1": "1",
  "2": "2",
  "3": "3"
};
