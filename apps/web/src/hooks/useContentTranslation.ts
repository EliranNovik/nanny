import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  apiTranslateContent,
  type TranslateContentKind,
  type TranslateContentResponse,
} from "@/lib/api";
import { normalizeAppLocale } from "@/i18n";
import { isTextLikelyInAppLocale } from "@/lib/detectTextLocale";

export type ContentTranslationMode = "original" | "translated";

type UseContentTranslationArgs = {
  contentKind: TranslateContentKind;
  contentId: string;
  title?: string | null;
  body?: string | null;
  enabled?: boolean;
};

export function useContentTranslation({
  contentKind,
  contentId,
  title,
  body,
  enabled = true,
}: UseContentTranslationArgs) {
  const { i18n, t } = useTranslation();
  const targetLocale = normalizeAppLocale(i18n.language);
  const [mode, setMode] = useState<ContentTranslationMode>("original");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TranslateContentResponse | null>(null);

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
    !likelyAlreadyInLanguage &&
    !result?.alreadyInTargetLanguage;

  const fetchTranslation = useCallback(async () => {
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
  }, [canAttempt, contentId, contentKind, t, targetLocale]);

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
