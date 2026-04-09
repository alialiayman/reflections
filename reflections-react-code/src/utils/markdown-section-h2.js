/**
 * Running index for sections whose opening line is a level-2 heading (`## `, not `###`).
 * Matches on-the-fly `## N.` display numbering in the README view.
 */

const FIRST_LINE_IS_H2 = /^## (?!#)/;

export function sectionOpensWithH2(markdown = "") {
  const first = (markdown.split("\n")[0] || "").trim();
  return FIRST_LINE_IS_H2.test(first);
}

/**
 * @param {Array<{ markdown: string } & Record<string, unknown>>} sections
 * @returns {Array<{ h2Sequence: number | null } & typeof sections[0]>}
 */
export function addH2SequencesToSections(sections) {
  let n = 0;
  return sections.map((s) => {
    if (sectionOpensWithH2(s.markdown)) {
      n += 1;
      return { ...s, h2Sequence: n };
    }
    return { ...s, h2Sequence: null };
  });
}
