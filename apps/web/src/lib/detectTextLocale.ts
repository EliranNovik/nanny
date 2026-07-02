import { normalizeAppLocale, type AppLocale } from "@/i18n";

const HEBREW = /[\u0590-\u05FF]/;
const CYRILLIC = /[\u0400-\u04FF]/;
const LATIN = /[A-Za-zÀ-ÿ]/;

const FRENCH_MARKERS =
  /[àâäéèêëïîôùûüçœæ]/i;

const FRENCH_WORDS =
  /\b(le|la|les|de|du|des|et|pour|avec|chez|une|un|est|pas|que|sur|dans|je|tu|nous|vous|merci|bonjour|besoin|aide)\b/i;

function scriptCounts(text: string): { he: number; cy: number; la: number } {
  let he = 0;
  let cy = 0;
  let la = 0;
  for (const char of text) {
    if (/\s/.test(char)) continue;
    if (HEBREW.test(char)) he += 1;
    else if (CYRILLIC.test(char)) cy += 1;
    else if (LATIN.test(char)) la += 1;
  }
  return { he, cy, la };
}

/** Best-effort locale guess for user-generated text (en/he/ru/fr). */
export function detectLikelyAppLocale(
  text: string | null | undefined,
): AppLocale | null {
  const trimmed = text?.trim();
  if (!trimmed) return null;

  const { he, cy, la } = scriptCounts(trimmed);
  const total = he + cy + la;
  if (total < 2) return null;

  const shares = [he / total, cy / total, la / total];
  const significantScripts = shares.filter((s) => s > 0.15).length;
  if (significantScripts >= 2) return null;

  if (he / total >= 0.25) return "he";
  if (cy / total >= 0.25) return "ru";

  if (la > 0) {
    if (FRENCH_MARKERS.test(trimmed) || FRENCH_WORDS.test(trimmed)) {
      return "fr";
    }
    return "en";
  }

  return null;
}

/** True when all provided text samples appear to be in the user's app language. */
export function isTextLikelyInAppLocale(
  texts: Array<string | null | undefined>,
  userLocale: string,
): boolean {
  const target = normalizeAppLocale(userLocale);
  const samples = texts.map((t) => t?.trim()).filter(Boolean) as string[];
  if (samples.length === 0) return false;

  return samples.every((text) => {
    const detected = detectLikelyAppLocale(text);
    return detected !== null && detected === target;
  });
}
