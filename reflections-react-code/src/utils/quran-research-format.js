const START = "<<<REFLECTIONS_QURAN_V1>>>";
const END = "<<<END_REFLECTIONS_QURAN>>>";

export const QURAN_RESEARCH_FILENAME = "quran-research.md";

/**
 * @typedef {{ id: string, surah: number, from: number, to: number, text: string, tags: string[] }} QuranResearchItem
 */

/**
 * @param {string} markdown
 * @returns {{ items: QuranResearchItem[] } | null}
 */
export function parseQuranResearchMarkdown(markdown) {
  if (!markdown || typeof markdown !== "string") {
    return null;
  }
  const i = markdown.indexOf(START);
  const j = markdown.indexOf(END);
  if (i === -1 || j === -1 || j <= i) {
    return null;
  }
  const jsonStr = markdown.slice(i + START.length, j).trim();
  try {
    const data = JSON.parse(jsonStr);
    if (!data || data.v !== 1 || !Array.isArray(data.items)) {
      return null;
    }
    const items = data.items
      .map((row, i) => {
        const from = Number(row.from);
        const to = Number(row.to != null ? row.to : row.from);
        return {
        id: typeof row.id === "string" && row.id ? row.id : `legacy-${i}-${Number(row.surah)}-${from}`,
        surah: Number(row.surah),
        from,
        to,
        text: typeof row.text === "string" ? row.text : "",
        tags: Array.isArray(row.tags)
          ? row.tags.map((t) => String(t).trim()).filter(Boolean)
          : [],
      };
      })
      .filter(
        (row) =>
          row.surah >= 1 &&
          row.surah <= 114 &&
          row.from >= 1 &&
          row.to >= row.from &&
          row.text.length > 0
      );
    return { items };
  } catch {
    return null;
  }
}

/**
 * @param {QuranResearchItem[]} items
 * @returns {string}
 */
export function serializeQuranResearchMarkdown(items) {
  const payload = {
    v: 1,
    items: items.map((it) => ({
      id: it.id,
      surah: it.surah,
      from: it.from,
      to: it.to,
      text: it.text,
      tags: it.tags,
    })),
  };
  const json = JSON.stringify(payload, null, 2);
  return [
    "# Quran research",
    "",
    "This file is updated by the **Reflections** Quran research tool on this site. The structured data lives in the block below; use the app to edit safely.",
    "",
    START,
    json,
    END,
    "",
  ].join("\n");
}
