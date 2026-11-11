import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  BookOpen,
  ChevronDown,
  Loader2,
  MessageSquareQuote,
  Plus,
  Save,
  Settings,
  ShieldAlert,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/toast";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { AdminQualityManager } from "@/pages/admin/AdminQualityManager";

type EntryKind = "behavior" | "knowledge" | "rules";

const KIND_ORDER: EntryKind[] = ["behavior", "knowledge", "rules"];

type KnowledgeEntry = {
  id: string;
  kind: EntryKind;
  title: string;
  body: string;
  enabled: boolean;
  sort_order: number;
  updated_at: string;
};

type Draft = {
  id: string | null;
  kind: EntryKind;
  title: string;
  body: string;
  enabled: boolean;
};

/** Mobile carousel: entries shown per card before "View more". */
const COLLAPSED_ENTRY_COUNT = 3;
const BODY_MAX = 8000;
const TITLE_MAX = 120;

const KIND_META: Record<EntryKind, { label: string; hint: string; icon: typeof Bot }> = {
  behavior: {
    label: "Behaviour",
    hint: "Tone, style and answer length.",
    icon: MessageSquareQuote,
  },
  knowledge: {
    label: "Knowledge",
    hint: "Facts, policies and FAQs.",
    icon: BookOpen,
  },
  rules: {
    label: "Rules & service",
    hint: "What the bot must never say or do.",
    icon: ShieldAlert,
  },
};

const TITLE_PLACEHOLDER: Record<EntryKind, string> = {
  behavior: "e.g. Tone of voice",
  knowledge: "e.g. Who created Tebnu",
  rules: "e.g. No legal or medical advice",
};

const BODY_PLACEHOLDER: Record<EntryKind, string> = {
  behavior:
    "Describe how the bot should talk. For example: friendly and short, use the person's first name, no emojis.",
  knowledge:
    "Write the facts plainly. For example: Tebnu was created by … in … to help people find help nearby.",
  rules:
    "One rule per line, written as do or don't. For example:\n- Never promise a refund or a date.\n- Do not recommend a specific helper.\n- Do not discuss other users' private details.",
};

const KIND_NOTE: Record<EntryKind, string> = {
  behavior: "Behaviour entries cannot switch off safety rules or the reply format.",
  knowledge: "The bot treats knowledge entries as true, so keep them accurate.",
  rules: "Rules win over behaviour and knowledge, and the bot keeps them even if a user insists.",
};

const emptyDraft = (kind: EntryKind = "knowledge"): Draft => ({
  id: null,
  kind,
  title: "",
  body: "",
  enabled: true,
});

function draftFrom(entry: KnowledgeEntry): Draft {
  return {
    id: entry.id,
    kind: entry.kind,
    title: entry.title,
    body: entry.body,
    enabled: entry.enabled,
  };
}

const cardClass =
  "rounded-2xl bg-white dark:bg-zinc-900";

export default function AdminAiBotPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const [expandedKinds, setExpandedKinds] = useState<Partial<Record<EntryKind, boolean>>>({});
  const [section, setSection] = useState<"chat" | "quality">("chat");
  const [capOpen, setCapOpen] = useState(false);
  const [dailyCap, setDailyCap] = useState("20");
  const [capMissing, setCapMissing] = useState(false);
  const [capSaving, setCapSaving] = useState(false);
  const carouselRef = useRef<HTMLElement>(null);
  const editorRef = useRef<HTMLElement>(null);
  const capMenuRef = useRef<HTMLDivElement>(null);

  const onCarouselScroll = () => {
    const el = carouselRef.current;
    if (!el) return;
    const slides = Array.from(el.children) as HTMLElement[];
    const box = el.getBoundingClientRect();
    const center = box.left + box.width / 2;
    let closest = 0;
    let best = Infinity;
    slides.forEach((slide, index) => {
      const rect = slide.getBoundingClientRect();
      const distance = Math.abs(rect.left + rect.width / 2 - center);
      if (distance < best) {
        best = distance;
        closest = index;
      }
    });
    setActiveSlide(closest);
  };

  const scrollToSlide = (index: number) => {
    const el = carouselRef.current;
    const slide = el?.children[index] as HTMLElement | undefined;
    if (!el || !slide) return;
    el.scrollTo({
      left: el.scrollLeft + slide.getBoundingClientRect().left - el.getBoundingClientRect().left,
      behavior: "smooth",
    });
  };

  const revealEditorOnMobile = () => {
    if (window.matchMedia("(min-width: 1024px)").matches) return;
    requestAnimationFrame(() => {
      editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const loadCap = useCallback(async () => {
    const { data, error } = await supabase
      .from("support_bot_settings")
      .select("daily_message_cap")
      .eq("id", 1)
      .maybeSingle();
    if (error) {
      setCapMissing(error.code === "42P01" || error.code === "PGRST205");
      return;
    }
    setCapMissing(false);
    if (data && typeof data.daily_message_cap === "number") {
      setDailyCap(String(data.daily_message_cap));
    }
  }, []);

  const saveCap = async () => {
    const value = Number(dailyCap);
    if (!Number.isInteger(value) || value < 0 || value > 500) {
      addToast({
        title: "Enter a whole number from 0 to 500",
        description: "Use 0 for no daily limit.",
        variant: "error",
      });
      return;
    }
    setCapSaving(true);
    const { error } = await supabase.from("support_bot_settings").upsert({
      id: 1,
      daily_message_cap: value,
      updated_by: user?.id ?? null,
    });
    setCapSaving(false);
    if (error) {
      addToast({
        title: "Could not save the limit",
        description:
          error.code === "42P01" || error.code === "PGRST205"
            ? "Run db/sql/160_support_bot_daily_cap.sql in Supabase first."
            : error.message,
        variant: "error",
      });
      return;
    }
    setCapMissing(false);
    addToast({
      title: value === 0 ? "Daily limit is off" : `Daily limit is ${value} messages`,
      variant: "success",
    });
  };

  const load = useCallback(async () => {
    setLoading(true);
    void loadCap();
    const { data, error } = await supabase
      .from("support_bot_knowledge")
      .select("id, kind, title, body, enabled, sort_order, updated_at")
      .order("kind", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    setLoading(false);
    if (error) {
      const missing = error.code === "42P01" || error.code === "PGRST205";
      setTableMissing(missing);
      if (!missing) {
        addToast({ title: "Could not load entries", description: error.message, variant: "error" });
      }
      return;
    }
    setTableMissing(false);
    setEntries((data ?? []) as KnowledgeEntry[]);
  }, [addToast, loadCap]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!capOpen) return;
    const onPointer = (event: MouseEvent) => {
      if (!capMenuRef.current?.contains(event.target as Node)) setCapOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCapOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [capOpen]);

  const grouped = useMemo(
    () => ({
      behavior: entries.filter((entry) => entry.kind === "behavior"),
      knowledge: entries.filter((entry) => entry.kind === "knowledge"),
      rules: entries.filter((entry) => entry.kind === "rules"),
    }),
    [entries],
  );

  const saved = draft.id ? entries.find((entry) => entry.id === draft.id) : null;
  const dirty = saved
    ? saved.title !== draft.title ||
      saved.body !== draft.body ||
      saved.kind !== draft.kind ||
      saved.enabled !== draft.enabled
    : draft.title.trim().length > 0 || draft.body.trim().length > 0;
  const canSave = draft.title.trim().length > 0 && draft.body.trim().length > 0 && dirty && !saving;

  const confirmDiscard = () =>
    !dirty || window.confirm("You have unsaved changes. Discard them?");

  const openEntry = (entry: KnowledgeEntry) => {
    if (entry.id === draft.id || !confirmDiscard()) return;
    setDraft(draftFrom(entry));
    revealEditorOnMobile();
  };

  const startNew = (kind: EntryKind) => {
    if (!confirmDiscard()) return;
    setDraft(emptyDraft(kind));
    revealEditorOnMobile();
  };

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    const payload = {
      kind: draft.kind,
      title: draft.title.trim().slice(0, TITLE_MAX),
      body: draft.body.trim().slice(0, BODY_MAX),
      enabled: draft.enabled,
    };
    const result = draft.id
      ? await supabase
          .from("support_bot_knowledge")
          .update(payload)
          .eq("id", draft.id)
          .select("id, kind, title, body, enabled, sort_order, updated_at")
          .single()
      : await supabase
          .from("support_bot_knowledge")
          .insert({
            ...payload,
            sort_order: grouped[draft.kind].length,
            created_by: user?.id ?? null,
            updated_by: user?.id ?? null,
          })
          .select("id, kind, title, body, enabled, sort_order, updated_at")
          .single();
    setSaving(false);
    if (result.error || !result.data) {
      addToast({
        title: "Save failed",
        description:
          result.error?.code === "23514" && draft.kind === "rules"
            ? "Rules are not enabled in the database yet. Run db/sql/155_support_bot_rules.sql."
            : result.error?.message ?? "Please try again.",
        variant: "error",
      });
      return;
    }
    const row = result.data as KnowledgeEntry;
    setEntries((prev) =>
      draft.id ? prev.map((entry) => (entry.id === row.id ? row : entry)) : [...prev, row],
    );
    setDraft(draftFrom(row));
    addToast({
      title: "Saved",
      description: "The bot uses this from its next reply, within about 30 seconds.",
      variant: "success",
    });
  };

  const toggleEnabled = async (entry: KnowledgeEntry, enabled: boolean) => {
    setEntries((prev) => prev.map((item) => (item.id === entry.id ? { ...item, enabled } : item)));
    if (draft.id === entry.id) setDraft((prev) => ({ ...prev, enabled }));
    const { error } = await supabase
      .from("support_bot_knowledge")
      .update({ enabled })
      .eq("id", entry.id);
    if (error) {
      setEntries((prev) =>
        prev.map((item) => (item.id === entry.id ? { ...item, enabled: !enabled } : item)),
      );
      addToast({ title: "Could not update", description: error.message, variant: "error" });
    }
  };

  const remove = async () => {
    if (!draft.id || deleting) return;
    if (!window.confirm(`Delete "${draft.title || "this entry"}"? The bot stops using it right away.`)) {
      return;
    }
    setDeleting(true);
    const { error } = await supabase.from("support_bot_knowledge").delete().eq("id", draft.id);
    setDeleting(false);
    if (error) {
      addToast({ title: "Delete failed", description: error.message, variant: "error" });
      return;
    }
    setEntries((prev) => prev.filter((entry) => entry.id !== draft.id));
    setDraft(emptyDraft(draft.kind));
    addToast({ title: "Deleted", variant: "success" });
  };

  return (
    <div className="admin-page min-h-screen bg-zinc-100 pb-10 dark:bg-zinc-950 md:h-[calc(100dvh-4rem)] md:min-h-0 md:overflow-y-auto">
      <div className="w-full px-2 py-6 md:px-4 lg:px-6 xl:px-8">
        <div className="mb-6 flex flex-wrap items-center gap-1 md:mb-8">
          <nav className="flex items-center gap-1" aria-label="AI tools">
            {(
              [
                ["chat", "AI chat bot"],
                ["quality", "Quality manager"],
              ] as const
            ).map(([id, label]) => {
              const selected = section === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setSection(id);
                    if (id !== "chat") setCapOpen(false);
                  }}
                  aria-current={selected ? "page" : undefined}
                  className={cn(
                    "rounded-xl px-3 py-2 text-xl font-extrabold tracking-tight transition-colors sm:text-3xl",
                    selected
                      ? "text-zinc-900 underline decoration-2 underline-offset-8 dark:text-zinc-50"
                      : "text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300",
                    selected && id === "chat" && "decoration-orange-500",
                    selected && id === "quality" && "decoration-sky-600",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </nav>
          {section === "chat" ? (
          <div className="relative" ref={capMenuRef}>
            <button
              type="button"
              onClick={() => setCapOpen((open) => !open)}
              aria-expanded={capOpen}
              aria-haspopup="dialog"
              aria-label="Daily message limit"
              title="Daily message limit"
              className={cn(
                "inline-flex h-10 w-10 items-center justify-center rounded-xl text-zinc-500 transition-colors hover:bg-white hover:text-orange-600 dark:hover:bg-zinc-900 dark:hover:text-orange-400",
                capOpen && "bg-white text-orange-600 dark:bg-zinc-900 dark:text-orange-400",
              )}
            >
              <Settings className="h-5 w-5" />
            </button>
            {capOpen ? (
              <div className="absolute start-0 top-12 z-30 w-[min(20rem,calc(100vw-2rem))] rounded-2xl bg-white p-4 shadow-lg ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-700">
                <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-200">
                  <SlidersHorizontal className="h-4 w-4 text-orange-500" /> Daily message limit
                </h2>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Messages one person can get per day. Then the chat goes to the Tebnu admins until midnight UTC. 0 means no limit.
                </p>
                {capMissing ? (
                  <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                    Run db/sql/160_support_bot_daily_cap.sql first. Until then the limit is 20.
                  </p>
                ) : null}
                <div className="mt-3 flex items-center gap-2">
                  <label className="sr-only" htmlFor="daily-cap">
                    Messages per person per day
                  </label>
                  <input
                    id="daily-cap"
                    inputMode="numeric"
                    value={dailyCap}
                    onChange={(e) => setDailyCap(e.target.value.replace(/[^\d]/g, "").slice(0, 3))}
                    className="h-10 w-20 rounded-xl border border-zinc-200 bg-white px-3 text-center text-sm font-bold tabular-nums text-zinc-900 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                  <button
                    type="button"
                    onClick={() => void saveCap()}
                    disabled={capSaving}
                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-orange-600 px-4 text-sm font-bold text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
                  >
                    {capSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          ) : null}
        </div>

        {section === "quality" ? (
          <AdminQualityManager />
        ) : tableMissing ? (
          <div className={cn(cardClass, "p-6 text-sm text-zinc-700 dark:text-zinc-300")}>
            The knowledge table is not set up yet. Run{" "}
            <code className="rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">
              db/sql/154_support_bot_knowledge.sql
            </code>{" "}
            in the Supabase SQL editor, then reload the page.
          </div>
        ) : (
          <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(280px,360px)_1fr] lg:gap-6">
            <div className="min-w-0">
            <aside
              ref={carouselRef}
              onScroll={onCarouselScroll}
              className="-mx-2 flex snap-x snap-mandatory items-start gap-3 overflow-x-auto scroll-px-2 px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:-mx-4 md:scroll-px-4 md:px-4 lg:mx-0 lg:grid lg:grid-cols-1 lg:items-start lg:gap-6 lg:overflow-visible lg:px-0"
            >
              {KIND_ORDER.map((kind) => {
                const meta = KIND_META[kind];
                const Icon = meta.icon;
                const listOpen = Boolean(expandedKinds[kind]);
                return (
                  <section
                    key={kind}
                    className={cn(cardClass, "flex w-[86%] shrink-0 snap-start flex-col p-4 sm:w-[70%] lg:min-h-[19rem] lg:w-auto")}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-200">
                        <Icon className="h-6 w-6 shrink-0 text-orange-500" /> {meta.label}
                      </h2>
                      <button
                        type="button"
                        onClick={() => startNew(kind)}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-orange-600 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-500/10"
                      >
                        <Plus className="h-3.5 w-3.5" /> New
                      </button>
                    </div>
                    <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">{meta.hint}</p>

                    {loading && entries.length === 0 ? (
                      <div className="flex justify-center py-6">
                        <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                      </div>
                    ) : grouped[kind].length === 0 ? (
                      <p className="rounded-xl border border-dashed border-zinc-200 px-3 py-4 text-center text-xs text-zinc-500 dark:border-zinc-700">
                        No entries yet.
                      </p>
                    ) : (
                      <ul className="space-y-1.5">
                        {grouped[kind].map((entry, index) => (
                          <li
                            key={entry.id}
                            className={cn(
                              !listOpen && index >= COLLAPSED_ENTRY_COUNT && "hidden",
                            )}
                          >
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={() => openEntry(entry)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  openEntry(entry);
                                }
                              }}
                              className={cn(
                                "flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
                                draft.id === entry.id
                                  ? "bg-orange-50 ring-1 ring-orange-200 dark:bg-orange-500/10 dark:ring-orange-500/30"
                                  : "hover:bg-zinc-50 dark:hover:bg-zinc-800/60",
                              )}
                            >
                              <div className="min-w-0 flex-1">
                                <p
                                  className={cn(
                                    "truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100",
                                    !entry.enabled && "text-zinc-400 line-through dark:text-zinc-500",
                                  )}
                                >
                                  {entry.title}
                                </p>
                                <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                                  {entry.body}
                                </p>
                              </div>
                              <Switch
                                checked={entry.enabled}
                                onCheckedChange={(value) => void toggleEnabled(entry, value)}
                                onClick={(e) => e.stopPropagation()}
                                aria-label={entry.enabled ? "Turn off" : "Turn on"}
                              />
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                    {grouped[kind].length > COLLAPSED_ENTRY_COUNT ? (
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedKinds((prev) => ({ ...prev, [kind]: !prev[kind] }))
                        }
                        className="mt-auto inline-flex items-center justify-center gap-1 self-center rounded-lg px-3 pt-3 text-xs font-semibold text-orange-600 hover:opacity-80 dark:text-orange-400"
                        aria-expanded={listOpen}
                      >
                        {listOpen
                          ? "Show less"
                          : `See more (${grouped[kind].length - COLLAPSED_ENTRY_COUNT})`}
                        <ChevronDown
                          className={cn("h-3.5 w-3.5 transition-transform", listOpen && "rotate-180")}
                        />
                      </button>
                    ) : null}
                  </section>
                );
              })}
            </aside>
            <div className="mt-3 flex justify-center gap-1.5 lg:hidden">
              {KIND_ORDER.map((kind, index) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => scrollToSlide(index)}
                  className={cn(
                    "h-2 rounded-full transition-all",
                    activeSlide === index
                      ? "w-5 bg-orange-500"
                      : "w-2 bg-zinc-300 dark:bg-zinc-700",
                  )}
                  aria-label={KIND_META[kind].label}
                  aria-current={activeSlide === index ? "true" : undefined}
                />
              ))}
            </div>
            </div>

            <section ref={editorRef} className={cn(cardClass, "mb-8 flex scroll-mt-20 flex-col p-5 lg:mb-0 lg:h-[calc(19rem*3+3rem)] lg:self-start")}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                  {draft.id ? "Edit entry" : "New entry"}
                </h2>
                <div className="inline-flex rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
                  {KIND_ORDER.map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => setDraft((prev) => ({ ...prev, kind }))}
                      className={cn(
                        "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                        draft.kind === kind
                          ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-50"
                          : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200",
                      )}
                    >
                      {KIND_META[kind].label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="mb-1.5 text-xs font-bold uppercase tracking-wider text-zinc-500" htmlFor="kb-title">
                Title
              </label>
              <input
                id="kb-title"
                value={draft.title}
                maxLength={TITLE_MAX}
                onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
                placeholder={TITLE_PLACEHOLDER[draft.kind]}
                className="mb-4 h-11 w-full rounded-xl border border-zinc-200 bg-white px-3.5 text-sm font-semibold text-zinc-900 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />

              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500" htmlFor="kb-body">
                  Text
                </label>
                <span className="text-xs tabular-nums text-zinc-400">
                  {draft.body.length} / {BODY_MAX}
                </span>
              </div>
              <textarea
                id="kb-body"
                value={draft.body}
                maxLength={BODY_MAX}
                onChange={(e) => setDraft((prev) => ({ ...prev, body: e.target.value }))}
                placeholder={BODY_PLACEHOLDER[draft.kind]}
                className="h-36 w-full resize-y rounded-xl border border-zinc-200 bg-white px-3.5 py-3 text-sm leading-relaxed text-zinc-900 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 lg:h-auto lg:min-h-0 lg:flex-1"
              />
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                Write in any language. The bot answers each person in their own language. {KIND_NOTE[draft.kind]}
              </p>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800 lg:mt-auto">
                <label className="flex items-center gap-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  <Switch
                    checked={draft.enabled}
                    onCheckedChange={(value) => setDraft((prev) => ({ ...prev, enabled: value }))}
                  />
                  Bot uses this entry
                </label>
                <div className="flex items-center gap-2">
                  {draft.id ? (
                    <button
                      type="button"
                      onClick={() => void remove()}
                      disabled={deleting}
                      className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-500/10"
                    >
                      {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      Delete
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void save()}
                    disabled={!canSave}
                    className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {draft.id ? "Save changes" : "Add entry"}
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}

      </div>
    </div>
  );
}
