import type { MouseEvent, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Languages, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useContentTranslation } from "@/hooks/useContentTranslation";
import type { TranslateContentKind } from "@/lib/api";

const translateButtonClass =
  "inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 transition-colors hover:text-emerald-700 disabled:opacity-60 dark:text-emerald-400 dark:hover:text-emerald-300";

const translateButtonOnDarkClass =
  "inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 transition-colors hover:text-emerald-300 disabled:opacity-60";

type TranslateLinkButtonProps = {
  loading: boolean;
  label: string;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  variant?: "default" | "onDark";
  className?: string;
};

export function TranslateLinkButton({
  loading,
  label,
  onClick,
  variant = "default",
  className,
}: TranslateLinkButtonProps) {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={cn(
        variant === "onDark" ? translateButtonOnDarkClass : translateButtonClass,
        className,
      )}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
      ) : (
        <Languages className="h-4 w-4 shrink-0" aria-hidden />
      )}
      <span>{loading ? t("translate.translating") : label}</span>
    </button>
  );
}

type TranslateTextControlProps = {
  contentKind: TranslateContentKind;
  contentId: string;
  title?: string | null;
  body?: string | null;
  enabled?: boolean;
  className?: string;
  variant?: "default" | "onDark";
};

export function TranslateTextControl({
  contentKind,
  contentId,
  title,
  body,
  enabled = true,
  className,
  variant = "default",
}: TranslateTextControlProps) {
  const { showControl, loading, controlLabel, toggle, error } =
    useContentTranslation({
      contentKind,
      contentId,
      title,
      body,
      enabled,
    });

  if (!showControl) return null;

  return (
    <div className={cn("mt-1", className)}>
      <TranslateLinkButton
        loading={loading}
        label={controlLabel}
        onClick={() => void toggle()}
        variant={variant}
      />
      {error ? (
        <p className="mt-0.5 text-[11px] text-muted-foreground">{error}</p>
      ) : null}
    </div>
  );
}

type TranslatableCommentBodyProps = {
  contentKind: Extract<
    TranslateContentKind,
    "profile_post_comment" | "job_request_comment"
  >;
  contentId: string;
  body: string;
  className?: string;
  renderBody: (text: string) => ReactNode;
};

export function TranslatableCommentBody({
  contentKind,
  contentId,
  body,
  className,
  renderBody,
}: TranslatableCommentBodyProps) {
  const translation = useContentTranslation({
    contentKind,
    contentId,
    body,
  });

  const text = translation.displayBody ?? body;

  return (
    <>
      {renderBody(text)}
      {translation.showControl ? (
        <div className={className}>
          <TranslateLinkButton
            loading={translation.loading}
            label={translation.controlLabel}
            onClick={() => void translation.toggle()}
          />
          {translation.error ? (
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {translation.error}
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

type TranslatablePostTextProps = {
  contentKind: Extract<TranslateContentKind, "profile_post" | "job_request">;
  contentId: string;
  title?: string | null;
  body?: string | null;
  renderTitle?: (text: string) => ReactNode;
  renderBody?: (text: string) => ReactNode;
  className?: string;
};

export function TranslatablePostText({
  contentKind,
  contentId,
  title,
  body,
  renderTitle,
  renderBody,
  className,
}: TranslatablePostTextProps) {
  const translation = useContentTranslation({
    contentKind,
    contentId,
    title,
    body,
  });

  const displayTitle = translation.displayTitle;
  const displayBody = translation.displayBody;

  return (
    <>
      {displayTitle && renderTitle ? renderTitle(displayTitle) : null}
      {displayBody && renderBody ? renderBody(displayBody) : null}
      {translation.showControl ? (
        <div className={className}>
          <TranslateLinkButton
            loading={translation.loading}
            label={translation.controlLabel}
            onClick={() => void translation.toggle()}
          />
          {translation.error ? (
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {translation.error}
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

type TranslatableChatMessageProps = {
  messageId: string;
  body: string;
  renderBody: (text: string) => ReactNode;
  className?: string;
  variant?: "default" | "onDark";
  /** When false, hides translate control (e.g. sent messages). */
  enabled?: boolean;
};

export function TranslatableChatMessage({
  messageId,
  body,
  renderBody,
  className,
  variant = "onDark",
  enabled = true,
}: TranslatableChatMessageProps) {
  const translation = useContentTranslation({
    contentKind: "chat_message",
    contentId: messageId,
    body,
    enabled,
  });

  const text = translation.displayBody ?? body;

  return (
    <>
      {renderBody(text)}
      {translation.showControl ? (
        <div className={className}>
          <TranslateLinkButton
            loading={translation.loading}
            label={translation.controlLabel}
            onClick={() => void translation.toggle()}
            variant={variant}
          />
          {translation.error ? (
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              {translation.error}
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
