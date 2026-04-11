import type { SegmentRole, StyleRule } from "./types";

const ALLOWED_PROPERTIES = new Set([
  "color",
  "background",
  "background-color",
  "font-weight",
  "font-style",
  "text-decoration",
  "border",
  "border-bottom",
  "padding"
]);

const TARGET_TO_ROLES: Record<StyleRule["target"], SegmentRole[]> = {
  labels: ["label"],
  "case-endings": ["ending"],
  "verb-stems": ["stem"],
  "verb-tense-markers": ["tenseMood"],
  "verb-thematics": ["thematic"],
  "verb-personal-endings": ["personal"]
};

export function sanitizeCssText(cssText: string): { cssText: string; errors: string[] } {
  const errors: string[] = [];
  const safeDeclarations: string[] = [];

  for (const rawDeclaration of cssText.split(";")) {
    const declaration = rawDeclaration.trim();
    if (!declaration) continue;

    const colonIndex = declaration.indexOf(":");
    if (colonIndex === -1) {
      errors.push(`Missing ":" in "${declaration}".`);
      continue;
    }

    const property = declaration.slice(0, colonIndex).trim().toLowerCase();
    const value = declaration.slice(colonIndex + 1).trim();

    if (!ALLOWED_PROPERTIES.has(property)) {
      errors.push(`"${property}" is not an allowed style property.`);
      continue;
    }

    if (/url\s*\(|expression\s*\(|javascript:/i.test(value)) {
      errors.push(`Unsafe value rejected for "${property}".`);
      continue;
    }

    safeDeclarations.push(`${property}: ${value}`);
  }

  return { cssText: safeDeclarations.join("; "), errors };
}

export function styleForRole(role: SegmentRole, rules: StyleRule[]): string | undefined {
  const declarations = rules
    .filter((rule) => rule.enabled !== false)
    .filter((rule) => TARGET_TO_ROLES[rule.target]?.includes(role))
    .map((rule) => sanitizeCssText(rule.cssText).cssText)
    .filter(Boolean);

  return declarations.length ? declarations.join("; ") : undefined;
}

export function styleErrors(rules: StyleRule[]): string[] {
  return rules
    .filter((rule) => rule.enabled !== false)
    .flatMap((rule) => sanitizeCssText(rule.cssText).errors.map((error) => `${rule.name}: ${error}`));
}
