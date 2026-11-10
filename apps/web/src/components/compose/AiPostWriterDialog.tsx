import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowUp, Check, ChevronRight, RotateCcw, Square, X } from "lucide-react";
import { AiIcon } from "@/components/ai/AiIcon";
import { useTranslation } from "react-i18next";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { apiPostStream } from "@/lib/api";
import { cn } from "@/lib/utils";

export type AiPostType = "community" | "event" | "request" | "offer";

export type AiPostDraft = {
  title?: string;
  description?: string;
  eventDate?: string;
  eventTime?: string;
  location?: string;
  helpersNeeded?: string;
  /** Other form answers, label to value. */
  details?: Record<string, string>;
};

type Turn = {
  id: string;
  role: "user" | "assistant";
  content: string;
  title?: string;
  post?: string;
  /** Assistant turn still streaming. */
  streaming?: boolean;
  /** Which part the AI is writing right now. */
  phase?: "thinking" | "reply" | "post";
  applied?: boolean;
  error?: boolean;
};

const POST_MAX = 500;
const TITLE_MAX = 80;

const SUGGESTIONS: Record<AiPostType, string[]> = {
  community: [
    "Ask where the next gatherings in Tel Aviv are",
    "A friendly “How is everyone doing?” check-in",
    "Share some local news",
    "Ask for a recommendation nearby",
  ],
  event: [
    "Invite neighbours to a picnic in the park",
    "Call for volunteers for a beach clean-up",
    "A weekly running group",
    "A kids' play morning",
  ],
  request: [
    "Write it from what I filled in so far",
    "Make it clear and friendly",
    "Add what a helper needs to know",
    "Keep it short",
  ],
  offer: [
    "Write it from what I filled in so far",
    "Highlight my experience",
    "Make it warm and trustworthy",
    "Keep it short",
  ],
};

const SUBTITLE: Record<AiPostType, [string, string]> = {
  community: ["aiWriter.subtitleCommunity", "Community post"],
  event: ["aiWriter.subtitleEvent", "Event"],
  request: ["aiWriter.subtitleRequest", "Help request"],
  offer: ["aiWriter.subtitleOffer", "Service offer"],
};

const INTRO: Record<AiPostType, [string, string]> = {
  community: [
    "aiWriter.introCommunity",
    "Tell me what you'd like to share or ask, and I'll write the title and the post for you. You can tweak it after.",
  ],
  event: [
    "aiWriter.introEvent",
    "Tell me what the event is about and I'll write the name and the description for you. You can tweak it after.",
  ],
  request: [
    "aiWriter.introRequest",
    "Tell me what you need help with, and I'll write a clear description helpers can act on. I'll use what you already filled in.",
  ],
  offer: [
    "aiWriter.introOffer",
    "Tell me what you offer and a bit about you, and I'll write a description people will want to message you about.",
  ],
};

/** Opens the AI writer. Same look everywhere it appears. */
export function AiWriteButton({
  onClick,
  hint,
  disabled,
  className,
}: {
  onClick: () => void;
  hint: string;
  disabled?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className={cn("relative pt-2", className)}>
    <span className="pointer-events-none absolute right-4 top-0 z-10 rounded-full bg-white px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-orange-600 shadow-md ring-1 ring-orange-200 dark:bg-zinc-900 dark:text-orange-400 dark:ring-orange-500/40">
      {t("aiWriter.new", { defaultValue: "New" })}
    </span>
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-orange-500 via-orange-500 to-rose-500 px-4 py-3 text-left text-white shadow-md shadow-orange-500/20 transition-all hover:shadow-lg hover:shadow-orange-500/30 active:scale-[0.99] disabled:opacity-60"
    >
      <AiIcon className="h-9 w-9 shadow-sm ring-2 ring-white/70 transition-transform group-hover:rotate-12 group-hover:scale-110" />
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-bold leading-tight">
          {t("aiWriter.cta", { defaultValue: "Write with AI" })}
        </span>
        <span className="block truncate text-[12px] font-medium text-white/85">{hint}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 opacity-80 transition-transform group-hover:translate-x-0.5" />
    </button>
    </div>
  );
}

let turnSeq = 0;
const nextId = () => `t${Date.now()}-${(turnSeq += 1)}`;

function StatusLabel({ phase }: { phase: "thinking" | "reply" | "post" }) {
  const { t } = useTranslation();
  const label =
    phase === "post"
      ? t("aiWriter.creating", { defaultValue: "Creating your post" })
      : t("aiWriter.thinking", { defaultValue: "Thinking" });
  return (
    <div className="flex items-center gap-2 text-[13px] font-semibold">
      <span className="flex items-center gap-[3px]" aria-hidden>
        {[0, 160, 320].map((delay) => (
          <span
            key={delay}
            className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-typing-dot-wave"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </span>
      <span className="animate-ai-shimmer bg-[linear-gradient(90deg,theme(colors.zinc.500)_0%,theme(colors.zinc.500)_40%,theme(colors.orange.500)_50%,theme(colors.zinc.500)_60%,theme(colors.zinc.500)_100%)] bg-[length:200%_100%] bg-clip-text text-transparent dark:bg-[linear-gradient(90deg,theme(colors.zinc.400)_0%,theme(colors.zinc.400)_40%,theme(colors.orange.400)_50%,theme(colors.zinc.400)_60%,theme(colors.zinc.400)_100%)]">
        {label}…
      </span>
    </div>
  );
}

function Caret() {
  return (
    <span
      aria-hidden
      className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[2px] rounded-full bg-orange-500 animate-ai-caret"
    />
  );
}

function AiAvatar() {
  return <AiIcon className="shadow-sm" />;
}

export function AiPostWriterDialog({
  open,
  onOpenChange,
  postType,
  firstName,
  draft,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postType: AiPostType;
  firstName: string | null;
  draft: AiPostDraft;
  onApply: (result: { title: string; post: string }) => void;
}) {
  const { t } = useTranslation();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const stickToBottomRef = useRef(true);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const onApplyRef = useRef(onApply);
  onApplyRef.current = onApply;

  useEffect(() => {
    if (!open) abortRef.current?.abort();
  }, [open]);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    // On phones, focusing would pop the keyboard over the suggestions.
    if (!open || !window.matchMedia("(min-width: 768px)").matches) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 220);
    return () => window.clearTimeout(id);
  }, [open]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [turns]);

  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [input]);

  const patchTurn = useCallback((id: string, patch: (turn: Turn) => Turn) => {
    setTurns((prev) => prev.map((turn) => (turn.id === id ? patch(turn) : turn)));
  }, []);

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || busy) return;
      const userTurn: Turn = { id: nextId(), role: "user", content: message };
      const aiTurn: Turn = {
        id: nextId(),
        role: "assistant",
        content: "",
        streaming: true,
        phase: "thinking",
      };
      const history = [...turns.filter((turn) => !turn.error), userTurn];
      setTurns((prev) => [...prev, userTurn, aiTurn]);
      setInput("");
      setBusy(true);
      stickToBottomRef.current = true;

      const controller = new AbortController();
      abortRef.current = controller;
      let title = "";
      let post = "";
      try {
        await apiPostStream(
          "/api/ai/post-writer",
          {
            postType,
            turns: history.map((turn) => ({
              role: turn.role,
              content: turn.content || (turn.post ? "Here is the post." : "…"),
              ...(turn.title ? { title: turn.title } : {}),
              ...(turn.post ? { post: turn.post } : {}),
            })),
            draft: draftRef.current,
          },
          (event, data) => {
            const piece = (data as { text?: string; message?: string }) ?? {};
            if (event === "reply" && piece.text) {
              patchTurn(aiTurn.id, (turn) => ({
                ...turn,
                content: turn.content + piece.text,
                phase: turn.phase === "post" ? "post" : "reply",
              }));
            } else if (event === "title" && piece.text) {
              title += piece.text;
              patchTurn(aiTurn.id, (turn) => ({ ...turn, title, phase: "post" }));
            } else if (event === "post" && piece.text) {
              post += piece.text;
              patchTurn(aiTurn.id, (turn) => ({ ...turn, post, phase: "post" }));
            } else if (event === "error") {
              throw new Error(piece.message || "error");
            }
          },
          controller.signal,
        );
        const finalTitle = title.trim().slice(0, TITLE_MAX);
        const finalPost = post.trim().slice(0, POST_MAX);
        const applied = finalPost.length > 0;
        if (applied) onApplyRef.current({ title: finalTitle, post: finalPost });
        patchTurn(aiTurn.id, (turn) => ({
          ...turn,
          content: turn.content.trim(),
          title: finalTitle || undefined,
          post: finalPost || undefined,
          streaming: false,
          phase: undefined,
          applied,
        }));
      } catch (err) {
        const aborted = (err as Error)?.name === "AbortError";
        patchTurn(aiTurn.id, (turn) => ({
          ...turn,
          streaming: false,
          phase: undefined,
          error: !aborted || (!turn.content && !turn.post),
          content:
            turn.content ||
            (aborted
              ? t("aiWriter.stopped", { defaultValue: "Stopped." })
              : (err as Error)?.message && !/^HTTP \d+/.test((err as Error).message)
                ? (err as Error).message
                : t("aiWriter.failed", {
                    defaultValue: "I couldn't write that right now. Please try again.",
                  })),
        }));
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        setBusy(false);
      }
    },
    [busy, patchTurn, postType, t, turns],
  );

  const retry = () => {
    const lastUser = [...turns].reverse().find((turn) => turn.role === "user");
    if (!lastUser) return;
    setTurns((prev) => {
      const index = prev.lastIndexOf(lastUser);
      return prev.slice(0, index);
    });
    void send(lastUser.content);
  };

  const greeting = firstName
    ? t("aiWriter.greetingNamed", {
        name: firstName,
        defaultValue: "Hi {{name}}! How can I help with your post?",
      })
    : t("aiWriter.greeting", { defaultValue: "Hi! How can I help with your post?" });
  const intro = t(INTRO[postType][0], { defaultValue: INTRO[postType][1] });

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogPrimitive.Portal>
      <DialogPrimitive.Content
        aria-describedby={undefined}
        onOpenAutoFocus={(e) => e.preventDefault()}
        // The post stays usable next to the drawer; only the X or Escape closes it.
        onInteractOutside={(e) => e.preventDefault()}
        className={cn(
          "fixed z-[150] flex flex-col overflow-hidden bg-white shadow-[0_-8px_40px_rgba(0,0,0,0.18)] outline-none ring-1 ring-black/5 dark:bg-zinc-900 dark:ring-white/10 md:shadow-[-12px_0_48px_rgba(0,0,0,0.18)]",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:duration-300 data-[state=closed]:duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
          // Phone: bottom sheet.
          "inset-x-0 bottom-0 h-[90dvh] rounded-t-[28px] data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
          // Tablet and desktop: side drawer on the right.
          "md:inset-x-auto md:inset-y-0 md:right-0 md:h-full md:w-[440px] md:max-w-[92vw] md:rounded-none md:rounded-l-[28px] md:data-[state=open]:slide-in-from-right md:data-[state=closed]:slide-out-to-right md:data-[state=open]:slide-in-from-bottom-0 md:data-[state=closed]:slide-out-to-bottom-0",
        )}
      >
        <div className="flex justify-center bg-white pt-2.5 dark:bg-zinc-900 md:hidden" aria-hidden>
          <span className="h-1.5 w-10 rounded-full bg-zinc-300 dark:bg-zinc-700" />
        </div>
        <div className="flex items-center gap-3 border-b border-black/5 bg-white px-4 pb-3 pt-2 dark:border-white/10 dark:bg-zinc-900 md:pt-[max(1rem,env(safe-area-inset-top))]">
          <AiAvatar />
          <div className="min-w-0 flex-1">
            <DialogPrimitive.Title className="text-[15px] font-bold leading-tight text-zinc-900 dark:text-zinc-50">
              {t("aiWriter.title", { defaultValue: "Write with AI" })}
            </DialogPrimitive.Title>
            <p className="text-[12px] font-medium text-zinc-500 dark:text-zinc-400">
              {t(SUBTITLE[postType][0], { defaultValue: SUBTITLE[postType][1] })}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label={t("aiWriter.close", { defaultValue: "Close" })}
            className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div
          ref={scrollRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
          }}
          className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-5"
        >
          <div className="flex items-start gap-3 animate-ai-message-in">
            <AiAvatar />
            <div className="min-w-0 flex-1 pt-1 text-[15px] leading-relaxed text-zinc-800 dark:text-zinc-100">
              <p className="font-semibold">{greeting}</p>
              <p className="mt-1 text-zinc-600 dark:text-zinc-300">{intro}</p>
            </div>
          </div>

          {turns.length === 0 ? (
            <div className="flex flex-wrap gap-2 pl-11 animate-ai-message-in [animation-delay:120ms]">
              {SUGGESTIONS[postType].map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => void send(suggestion)}
                  className="rounded-full bg-zinc-100 px-3.5 py-2 text-left text-[13px] font-semibold text-zinc-700 transition-all hover:-translate-y-px hover:bg-orange-50 hover:text-orange-600 active:translate-y-0 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-orange-500/15 dark:hover:text-orange-400"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          ) : null}

          {turns.map((turn) =>
            turn.role === "user" ? (
              <div key={turn.id} className="flex justify-end animate-ai-message-in">
                <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-orange-500 px-4 py-2.5 text-[14px] font-medium leading-relaxed text-white shadow-sm">
                  {turn.content}
                </div>
              </div>
            ) : (
              <div key={turn.id} className="flex items-start gap-3 animate-ai-message-in">
                <AiAvatar />
                <div className="min-w-0 flex-1 space-y-3 pt-1">
                  {turn.phase === "thinking" ? (
                    <div className="py-0.5">
                      <StatusLabel phase="thinking" />
                    </div>
                  ) : null}

                  {turn.content ? (
                    <div
                      className={cn(
                        "whitespace-pre-wrap text-[15px] leading-relaxed",
                        turn.error
                          ? "text-red-600 dark:text-red-400"
                          : "text-zinc-800 dark:text-zinc-100",
                      )}
                    >
                      {turn.content.trim()}
                      {turn.streaming && turn.phase === "reply" ? <Caret /> : null}
                    </div>
                  ) : null}

                  {turn.title || turn.post || (turn.streaming && turn.phase === "post") ? (
                    <div className="overflow-hidden rounded-2xl bg-zinc-50 ring-1 ring-orange-200/70 dark:bg-zinc-800 dark:ring-orange-500/25">
                      <div className="flex items-center justify-between gap-2 border-b border-orange-100 bg-orange-50/70 px-4 py-2 dark:border-orange-500/15 dark:bg-orange-500/10">
                        {turn.streaming ? (
                          <StatusLabel phase="post" />
                        ) : turn.applied ? (
                          <span className="flex items-center gap-1.5 text-[12px] font-bold text-emerald-600 dark:text-emerald-400">
                            <Check className="h-3.5 w-3.5" />
                            {t("aiWriter.added", { defaultValue: "Added to your post" })}
                          </span>
                        ) : (
                          <span className="text-[12px] font-bold text-zinc-500">
                            {t("aiWriter.draft", { defaultValue: "Draft" })}
                          </span>
                        )}
                        {!turn.streaming && turn.post ? (
                          <button
                            type="button"
                            onClick={() => {
                              onApply({ title: turn.title ?? "", post: turn.post ?? "" });
                              setTurns((prev) =>
                                prev.map((item) =>
                                  item.role === "assistant"
                                    ? { ...item, applied: item.id === turn.id }
                                    : item,
                                ),
                              );
                            }}
                            className="rounded-full px-2.5 py-1 text-[12px] font-bold text-orange-600 transition-colors hover:bg-orange-100 dark:text-orange-400 dark:hover:bg-orange-500/15"
                          >
                            {turn.applied
                              ? t("aiWriter.useAgain", { defaultValue: "Use again" })
                              : t("aiWriter.use", { defaultValue: "Use this" })}
                          </button>
                        ) : null}
                      </div>
                      <div className="px-4 py-3">
                        {turn.title ? (
                          <p className="mb-1.5 text-[15px] font-bold leading-snug text-zinc-900 dark:text-zinc-50">
                            {turn.title}
                            {turn.streaming && !turn.post ? <Caret /> : null}
                          </p>
                        ) : null}
                        <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-zinc-700 dark:text-zinc-200">
                          {turn.post}
                          {turn.streaming && turn.post ? <Caret /> : null}
                        </p>
                      </div>
                    </div>
                  ) : null}

                  {turn.error && !busy && turn === turns[turns.length - 1] ? (
                    <button
                      type="button"
                      onClick={retry}
                      className="flex items-center gap-1.5 rounded-full px-2 py-1 text-[12px] font-bold text-zinc-500 hover:text-orange-600"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      {t("aiWriter.retry", { defaultValue: "Try again" })}
                    </button>
                  ) : null}
                </div>
              </div>
            ),
          )}
        </div>

        <div className="border-t border-black/5 bg-white px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 dark:border-white/10 dark:bg-zinc-900">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
            className="flex items-end gap-2 rounded-3xl bg-zinc-100 py-1.5 pl-4 pr-1.5 transition-shadow focus-within:ring-2 focus-within:ring-orange-500/30 dark:bg-zinc-800"
          >
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              maxLength={1000}
              placeholder={
                turns.some((turn) => turn.post)
                  ? t("aiWriter.placeholderRevise", {
                      defaultValue: "Ask for a change, e.g. shorter or more fun",
                    })
                  : t("aiWriter.placeholder", { defaultValue: "What would you like to post?" })
              }
              className="max-h-[132px] min-h-[36px] flex-1 resize-none bg-transparent py-2 text-[15px] text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100"
            />
            {busy ? (
              <button
                type="button"
                onClick={() => abortRef.current?.abort()}
                aria-label={t("aiWriter.stop", { defaultValue: "Stop" })}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white transition-transform active:scale-95 dark:bg-zinc-100 dark:text-zinc-900"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                aria-label={t("aiWriter.send", { defaultValue: "Send" })}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white shadow-sm transition-all hover:bg-orange-600 active:scale-95 disabled:bg-zinc-300 disabled:shadow-none dark:disabled:bg-zinc-700"
              >
                <ArrowUp className="h-[18px] w-[18px]" />
              </button>
            )}
          </form>
        </div>
      </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
