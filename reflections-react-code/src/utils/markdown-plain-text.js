import { marked } from "marked";

/**
 * Convert markdown to plain text for TTS (strip markup, keep readable flow).
 */
export function markdownToPlainText(markdown) {
  if (markdown == null || typeof markdown !== "string") {
    return "";
  }
  const src = markdown.trim();
  if (!src) {
    return "";
  }
  try {
    const html = marked.parse(src, { async: false });
    if (typeof html !== "string") {
      return src.replace(/[#*_`[\]]/g, " ").replace(/\s+/g, " ").trim();
    }
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    const text = (tmp.textContent || tmp.innerText || "").replace(/\s+/g, " ").trim();
    return text || src.replace(/[#*_`[\]]/g, " ").replace(/\s+/g, " ").trim();
  } catch {
    return src.replace(/[#*_`[\]]/g, " ").replace(/\s+/g, " ").trim();
  }
}
