/**
 * Fetches Uthmani Arabic text via alquran.cloud (no API key, CORS-friendly).
 * Responses are cached in-memory for the session.
 */

import { getArabicSurahName } from "../constants/surah-arabic-names";

const API_BASE = "https://api.alquran.cloud/v1";

const surahCache = new Map();

/** Serialize alquran.cloud calls and space them out to reduce HTTP 429 rate limits. */
const MIN_REQUEST_GAP_MS = 320;
let alquranQueue = Promise.resolve();

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function alquranFetch(url, init = {}) {
  const run = async () => {
    await sleep(MIN_REQUEST_GAP_MS);
    if (init.signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    let res = await fetch(url, init);
    if (res.status === 429) {
      await sleep(2800);
      if (init.signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      res = await fetch(url, init);
    }
    return res;
  };
  const done = alquranQueue.then(run, run);
  alquranQueue = done.catch(() => {});
  return done;
}

/** NFC, strip tatweel, loosen common alef/hamza variants for substring match */
export function normalizeArabicForSearch(raw) {
  if (raw == null || typeof raw !== "string") {
    return "";
  }
  let s = raw.replace(/^\uFEFF/, "").trim();
  if (!s) {
    return "";
  }
  s = s.normalize("NFC");
  s = s.replace(/\u0640/g, ""); // tatweel
  const map = {
    "\u0623": "\u0627",
    "\u0625": "\u0627",
    "\u0622": "\u0627",
    "\u0671": "\u0627",
    "\u0670": "",
    "\u0629": "\u0647",
    "\u0649": "\u064a",
  };
  s = [...s].map((ch) => map[ch] ?? ch).join("");
  return s;
}

const ARABIC_SCRIPT_RE =
  /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

export function isLikelyArabicScript(text) {
  return ARABIC_SCRIPT_RE.test(String(text || ""));
}

/**
 * Search English translations (alquran.cloud). Returns surah + ayah for each match.
 * @returns {Promise<Array<{ surah: number, numberInSurah: number, snippet: string }>>}
 */
/** Common Latin spellings → alternates to try against /search/.../all/en (API is spelling-sensitive). */
function translationSearchQueryVariants(keyword) {
  const q = String(keyword || "").trim();
  if (!q) {
    return [];
  }
  const out = [];
  const seen = new Set();
  const push = (s) => {
    const t = String(s).trim();
    if (t && !seen.has(t.toLowerCase())) {
      seen.add(t.toLowerCase());
      out.push(t);
    }
  };
  push(q);
  const lower = q.toLowerCase();
  const aliases = {
    mohamed: ["Muhammad", "Mohammed", "Muhammed", "Mohammad"],
    mohammed: ["Muhammad", "Mohamed", "Mohammad"],
    muhammed: ["Muhammad", "Mohammed"],
    mohammad: ["Muhammad", "Mohammed"],
    ibrahim: ["Abraham", "Ibrahim"],
    abraham: ["Ibrahim", "Ibraheem"],
    ismail: ["Ishmael", "Ismael"],
    ishmael: ["Ismail", "Ismael"],
    ishaq: ["Isaac", "Ishaak"],
    isaac: ["Ishaq", "Ishak"],
    musa: ["Moses", "Musa"],
    moses: ["Musa", "Moshe"],
  };
  (aliases[lower] || []).forEach(push);
  return out;
}

async function searchTranslationWordSingle(query, { maxResults, signal }) {
  const enc = encodeURIComponent(query);
  const init = signal ? { signal } : {};
  const res = await alquranFetch(`${API_BASE}/search/${enc}/all/en`, init);
  const json = await res.json().catch(() => ({}));
  if (res.status === 404 || json.code === 404) {
    return [];
  }
  if (!res.ok) {
    throw new Error(`تعذر البحث في الترجمة (HTTP ${res.status}).`);
  }
  if (json.code !== 200 || !Array.isArray(json.data?.matches)) {
    throw new Error(json.status || "استجابة بحث غير صالحة.");
  }
  return json.data.matches.slice(0, maxResults).map((m) => ({
    surah: m.surah?.number,
    numberInSurah: m.numberInSurah,
    snippet: typeof m.text === "string" ? m.text : "",
  }));
}

export async function searchTranslationWord(keyword, { maxResults = 80, signal } = {}) {
  const variants = translationSearchQueryVariants(keyword);
  if (!variants.length) {
    return [];
  }
  for (const variant of variants) {
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    const hits = await searchTranslationWordSingle(variant, { maxResults, signal });
    if (hits.length) {
      return hits;
    }
  }
  return [];
}

/**
 * Scan cached/fetched Uthmani text for a substring (Arabic-friendly normalization).
 * Loads surahs one at a time (rate-limited fetch) to avoid HTTP 429 from the API.
 */
export async function searchUthmaniWord(keyword, { maxResults = 80, signal, onProgress } = {}) {
  const normKw = normalizeArabicForSearch(keyword);
  if (!normKw) {
    return [];
  }
  const results = [];
  for (let n = 1; n <= 114 && results.length < maxResults; n += 1) {
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    onProgress?.(n, 114);
    const data = await fetchSurahUthmani(n, { signal });
    for (const a of data.ayahs || []) {
      const raw = (a.text || "").replace(/^\uFEFF/, "").trim();
      const normAyah = normalizeArabicForSearch(raw);
      if (normAyah.includes(normKw)) {
        results.push({
          surah: n,
          numberInSurah: a.numberInSurah,
          snippet: raw.slice(0, 120),
        });
        if (results.length >= maxResults) {
          return results;
        }
      }
    }
  }
  return results;
}

/**
 * Arabic / script → Uthmani scan; Latin etc. → English translation index (then you still load Uthmani for display).
 */
export async function searchQuranWord(keyword, options = {}) {
  const t = String(keyword || "").trim();
  if (!t) {
    return { mode: "none", hits: [] };
  }
  if (isLikelyArabicScript(t)) {
    const hits = await searchUthmaniWord(t, options);
    return { mode: "uthmani", hits };
  }
  const hits = await searchTranslationWord(t, options);
  return { mode: "translation", hits };
}

export async function fetchSurahUthmani(surah, options = {}) {
  const { signal } = options;
  const n = Number(surah);
  if (!Number.isInteger(n) || n < 1 || n > 114) {
    throw new Error("رقم السورة يجب أن يكون بين ١ و ١١٤.");
  }
  if (surahCache.has(n)) {
    return surahCache.get(n);
  }
  const fetchInit = signal ? { signal } : {};
  const res = await alquranFetch(`${API_BASE}/surah/${n}/quran-uthmani`, fetchInit);
  if (!res.ok) {
    throw new Error(`تعذر الاتصال بخدمة الآيات (HTTP ${res.status}).`);
  }
  const json = await res.json();
  if (json.code !== 200 || !json.data?.ayahs?.length) {
    throw new Error(json.status || "استجابة غير صالحة من خدمة القرآن.");
  }
  surahCache.set(n, json.data);
  return json.data;
}

/**
 * @returns {{ text: string, surah: number, start: number, end: number, surahName: string, arabicName: string }}
 */
export async function fetchVerseRange(surah, startVerse, endVerse) {
  const data = await fetchSurahUthmani(surah);
  const start = Math.min(startVerse, endVerse);
  const end = Math.max(startVerse, endVerse);
  if (!Number.isInteger(start) || !Number.isInteger(end)) {
    throw new Error("أرقام الآيات يجب أن تكون أعدادًا صحيحة.");
  }
  if (start < 1 || end > data.numberOfAyahs) {
    throw new Error(
      `هذه السورة فيها ${data.numberOfAyahs} آية. اختر من ١ إلى ${data.numberOfAyahs}.`
    );
  }
  const ayahs = data.ayahs.filter(
    (a) => a.numberInSurah >= start && a.numberInSurah <= end
  );
  const lines = ayahs.map((a) => (a.text || "").replace(/^\uFEFF/, "").trim());
  const text = lines.join("\n\n");
  const apiArabic = typeof data.name === "string" ? data.name.replace(/^\uFEFF/, "").trim() : "";
  return {
    text,
    surah: data.number,
    start,
    end,
    surahName: data.englishName,
    arabicName: apiArabic || getArabicSurahName(data.number),
  };
}
