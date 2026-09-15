import { describe, expect, it } from "vitest";
import { cardNodeToSvg } from "./share";

describe("results card share snapshot", () => {
  it("embeds the on-screen sheet markup instead of a truncated text dump", () => {
    const article = document.createElement("article");
    article.className = "card-sheet";
    article.innerHTML =
      '<table class="sheet-grid"><tbody><tr><td>Squat</td><td>162.5</td></tr></tbody></table>';
    document.body.appendChild(article);
    const svg = cardNodeToSvg(article);
    article.remove();
    expect(svg).toContain("foreignObject");
    expect(svg).toContain("card-sheet");
    expect(svg).toContain("sheet-grid");
    expect(svg).toContain("162.5");
    expect(svg.includes("slice(0, 48)")).toBe(false);
  });
});
