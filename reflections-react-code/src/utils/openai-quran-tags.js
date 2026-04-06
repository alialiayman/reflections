/**
 * Proposes short thematic tags for a Quranic passage (JSON response).
 */
export async function suggestQuranTags(verseText, refLabel, getApiKey) {
  const key = getApiKey?.();
  if (!key) {
    throw new Error("OpenAI key not configured.");
  }
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.35,
      messages: [
        {
          role: "system",
          content:
            'أنت تساعد باحثين في وسم مقاطع قرآنية. أجب بصيغة JSON فقط: {"tags":["وسم1","وسم2"]}. استخدم من ٣ إلى ١٠ وسوماً قصيرة بالعربية فقط (كلمات أو عبارات موضوعية جداً قصيرة، بدون جمل طويلة). ممنوع الإنجليزية أو الحروف اللاتينية في الوسوم. لا تكتب أي شرح خارج JSON.',
        },
        {
          role: "user",
          content: `المرجع ${refLabel}:\n\n${verseText}\n\nاقترح وسوماً موضوعية بالعربية فقط.`,
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 400,
    }),
  });
  const raw = await res.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`OpenAI response was not JSON (HTTP ${res.status}).`);
  }
  if (!res.ok) {
    throw new Error(data?.error?.message || `OpenAI HTTP ${res.status}`);
  }
  const content = data?.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("Empty tag suggestion from model.");
  }
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Model did not return valid JSON for tags.");
  }
  const tags = parsed?.tags;
  if (!Array.isArray(tags)) {
    throw new Error('Expected {"tags": [...]} from model.');
  }
  return tags.map((t) => String(t).trim()).filter(Boolean);
}
