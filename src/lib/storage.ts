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

export function importProject(json: string): Project {
  const parsed = JSON.parse(json) as Project;
  if (!Array.isArray(parsed.entries) || !Array.isArray(parsed.templates) || !Array.isArray(parsed.styleRules)) {
    throw new Error("Project JSON must include entries, templates, and styleRules arrays.");
  }
  return parsed;
}

function normalizeProject(project: Project, fallback: Project): Project {
  const visibility = {
    ...fallback.visibility,
    ...project.visibility,
    cases: project.visibility?.cases || fallback.visibility.cases
  };

  return {
    ...project,
    entries: project.entries.map((entry) => ({
      ...entry,
      visibility: entry.visibility ? { ...entry.visibility } : undefined
    })),
    visibility
  };
}
