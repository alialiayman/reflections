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

/**
 * Running `##` index for one section, using live markdown (e.g. while editing).
 * @param {Array<{ markdown?: string }>} sections
 * @param {number} index
 * @param {(sectionIndex: number) => string} resolveMarkdown
 */
export function getH2SequenceAtIndex(sections, index, resolveMarkdown) {
  let n = 0;
  for (let i = 0; i <= index; i += 1) {
    const markdown = resolveMarkdown(i);
    if (sectionOpensWithH2(markdown)) {
      n += 1;
      if (i === index) {
        return n;
      }
    }
  }
  return null;
}

/**
 * All heading numbers reserved by `##` sections in the document.
 * @param {Array<{ markdown?: string }>} sections
 * @param {(sectionIndex: number) => string} resolveMarkdown
 */
export function collectReservedH2SequenceNumbers(sections, resolveMarkdown) {
  const reserved = new Set();
  let n = 0;
  for (let i = 0; i < sections.length; i += 1) {
    if (sectionOpensWithH2(resolveMarkdown(i))) {
      n += 1;
      reserved.add(n);
    }
  }
  return reserved;
}
