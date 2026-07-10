import { describe, expect, it } from "vitest";
import advisorHandover from "../advisor-plans/HANDOVER.md?raw";
import advisorReadme from "../advisor-plans/README.md?raw";
import design from "../DESIGN.md?raw";
import docsHandover from "../docs/HANDOVER.md?raw";
import artProductionSpec from "../docs/art-production-spec.md?raw";
import indexHtml from "../index.html?raw";
import readme from "../README.md?raw";
import { screenMarkup } from "../src/ui/markup";

const productName = "Colosseum Survivors";

describe("Colosseum Survivors public product identity", () => {
  it("publishes the product name in browser metadata", () => {
    expect(indexHtml).toContain(`<title>${productName}</title>`);
    expect(indexHtml).toContain(`<meta name="application-name" content="${productName}" />`);
    expect(indexHtml).toMatch(/<meta\s+name="description"/);
    expect(indexHtml).not.toMatch(/ghost/i);
  });

  it("renders the new title, arena introduction, and accessible run name", () => {
    const markup = screenMarkup();

    expect(markup).toContain('<h1 class="title-logo-big" aria-label="Colosseum Survivors">');
    expect(markup).toContain('<span class="title-logo-line">COLOSSEUM</span>');
    expect(markup).toContain('<span class="title-logo-line">SURVIVORS</span>');
    expect(markup).toContain('<p class="eyebrow">ENTER THE GRAND ARENA</p>');
    expect(markup).toContain(`<h1>${productName}</h1>`);
    expect(markup).toContain(`aria-label="${productName} run"`);
    expect(markup).not.toMatch(/ghost/i);
  });

  it("names the current product in user-facing project documents", () => {
    for (const [path, contents] of [
      ["README.md", readme],
      ["DESIGN.md", design],
      ["docs/HANDOVER.md", docsHandover],
      ["docs/art-production-spec.md", artProductionSpec],
      ["advisor-plans/HANDOVER.md", advisorHandover],
      ["advisor-plans/README.md", advisorReadme],
    ]) {
      expect(contents, path).toContain(productName);
    }
  });
});
