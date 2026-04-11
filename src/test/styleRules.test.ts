import { describe, expect, it } from "vitest";
import { sanitizeCssText, styleForRole } from "../lib/styleRules";

describe("style rules", () => {
  it("keeps safe CSS declarations", () => {
    const result = sanitizeCssText("color: red; font-weight: 700; text-decoration: underline");
    expect(result.errors).toEqual([]);
    expect(result.cssText).toContain("color: red");
  });

  it("rejects unsafe declarations", () => {
    const result = sanitizeCssText("position: fixed; background: url(javascript:alert(1))");
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.cssText).toBe("");
  });

  it("maps verb personal-ending rules to personal segments", () => {
    const style = styleForRole("personal", [
      {
        id: "s",
        name: "Personal endings",
        target: "verb-personal-endings",
        cssText: "color: green"
      }
    ]);
    expect(style).toBe("color: green");
  });
});
