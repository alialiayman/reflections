/**
 * Fetches Uthmani Arabic text via alquran.cloud (no API key, CORS-friendly).
 * Responses are cached in-memory for the session.
 */

import { getArabicSurahName } from "../constants/surah-arabic-names";

const API_BASE = "https://api.alquran.cloud/v1";

const surahCache = new Map();

export async function fetchSurahUthmani(surah) {
  const n = Number(surah);
  if (!Number.isInteger(n) || n < 1 || n > 114) {
    throw new Error("رقم السورة يجب أن يكون بين ١ و ١١٤.");
  }
  if (surahCache.has(n)) {
    return surahCache.get(n);
  }
  const res = await fetch(`${API_BASE}/surah/${n}/quran-uthmani`);
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
