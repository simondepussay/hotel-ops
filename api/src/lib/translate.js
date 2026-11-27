// Traduction avec Azure AI Translator. Sans clé (en local par exemple), rien n'est traduit
// et l'interface affiche simplement le texte d'origine.
const KEY = process.env.TRANSLATOR_KEY;
const REGION = process.env.TRANSLATOR_REGION;
const ENDPOINT = 'https://api.cognitive.microsofttranslator.com/translate?api-version=3.0';

// Codes de l'app → codes de Translator (le chinois est en caractères simplifiés).
const TO_AZURE = { zh: 'zh-Hans' };
const FROM_AZURE = { 'zh-Hans': 'zh', 'zh-Hant': 'zh' };

// Langues que le staff peut lire : chaque message client est traduit dans ces trois langues.
export const STAFF_LANGS = ['ja', 'en', 'fr'];

export const translationEnabled = () => !!KEY;

/**
 * Traduit `text` vers chaque langue de `targets`.
 * Renvoie { from, tr } : `from` est la langue détectée, `tr` un objet { langue: texte }.
 * En cas d'erreur, on renvoie un résultat vide : un message non traduit vaut mieux qu'un message perdu.
 */
export async function translate(text, targets, { from, log } = {}) {
  const wanted = [...new Set(targets.filter(Boolean))].filter((l) => l !== from);
  if (!KEY || !text || !wanted.length) return { from: from || null, tr: {} };
  const url = new URL(ENDPOINT);
  for (const l of wanted) url.searchParams.append('to', TO_AZURE[l] || l);
  if (from) url.searchParams.set('from', TO_AZURE[from] || from);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': KEY,
        ...(REGION ? { 'Ocp-Apim-Subscription-Region': REGION } : {}),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([{ text }]),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`translator ${res.status}`);
    const [result] = await res.json();
    const detected = result.detectedLanguage?.language;
    const src = from || FROM_AZURE[detected] || detected || null;
    const tr = {};
    for (const t of result.translations || []) {
      const lang = FROM_AZURE[t.to] || t.to;
      if (lang !== src) tr[lang] = t.text;
    }
    return { from: src, tr };
  } catch (e) {
    log?.(`translation failed: ${e.message}`);
    return { from: from || null, tr: {} };
  }
}
