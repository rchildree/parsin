import type { TextSegment } from "./types";

export function uid(prefix = "id"): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function textOf(segments: TextSegment[]): string {
  return segments.map((segment) => segment.text).join("");
}

export function segmentsForStemEnding(stem: string, ending: string, endingLabel: string): TextSegment[] {
  const segments: TextSegment[] = [
    { text: stem, role: "stem", label: "stem" },
    { text: ending, role: "ending", label: endingLabel }
  ];
  return segments.filter((segment) => segment.text.length > 0);
}

export function overrideCellKey(parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join(":");
}

export function stripMacrons(value: string): string {
  return value.normalize("NFD").replace(/[\u0304]/g, "").normalize("NFC");
}

export function removeEnding(value: string, endings: string[]): string {
  for (const ending of endings) {
    if (value.endsWith(ending)) return value.slice(0, -ending.length);
  }
  return value;
}
