import { describe, expect, it } from "vitest";
import { CASE_LABELS, NUMBER_LABELS, PERSON_LABELS, TENSE_LABELS } from "../lib/labels";
import { deriveNounStem, deriveVerbConjugation, deriveVerbStems, displayVerbPresentSystemStem, generateEntrySections, inferDeponentVerb } from "../lib/morphology";
import type { AdjectiveEntry, NounEntry, VerbEntry, VisibilitySettings } from "../lib/types";

const visibility: VisibilitySettings = {
  cases: ["nom", "gen", "dat", "acc", "abl", "voc", "loc"],
  showLocative: true,
  showInfinitives: true,
  showParticiples: true,
  showImperatives: true,
  showIndicativeActive: true,
  showIndicativePassive: true,
  showSubjunctiveActive: true,
  showSubjunctivePassive: true
};

describe("labels", () => {
  it("uses the requested abbreviated defaults", () => {
    expect(CASE_LABELS).toMatchObject({
      nom: "nom.",
      gen: "gen.",
      dat: "dat.",
      acc: "acc.",
      abl: "abl.",
      voc: "voc.",
      loc: "loc."
    });
    expect(NUMBER_LABELS).toEqual({ sg: "sg.", pl: "pl." });
    expect(PERSON_LABELS).toEqual({ "1": "1", "2": "2", "3": "3" });
    expect(TENSE_LABELS).toMatchObject({
      pres: "pres.",
      impf: "impf.",
      fut: "fut.",
      pf: "pf.",
      plupf: "plupf.",
      futpf: "fut. pf."
    });
  });
});

describe("noun generation", () => {
  it("generates second-declension grouped forms and optional locative", () => {
    const entry: NounEntry = {
      id: "servus",
      pos: "noun",
      lemma: "servus",
      displayName: "servus",
      declension: "2",
      gender: "m",
      nominative: "servus",
      genitive: "servī",
      stem: deriveNounStem("2", "servī")
    };

    const section = generateEntrySections(entry, visibility)[0];
    expect(section.rows.map((row) => row.label)).toContain("loc.sg.");
    expect(section.rows.map((row) => row.label).slice(0, 3)).toEqual(["nom.sg.", "gen.sg.", "dat.sg."]);
    expect(section.rows.find((row) => row.key === "gen-sg")?.cells[0].displayText).toBe("servī");
    expect(section.rows.find((row) => row.key === "voc-sg")?.cells[0].displayText).toBe("serve");
    expect(section.rows.find((row) => row.key === "nom-pl")?.label).toBe("nom.pl.");
  });

  it("preserves supplied macrons", () => {
    expect(deriveNounStem("2", "dōnī")).toBe("dōn");
  });
});

describe("adjective generation", () => {
  it("creates nominative and vocative singular forms for positive adjectives", () => {
    const entry: AdjectiveEntry = {
      id: "bonus",
      pos: "adjective",
      lemma: "bonus",
      displayName: "bonus",
      adjectiveClass: "1-2",
      nominative: "bonus",
      feminineForm: "bona",
      neuterForm: "bonum",
      genitive: "bonī",
      stem: "bon",
      comparativeStem: "",
      superlativeStem: "",
      degrees: ["positive"]
    };

    const section = generateEntrySections(entry, visibility)[0];
    const nomSg = section.rows.find((row) => row.key === "positive-nom-sg");
    const vocSg = section.rows.find((row) => row.key === "positive-voc-sg");
    expect(nomSg?.cells[0].displayText).toBe("bonus");
    expect(nomSg?.cells[1].displayText).toBe("bona");
    expect(nomSg?.cells[2].displayText).toBe("bonum");
    expect(vocSg?.cells[0].displayText).toBe("bone");
    expect(vocSg?.cells[1].displayText).toBe("bona");
    expect(vocSg?.cells[2].displayText).toBe("bonum");
  });

  it("collapses masculine and feminine adjective columns when forms match", () => {
    const entry: AdjectiveEntry = {
      id: "fortis",
      pos: "adjective",
      lemma: "fortis",
      displayName: "fortis",
      adjectiveClass: "3",
      nominative: "fortis",
      feminineForm: "",
      neuterForm: "forte",
      genitive: "fortis",
      stem: "fort",
      comparativeStem: "",
      superlativeStem: "",
      degrees: ["positive"]
    };

    const section = generateEntrySections(entry, visibility)[0];
    expect(section.columns.map((column) => column.label)).toEqual(["M./F.", "N."]);
    expect(section.rows.find((row) => row.key === "positive-nom-sg")?.cells[0].displayText).toBe("fortis");
    expect(section.rows.find((row) => row.key === "positive-nom-sg")?.cells[1].displayText).toBe("forte");
  });

  it("supports pronominal-declension adjectives", () => {
    const solus: AdjectiveEntry = {
      id: "solus",
      pos: "adjective",
      lemma: "sōlus",
      displayName: "sōlus",
      adjectiveClass: "1-2",
      pronominal: true,
      nominative: "sōlus",
      feminineForm: "sōla",
      neuterForm: "sōlum",
      genitive: "sōlīus",
      stem: "sōl",
      comparativeStem: "",
      superlativeStem: "",
      degrees: ["positive"]
    };

    const solusSection = generateEntrySections(solus, visibility)[0];
    expect(solusSection.rows.find((row) => row.key === "positive-gen-sg")?.cells[0].displayText).toBe("sōlīus");
    expect(solusSection.rows.find((row) => row.key === "positive-gen-sg")?.cells[1].displayText).toBe("sōlīus");
    expect(solusSection.rows.find((row) => row.key === "positive-dat-sg")?.cells[2].displayText).toBe("sōlī");

    const alius: AdjectiveEntry = {
      id: "alius",
      pos: "adjective",
      lemma: "alius",
      displayName: "alius",
      adjectiveClass: "1-2",
      pronominal: true,
      nominative: "alius",
      feminineForm: "alia",
      neuterForm: "",
      genitive: "alīus",
      stem: "ali",
      comparativeStem: "",
      superlativeStem: "",
      degrees: ["positive"]
    };

    const aliusSection = generateEntrySections(alius, visibility)[0];
    expect(aliusSection.rows.find((row) => row.key === "positive-nom-sg")?.cells[2].displayText).toBe("aliud");
    expect(aliusSection.rows.find((row) => row.key === "positive-gen-sg")?.cells[0].displayText).toBe("alīus");
  });
});

describe("verb generation", () => {
  it("displays pedagogical present-system stems without changing engine stems", () => {
    expect(displayVerbPresentSystemStem({ conjugation: "1", presentStem: "am" })).toBe("amā");
    expect(displayVerbPresentSystemStem({ conjugation: "2", presentStem: "hab" })).toBe("habē");
    expect(displayVerbPresentSystemStem({ conjugation: "3", presentStem: "ag" })).toBe("ag(e/o)");
    expect(displayVerbPresentSystemStem({ conjugation: "3io", presentStem: "cap" })).toBe("capi");
    expect(displayVerbPresentSystemStem({ conjugation: "4", presentStem: "aud" })).toBe("audī");
    expect(displayVerbPresentSystemStem({ conjugation: "irregular", presentStem: "s" })).toBe("s");
  });

  it("infers deponent conjugations and present-system displays", () => {
    const first = { first: "hortor", infinitive: "hortārī", perfect: "hortātus sum", supine: "hortātus" };
    const second = { first: "vereor", infinitive: "verērī", perfect: "veritus sum", supine: "veritus" };
    const third = { first: "loquor", infinitive: "loquī", perfect: "locūtus sum", supine: "locūtus" };
    const thirdIo = { first: "patior", infinitive: "patī", perfect: "passus sum", supine: "passus" };
    const fourth = { first: "audior", infinitive: "audīrī", perfect: "audītus sum", supine: "audītus" };

    expect(deriveVerbConjugation(first.infinitive, first.first)).toBe("1");
    expect(deriveVerbConjugation(second.infinitive, second.first)).toBe("2");
    expect(deriveVerbConjugation(third.infinitive, third.first)).toBe("3");
    expect(deriveVerbConjugation(thirdIo.infinitive, thirdIo.first)).toBe("3io");
    expect(deriveVerbConjugation(fourth.infinitive, fourth.first)).toBe("4");

    expect(inferDeponentVerb(first)).toBe(true);
    expect(inferDeponentVerb(second)).toBe(true);
    expect(inferDeponentVerb(third)).toBe(true);
    expect(inferDeponentVerb(thirdIo)).toBe(true);
    expect(inferDeponentVerb(fourth)).toBe(true);
    expect(inferDeponentVerb({ first: "amō", infinitive: "amāre", perfect: "amāvī", supine: "amātum" })).toBe(false);

    expect(displayVerbPresentSystemStem({ conjugation: "1", ...deriveVerbStems("1", first) })).toBe("hortā");
    expect(displayVerbPresentSystemStem({ conjugation: "2", ...deriveVerbStems("2", second) })).toBe("verē");
    expect(displayVerbPresentSystemStem({ conjugation: "3", ...deriveVerbStems("3", third) })).toBe("loqu(e/o)");
    expect(displayVerbPresentSystemStem({ conjugation: "3io", ...deriveVerbStems("3io", thirdIo) })).toBe("pati");
    expect(displayVerbPresentSystemStem({ conjugation: "4", ...deriveVerbStems("4", fourth) })).toBe("audī");
  });

  it("builds deponent imperfect subjunctive passive from the corrected infinitive base", () => {
    const firstDep: VerbEntry = {
      id: "hortor",
      pos: "verb",
      lemma: "hortor",
      displayName: "hortor",
      conjugation: "1",
      principalParts: { first: "hortor", infinitive: "hortārī", perfect: "hortātus sum", supine: "hortātus" },
      ...deriveVerbStems("1", { first: "hortor", infinitive: "hortārī", perfect: "hortātus sum", supine: "hortātus" }),
      deponent: true
    };
    const thirdDep: VerbEntry = {
      id: "loquor",
      pos: "verb",
      lemma: "loquor",
      displayName: "loquor",
      conjugation: "3",
      principalParts: { first: "loquor", infinitive: "loquī", perfect: "locūtus sum", supine: "locūtus" },
      ...deriveVerbStems("3", { first: "loquor", infinitive: "loquī", perfect: "locūtus sum", supine: "locūtus" }),
      deponent: true
    };

    const firstFinite = generateEntrySections(firstDep, visibility).find((section) => section.signature.startsWith("verb:finite"));
    const thirdFinite = generateEntrySections(thirdDep, visibility).find((section) => section.signature.startsWith("verb:finite"));

    expect(firstFinite?.rows.find((row) => row.key === "impf-sg-1")?.cells[3].displayText).toBe("hortārer");
    expect(firstFinite?.rows.find((row) => row.key === "impf-pl-2")?.cells[3].displayText).toBe("hortārēminī");
    expect(firstFinite?.rows.find((row) => row.key === "impf-sg-3")?.cells[3].displayText).toBe("hortārētur");
    expect(thirdFinite?.rows.find((row) => row.key === "impf-sg-1")?.cells[3].displayText).toBe("loquerer");
    expect(thirdFinite?.rows.find((row) => row.key === "impf-pl-1")?.cells[3].displayText).toBe("loquerēmur");
  });

  it("builds deponent infinitives and imperatives with passive morphology", () => {
    const entry: VerbEntry = {
      id: "hortor",
      pos: "verb",
      lemma: "hortor",
      displayName: "hortor",
      conjugation: "1",
      principalParts: { first: "hortor", infinitive: "hortārī", perfect: "hortātus sum", supine: "hortātus" },
      ...deriveVerbStems("1", { first: "hortor", infinitive: "hortārī", perfect: "hortātus sum", supine: "hortātus" }),
      deponent: true
    };

    const sections = generateEntrySections(entry, visibility);
    const infinitives = sections.find((section) => section.title.includes("infinitives"));
    const imperatives = sections.find((section) => section.title.includes("imperatives"));

    expect(infinitives?.rows.find((row) => row.key === "present active")?.cells[0].displayText).toBe("hortārī");
    expect(infinitives?.rows.find((row) => row.key === "present passive")).toBeUndefined();
    expect(infinitives?.rows.find((row) => row.key === "perfect active")?.cells[0].displayText).toBe("hortātus esse");
    expect(imperatives?.rows.find((row) => row.key === "sg.")?.cells[0].displayText).toBe("hortāre");
    expect(imperatives?.rows.find((row) => row.key === "pl.")?.cells[0].displayText).toBe("hortāminī");
  });

  it("generates regular finite forms with segment metadata", () => {
    const principalParts = { first: "amō", infinitive: "amāre", perfect: "amāvī", supine: "amātum" };
    const stems = deriveVerbStems("1", principalParts);
    const entry: VerbEntry = {
      id: "amo",
      pos: "verb",
      lemma: "amō",
      displayName: "amō",
      conjugation: "1",
      principalParts,
      ...stems
    };

    const finite = generateEntrySections(entry, visibility).find((section) => section.signature.startsWith("verb:finite"));
    expect(finite?.columns.map((column) => column.label)).toEqual(["indic. act.", "indic. pass.", "subj. act.", "subj. pass."]);
    expect(finite?.rows.find((row) => row.key === "pres-sg-1")?.cells[0].displayText).toBe("amō");
    expect(finite?.rows.find((row) => row.key === "pres-sg-1")?.labelRowSpan).toBe(6);
    expect(finite?.rows.find((row) => row.key === "pres-sg-2")?.labelRowSpan).toBeUndefined();
    expect(finite?.rows.find((row) => row.key === "impf-sg-1")?.cells[0].segments.map((segment) => segment.role)).toContain("tenseMood");
    expect(finite?.rows.find((row) => row.key === "fut-pl-3")?.cells[0].displayText).toBe("amābunt");
    expect(finite?.rows.find((row) => row.key === "subjunctive")).toBeUndefined();
    expect(finite?.rows.find((row) => row.key === "pres-sg-1")?.cells[2].segments.find((segment) => segment.role === "tenseMood")?.tone).toBe("secondary");
    expect(finite?.rows.find((row) => row.key === "impf-sg-1")?.cells[0].segments.find((segment) => segment.role === "tenseMood")?.text).toBe("ba");
    expect(finite?.rows.find((row) => row.key === "impf-sg-2")?.cells[2].displayText).toBe("amārēs");
    expect(finite?.rows.find((row) => row.key === "impf-pl-2")?.cells[3].displayText).toBe("amārēminī");
    expect(finite?.rows.find((row) => row.key === "impf-pl-3")?.cells[2].displayText).toBe("amārent");
    expect(finite?.rows.find((row) => row.key === "fut-sg-1")?.cells[0].segments.find((segment) => segment.role === "tenseMood")?.text).toBe("b");
    expect(finite?.rows.find((row) => row.key === "fut-sg-1")?.cells[0].segments.find((segment) => segment.role === "personal")?.text).toBe("ō");
    expect(finite?.rows.find((row) => row.key === "fut-sg-1")?.cells[1].segments.find((segment) => segment.role === "tenseMood")?.text).toBe("bo");
    expect(finite?.rows.find((row) => row.key === "fut-sg-1")?.cells[1].segments.find((segment) => segment.role === "personal")?.text).toBe("r");
    expect(finite?.rows.find((row) => row.key === "fut-pl-3")?.cells[0].segments.find((segment) => segment.role === "tenseMood")?.text).toBe("bu");
    expect(finite?.rows.find((row) => row.key === "pf-sg-2")?.cells[0].segments.find((segment) => segment.role === "personal")?.text).toBe("istī");
    expect(finite?.rows.find((row) => row.key === "pf-sg-1")?.cells[2].segments.find((segment) => segment.role === "tenseMood")?.text).toBe("eri");
    expect(finite?.rows.find((row) => row.key === "plupf-sg-1")?.cells[0].segments.find((segment) => segment.role === "tenseMood")?.text).toBe("era");
    expect(finite?.rows.find((row) => row.key === "plupf-sg-1")?.cells[0].segments.find((segment) => segment.role === "personal")?.text).toBe("m");
    expect(finite?.rows.find((row) => row.key === "plupf-sg-1")?.cells[2].displayText).toBe("amāvissem");
    expect(finite?.rows.find((row) => row.key === "futpf-sg-1")?.cells[0].segments.find((segment) => segment.role === "tenseMood")?.text).toBe("er");
    expect(finite?.rows.find((row) => row.key === "futpf-sg-1")?.cells[0].segments.find((segment) => segment.role === "personal")?.text).toBe("ō");
  });

  it("accepts either -um or -us for the fourth principal part", () => {
    expect(deriveVerbStems("1", { first: "amō", infinitive: "amāre", perfect: "amāvī", supine: "amātum" }).supineStem).toBe("amāt");
    expect(deriveVerbStems("1", { first: "amō", infinitive: "amāre", perfect: "amāvī", supine: "amātus" }).supineStem).toBe("amāt");
  });

  it("still builds charts from the internal present stem", () => {
    const entry: VerbEntry = {
      id: "custom",
      pos: "verb",
      lemma: "custom",
      displayName: "custom",
      conjugation: "3",
      principalParts: { first: "agō", infinitive: "agere", perfect: "ēgī", supine: "āctum" },
      presentStem: "xyz",
      perfectStem: "ēg",
      supineStem: "āct"
    };

    const finite = generateEntrySections(entry, visibility).find((section) => section.signature.startsWith("verb:finite"));
    expect(displayVerbPresentSystemStem(entry)).toBe("xyz(e/o)");
    expect(finite?.rows.find((row) => row.key === "pres-sg-1")?.cells[0].displayText).toBe("xyzō");
  });

  it("only marks the exclusive personal-ending list as personal", () => {
    const principalParts = { first: "amō", infinitive: "amāre", perfect: "amāvī", supine: "amātum" };
    const entry: VerbEntry = {
      id: "amo",
      pos: "verb",
      lemma: "amō",
      displayName: "amō",
      conjugation: "1",
      principalParts,
      ...deriveVerbStems("1", principalParts)
    };
    const finite = generateEntrySections(entry, visibility).find((section) => section.signature.startsWith("verb:finite"));
    const futureFirst = finite?.rows.find((row) => row.key === "fut-sg-1")?.cells[0];
    const futurePlural = finite?.rows.find((row) => row.key === "fut-pl-3")?.cells[0];

    expect(futureFirst?.displayText).toBe("amābō");
    expect(futureFirst?.segments.find((segment) => segment.role === "personal")?.text).toBe("ō");
    expect(futurePlural?.displayText).toBe("amābunt");
    expect(futurePlural?.segments.find((segment) => segment.text === "nt")?.role).toBe("personal");
  });

  it("generates present passives and passive infinitives correctly", () => {
    const amoParts = { first: "amō", infinitive: "amāre", perfect: "amāvī", supine: "amātum" };
    const amo: VerbEntry = {
      id: "amo",
      pos: "verb",
      lemma: "amō",
      displayName: "amō",
      conjugation: "1",
      principalParts: amoParts,
      ...deriveVerbStems("1", amoParts)
    };
    const agoParts = { first: "agō", infinitive: "agere", perfect: "ēgī", supine: "āctum" };
    const ago: VerbEntry = {
      id: "ago",
      pos: "verb",
      lemma: "agō",
      displayName: "agō",
      conjugation: "3",
      principalParts: agoParts,
      ...deriveVerbStems("3", agoParts)
    };

    const amoSections = generateEntrySections(amo, visibility);
    const amoFinite = amoSections.find((section) => section.signature.startsWith("verb:finite"));
    expect(amoFinite?.rows.find((row) => row.key === "pres-sg-1")?.cells[1].displayText).toBe("amor");
    expect(amoFinite?.rows.find((row) => row.key === "pres-sg-1")?.cells[1].segments.find((segment) => segment.role === "personal")?.text).toBe("r");
    expect(amoFinite?.rows.find((row) => row.key === "pres-sg-3")?.cells[1].displayText).toBe("amātur");
    expect(amoSections.find((section) => section.title.includes("infinitives"))?.rows.find((row) => row.key === "present passive")?.cells[0].displayText).toBe("amārī");

    const agoSections = generateEntrySections(ago, visibility);
    const agoFinite = agoSections.find((section) => section.signature.startsWith("verb:finite"));
    expect(agoFinite?.rows.find((row) => row.key === "pres-sg-1")?.cells[1].displayText).toBe("agor");
    expect(agoFinite?.rows.find((row) => row.key === "pres-sg-3")?.cells[1].displayText).toBe("agitur");
    expect(agoSections.find((section) => section.title.includes("infinitives"))?.rows.find((row) => row.key === "present passive")?.cells[0].displayText).toBe("agī");
  });

  it("does not mark passive compound auxiliaries as tense markers", () => {
    const principalParts = { first: "amō", infinitive: "amāre", perfect: "amāvī", supine: "amātum" };
    const entry: VerbEntry = {
      id: "amo",
      pos: "verb",
      lemma: "amō",
      displayName: "amō",
      conjugation: "1",
      principalParts,
      ...deriveVerbStems("1", principalParts)
    };

    const finite = generateEntrySections(entry, visibility).find((section) => section.signature.startsWith("verb:finite"));
    const perfectPassiveIndic = finite?.rows.find((row) => row.key === "pf-sg-1")?.cells[1];
    const pluperfectPassiveIndic = finite?.rows.find((row) => row.key === "plupf-sg-1")?.cells[1];
    const futurePerfectPassiveIndic = finite?.rows.find((row) => row.key === "futpf-sg-1")?.cells[1];
    const perfectPassiveSubj = finite?.rows.find((row) => row.key === "pf-sg-1")?.cells[3];
    const pluperfectPassiveSubj = finite?.rows.find((row) => row.key === "plupf-sg-1")?.cells[3];

    expect(perfectPassiveIndic?.displayText).toBe("amātus sum");
    expect(perfectPassiveIndic?.segments.find((segment) => segment.role === "auxiliary")?.text).toBe(" sum");
    expect(perfectPassiveIndic?.segments.some((segment) => segment.role === "tenseMood")).toBe(false);

    expect(pluperfectPassiveIndic?.displayText).toBe("amātus eram");
    expect(pluperfectPassiveIndic?.segments.find((segment) => segment.role === "auxiliary")?.text).toBe(" eram");
    expect(pluperfectPassiveIndic?.segments.some((segment) => segment.role === "tenseMood")).toBe(false);

    expect(futurePerfectPassiveIndic?.displayText).toBe("amātus erō");
    expect(futurePerfectPassiveIndic?.segments.find((segment) => segment.role === "auxiliary")?.text).toBe(" erō");
    expect(futurePerfectPassiveIndic?.segments.some((segment) => segment.role === "tenseMood")).toBe(false);

    expect(perfectPassiveSubj?.displayText).toBe("amātus sim");
    expect(perfectPassiveSubj?.segments.find((segment) => segment.role === "auxiliary")?.text).toBe(" sim");
    expect(perfectPassiveSubj?.segments.some((segment) => segment.role === "tenseMood")).toBe(false);

    expect(pluperfectPassiveSubj?.displayText).toBe("amātus essem");
    expect(pluperfectPassiveSubj?.segments.find((segment) => segment.role === "auxiliary")?.text).toBe(" essem");
    expect(pluperfectPassiveSubj?.segments.some((segment) => segment.role === "tenseMood")).toBe(false);
  });

  it("generates correct imperfect indicatives for 3io and 4th conjugation verbs", () => {
    const capioParts = { first: "capiō", infinitive: "capere", perfect: "cēpī", supine: "captum" };
    const capio: VerbEntry = {
      id: "capio",
      pos: "verb",
      lemma: "capiō",
      displayName: "capiō",
      conjugation: "3io",
      principalParts: capioParts,
      ...deriveVerbStems("3io", capioParts)
    };
    const audioParts = { first: "audiō", infinitive: "audīre", perfect: "audīvī", supine: "audītum" };
    const audio: VerbEntry = {
      id: "audio",
      pos: "verb",
      lemma: "audiō",
      displayName: "audiō",
      conjugation: "4",
      principalParts: audioParts,
      ...deriveVerbStems("4", audioParts)
    };

    const capioFinite = generateEntrySections(capio, visibility).find((section) => section.signature.startsWith("verb:finite"));
    expect(capioFinite?.rows.find((row) => row.key === "impf-sg-1")?.cells[0].displayText).toBe("capiēbam");
    expect(capioFinite?.rows.find((row) => row.key === "impf-sg-1")?.cells[1].displayText).toBe("capiēbar");

    const audioFinite = generateEntrySections(audio, visibility).find((section) => section.signature.startsWith("verb:finite"));
    expect(audioFinite?.rows.find((row) => row.key === "impf-sg-1")?.cells[0].displayText).toBe("audiēbam");
    expect(audioFinite?.rows.find((row) => row.key === "impf-sg-1")?.cells[1].displayText).toBe("audiēbar");
  });

  it("renders participles in dictionary-style strings including future passive", () => {
    const principalParts = { first: "amō", infinitive: "amāre", perfect: "amāvī", supine: "amātum" };
    const entry: VerbEntry = {
      id: "amo",
      pos: "verb",
      lemma: "amō",
      displayName: "amō",
      conjugation: "1",
      principalParts,
      ...deriveVerbStems("1", principalParts)
    };

    const participles = generateEntrySections(entry, visibility).find((section) => section.title.includes("participles"));
    expect(participles?.rows.find((row) => row.key === "present active")?.cells[0].displayText).toBe("amāns (amantis)");
    expect(participles?.rows.find((row) => row.key === "perfect passive")?.cells[0].displayText).toBe("amātus -a -um");
    expect(participles?.rows.find((row) => row.key === "future active")?.cells[0].displayText).toBe("amātūrus -a -um");
    expect(participles?.rows.find((row) => row.key === "future passive")?.cells[0].displayText).toBe("amandus -a -um");
  });

  it("uses special short imperatives for dico, duco, facio, and fero", () => {
    const entries: VerbEntry[] = [
      {
        id: "dico",
        pos: "verb",
        lemma: "dīcō",
        displayName: "dīcō",
        conjugation: "3",
        principalParts: { first: "dīcō", infinitive: "dīcere", perfect: "dīxī", supine: "dictum" },
        ...deriveVerbStems("3", { first: "dīcō", infinitive: "dīcere", perfect: "dīxī", supine: "dictum" })
      },
      {
        id: "duco",
        pos: "verb",
        lemma: "dūcō",
        displayName: "dūcō",
        conjugation: "3",
        principalParts: { first: "dūcō", infinitive: "dūcere", perfect: "dūxī", supine: "ductum" },
        ...deriveVerbStems("3", { first: "dūcō", infinitive: "dūcere", perfect: "dūxī", supine: "ductum" })
      },
      {
        id: "facio",
        pos: "verb",
        lemma: "faciō",
        displayName: "faciō",
        conjugation: "3io",
        principalParts: { first: "faciō", infinitive: "facere", perfect: "fēcī", supine: "factum" },
        ...deriveVerbStems("3io", { first: "faciō", infinitive: "facere", perfect: "fēcī", supine: "factum" })
      },
      {
        id: "fero",
        pos: "verb",
        lemma: "ferō",
        displayName: "ferō",
        conjugation: "irregular",
        principalParts: { first: "ferō", infinitive: "ferre", perfect: "tulī", supine: "lātum" },
        presentStem: "fer",
        perfectStem: "tul",
        supineStem: "lāt",
        irregularKey: "fero"
      }
    ];

    const forms = entries.map((entry) => ({
      id: entry.id,
      imperatives: generateEntrySections(entry, visibility).find((section) => section.title.includes("imperatives"))
    }));

    expect(forms.find((item) => item.id === "dico")?.imperatives?.rows[0].cells[0].displayText).toBe("dīc");
    expect(forms.find((item) => item.id === "dico")?.imperatives?.rows[1].cells[0].displayText).toBe("dīcite");
    expect(forms.find((item) => item.id === "duco")?.imperatives?.rows[0].cells[0].displayText).toBe("dūc");
    expect(forms.find((item) => item.id === "duco")?.imperatives?.rows[1].cells[0].displayText).toBe("dūcite");
    expect(forms.find((item) => item.id === "facio")?.imperatives?.rows[0].cells[0].displayText).toBe("fac");
    expect(forms.find((item) => item.id === "facio")?.imperatives?.rows[1].cells[0].displayText).toBe("facite");
    expect(forms.find((item) => item.id === "fero")?.imperatives?.rows[0].cells[0].displayText).toBe("fer");
    expect(forms.find((item) => item.id === "fero")?.imperatives?.rows[1].cells[0].displayText).toBe("ferte");
  });

  it("builds regular plural imperatives correctly, including 4th conjugation", () => {
    const amoParts = { first: "amō", infinitive: "amāre", perfect: "amāvī", supine: "amātum" };
    const moneoParts = { first: "moneō", infinitive: "monēre", perfect: "monuī", supine: "monitum" };
    const audioParts = { first: "audiō", infinitive: "audīre", perfect: "audīvī", supine: "audītum" };

    const entries: VerbEntry[] = [
      {
        id: "amo",
        pos: "verb",
        lemma: "amō",
        displayName: "amō",
        conjugation: "1",
        principalParts: amoParts,
        ...deriveVerbStems("1", amoParts)
      },
      {
        id: "moneo",
        pos: "verb",
        lemma: "moneō",
        displayName: "moneō",
        conjugation: "2",
        principalParts: moneoParts,
        ...deriveVerbStems("2", moneoParts)
      },
      {
        id: "audio",
        pos: "verb",
        lemma: "audiō",
        displayName: "audiō",
        conjugation: "4",
        principalParts: audioParts,
        ...deriveVerbStems("4", audioParts)
      }
    ];

    const forms = entries.map((entry) => ({
      id: entry.id,
      imperatives: generateEntrySections(entry, visibility).find((section) => section.title.includes("imperatives"))
    }));

    expect(forms.find((item) => item.id === "amo")?.imperatives?.rows[1].cells[0].displayText).toBe("amāte");
    expect(forms.find((item) => item.id === "moneo")?.imperatives?.rows[1].cells[0].displayText).toBe("monēte");
    expect(forms.find((item) => item.id === "audio")?.imperatives?.rows[1].cells[0].displayText).toBe("audīte");
  });

  it("uses hard-coded irregular forms", () => {
    const entry: VerbEntry = {
      id: "sum",
      pos: "verb",
      lemma: "sum",
      displayName: "sum",
      conjugation: "irregular",
      principalParts: { first: "sum", infinitive: "esse", perfect: "fuī", supine: "futūrum" },
      presentStem: "s",
      perfectStem: "fu",
      supineStem: "futūr",
      irregularKey: "sum"
    };
    const finite = generateEntrySections(entry, visibility).find((section) => section.signature.startsWith("verb:finite"));
    expect(finite?.rows.find((row) => row.key === "pres-sg-3")?.cells[0].displayText).toBe("est");
    expect(finite?.rows.find((row) => row.key === "pres-sg-3")?.cells[0].segments.find((segment) => segment.role === "personal")?.text).toBe("t");
    expect(finite?.rows.find((row) => row.key === "pf-pl-3")?.cells[0].segments.find((segment) => segment.role === "personal")?.text).toBe("ērunt");
    expect(finite?.rows.find((row) => row.key === "pf-sg-3")?.cells[2].segments.find((segment) => segment.role === "tenseMood")?.text).toBe("eri");
    expect(finite?.rows.find((row) => row.key === "pf-sg-3")?.cells[2].segments.find((segment) => segment.role === "personal")?.text).toBe("t");
    expect(finite?.rows.find((row) => row.key === "futpf-sg-2")?.cells[0].segments.find((segment) => segment.role === "tenseMood")?.text).toBe("eri");
    expect(finite?.rows.find((row) => row.key === "futpf-sg-2")?.cells[0].segments.find((segment) => segment.role === "personal")?.text).toBe("s");
    expect(finite?.rows.find((row) => row.key === "fut-sg-2")?.cells[0].segments.find((segment) => segment.role === "personal")?.text).toBe("s");
    expect(finite?.rows.find((row) => row.key === "fut-pl-3")?.cells[0].segments.find((segment) => segment.role === "personal")?.text).toBe("nt");
    const participles = generateEntrySections(entry, visibility).find((section) => section.title.includes("participles"));
    expect(participles?.rows.find((row) => row.key === "perfect passive")?.cells[0].displayText).toBe("—");
  });

  it("applies full highlighting to non-sum irregular active systems", () => {
    const entry: VerbEntry = {
      id: "fero",
      pos: "verb",
      lemma: "ferō",
      displayName: "ferō",
      conjugation: "irregular",
      principalParts: { first: "ferō", infinitive: "ferre", perfect: "tulī", supine: "lātum" },
      presentStem: "fer",
      perfectStem: "tul",
      supineStem: "lāt",
      irregularKey: "fero"
    };

    const finite = generateEntrySections(entry, visibility).find((section) => section.signature.startsWith("verb:finite"));
    expect(finite?.rows.find((row) => row.key === "impf-sg-1")?.cells[0].segments.find((segment) => segment.role === "tenseMood")?.text).toBe("ba");
    expect(finite?.rows.find((row) => row.key === "fut-sg-2")?.cells[0].segments.find((segment) => segment.role === "tenseMood")?.text).toBe("ē");
    expect(finite?.rows.find((row) => row.key === "fut-sg-2")?.cells[0].segments.find((segment) => segment.role === "personal")?.text).toBe("s");
    expect(finite?.rows.find((row) => row.key === "fut-sg-3")?.cells[0].segments.find((segment) => segment.role === "tenseMood")?.text).toBe("e");
    expect(finite?.rows.find((row) => row.key === "fut-sg-3")?.cells[0].segments.find((segment) => segment.role === "personal")?.text).toBe("t");
    expect(finite?.rows.find((row) => row.key === "pres-sg-2")?.cells[2].segments.find((segment) => segment.role === "tenseMood")?.text).toBe("ā");
    expect(finite?.rows.find((row) => row.key === "pres-sg-3")?.cells[2].segments.find((segment) => segment.role === "tenseMood")?.text).toBe("a");
    expect(finite?.rows.find((row) => row.key === "pres-sg-3")?.cells[2].segments.find((segment) => segment.role === "personal")?.text).toBe("t");
    expect(finite?.rows.find((row) => row.key === "pf-sg-2")?.cells[0].segments.find((segment) => segment.role === "stem")?.tone).toBe("secondary");
    expect(finite?.rows.find((row) => row.key === "pf-sg-3")?.cells[2].segments.find((segment) => segment.role === "tenseMood")?.text).toBe("eri");
  });

  it("generates passive forms for fero", () => {
    const entry: VerbEntry = {
      id: "fero",
      pos: "verb",
      lemma: "ferō",
      displayName: "ferō",
      conjugation: "irregular",
      principalParts: { first: "ferō", infinitive: "ferre", perfect: "tulī", supine: "lātum" },
      presentStem: "fer",
      perfectStem: "tul",
      supineStem: "lāt",
      irregularKey: "fero"
    };

    const sections = generateEntrySections(entry, visibility);
    const finite = sections.find((section) => section.signature.startsWith("verb:finite"));
    expect(finite?.rows.find((row) => row.key === "pres-sg-1")?.cells[1].displayText).toBe("feror");
    expect(finite?.rows.find((row) => row.key === "pres-sg-2")?.cells[1].displayText).toBe("ferris");
    expect(finite?.rows.find((row) => row.key === "fut-sg-2")?.cells[1].segments.find((segment) => segment.role === "tenseMood")?.text).toBe("ē");
    expect(finite?.rows.find((row) => row.key === "pf-sg-1")?.cells[1].displayText).toBe("lātus sum");
    expect(finite?.rows.find((row) => row.key === "pf-sg-1")?.cells[1].segments.find((segment) => segment.role === "auxiliary")?.text).toBe(" sum");
    expect(finite?.rows.find((row) => row.key === "pf-sg-1")?.cells[1].segments.some((segment) => segment.role === "tenseMood")).toBe(false);

    const infinitives = sections.find((section) => section.title.includes("infinitives"));
    expect(infinitives?.rows.find((row) => row.key === "present passive")?.cells[0].displayText).toBe("ferrī");

    const participles = sections.find((section) => section.title.includes("participles"));
    expect(participles?.rows.find((row) => row.key === "present active")?.cells[0].displayText).toBe("ferēns (ferentis)");
    expect(participles?.rows.find((row) => row.key === "future passive")?.cells[0].displayText).toBe("ferendus -a -um");
  });
});
