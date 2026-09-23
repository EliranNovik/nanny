import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  apiTranslateContent,
  type TranslateContentKind,
  type TranslateContentResponse,
} from "@/lib/api";
import { normalizeAppLocale } from "@/i18n";
import { isTextLikelyInAppLocale } from "@/lib/detectTextLocale";

export type ContentTranslationMode = "original" | "translated";

type PrecomputedTranslation = {
  translatedTitle?: string | null;
  translatedBody?: string | null;
};

type UseContentTranslationArgs = {
  contentKind: TranslateContentKind;
  contentId: string;
  title?: string | null;
  body?: string | null;
  enabled?: boolean;
  /** Precomputed feed overlay — do not call Google. */
  precomputed?: PrecomputedTranslation | null;
};

export function useContentTranslation({
  contentKind,
  contentId,
  title,
  body,
  enabled = true,
  precomputed = null,
}: UseContentTranslationArgs) {
  const { i18n, t } = useTranslation();
  const targetLocale = normalizeAppLocale(i18n.language);
  const hasPrecomputed = Boolean(
    precomputed?.translatedTitle?.trim() || precomputed?.translatedBody?.trim(),
  );
  const [mode, setMode] = useState<ContentTranslationMode>(
    hasPrecomputed ? "translated" : "original",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TranslateContentResponse | null>(() =>
    hasPrecomputed
      ? {
          fields: {
            title: precomputed?.translatedTitle ?? undefined,
            body: precomputed?.translatedBody ?? undefined,
          },
          sourceLocale: null,
          targetLocale,
          cached: true,
          alreadyInTargetLanguage: false,
        }
      : null,
  );

  const hadPrecomputedRef = useRef(hasPrecomputed);
  useEffect(() => {
    if (!hasPrecomputed) return;
    setResult({
      fields: {
        title: precomputed?.translatedTitle ?? undefined,
        body: precomputed?.translatedBody ?? undefined,
      },
      sourceLocale: null,
      targetLocale,
      cached: true,
      alreadyInTargetLanguage: false,
    });
    if (!hadPrecomputedRef.current) {
      setMode("translated");
    }
    hadPrecomputedRef.current = true;
  }, [
    hasPrecomputed,
    precomputed?.translatedBody,
    precomputed?.translatedTitle,
    targetLocale,
  ]);

  const hasText = Boolean(title?.trim() || body?.trim());
  const canAttempt = enabled && hasText;

  const likelyAlreadyInLanguage = useMemo(
    () => isTextLikelyInAppLocale([title, body], targetLocale),
    [body, targetLocale, title],
  );

  const displayTitle = useMemo(() => {
    if (mode === "translated" && result?.fields.title) return result.fields.title;
    return title?.trim() || null;
  }, [mode, result?.fields.title, title]);

  const displayBody = useMemo(() => {
    if (mode === "translated" && result?.fields.body) return result.fields.body;
    return body?.trim() || null;
  }, [mode, result?.fields.body, body]);

  const showControl =
    canAttempt &&
    (hasPrecomputed ||
      (!likelyAlreadyInLanguage && !result?.alreadyInTargetLanguage));

  const fetchTranslation = useCallback(async () => {
    if (hasPrecomputed) return result;
    if (!canAttempt) return null;
    setLoading(true);
    setError(null);
    try {
      const response = await apiTranslateContent({
        contentKind,
        contentId,
        targetLocale,
      });
      setResult(response);
      if (response.alreadyInTargetLanguage) {
        setError(t("translate.alreadyInLanguage"));
        return response;
      }
      if (response.skipped) {
        setError(t("translate.error"));
        return response;
      }
      if (
        !response.fields.body?.trim() &&
        !response.fields.title?.trim()
      ) {
        setError(t("translate.error"));
        return response;
      }
      setMode("translated");
      return response;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t("translate.error");
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [canAttempt, contentId, contentKind, hasPrecomputed, result, t, targetLocale]);

  const toggle = useCallback(async () => {
    if (mode === "translated") {
      setMode("original");
      setError(null);
      return;
    }
    if (result && !result.alreadyInTargetLanguage) {
      setMode("translated");
      setError(null);
      return;
    }
    await fetchTranslation();
  }, [fetchTranslation, mode, result]);

  const controlLabel =
    mode === "translated" ? t("translate.seeOriginal") : t("translate.seeTranslation");

  return {
    mode,
    loading,
    error,
    result,
    displayTitle,
    displayBody,
    showControl,
    controlLabel,
    toggle,
  };
}
