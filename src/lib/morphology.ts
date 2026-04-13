import { CASE_LABELS, CASE_ORDER, DEFAULT_CASES, NUMBER_LABELS, NUMBER_ORDER, PERSON_LABELS, PERSON_ORDER, TENSE_LABELS, TENSE_ORDER } from "./labels";
import type {
  AdjectiveEntry,
  ChartSection,
  GeneratedCell,
  Gender,
  LatinCase,
  LatinNumber,
  MorphEntry,
  NounEntry,
  Person,
  PronounEntry,
  PronounType,
  TextSegment,
  VerbEntry,
  VerbMood,
  VerbTense,
  VerbVoice,
  VisibilitySettings
} from "./types";
import { overrideCellKey, removeEnding, segmentsForStemEnding, stripMacrons, textOf } from "./utils";

const DEFAULT_VISIBILITY: VisibilitySettings = {
  cases: DEFAULT_CASES,
  showLocative: false,
  showInfinitives: true,
  showParticiples: true,
  showImperatives: true,
  showIndicativeActive: true,
  showIndicativePassive: true,
  showSubjunctiveActive: true,
  showSubjunctivePassive: true
};

const GENDER_LABELS: Record<Gender, string> = { m: "m.", f: "f.", n: "n." };

export function deriveNounStem(declension: NounEntry["declension"], genitive: string): string {
  const endings: Record<NounEntry["declension"], string[]> = {
    "1": ["ae"],
    "2": ["ī", "i"],
    "3": ["is"],
    "4": ["ūs", "us"],
    "5": ["ēī", "eī", "ei"]
  };
  return removeEnding(genitive.trim(), endings[declension]);
}

export function deriveNounDeclension(genitive: string): NounEntry["declension"] {
  const value = genitive.trim();
  if (value.endsWith("ae")) return "1";
  if (value.endsWith("ēī") || value.endsWith("eī") || value.endsWith("ei")) return "5";
  if (value.endsWith("ī") || value.endsWith("i")) return "2";
  if (value.endsWith("is")) return "3";
  if (value.endsWith("ūs") || value.endsWith("us")) return "4";
  return "3";
}

export function deriveVerbStems(
  conjugation: VerbEntry["conjugation"],
  principalParts: VerbEntry["principalParts"]
): Pick<VerbEntry, "presentStem" | "perfectStem" | "supineStem"> {
  const infinitiveEndings: Record<VerbEntry["conjugation"], string[]> = {
    "1": ["ārī", "ari", "āre", "are"],
    "2": ["ērī", "eri", "ēre", "ere"],
    "3": ["ere", "ī", "i"],
    "3io": ["ere", "ī", "i"],
    "4": ["īrī", "iri", "īre", "ire"],
    irregular: []
  };

  return {
    presentStem: removeEnding(principalParts.infinitive.trim(), infinitiveEndings[conjugation]),
    perfectStem: removeEnding(principalParts.perfect.trim(), ["ī", "i"]),
    supineStem: removeEnding(principalParts.supine.trim(), ["um", "us"])
  };
}

export function displayVerbPresentSystemStem(entry: Pick<VerbEntry, "conjugation" | "presentStem">): string {
  if (!entry.presentStem) return "";
  if (entry.conjugation === "1") return `${entry.presentStem}ā`;
  if (entry.conjugation === "2") return `${entry.presentStem}ē`;
  if (entry.conjugation === "3") return `${entry.presentStem}(e/o)`;
  if (entry.conjugation === "3io") return `${entry.presentStem}i`;
  if (entry.conjugation === "4") return `${entry.presentStem}ī`;
  return entry.presentStem;
}

export function deriveVerbConjugation(infinitive: string, firstPrincipalPart = ""): VerbEntry["conjugation"] {
  const value = stripMacrons(infinitive.trim()).toLowerCase();
  const first = stripMacrons(firstPrincipalPart.trim()).toLowerCase();
  if (value.endsWith("ari")) return "1";
  if (value.endsWith("iri")) return "4";
  if (value.endsWith("eri") && (first.endsWith("eo") || first.endsWith("eor"))) return "2";
  if (value.endsWith("are")) return "1";
  if (value.endsWith("ere")) return (first.endsWith("eo") || first.endsWith("eor")) ? "2" : (first.endsWith("io") || first.endsWith("ior") ? "3io" : "3");
  if (value.endsWith("ire")) return "4";
  if (value.endsWith("i")) return first.endsWith("ior") ? "3io" : "3";
  return "irregular";
}

export function inferDeponentVerb(principalParts: VerbEntry["principalParts"]): boolean {
  const first = stripMacrons(principalParts.first.trim()).toLowerCase();
  const second = stripMacrons(principalParts.infinitive.trim()).toLowerCase();
  if (second.endsWith("ari")) return first.endsWith("or");
  if (second.endsWith("eri")) return first.endsWith("eor");
  if (second.endsWith("iri")) return first.endsWith("ior");
  if (second.endsWith("i")) return first.endsWith("ior") || first.endsWith("or");
  return false;
}

export function detectIrregularVerb(firstPrincipalPart: string, infinitive = ""): VerbEntry["irregularKey"] | undefined {
  const first = firstPrincipalPart.trim();
  const second = infinitive.trim();
  if (first === "sum" || second === "esse") return "sum";
  if (first === "possum" || second === "posse") return "possum";
  if (first === "eō" || first === "eo" || second === "īre" || second === "ire") return first === "eō" || first === "eo" ? "eo" : undefined;
  if (first === "ferō" || first === "fero" || second === "ferre") return "fero";
  if (first === "volō" || first === "volo" || second === "velle") return "volo";
  if (first === "nōlō" || first === "nolo" || second === "nōlle" || second === "nolle") return "nolo";
  if (first === "mālō" || first === "malo" || second === "mālle" || second === "malle") return "malo";
  return undefined;
}

export function deriveAdjectiveStem(genitive: string): string {
  return removeEnding(genitive.trim(), ["ī", "ae", "is"]);
}

export function generateEntrySections(entry: MorphEntry, visibility: VisibilitySettings = DEFAULT_VISIBILITY): ChartSection[] {
  switch (entry.pos) {
    case "noun":
      return [generateNounSection(entry, visibility)];
    case "adjective":
      return generateAdjectiveSections(entry, visibility);
    case "pronoun":
      return [generatePronounSection(entry, visibility)];
    case "verb":
      return generateVerbSections(entry, visibility);
  }
}

function visibleCases(visibility: VisibilitySettings): LatinCase[] {
  const allowed = new Set(visibility.cases);
  return CASE_ORDER.filter((latinCase) => allowed.has(latinCase) && (latinCase !== "loc" || visibility.showLocative));
}

function makeCell(
  entry: MorphEntry,
  key: string,
  slot: Record<string, string>,
  segments: TextSegment[]
): GeneratedCell {
  const generatedText = textOf(segments);
  return {
    key,
    entryId: entry.id,
    entryLemma: entry.displayName || entry.lemma,
    slot,
    segments,
    generatedText,
    displayText: generatedText
  };
}

function nounEnding(entry: NounEntry, latinCase: LatinCase, number: LatinNumber): { stem: string; ending: string; whole?: string } {
  const { declension, gender, stem, nominative, iStem } = entry;

  if (latinCase === "nom" && number === "sg") return { stem: nominative, ending: "", whole: nominative };
  if (latinCase === "voc" && number === "sg") {
    if (declension === "2" && gender !== "n" && nominative.endsWith("us")) return { stem, ending: "e" };
    return { stem: nominative, ending: "", whole: nominative };
  }

  const d1 = {
    sg: { gen: "ae", dat: "ae", acc: "am", abl: "ā", loc: "ae", nom: "a", voc: "a" },
    pl: { nom: "ae", gen: "ārum", dat: "īs", acc: "ās", abl: "īs", voc: "ae", loc: "īs" }
  };
  const d2m = {
    sg: { gen: "ī", dat: "ō", acc: "um", abl: "ō", loc: "ī", nom: "us", voc: "e" },
    pl: { nom: "ī", gen: "ōrum", dat: "īs", acc: "ōs", abl: "īs", voc: "ī", loc: "īs" }
  };
  const d2n = {
    sg: { gen: "ī", dat: "ō", acc: "um", abl: "ō", loc: "ī", nom: "um", voc: "um" },
    pl: { nom: "a", gen: "ōrum", dat: "īs", acc: "a", abl: "īs", voc: "a", loc: "īs" }
  };
  const d3mf = {
    sg: { gen: "is", dat: "ī", acc: "em", abl: iStem ? "ī" : "e", loc: "ī", nom: "", voc: "" },
    pl: { nom: "ēs", gen: iStem ? "ium" : "um", dat: "ibus", acc: "ēs", abl: "ibus", voc: "ēs", loc: "ibus" }
  };
  const d3n = {
    sg: { gen: "is", dat: "ī", acc: "", abl: iStem ? "ī" : "e", loc: "ī", nom: "", voc: "" },
    pl: { nom: iStem ? "ia" : "a", gen: iStem ? "ium" : "um", dat: "ibus", acc: iStem ? "ia" : "a", abl: "ibus", voc: iStem ? "ia" : "a", loc: "ibus" }
  };
  const d4m = {
    sg: { nom: "us", gen: "ūs", dat: "uī", acc: "um", abl: "ū", voc: "us", loc: "ū" },
    pl: { nom: "ūs", gen: "uum", dat: "ibus", acc: "ūs", abl: "ibus", voc: "ūs", loc: "ibus" }
  };
  const d4n = {
    sg: { nom: "ū", gen: "ūs", dat: "ū", acc: "ū", abl: "ū", voc: "ū", loc: "ū" },
    pl: { nom: "ua", gen: "uum", dat: "ibus", acc: "ua", abl: "ibus", voc: "ua", loc: "ibus" }
  };
  const d5 = {
    sg: { nom: "ēs", gen: "ēī", dat: "ēī", acc: "em", abl: "ē", voc: "ēs", loc: "ē" },
    pl: { nom: "ēs", gen: "ērum", dat: "ēbus", acc: "ēs", abl: "ēbus", voc: "ēs", loc: "ēbus" }
  };

  const table =
    declension === "1"
      ? d1
      : declension === "2"
        ? gender === "n"
          ? d2n
          : d2m
        : declension === "3"
          ? gender === "n"
            ? d3n
            : d3mf
          : declension === "4"
            ? gender === "n"
              ? d4n
              : d4m
            : d5;

  if (declension === "3" && gender === "n" && number === "sg" && ["nom", "acc", "voc"].includes(latinCase)) {
    return { stem: nominative, ending: "", whole: nominative };
  }

  return { stem, ending: table[number][latinCase] };
}

function generateNounSection(entry: NounEntry, visibility: VisibilitySettings): ChartSection {
  const columns = [
    {
      key: "form",
      label: entry.nominative,
      entryId: entry.id,
      entryLemma: entry.displayName
    }
  ];
  const rows = NUMBER_ORDER.flatMap((number) => visibleCases(visibility).map((latinCase) => ({
    key: `${latinCase}-${number}`,
    label: `${CASE_LABELS[latinCase]}${NUMBER_LABELS[number]}`,
    cells: [
      (() => {
      const key = overrideCellKey([entry.id, "noun", latinCase, number]);
      const form = nounEnding(entry, latinCase, number);
      return makeCell(entry, key, { case: latinCase, number }, segmentsForStemEnding(form.stem, form.ending, `${CASE_LABELS[latinCase]} ${NUMBER_LABELS[number]} ending`));
      })()
    ]
  })));

  return {
    id: `${entry.id}-noun`,
    title: entry.displayName,
    kind: "case-grid",
    signature: `case-grid:noun:${visibleCases(visibility).join(",")}:stacked-number`,
    columns,
    rows
  };
}

function adjectiveStem(entry: AdjectiveEntry, degree: "positive" | "comparative" | "superlative"): string {
  if (degree === "comparative") return entry.comparativeStem || `${entry.stem}iōr`;
  if (degree === "superlative") return entry.superlativeStem || `${entry.stem}issim`;
  return entry.stem;
}

function pronominalGenitiveForm(stem: string): { stem: string; ending: string } {
  if (stem.endsWith("i") || stem.endsWith("ī")) {
    return { stem: stem.slice(0, -1), ending: "īus" };
  }
  return { stem, ending: "īus" };
}

function autoPronominalAdjective(entry: AdjectiveEntry): boolean {
  if (entry.adjectiveClass !== "1-2") return false;
  const nominative = stripMacrons((entry.nominative || "").trim()).toLowerCase();
  return ["unus", "nullus", "ullus", "solus", "neuter", "alius", "uter", "totus", "alter"].includes(nominative);
}

function defaultAoNeuter(entry: AdjectiveEntry, stem: string): string {
  if (entry.neuterForm) return entry.neuterForm;
  if ((entry.pronominal || autoPronominalAdjective(entry)) && (entry.nominative || "").endsWith("ius")) {
    return (entry.nominative || "").replace(/ius$/, "iud");
  }
  return `${stem}um`;
}

function adjectiveEnding(
  entry: AdjectiveEntry,
  degree: "positive" | "comparative" | "superlative",
  gender: Gender,
  latinCase: LatinCase,
  number: LatinNumber
): { stem: string; ending: string } {
  if (degree === "comparative") {
    const comparative = adjectiveStem(entry, degree);
    const pseudoNoun: NounEntry = {
      ...entry,
      pos: "noun",
      declension: "3",
      gender,
      nominative: gender === "n" ? `${comparative.replace(/ior$/, "")}ius` : comparative,
      genitive: `${comparative}is`,
      stem: comparative,
      iStem: true
    };
    const form = nounEnding(pseudoNoun, latinCase, number);
    if (latinCase === "nom" && number === "sg") {
      return gender === "n"
        ? { stem: comparative.replace(/ior$/, ""), ending: "ius" }
        : { stem: comparative, ending: "" };
    }
    if (latinCase === "voc" && number === "sg") {
      return gender === "n"
        ? { stem: comparative.replace(/ior$/, ""), ending: "ius" }
        : { stem: comparative, ending: "" };
    }
    return { stem: form.stem, ending: form.ending };
  }

  const stem = adjectiveStem(entry, degree);
  if (entry.adjectiveClass === "3" && degree === "positive") {
    const masculine = entry.nominative || `${stem}is`;
    const feminine = entry.feminineForm || masculine;
    const neuter = entry.neuterForm || (entry.feminineForm ? `${entry.neuterStem || stem}e` : masculine);
    const neuterStem = entry.neuterStem || stem;
    if (number === "sg" && (latinCase === "nom" || latinCase === "voc")) {
      if (gender === "m") return { stem: masculine, ending: "" };
      if (gender === "f") return { stem: feminine, ending: "" };
      if (neuter === masculine) return { stem: masculine, ending: "" };
      return neuter.endsWith("e") ? { stem: neuterStem, ending: "e" } : { stem: neuter, ending: "" };
    }
    if (number === "sg" && latinCase === "acc") {
      if (gender === "n") {
        if (neuter === masculine) return { stem: masculine, ending: "" };
        return neuter.endsWith("e") ? { stem: neuterStem, ending: "e" } : { stem: neuter, ending: "" };
      }
      return { stem, ending: "em" };
    }
    if (number === "sg" && latinCase === "abl") return { stem, ending: "ī" };
    if (number === "sg" && latinCase === "gen") return { stem, ending: "is" };
    if (number === "sg" && latinCase === "dat") return { stem, ending: "ī" };
    if (number === "sg" && latinCase === "loc") return { stem, ending: "ī" };
    if (number === "pl" && (latinCase === "nom" || latinCase === "acc" || latinCase === "voc")) {
      return gender === "n" ? { stem, ending: "ia" } : { stem, ending: "ēs" };
    }
    if (number === "pl" && latinCase === "gen") return { stem, ending: "ium" };
    if (number === "pl" && (latinCase === "dat" || latinCase === "abl" || latinCase === "loc")) return { stem, ending: "ibus" };
  }

  const nominative =
    degree === "superlative"
      ? gender === "f"
        ? `${stem}a`
        : gender === "n"
          ? `${stem}um`
          : `${stem}us`
      : gender === "m"
        ? entry.nominative || `${stem}us`
        : gender === "f"
          ? entry.feminineForm || `${stem}a`
          : defaultAoNeuter(entry, stem);

  if (entry.adjectiveClass === "1-2" && degree === "positive" && (entry.pronominal || autoPronominalAdjective(entry)) && number === "sg") {
    if (latinCase === "gen") {
      return pronominalGenitiveForm(stem);
    }
    if (latinCase === "dat" || latinCase === "loc") {
      return { stem, ending: "ī" };
    }
  }
  const endingNoun: NounEntry = {
    ...entry,
    pos: "noun",
    declension: gender === "f" ? "1" : "2",
    gender,
    nominative,
    genitive: gender === "f" ? `${stem}ae` : `${stem}ī`,
    stem,
    iStem: false
  };
  return nounEnding(endingNoun, latinCase, number);
}

function generateAdjectiveSections(entry: AdjectiveEntry, visibility: VisibilitySettings): ChartSection[] {
  return entry.degrees.map((degree) => {
    const genders: Gender[] = ["m", "f", "n"];
    const rowKeys = NUMBER_ORDER.flatMap((number) => visibleCases(visibility).map((latinCase) => `${degree}-${latinCase}-${number}`));
    const genderCells = Object.fromEntries(
      genders.map((gender) => [
        gender,
        NUMBER_ORDER.flatMap((number) =>
          visibleCases(visibility).map((latinCase) => {
            const key = overrideCellKey([entry.id, "adjective", degree, latinCase, number, gender]);
            const form = adjectiveEnding(entry, degree, gender, latinCase, number);
            return makeCell(
              entry,
              key,
              { degree, case: latinCase, number, gender },
              segmentsForStemEnding(form.stem, form.ending, `${degree} ${CASE_LABELS[latinCase]} ${NUMBER_LABELS[number]} ending`)
            );
          })
        )
      ])
    ) as Record<Gender, GeneratedCell[]>;

    const groups: Gender[][] = [];
    if (sameAdjectiveColumn(genderCells.m, genderCells.f) && sameAdjectiveColumn(genderCells.f, genderCells.n)) groups.push(["m", "f", "n"]);
    else if (sameAdjectiveColumn(genderCells.m, genderCells.f)) groups.push(["m", "f"], ["n"]);
    else groups.push(["m"], ["f"], ["n"]);

    const columns = groups.map((group, index) => ({
      key: `${degree}-group-${index}`,
      label: group.map((gender) => GENDER_LABELS[gender].toUpperCase()).join("/"),
      entryId: entry.id,
      entryLemma: entry.displayName
    }));

    const rows = NUMBER_ORDER.flatMap((number) =>
      visibleCases(visibility).map((latinCase) => ({
        key: `${degree}-${latinCase}-${number}`,
        label: `${CASE_LABELS[latinCase]}${NUMBER_LABELS[number]}`,
        cells: groups.map((group) => {
          const cellIndex = rowKeys.indexOf(`${degree}-${latinCase}-${number}`);
          return genderCells[group[0]][cellIndex];
        })
      }))
    );

    return {
      id: `${entry.id}-adjective-${degree}`,
      title: `${entry.displayName} (${degree})`,
      kind: "case-grid",
      signature: `adjective:${degree}:${visibleCases(visibility).join(",")}:stacked-number`,
      columns,
      rows
    };
  });
}

function sameAdjectiveColumn(left: GeneratedCell[], right: GeneratedCell[]): boolean {
  return left.length === right.length && left.every((cell, index) => cell.displayText === right[index].displayText);
}

type PronounTable = Record<string, string>;

const QUI_TABLE: PronounTable = {
  "nom:sg:m": "quī",
  "nom:sg:f": "quae",
  "nom:sg:n": "quod",
  "gen:sg:m": "cuius",
  "gen:sg:f": "cuius",
  "gen:sg:n": "cuius",
  "dat:sg:m": "cui",
  "dat:sg:f": "cui",
  "dat:sg:n": "cui",
  "acc:sg:m": "quem",
  "acc:sg:f": "quam",
  "acc:sg:n": "quod",
  "abl:sg:m": "quō",
  "abl:sg:f": "quā",
  "abl:sg:n": "quō",
  "nom:pl:m": "quī",
  "nom:pl:f": "quae",
  "nom:pl:n": "quae",
  "gen:pl:m": "quōrum",
  "gen:pl:f": "quārum",
  "gen:pl:n": "quōrum",
  "dat:pl:m": "quibus",
  "dat:pl:f": "quibus",
  "dat:pl:n": "quibus",
  "acc:pl:m": "quōs",
  "acc:pl:f": "quās",
  "acc:pl:n": "quae",
  "abl:pl:m": "quibus",
  "abl:pl:f": "quibus",
  "abl:pl:n": "quibus"
};

const QUIS_TABLE: PronounTable = {
  ...QUI_TABLE,
  "nom:sg:m": "quis",
  "nom:sg:f": "quis",
  "nom:sg:n": "quid",
  "acc:sg:n": "quid"
};

const QUISQUIS_TABLE: PronounTable = {
  "nom:sg:m": "quisquis",
  "nom:sg:f": "quisquis",
  "nom:sg:n": "quidquid",
  "gen:sg:m": "cuiuscuius",
  "gen:sg:f": "cuiuscuius",
  "gen:sg:n": "cuiuscuius",
  "dat:sg:m": "cuicui",
  "dat:sg:f": "cuicui",
  "dat:sg:n": "cuicui",
  "acc:sg:m": "quemquem",
  "acc:sg:f": "quamquam",
  "acc:sg:n": "quidquid",
  "abl:sg:m": "quōquō",
  "abl:sg:f": "quāquā",
  "abl:sg:n": "quōquō",
  "nom:pl:m": "quīquī",
  "nom:pl:f": "quaequae",
  "nom:pl:n": "quaequae",
  "gen:pl:m": "quōrumquōrum",
  "gen:pl:f": "quārumquārum",
  "gen:pl:n": "quōrumquōrum",
  "dat:pl:m": "quibusquibus",
  "dat:pl:f": "quibusquibus",
  "dat:pl:n": "quibusquibus",
  "acc:pl:m": "quōsquōs",
  "acc:pl:f": "quāsquās",
  "acc:pl:n": "quaequae",
  "abl:pl:m": "quibusquibus",
  "abl:pl:f": "quibusquibus",
  "abl:pl:n": "quibusquibus"
};

const QUIDAM_TABLE: PronounTable = {
  "nom:sg:m": "quīdam",
  "nom:sg:f": "quaedam",
  "nom:sg:n": "quoddam",
  "gen:sg:m": "cuiusdam",
  "gen:sg:f": "cuiusdam",
  "gen:sg:n": "cuiusdam",
  "dat:sg:m": "cuidam",
  "dat:sg:f": "cuidam",
  "dat:sg:n": "cuidam",
  "acc:sg:m": "quendam",
  "acc:sg:f": "quandam",
  "acc:sg:n": "quoddam",
  "abl:sg:m": "quōdam",
  "abl:sg:f": "quādam",
  "abl:sg:n": "quōdam",
  "nom:pl:m": "quīdam",
  "nom:pl:f": "quaedam",
  "nom:pl:n": "quaedam",
  "gen:pl:m": "quōrundam",
  "gen:pl:f": "quārundam",
  "gen:pl:n": "quōrundam",
  "dat:pl:m": "quibusdam",
  "dat:pl:f": "quibusdam",
  "dat:pl:n": "quibusdam",
  "acc:pl:m": "quōsdam",
  "acc:pl:f": "quāsdam",
  "acc:pl:n": "quaedam",
  "abl:pl:m": "quibusdam",
  "abl:pl:f": "quibusdam",
  "abl:pl:n": "quibusdam"
};

const UTERQUE_TABLE: PronounTable = {
  "nom:sg:m": "uterque",
  "nom:sg:f": "utraque",
  "nom:sg:n": "utrumque",
  "gen:sg:m": "utrīusque",
  "gen:sg:f": "utrīusque",
  "gen:sg:n": "utrīusque",
  "dat:sg:m": "utrīque",
  "dat:sg:f": "utrīque",
  "dat:sg:n": "utrīque",
  "acc:sg:m": "utrumque",
  "acc:sg:f": "utramque",
  "acc:sg:n": "utrumque",
  "abl:sg:m": "utrōque",
  "abl:sg:f": "utrāque",
  "abl:sg:n": "utrōque",
  "nom:pl:m": "utrīque",
  "nom:pl:f": "utraeque",
  "nom:pl:n": "utraque",
  "gen:pl:m": "utrōrumque",
  "gen:pl:f": "utrārumque",
  "gen:pl:n": "utrōrumque",
  "dat:pl:m": "utrīsque",
  "dat:pl:f": "utrīsque",
  "dat:pl:n": "utrīsque",
  "acc:pl:m": "utrōsque",
  "acc:pl:f": "utrāsque",
  "acc:pl:n": "utraque",
  "abl:pl:m": "utrīsque",
  "abl:pl:f": "utrīsque",
  "abl:pl:n": "utrīsque"
};

const PRONOUNS: Record<Exclude<PronounType, "">, { title: string; genders: boolean; table: PronounTable }> = {
  ego: {
    title: "ego",
    genders: false,
    table: {
      "nom:sg": "ego",
      "gen:sg": "meī",
      "dat:sg": "mihi",
      "acc:sg": "mē",
      "abl:sg": "mē"
    }
  },
  nos: {
    title: "nōs",
    genders: false,
    table: {
      "nom:pl": "nōs",
      "gen:pl": "nostrī/nostrum",
      "dat:pl": "nōbīs",
      "acc:pl": "nōs",
      "abl:pl": "nōbīs"
    }
  },
  tu: {
    title: "tū",
    genders: false,
    table: {
      "nom:sg": "tū",
      "gen:sg": "tuī",
      "dat:sg": "tibi",
      "acc:sg": "tē",
      "abl:sg": "tē"
    }
  },
  vos: {
    title: "vōs",
    genders: false,
    table: {
      "nom:pl": "vōs",
      "gen:pl": "vestrī/vestrum",
      "dat:pl": "vōbīs",
      "acc:pl": "vōs",
      "abl:pl": "vōbīs"
    }
  },
  sui: {
    title: "suī",
    genders: false,
    table: {
      "gen:sg": "suī",
      "dat:sg": "sibi",
      "acc:sg": "sē",
      "abl:sg": "sē",
      "gen:pl": "suī",
      "dat:pl": "sibi",
      "acc:pl": "sē",
      "abl:pl": "sē"
    }
  },
  qui: {
    title: "quī quae quod",
    genders: true,
    table: QUI_TABLE
  },
  quis: {
    title: "quis quid",
    genders: true,
    table: QUIS_TABLE
  },
  quisquis: {
    title: "quisquis quidquid",
    genders: true,
    table: QUISQUIS_TABLE
  },
  quidam: {
    title: "quīdam quaedam quoddam",
    genders: true,
    table: QUIDAM_TABLE
  },
  is: { title: "is ea id", genders: true, table: buildPronominalTable("is", "ea", "id", "e", "i") },
  hic: {
    title: "hic haec hoc",
    genders: true,
    table: {
      "nom:sg:m": "hic",
      "nom:sg:f": "haec",
      "nom:sg:n": "hoc",
      "gen:sg:m": "huius",
      "gen:sg:f": "huius",
      "gen:sg:n": "huius",
      "dat:sg:m": "huic",
      "dat:sg:f": "huic",
      "dat:sg:n": "huic",
      "acc:sg:m": "hunc",
      "acc:sg:f": "hanc",
      "acc:sg:n": "hoc",
      "abl:sg:m": "hōc",
      "abl:sg:f": "hāc",
      "abl:sg:n": "hōc",
      "nom:pl:m": "hī",
      "nom:pl:f": "hae",
      "nom:pl:n": "haec",
      "gen:pl:m": "hōrum",
      "gen:pl:f": "hārum",
      "gen:pl:n": "hōrum",
      "dat:pl:m": "hīs",
      "dat:pl:f": "hīs",
      "dat:pl:n": "hīs",
      "acc:pl:m": "hōs",
      "acc:pl:f": "hās",
      "acc:pl:n": "haec",
      "abl:pl:m": "hīs",
      "abl:pl:f": "hīs",
      "abl:pl:n": "hīs"
    }
  },
  ille: { title: "ille illa illud", genders: true, table: buildPronominalTable("ille", "illa", "illud", "ill", "ill") },
  iste: { title: "iste ista istud", genders: true, table: buildPronominalTable("iste", "ista", "istud", "ist", "ist") },
  ipse: { title: "ipse ipsa ipsum", genders: true, table: buildPronominalTable("ipse", "ipsa", "ipsum", "ips", "ips") },
  idem: { title: "īdem eadem idem", genders: true, table: buildPronominalTable("īdem", "eadem", "idem", "eōrund", "e") },
  uterque: { title: "uterque utraque utrumque", genders: true, table: UTERQUE_TABLE },
  aliquis: { title: "aliquis aliquid", genders: true, table: prefixPronoun("ali", "qui") },
  quisque: { title: "quisque quidque", genders: true, table: suffixPronoun("qui", "que") }
};

function buildPronominalTable(mNom: string, fNom: string, nNom: string, obliqueStem: string, pluralStem: string): PronounTable {
  return {
    "nom:sg:m": mNom,
    "nom:sg:f": fNom,
    "nom:sg:n": nNom,
    "gen:sg:m": `${obliqueStem}īus`,
    "gen:sg:f": `${obliqueStem}īus`,
    "gen:sg:n": `${obliqueStem}īus`,
    "dat:sg:m": `${obliqueStem}ī`,
    "dat:sg:f": `${obliqueStem}ī`,
    "dat:sg:n": `${obliqueStem}ī`,
    "acc:sg:m": `${obliqueStem}um`,
    "acc:sg:f": `${obliqueStem}am`,
    "acc:sg:n": nNom,
    "abl:sg:m": `${obliqueStem}ō`,
    "abl:sg:f": `${obliqueStem}ā`,
    "abl:sg:n": `${obliqueStem}ō`,
    "nom:pl:m": `${pluralStem}ī`,
    "nom:pl:f": `${pluralStem}ae`,
    "nom:pl:n": `${pluralStem}a`,
    "gen:pl:m": `${pluralStem}ōrum`,
    "gen:pl:f": `${pluralStem}ārum`,
    "gen:pl:n": `${pluralStem}ōrum`,
    "dat:pl:m": `${pluralStem}īs`,
    "dat:pl:f": `${pluralStem}īs`,
    "dat:pl:n": `${pluralStem}īs`,
    "acc:pl:m": `${pluralStem}ōs`,
    "acc:pl:f": `${pluralStem}ās`,
    "acc:pl:n": `${pluralStem}a`,
    "abl:pl:m": `${pluralStem}īs`,
    "abl:pl:f": `${pluralStem}īs`,
    "abl:pl:n": `${pluralStem}īs`
  };
}

function prefixPronoun(prefix: string, base: keyof typeof PRONOUNS): PronounTable {
  const table = base === "qui" ? QUI_TABLE : {};
  return Object.fromEntries(Object.entries(table).map(([key, value]) => [key, `${prefix}${value}`]));
}

function suffixPronoun(base: keyof typeof PRONOUNS, suffix: string): PronounTable {
  const table = base === "qui" ? QUI_TABLE : {};
  return Object.fromEntries(Object.entries(table).map(([key, value]) => [key, `${value}${suffix}`]));
}

function pronounHasNumber(table: PronounTable, number: LatinNumber): boolean {
  return Object.keys(table).some((key) => key.split(":")[1] === number);
}

function generatePronounSection(entry: PronounEntry, visibility: VisibilitySettings): ChartSection {
  const { pronounType } = entry;
  if (!pronounType) {
    return {
      id: `${entry.id}-pronoun`,
      title: entry.displayName || "pronoun",
      kind: "case-grid",
      signature: `pronoun:blank:${visibleCases(visibility).join(",")}:stacked-number`,
      columns: [{ key: "form", label: "form", entryId: entry.id, entryLemma: entry.displayName }],
      rows: []
    };
  }
  const paradigm = PRONOUNS[pronounType];
  const columnSlots = paradigm.genders
    ? (["m", "f", "n"] as Gender[]).map((gender) => ({ gender }))
    : [{ gender: undefined }];
  const columns = columnSlots.map(({ gender }) => ({
    key: gender || "form",
    label: gender ? GENDER_LABELS[gender].toUpperCase() : "",
    entryId: entry.id,
    entryLemma: entry.displayName
  }));
  const rows = NUMBER_ORDER
    .filter((number) => pronounHasNumber(paradigm.table, number))
    .flatMap((number) => visibleCases(visibility).map((latinCase) => ({
    key: `${latinCase}-${number}`,
    label: `${CASE_LABELS[latinCase]}${NUMBER_LABELS[number]}`,
    cells: columnSlots.map(({ gender }) => {
      const lookupKey = gender ? `${latinCase}:${number}:${gender}` : `${latinCase}:${number}`;
      const key = overrideCellKey([entry.id, "pronoun", latinCase, number, gender]);
      const form = paradigm.table[lookupKey] || "—";
      return makeCell(entry, key, { case: latinCase, number, ...(gender ? { gender } : {}) }, [{ text: form, role: "form", label: `${CASE_LABELS[latinCase]} pronoun form` }]);
    })
  })));

  return {
    id: `${entry.id}-pronoun`,
    title: entry.displayName || paradigm.title,
    kind: "case-grid",
    signature: `pronoun:${paradigm.genders ? "gendered" : "personal"}:${visibleCases(visibility).join(",")}:stacked-number`,
    columns,
    rows
  };
}

type SixForms = [string, string, string, string, string, string];
type IrregularMap = Partial<Record<VerbMood, Partial<Record<VerbTense, SixForms>>>>;

const IRREGULAR_ACTIVE: Record<NonNullable<VerbEntry["irregularKey"]>, IrregularMap> = {
  sum: {
    indicative: {
      pres: ["sum", "es", "est", "sumus", "estis", "sunt"],
      impf: ["eram", "erās", "erat", "erāmus", "erātis", "erant"],
      fut: ["erō", "eris", "erit", "erimus", "eritis", "erunt"],
      pf: ["fuī", "fuistī", "fuit", "fuimus", "fuistis", "fuērunt"],
      plupf: ["fueram", "fuerās", "fuerat", "fuerāmus", "fuerātis", "fuerant"],
      futpf: ["fuerō", "fueris", "fuerit", "fuerimus", "fueritis", "fuerint"]
    },
    subjunctive: {
      pres: ["sim", "sīs", "sit", "sīmus", "sītis", "sint"],
      impf: ["essem", "essēs", "esset", "essēmus", "essētis", "essent"],
      pf: ["fuerim", "fuerīs", "fuerit", "fuerīmus", "fuerītis", "fuerint"],
      plupf: ["fuissem", "fuissēs", "fuisset", "fuissēmus", "fuissētis", "fuissent"]
    }
  },
  possum: {
    indicative: {
      pres: ["possum", "potes", "potest", "possumus", "potestis", "possunt"],
      impf: ["poteram", "poterās", "poterat", "poterāmus", "poterātis", "poterant"],
      fut: ["poterō", "poteris", "poterit", "poterimus", "poteritis", "poterunt"],
      pf: ["potuī", "potuistī", "potuit", "potuimus", "potuistis", "potuērunt"],
      plupf: ["potueram", "potuerās", "potuerat", "potuerāmus", "potuerātis", "potuerant"],
      futpf: ["potuerō", "potueris", "potuerit", "potuerimus", "potueritis", "potuerint"]
    },
    subjunctive: {
      pres: ["possim", "possīs", "possit", "possīmus", "possītis", "possint"],
      impf: ["possem", "possēs", "posset", "possēmus", "possētis", "possent"],
      pf: ["potuerim", "potuerīs", "potuerit", "potuerīmus", "potuerītis", "potuerint"],
      plupf: ["potuissem", "potuissēs", "potuisset", "potuissēmus", "potuissētis", "potuissent"]
    }
  },
  eo: {
    indicative: {
      pres: ["eō", "īs", "it", "īmus", "ītis", "eunt"],
      impf: ["ībam", "ībās", "ībat", "ībāmus", "ībātis", "ībant"],
      fut: ["ībō", "ībis", "ībit", "ībimus", "ībitis", "ībunt"],
      pf: ["iī", "iistī", "iit", "iimus", "iistis", "iērunt"],
      plupf: ["ieram", "ierās", "ierat", "ierāmus", "ierātis", "ierant"],
      futpf: ["ierō", "ieris", "ierit", "ierimus", "ieritis", "ierint"]
    },
    subjunctive: {
      pres: ["eam", "eās", "eat", "eāmus", "eātis", "eant"],
      impf: ["īrem", "īrēs", "īret", "īrēmus", "īrētis", "īrent"],
      pf: ["ierim", "ierīs", "ierit", "ierīmus", "ierītis", "ierint"],
      plupf: ["iissem", "iissēs", "iisset", "iissēmus", "iissētis", "iissent"]
    }
  },
  fero: {
    indicative: {
      pres: ["ferō", "fers", "fert", "ferimus", "fertis", "ferunt"],
      impf: ["ferēbam", "ferēbās", "ferēbat", "ferēbāmus", "ferēbātis", "ferēbant"],
      fut: ["feram", "ferēs", "feret", "ferēmus", "ferētis", "ferent"],
      pf: ["tulī", "tulistī", "tulit", "tulimus", "tulistis", "tulērunt"],
      plupf: ["tuleram", "tulerās", "tulerat", "tulerāmus", "tulerātis", "tulerant"],
      futpf: ["tulerō", "tuleris", "tulerit", "tulerimus", "tuleritis", "tulerint"]
    },
    subjunctive: {
      pres: ["feram", "ferās", "ferat", "ferāmus", "ferātis", "ferant"],
      impf: ["ferrem", "ferrēs", "ferret", "ferrēmus", "ferrētis", "ferrent"],
      pf: ["tulerim", "tulerīs", "tulerit", "tulerīmus", "tulerītis", "tulerint"],
      plupf: ["tulissem", "tulissēs", "tulisset", " tulissēmus".trim(), "tulissētis", "tulissent"]
    }
  },
  volo: irregularLikeThird("vol", "voluī", ["volō", "vīs", "vult", "volumus", "vultis", "volunt"], ["velim", "velīs", "velit", "velīmus", "velītis", "velint"]),
  nolo: irregularLikeThird("nol", "noluī", ["nōlō", "nōn vīs", "nōn vult", "nōlumus", "nōn vultis", "nōlunt"], ["nōlim", "nōlīs", "nōlit", "nōlīmus", "nōlītis", "nōlint"]),
  malo: irregularLikeThird("mal", "maluī", ["mālō", "māvīs", "māvult", "mālumus", "māvultis", "mālunt"], ["mālim", "mālīs", "mālit", "mālīmus", "mālītis", "mālint"])
};

function irregularLikeThird(presentStem: string, perfect: string, present: SixForms, subjPresent: SixForms): IrregularMap {
  const perfectStem = removeEnding(perfect, ["ī", "i"]);
  return {
    indicative: {
      pres: present,
      impf: ["ēbam", "ēbās", "ēbat", "ēbāmus", "ēbātis", "ēbant"].map((suffix) => `${presentStem}${suffix}`) as SixForms,
      fut: ["am", "ēs", "et", "ēmus", "ētis", "ent"].map((suffix) => `${presentStem}${suffix}`) as SixForms,
      pf: ["ī", "istī", "it", "imus", "istis", "ērunt"].map((suffix) => `${perfectStem}${suffix}`) as SixForms,
      plupf: ["eram", "erās", "erat", "erāmus", "erātis", "erant"].map((suffix) => `${perfectStem}${suffix}`) as SixForms,
      futpf: ["erō", "eris", "erit", "erimus", "eritis", "erint"].map((suffix) => `${perfectStem}${suffix}`) as SixForms
    },
    subjunctive: {
      pres: subjPresent,
      impf: ["em", "ēs", "et", "ēmus", "ētis", "ent"].map((suffix) => `${presentStem}l${suffix}`) as SixForms,
      pf: ["erim", "erīs", "erit", "erīmus", "erītis", "erint"].map((suffix) => `${perfectStem}${suffix}`) as SixForms,
      plupf: ["issem", "issēs", "isset", "issēmus", "issētis", "issent"].map((suffix) => `${perfectStem}${suffix}`) as SixForms
    }
  };
}

function formIndex(person: Person, number: LatinNumber): number {
  return NUMBER_ORDER.indexOf(number) * 3 + PERSON_ORDER.indexOf(person);
}

function activePersonal(person: Person, number: LatinNumber, firstSingular = "m"): string {
  const endings: Record<LatinNumber, Record<Person, string>> = {
    sg: { "1": firstSingular, "2": "s", "3": "t" },
    pl: { "1": "mus", "2": "tis", "3": "nt" }
  };
  return endings[number][person];
}

function personalSegment(text: string, label = "personal ending"): TextSegment {
  const personalEndings = new Set(["ō", "m", "s", "t", "mus", "tis", "nt", "r", "ris", "tur", "mur", "minī", "ntur", "ī", "istī", "it", "imus", "istis", "ērunt"]);
  return { text, role: personalEndings.has(text) ? "personal" : "tenseMood", label };
}

function splitIrregularWithPersonal(
  form: string,
  personal: string,
  stemLabel = "irregular stem",
  stemTone?: TextSegment["tone"]
): TextSegment[] {
  if (form.endsWith(personal) && form.length > personal.length) {
    return [
      { text: form.slice(0, -personal.length), role: "stem", label: stemLabel, tone: stemTone },
      { text: personal, role: "personal", label: "personal ending" }
    ];
  }
  return [{ text: form, role: "form", label: "irregular form" }];
}

function splitIrregularMarkedEnding(
  form: string,
  markers: string[],
  personal: string,
  stemLabel = "irregular stem",
  stemTone?: TextSegment["tone"]
): TextSegment[] {
  for (const marker of markers) {
    const suffix = `${marker}${personal}`;
    if (form.endsWith(suffix) && form.length > suffix.length) {
      return [
        { text: form.slice(0, -suffix.length), role: "stem", label: stemLabel, tone: stemTone },
        { text: marker, role: "tenseMood", label: "tense/mood marker", tone: "secondary" },
        { text: personal, role: "personal", label: "personal ending" }
      ];
    }
  }
  return splitIrregularWithPersonal(form, personal, stemLabel, stemTone);
}

function splitIrregularPresentSubjunctive(
  irregularKey: NonNullable<VerbEntry["irregularKey"]>,
  form: string,
  person: Person,
  number: LatinNumber
): TextSegment[] {
  if (irregularKey === "fero") {
    const marker = finiteMarkerIsLong(person, number) ? "ā" : "a";
    return splitIrregularMarkedEnding(form, [marker], activePersonal(person, number));
  }
  if (irregularKey === "eo") {
    const marker = finiteMarkerIsLong(person, number) ? "ā" : "a";
    return splitIrregularMarkedEnding(form, [marker], activePersonal(person, number));
  }
  return splitIrregularWithPersonal(form, activePersonal(person, number, form.endsWith("ō") ? "ō" : "m"));
}

function splitIrregularImperfect(
  form: string,
  person: Person,
  number: LatinNumber
): TextSegment[] {
  return splitIrregularMarkedEnding(form, ["ba", "bā"], activePersonal(person, number));
}

function splitIrregularFuture(
  irregularKey: NonNullable<VerbEntry["irregularKey"]>,
  form: string,
  person: Person,
  number: LatinNumber
): TextSegment[] {
  if (irregularKey === "sum") {
    const personal = person === "1" && number === "sg" ? "ō" : activePersonal(person, number);
    return splitIrregularWithPersonal(form, personal);
  }
  if (irregularKey === "eo") {
    if (person === "1" && number === "sg") return splitIrregularMarkedEnding(form, ["b"], "ō");
    if (person === "3" && number === "pl") return splitIrregularMarkedEnding(form, ["bu"], "nt");
    return splitIrregularMarkedEnding(form, ["bi"], activePersonal(person, number));
  }
  if (irregularKey === "fero") {
    const marker = person === "1" && number === "sg" ? "a" : finiteMarkerIsLong(person, number) ? "ē" : "e";
    return splitIrregularMarkedEnding(form, [marker], activePersonal(person, number));
  }
  if (["possum", "volo", "nolo", "malo"].includes(irregularKey)) {
    const personal = person === "1" && number === "sg" ? (form.endsWith("ō") ? "ō" : "m") : activePersonal(person, number);
    return splitIrregularWithPersonal(form, personal);
  }
  return [{ text: form, role: "form", label: "irregular future form" }];
}

function irregularHasFinitePassive(entry: VerbEntry): boolean {
  return entry.irregularKey === "fero";
}

function feroPassiveSegments(mood: VerbMood, tense: VerbTense, person: Person, number: LatinNumber): TextSegment[] {
  const personal = passivePersonal(person, number);

  if (mood === "indicative") {
    if (tense === "pres") {
      if (person === "1" && number === "sg") return verbSegments("fer", "", "o", "r");
      if (person === "2" && number === "sg") return verbSegments("fer", "", "", "ris");
      if (person === "3" && number === "sg") return verbSegments("fer", "", "", "tur");
      if (person === "1" && number === "pl") return verbSegments("fer", "", "i", "mur");
      if (person === "2" && number === "pl") return verbSegments("fer", "", "i", "minī");
      return verbSegments("fer", "", "u", "ntur");
    }
    if (tense === "impf") {
      const marker = finiteMarkerIsLong(person, number) ? "bā" : "ba";
      return verbSegments("ferē", marker, "", personal, { tenseMood: "secondary" });
    }
    if (tense === "fut") {
      const marker = person === "1" && number === "sg" ? "a" : person === "3" && number === "pl" ? "e" : "ē";
      return verbSegments("fer", marker, "", personal, { tenseMood: "secondary" });
    }
  }

  if (mood === "subjunctive") {
    if (tense === "pres") {
      const marker = person === "1" && number === "sg" ? "a" : person === "3" && number === "pl" ? "a" : "ā";
      return verbSegments("fer", marker, "", personal, { tenseMood: "secondary" });
    }
    if (tense === "impf") {
      const marker = person === "1" && number === "sg" ? "e" : person === "3" && number === "pl" ? "e" : "ē";
      return verbSegments("ferr", marker, "", personal, { tenseMood: "secondary" });
    }
  }

  return [{ text: "—", role: "form", label: "not applicable" }];
}

function splitIrregularActive(
  irregularKey: NonNullable<VerbEntry["irregularKey"]>,
  mood: VerbMood,
  tense: VerbTense,
  person: Person,
  number: LatinNumber,
  form: string
): TextSegment[] {
  if (mood === "indicative" && tense === "pf") {
    return splitIrregularWithPersonal(form, perfectActiveEnding(person, number), "irregular perfect stem", "secondary");
  }

  if (mood === "indicative" && tense === "plupf") {
    return splitIrregularMarkedEnding(form, ["erā", "era"], activePersonal(person, number), "irregular perfect stem", "secondary");
  }

  if (mood === "indicative" && tense === "futpf") {
    if (person === "1" && number === "sg") {
      return splitIrregularMarkedEnding(form, ["er"], "ō", "irregular perfect stem", "secondary");
    }
    return splitIrregularMarkedEnding(form, ["eri"], activePersonal(person, number), "irregular perfect stem", "secondary");
  }

  if (mood === "subjunctive" && tense === "pf") {
    return splitIrregularMarkedEnding(form, ["eri", "erī"], activePersonal(person, number), "irregular perfect stem", "secondary");
  }

  if (mood === "subjunctive" && tense === "plupf") {
    return splitIrregularMarkedEnding(form, ["isse", "issē"], activePersonal(person, number), "irregular perfect stem", "secondary");
  }

  if (mood === "subjunctive" && tense === "pres") {
    return splitIrregularPresentSubjunctive(irregularKey, form, person, number);
  }

  if (mood === "indicative" && tense === "impf" && irregularKey !== "sum") {
    return splitIrregularImperfect(form, person, number);
  }

  if (mood === "indicative" && tense === "fut") {
    return splitIrregularFuture(irregularKey, form, person, number);
  }

  const personal =
    tense === "pf"
      ? perfectActiveEnding(person, number)
      : person === "1" && number === "sg"
        ? (form.endsWith("ō") ? "ō" : "m")
        : activePersonal(person, number);
  return splitIrregularWithPersonal(form, personal);
}

function passivePersonal(person: Person, number: LatinNumber, firstSingular = "r"): string {
  const endings: Record<LatinNumber, Record<Person, string>> = {
    sg: { "1": firstSingular, "2": "ris", "3": "tur" },
    pl: { "1": "mur", "2": "minī", "3": "ntur" }
  };
  return endings[number][person];
}

function verbSegments(
  stem: string,
  tenseMood: string,
  thematic: string,
  personal: string,
  tones: Partial<Record<"stem" | "tenseMood" | "thematic" | "personal", TextSegment["tone"]>> = {}
): TextSegment[] {
  const segments: TextSegment[] = [
    { text: stem, role: "stem", label: "verb stem", tone: tones.stem },
    { text: thematic, role: "thematic", label: "thematic vowel", tone: tones.thematic },
    { text: tenseMood, role: "tenseMood", label: "tense/mood marker", tone: tones.tenseMood },
    { ...personalSegment(personal), tone: tones.personal }
  ];
  return segments.filter((segment) => segment.text.length > 0);
}

function finiteMarkerIsLong(person: Person, number: LatinNumber): boolean {
  return (person === "2" && number === "sg") || (number === "pl" && person !== "3");
}

function passiveThirdSingularLong(person: Person, number: LatinNumber): boolean {
  return person === "3" && number === "sg";
}

function subjunctiveMarkerIsLong(voice: VerbVoice, person: Person, number: LatinNumber): boolean {
  return finiteMarkerIsLong(person, number) || (voice === "passive" && passiveThirdSingularLong(person, number));
}

function presentSubjunctiveSegments(entry: VerbEntry, voice: VerbVoice, person: Person, number: LatinNumber): TextSegment[] {
  const longMarker = subjunctiveMarkerIsLong(voice, person, number);
  const marker = longMarker ? "ā" : "a";
  const firstConjugationMarker = longMarker ? "ē" : "e";
  const personal = voice === "active" ? activePersonal(person, number) : passivePersonal(person, number);

  if (entry.conjugation === "1") {
    return verbSegments(entry.presentStem, firstConjugationMarker, "", personal, { tenseMood: "secondary" });
  }
  if (entry.conjugation === "2") {
    return verbSegments(entry.presentStem, marker, "e", personal, { tenseMood: "secondary" });
  }
  if (entry.conjugation === "3io" || entry.conjugation === "4") {
    return verbSegments(entry.presentStem, marker, "i", personal, { tenseMood: "secondary" });
  }
  return verbSegments(entry.presentStem, marker, "", personal, { tenseMood: "secondary" });
}

function imperfectIndicativeSegments(entry: VerbEntry, voice: VerbVoice, person: Person, number: LatinNumber): TextSegment[] {
  const stemVowel = entry.conjugation === "1" ? "ā" : entry.conjugation === "3io" || entry.conjugation === "4" ? "iē" : "ē";
  const marker = finiteMarkerIsLong(person, number) ? "bā" : "ba";
  const personal = voice === "active" ? activePersonal(person, number) : passivePersonal(person, number);
  return verbSegments(`${entry.presentStem}${stemVowel}`, marker, "", personal, { tenseMood: "secondary" });
}

function futureFirstSecondSegments(entry: VerbEntry, voice: VerbVoice, person: Person, number: LatinNumber): TextSegment[] {
  const stemVowel = entry.conjugation === "1" ? "ā" : "ē";
  if (voice === "passive") {
    const marker = person === "1" && number === "sg" ? "bo" : person === "2" && number === "sg" ? "be" : person === "3" && number === "pl" ? "bu" : "bi";
    const personal = person === "1" && number === "sg" ? "r" : person === "2" && number === "sg" ? "ris" : person === "3" && number === "sg" ? "tur" : person === "1" && number === "pl" ? "mur" : person === "2" && number === "pl" ? "minī" : "ntur";
    return verbSegments(`${entry.presentStem}${stemVowel}`, marker, "", personal, { tenseMood: "secondary" });
  }

  const marker = person === "1" && number === "sg" ? "b" : person === "3" && number === "pl" ? "bu" : "bi";
  const personal = person === "1" && number === "sg" ? "ō" : person === "3" && number === "pl" ? "nt" : activePersonal(person, number);
  return verbSegments(`${entry.presentStem}${stemVowel}`, marker, "", personal, { tenseMood: "secondary" });
}

function futureOtherSegments(entry: VerbEntry, voice: VerbVoice, person: Person, number: LatinNumber): TextSegment[] {
  const stemVowel = entry.conjugation === "3io" || entry.conjugation === "4" ? "i" : "";
  const marker = person === "1" && number === "sg" ? "a" : person === "3" ? "e" : "ē";
  const personal = voice === "active" ? activePersonal(person, number) : passivePersonal(person, number);
  return verbSegments(entry.presentStem, marker, stemVowel, personal, { tenseMood: "secondary" });
}

function pluperfectIndicativeActiveSegments(entry: VerbEntry, person: Person, number: LatinNumber): TextSegment[] {
  const marker = finiteMarkerIsLong(person, number) ? "erā" : "era";
  const personal = activePersonal(person, number);
  return verbSegments(entry.perfectStem, marker, "", personal, { stem: "secondary", tenseMood: "secondary" });
}

function futurePerfectIndicativeActiveSegments(entry: VerbEntry, person: Person, number: LatinNumber): TextSegment[] {
  const marker = person === "1" && number === "sg" ? "er" : "eri";
  const personal = person === "1" && number === "sg" ? "ō" : activePersonal(person, number);
  return verbSegments(entry.perfectStem, marker, "", personal, { stem: "secondary", tenseMood: "secondary" });
}

function pluperfectSubjunctiveActiveSegments(entry: VerbEntry, person: Person, number: LatinNumber): TextSegment[] {
  const marker = finiteMarkerIsLong(person, number) ? "issē" : "isse";
  const personal = activePersonal(person, number);
  return verbSegments(entry.perfectStem, marker, "", personal, { stem: "secondary", tenseMood: "secondary" });
}

function presentVowel(entry: VerbEntry, person: Person, number: LatinNumber): string {
  const c = entry.conjugation;
  if (c === "1") return person === "1" && number === "sg" ? "" : person === "3" && number === "pl" ? "a" : "ā";
  if (c === "2") return (person === "1" && number === "sg") || person === "3" ? "e" : "ē";
  if (c === "3") return person === "1" && number === "sg" ? "" : person === "3" && number === "pl" ? "u" : "i";
  if (c === "3io") return person === "3" && number === "pl" ? "iu" : person === "1" && number === "sg" ? "i" : "i";
  return person === "3" && number === "pl" ? "iu" : person === "1" && number === "sg" ? "i" : person === "2" && number === "sg" ? "ī" : number === "pl" && person !== "3" ? "ī" : "i";
}

function presentPassiveSegments(entry: VerbEntry, person: Person, number: LatinNumber): TextSegment[] {
  if (entry.conjugation === "1") {
    if (person === "1" && number === "sg") return verbSegments(entry.presentStem, "", "o", "r");
    const thematic = person === "3" && number === "pl" ? "a" : "ā";
    return verbSegments(entry.presentStem, "", thematic, passivePersonal(person, number));
  }
  if (entry.conjugation === "2") {
    if (person === "1" && number === "sg") return verbSegments(entry.presentStem, "", "eo", "r");
    const thematic = person === "3" && number === "pl" ? "e" : "ē";
    return verbSegments(entry.presentStem, "", thematic, passivePersonal(person, number));
  }
  if (entry.conjugation === "3") {
    if (person === "1" && number === "sg") return verbSegments(entry.presentStem, "", "o", "r");
    const thematic = person === "2" && number === "sg" ? "e" : person === "3" && number === "pl" ? "u" : "i";
    return verbSegments(entry.presentStem, "", thematic, passivePersonal(person, number));
  }
  if (entry.conjugation === "3io") {
    if (person === "1" && number === "sg") return verbSegments(entry.presentStem, "", "io", "r");
    const thematic = person === "2" && number === "sg" ? "e" : person === "3" && number === "pl" ? "iu" : "i";
    return verbSegments(entry.presentStem, "", thematic, passivePersonal(person, number));
  }
  if (entry.conjugation === "4") {
    if (person === "1" && number === "sg") return verbSegments(entry.presentStem, "", "io", "r");
    const thematic = person === "3" && number === "pl" ? "iu" : "ī";
    return verbSegments(entry.presentStem, "", thematic, passivePersonal(person, number));
  }
  return verbSegments(entry.presentStem, "", "", passivePersonal(person, number));
}

function regularFiniteSegments(entry: VerbEntry, mood: VerbMood, voice: VerbVoice, tense: VerbTense, person: Person, number: LatinNumber): TextSegment[] {
  if (entry.irregularKey && voice === "active") {
    const forms = IRREGULAR_ACTIVE[entry.irregularKey]?.[mood]?.[tense];
    if (forms) return splitIrregularActive(entry.irregularKey, mood, tense, person, number, forms[formIndex(person, number)]);
  }

  if (entry.irregularKey === "fero" && voice === "passive" && ["pres", "impf", "fut", "pf", "plupf", "futpf"].includes(tense)) {
    if ((mood === "indicative" && ["pres", "impf", "fut"].includes(tense)) || (mood === "subjunctive" && ["pres", "impf"].includes(tense))) {
      return feroPassiveSegments(mood, tense, person, number);
    }
  }

  const root = entry.presentStem;
  const perfectStem = entry.perfectStem;
  const passiveEnding = passivePersonal(person, number);
  const activeEnding = activePersonal(person, number);

  if (voice === "passive" && ["pf", "plupf", "futpf"].includes(tense)) {
    const participle = `${entry.supineStem}${number === "pl" ? "ī" : "us"}`;
    const auxMood = mood === "subjunctive" ? "subjunctive" : "indicative";
    const auxTense = mood === "subjunctive" ? (tense === "pf" ? "pres" : "impf") : tense === "pf" ? "pres" : tense === "plupf" ? "impf" : "fut";
    const aux = IRREGULAR_ACTIVE.sum[auxMood]![auxTense as VerbTense]![formIndex(person, number)];
    return [
      { text: participle, role: "stem", label: "perfect passive participle", tone: "tertiary" },
      { text: ` ${aux}`, role: "auxiliary", label: "auxiliary" }
    ];
  }

  if (mood === "indicative") {
    if (tense === "pres") {
      const thematic = presentVowel(entry, person, number);
      if (voice === "passive") return presentPassiveSegments(entry, person, number);
      const personal = activePersonal(person, number, "ō");
      return verbSegments(root, "", thematic, personal);
    }
    if (tense === "impf") {
      return imperfectIndicativeSegments(entry, voice, person, number);
    }
    if (tense === "fut") {
      if (entry.conjugation === "1" || entry.conjugation === "2") {
        return futureFirstSecondSegments(entry, voice, person, number);
      }
      return futureOtherSegments(entry, voice, person, number);
    }
    if (tense === "pf") return verbSegments(perfectStem, "", "", perfectActiveEnding(person, number), { stem: "secondary" });
    if (tense === "plupf") return pluperfectIndicativeActiveSegments(entry, person, number);
    if (tense === "futpf") return futurePerfectIndicativeActiveSegments(entry, person, number);
  }

  if (mood === "subjunctive") {
    if (tense === "pres") {
      return presentSubjunctiveSegments(entry, voice, person, number);
    }
    if (tense === "impf") {
      const infinitiveStem = imperfectSubjunctiveInfinitiveBase(
        voice === "passive" && entry.deponent ? deponentImperfectSubjunctiveInfinitive(entry) : entry.principalParts.infinitive,
        voice,
        person,
        number
      );
      return [
        { text: infinitiveStem, role: "stem", label: "present infinitive stem" },
        { text: voice === "active" ? activeEnding : passiveEnding, role: "personal", label: "personal ending" }
      ];
    }
    if (tense === "pf") {
      const marker = finiteMarkerIsLong(person, number) ? "erī" : "eri";
      return verbSegments(perfectStem, marker, "", activeEnding, { stem: "secondary", tenseMood: "secondary" });
    }
    if (tense === "plupf") return pluperfectSubjunctiveActiveSegments(entry, person, number);
  }

  return [{ text: "—", role: "form", label: "not applicable" }];
}

function deponentImperfectSubjunctiveInfinitive(entry: VerbEntry): string {
  const infinitive = entry.principalParts.infinitive.trim();
  if (entry.conjugation === "1") {
    if (infinitive.endsWith("ārī")) return `${removeEnding(infinitive, ["ārī"])}āre`;
    if (infinitive.endsWith("ari")) return `${removeEnding(infinitive, ["ari"])}are`;
  }
  if (entry.conjugation === "2") {
    if (infinitive.endsWith("ērī")) return `${removeEnding(infinitive, ["ērī"])}ēre`;
    if (infinitive.endsWith("eri")) return `${removeEnding(infinitive, ["eri"])}ere`;
  }
  if (entry.conjugation === "3" || entry.conjugation === "3io") {
    if (infinitive.endsWith("ī")) return `${removeEnding(infinitive, ["ī"])}ere`;
    if (infinitive.endsWith("i")) return `${removeEnding(infinitive, ["i"])}ere`;
  }
  if (entry.conjugation === "4") {
    if (infinitive.endsWith("īrī")) return `${removeEnding(infinitive, ["īrī"])}īre`;
    if (infinitive.endsWith("iri")) return `${removeEnding(infinitive, ["iri"])}ire`;
  }
  return infinitive;
}

function imperfectSubjunctiveInfinitiveBase(infinitive: string, voice: VerbVoice, person: Person, number: LatinNumber): string {
  if (!subjunctiveMarkerIsLong(voice, person, number)) return infinitive;
  if (infinitive.endsWith("e")) return `${infinitive.slice(0, -1)}ē`;
  return infinitive;
}

function perfectActiveEnding(person: Person, number: LatinNumber): string {
  const endings: Record<LatinNumber, Record<Person, string>> = {
    sg: { "1": "ī", "2": "istī", "3": "it" },
    pl: { "1": "imus", "2": "istis", "3": "ērunt" }
  };
  return endings[number][person];
}

function imperfectActiveEnding(person: Person, number: LatinNumber): string {
  const endings: Record<LatinNumber, Record<Person, string>> = {
    sg: { "1": "am", "2": "ās", "3": "at" },
    pl: { "1": "āmus", "2": "ātis", "3": "ant" }
  };
  return endings[number][person];
}

function imperfectPassiveEnding(person: Person, number: LatinNumber): string {
  const endings: Record<LatinNumber, Record<Person, string>> = {
    sg: { "1": "ar", "2": "āris", "3": "ātur" },
    pl: { "1": "āmur", "2": "āminī", "3": "antur" }
  };
  return endings[number][person];
}

function futurePassiveFirstSecondEnding(person: Person, number: LatinNumber): string {
  const endings: Record<LatinNumber, Record<Person, string>> = {
    sg: { "1": "or", "2": "eris", "3": "itur" },
    pl: { "1": "imur", "2": "iminī", "3": "untur" }
  };
  return endings[number][person];
}

function futurePerfectEnding(person: Person, number: LatinNumber): string {
  const endings: Record<LatinNumber, Record<Person, string>> = {
    sg: { "1": "erō", "2": "eris", "3": "erit" },
    pl: { "1": "erimus", "2": "eritis", "3": "erint" }
  };
  return endings[number][person];
}

function finiteTensesForMood(mood: VerbMood): VerbTense[] {
  return mood === "indicative" ? TENSE_ORDER : ["pres", "impf", "pf", "plupf"];
}

function generateVerbSections(entry: VerbEntry, visibility: VisibilitySettings): ChartSection[] {
  const sections: ChartSection[] = [generateFiniteVerbSection(entry, visibility)];

  if (visibility.showImperatives) sections.push(generateVerbFormsList(entry, "imperatives", imperativeForms(entry)));
  if (visibility.showInfinitives) sections.push(generateVerbFormsList(entry, "infinitives", infinitiveForms(entry)));
  if (visibility.showParticiples) sections.push(generateVerbFormsList(entry, "participles", participleForms(entry)));
  return sections;
}

function generateFiniteVerbSection(entry: VerbEntry, visibility: VisibilitySettings): ChartSection {
  const columnSlotOptions = [
    { mood: "indicative", voice: "active", label: "indic. act.", visible: visibility.showIndicativeActive },
    { mood: "indicative", voice: "passive", label: "indic. pass.", visible: visibility.showIndicativePassive },
    { mood: "subjunctive", voice: "active", label: "subj. act.", visible: visibility.showSubjunctiveActive },
    { mood: "subjunctive", voice: "passive", label: "subj. pass.", visible: visibility.showSubjunctivePassive }
  ] satisfies Array<{ mood: VerbMood; voice: VerbVoice; label: string; visible: boolean }>;
  const columnSlots = columnSlotOptions.filter((slot) => slot.visible);

  const personRows = NUMBER_ORDER.flatMap((number) => PERSON_ORDER.map((person) => ({ number, person })));
  const columns = columnSlots.map((slot) => ({
    key: `${slot.mood}-${slot.voice}`,
    label: slot.label,
    entryId: entry.id,
    entryLemma: entry.displayName
  }));

  const rows = TENSE_ORDER.flatMap((tense) =>
    personRows.map(({ number, person }, personIndex) => ({
      key: `${tense}-${number}-${person}`,
      label: TENSE_LABELS[tense],
      subLabel: `${PERSON_LABELS[person]}${NUMBER_LABELS[number]}`,
      labelRowSpan: personIndex === 0 ? personRows.length : undefined,
      cells: columnSlots.map(({ mood, voice }) => {
        const key = overrideCellKey([entry.id, "verb", mood, voice, tense, number, person]);
        const isSubjunctiveFuture = mood === "subjunctive" && !finiteTensesForMood(mood).includes(tense);
        const lacksPassive = voice === "passive" && Boolean(entry.irregularKey) && !irregularHasFinitePassive(entry);
        const lacksActive = voice === "active" && Boolean(entry.deponent);
        const segments =
          isSubjunctiveFuture || lacksPassive || lacksActive
            ? [{ text: "—", role: "form" as const, label: "not applicable" }]
            : regularFiniteSegments(entry, mood, voice, tense, person, number);
        return makeCell(entry, key, { mood, voice, tense, number, person }, segments);
      })
    }))
  );

  return {
    id: `${entry.id}-finite`,
    title: `${entry.displayName} finite`,
    kind: "finite-verb",
    signature: `verb:finite:${columns.map((column) => column.key).join(",")}`,
    columns,
    rows
  };
}

function generateVerbFormsList(entry: VerbEntry, label: string, forms: Array<[string, TextSegment[]]>): ChartSection {
  return {
    id: `${entry.id}-${label}`,
    title: `${entry.displayName} ${label}`,
    kind: "forms-list",
    signature: `verb-list:${label}`,
    columns: [{ key: label, label, entryId: entry.id, entryLemma: entry.displayName }],
    rows: forms.map(([rowLabel, segments]) => {
      const key = overrideCellKey([entry.id, label, rowLabel]);
      return {
        key: rowLabel,
        label: rowLabel,
        cells: [makeCell(entry, key, { form: label, label: rowLabel }, segments)]
      };
    })
  };
}

function imperativeForms(entry: VerbEntry): Array<[string, TextSegment[]]> {
  if (entry.irregularKey === "sum") {
    return [
      ["sg.", [{ text: "es", role: "form", label: "singular imperative" }]],
      ["pl.", [{ text: "este", role: "form", label: "plural imperative" }]]
    ];
  }

  const first = entry.principalParts.first.trim();
  const infinitive = entry.principalParts.infinitive.trim();
  if (first === "dīcō" || first === "dico" || infinitive === "dīcere" || infinitive === "dicere") {
    return [
      ["sg.", [{ text: "dīc", role: "form", label: "singular imperative" }]],
      ["pl.", [{ text: "dīcite", role: "form", label: "plural imperative" }]]
    ];
  }
  if (first === "dūcō" || first === "duco" || infinitive === "dūcere" || infinitive === "ducere") {
    return [
      ["sg.", [{ text: "dūc", role: "form", label: "singular imperative" }]],
      ["pl.", [{ text: "dūcite", role: "form", label: "plural imperative" }]]
    ];
  }
  if (first === "faciō" || first === "facio" || infinitive === "facere") {
    return [
      ["sg.", [{ text: "fac", role: "form", label: "singular imperative" }]],
      ["pl.", [{ text: "facite", role: "form", label: "plural imperative" }]]
    ];
  }
  if (entry.irregularKey === "fero") {
    return [
      ["sg.", [{ text: "fer", role: "form", label: "singular imperative" }]],
      ["pl.", [{ text: "ferte", role: "form", label: "plural imperative" }]]
    ];
  }

  if (entry.deponent) {
    return [
      ["sg.", [{ text: deponentSingularImperative(entry), role: "form", label: "singular imperative" }]],
      ["pl.", [{ text: deponentPluralImperative(entry), role: "form", label: "plural imperative" }]]
    ];
  }

  const singularThematic = entry.conjugation === "1" ? "ā" : entry.conjugation === "2" ? "ē" : entry.conjugation === "4" ? "ī" : "e";
  const pluralSuffix =
    entry.conjugation === "1"
      ? "āte"
      : entry.conjugation === "2"
        ? "ēte"
        : entry.conjugation === "4"
          ? "īte"
          : "ite";
  return [
    ["sg.", verbSegments(entry.presentStem, "", singularThematic, "")],
    ["pl.", [{ text: `${entry.presentStem}${pluralSuffix}`, role: "form", label: "plural imperative" }]]
  ];
}

function infinitiveForms(entry: VerbEntry): Array<[string, TextSegment[]]> {
  const forms: Array<[string, TextSegment[]]> = [[
    "present active",
    infinitiveSegments(entry.principalParts.infinitive, entry.presentStem, "present-system stem", "present active infinitive")
  ]];
  if (!entry.deponent && (!entry.irregularKey || entry.irregularKey === "fero")) {
    forms.push(["present passive", presentPassiveInfinitive(entry)]);
  }
  forms.push([
    "perfect active",
    entry.deponent
      ? infinitiveSegments(`${entry.supineStem}us esse`, entry.supineStem, "supine stem", "perfect active infinitive")
      : infinitiveSegments(`${entry.perfectStem}isse`, entry.perfectStem, "perfect stem", "perfect active infinitive")
  ]);
  forms.push(["future active", infinitiveSegments(`${entry.supineStem}ūrus esse`, entry.supineStem, "supine stem", "future active infinitive")]);
  return forms;
}

function deponentSingularImperative(entry: VerbEntry): string {
  const infinitive = entry.principalParts.infinitive.trim();
  if (entry.conjugation === "1") {
    if (infinitive.endsWith("ārī")) return `${removeEnding(infinitive, ["ārī"])}āre`;
    if (infinitive.endsWith("ari")) return `${removeEnding(infinitive, ["ari"])}are`;
  }
  if (entry.conjugation === "2") {
    if (infinitive.endsWith("ērī")) return `${removeEnding(infinitive, ["ērī"])}ēre`;
    if (infinitive.endsWith("eri")) return `${removeEnding(infinitive, ["eri"])}ere`;
  }
  if (entry.conjugation === "3" || entry.conjugation === "3io") {
    if (infinitive.endsWith("ī")) return `${removeEnding(infinitive, ["ī"])}ere`;
    if (infinitive.endsWith("i")) return `${removeEnding(infinitive, ["i"])}ere`;
  }
  if (entry.conjugation === "4") {
    if (infinitive.endsWith("īrī")) return `${removeEnding(infinitive, ["īrī"])}īre`;
    if (infinitive.endsWith("iri")) return `${removeEnding(infinitive, ["iri"])}ire`;
  }
  return infinitive;
}

function deponentPluralImperative(entry: VerbEntry): string {
  if (entry.conjugation === "1") return `${entry.presentStem}āminī`;
  if (entry.conjugation === "2") return `${entry.presentStem}ēminī`;
  if (entry.conjugation === "4") return `${entry.presentStem}īminī`;
  return `${entry.presentStem}iminī`;
}

function presentPassiveInfinitive(entry: VerbEntry): TextSegment[] {
  if (entry.irregularKey === "fero") return infinitiveSegments("ferrī", entry.presentStem, "present-system stem", "present passive infinitive");
  if (entry.conjugation === "1") return infinitiveSegments(`${entry.presentStem}ārī`, entry.presentStem, "present-system stem", "present passive infinitive");
  if (entry.conjugation === "2") return infinitiveSegments(`${entry.presentStem}ērī`, entry.presentStem, "present-system stem", "present passive infinitive");
  if (entry.conjugation === "3" || entry.conjugation === "3io") return infinitiveSegments(`${entry.presentStem}ī`, entry.presentStem, "present-system stem", "present passive infinitive");
  if (entry.conjugation === "4") return infinitiveSegments(`${entry.presentStem}īrī`, entry.presentStem, "present-system stem", "present passive infinitive");
  return [{ text: "—", role: "form", label: "not applicable" }];
}

function infinitiveSegments(form: string, stem: string, stemLabel: string, formLabel: string): TextSegment[] {
  if (!stem || !form.startsWith(stem)) {
    return [{ text: form, role: "form", label: formLabel }];
  }

  const segments: TextSegment[] = [
    { text: stem, role: "stem", label: stemLabel },
    { text: form.slice(stem.length), role: "form", label: formLabel }
  ];
  return segments.filter((segment) => segment.text.length > 0);
}

function participleForms(entry: VerbEntry): Array<[string, TextSegment[]]> {
  const forms: Array<[string, TextSegment[]]> = [
    ["present active", [{ text: presentActiveParticiple(entry), role: "form", label: "present active participle" }]]
  ];
  if (!entry.deponent) {
    forms.push([
      "perfect passive",
      [
        {
          text: entry.irregularKey === "sum" ? "—" : `${entry.supineStem}us -a -um`,
          role: "form",
          label: "perfect passive participle"
        }
      ]
    ]);
  }
  forms.push(["future active", [{ text: `${entry.supineStem}ūrus -a -um`, role: "form", label: "future active participle" }]]);
  forms.push(["future passive", [{ text: futurePassiveParticiple(entry), role: "form", label: "future passive participle" }]]);
  return forms;
}

function presentActiveParticiple(entry: VerbEntry): string {
  if (entry.irregularKey === "fero") return "ferēns (ferentis)";
  if (entry.conjugation === "1") return `${entry.presentStem}āns (${entry.presentStem}antis)`;
  if (entry.conjugation === "2") return `${entry.presentStem}ēns (${entry.presentStem}entis)`;
  if (entry.conjugation === "3") return `${entry.presentStem}ēns (${entry.presentStem}entis)`;
  if (entry.conjugation === "3io" || entry.conjugation === "4") return `${entry.presentStem}iēns (${entry.presentStem}ientis)`;
  return "—";
}

function futurePassiveParticiple(entry: VerbEntry): string {
  if (entry.irregularKey === "fero") return "ferendus -a -um";
  if (entry.conjugation === "1") return `${entry.presentStem}andus -a -um`;
  if (entry.conjugation === "2") return `${entry.presentStem}endus -a -um`;
  if (entry.conjugation === "3") return `${entry.presentStem}endus -a -um`;
  if (entry.conjugation === "3io" || entry.conjugation === "4") return `${entry.presentStem}iendus -a -um`;
  return "—";
}
