import type { Project } from "./types";

export const STORAGE_KEY = "latin-chart-workbench-project";

export function loadProject(fallback: Project): Project {
  if (typeof localStorage === "undefined") return fallback;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return fallback;
    return normalizeProject({ ...fallback, ...JSON.parse(stored) }, fallback);
  } catch {
    return fallback;
  }
}

export function saveProject(project: Project): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
}

export function exportProject(project: Project): string {
  return JSON.stringify(project, null, 2);
}

export function importProject(json: string, fallback: Project): Project {
  const parsed = JSON.parse(json) as Project;
  if (!Array.isArray(parsed.entries) || !Array.isArray(parsed.templates) || !Array.isArray(parsed.styleRules)) {
    throw new Error("Project JSON must include entries, templates, and styleRules arrays.");
  }
  return normalizeProject(parsed, fallback);
}

function normalizeProject(project: Project, fallback: Project): Project {
  const visibility = {
    ...fallback.visibility,
    ...project.visibility,
    cases: project.visibility?.cases || fallback.visibility.cases
  };

  // Merge in any style rule targets missing from stored data (e.g. after adding new targets)
  const existingTargets = new Set(project.styleRules.map((r) => r.target));
  const missingRules = fallback.styleRules.filter((r) => !existingTargets.has(r.target));

  return {
    ...project,
    styleRules: [...project.styleRules, ...missingRules],
    entries: project.entries.map((rawEntry) => {
      const { overrides: _legacyOverrides, ...entry } = rawEntry as typeof rawEntry & { overrides?: Record<string, string> };
      return {
        ...entry,
        visibility: entry.visibility ? { ...entry.visibility } : undefined
      };
    }),
    visibility
  };
}
