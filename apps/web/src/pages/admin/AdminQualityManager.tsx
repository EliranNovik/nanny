import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/toast";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type NoteKind = "standard" | "category";

type QualityNote = {
  id: string;
  kind: NoteKind;
  title: string;
  body: string;
  enabled: boolean;
  sort_order: number;
};

type Draft = {
  id: string | null;
  kind: NoteKind;
  title: string;
  body: string;
  enabled: boolean;
};

const BODY_MAX = 4000;
const TITLE_MAX = 120;

const emptyDraft = (kind: NoteKind = "standard"): Draft => ({
  id: null,
  kind,
  title: "",
  body: "",
  enabled: true,
});

export function AdminQualityManager() {
  const { addToast } = useToast();
  const [notes, setNotes] = useState<QualityNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("quality_manager_notes")
      .select("id, kind, title, body, enabled, sort_order")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) {
      const missing = /quality_manager_notes|schema cache|does not exist/i.test(error.message);
      setTableMissing(missing);
      if (!missing) addToast({ title: "Could not load quality notes", description: error.message, variant: "error" });
      setLoading(false);
      return;
    }
    setTableMissing(false);
    setNotes((data ?? []) as QualityNote[]);
    setLoading(false);
  }, [addToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    const title = draft.title.trim();
    const body = draft.body.trim();
    if (!title || saving) return;
    setSaving(true);
    const payload = {
      kind: draft.kind,
      title,
      body,
      enabled: draft.enabled,
    };
    const result = draft.id
      ? await supabase.from("quality_manager_notes").update(payload).eq("id", draft.id).select().single()
      : await supabase
          .from("quality_manager_notes")
          .insert({ ...payload, sort_order: notes.filter((note) => note.kind === draft.kind).length })
          .select()
          .single();
    setSaving(false);
    if (result.error || !result.data) {
      addToast({ title: "Could not save", description: result.error?.message, variant: "error" });
      return;
    }
    const row = result.data as QualityNote;
    setNotes((prev) => (draft.id ? prev.map((note) => (note.id === row.id ? row : note)) : [...prev, row]));
    setDraft({ ...emptyDraft(draft.kind), ...row });
    addToast({ title: "Saved", description: "The quality manager uses this on the next post.", variant: "success" });
  };

  const toggle = async (note: QualityNote, enabled: boolean) => {
    setNotes((prev) => prev.map((item) => (item.id === note.id ? { ...item, enabled } : item)));
    const { error } = await supabase.from("quality_manager_notes").update({ enabled }).eq("id", note.id);
    if (error) {
      setNotes((prev) => prev.map((item) => (item.id === note.id ? { ...item, enabled: !enabled } : item)));
      addToast({ title: "Could not update", description: error.message, variant: "error" });
    }
  };

  const remove = async () => {
    if (!draft.id || deleting) return;
    if (!window.confirm(`Delete "${draft.title}"?`)) return;
    setDeleting(true);
    const { error } = await supabase.from("quality_manager_notes").delete().eq("id", draft.id);
    setDeleting(false);
    if (error) {
      addToast({ title: "Delete failed", description: error.message, variant: "error" });
      return;
    }
    setNotes((prev) => prev.filter((note) => note.id !== draft.id));
    setDraft(emptyDraft(draft.kind));
  };

  const standards = notes.filter((note) => note.kind === "standard");
  const categories = notes.filter((note) => note.kind === "category");

  return (
    <section>
      <p className="mb-6 max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        This reviews every new post before it is saved. It does not chat with anyone.
        At 70% or more it asks the person to change the post. From 50% to 69% the post goes up and lands in Flagged by AI.
      </p>

      {tableMissing ? (
        <div className="rounded-2xl bg-white p-6 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          The quality tables are not set up yet. Run{" "}
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">db/sql/159_quality_manager.sql</code>{" "}
          in the Supabase SQL editor, then reload.
        </div>
      ) : (
        <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(280px,360px)_1fr] lg:gap-6">
          <div className="space-y-4">
            <NoteList
              title="Standards"
              hint="Extra lines that make the review stricter."
              notes={standards}
              loading={loading}
              activeId={draft.id}
              onOpen={(note) => setDraft(note)}
              onNew={() => setDraft(emptyDraft("standard"))}
              onToggle={toggle}
            />
            <NoteList
              title="Categories"
              hint="Problems this manager should look for."
              notes={categories}
              loading={loading}
              activeId={draft.id}
              onOpen={(note) => setDraft(note)}
              onNew={() => setDraft(emptyDraft("category"))}
              onToggle={toggle}
            />
          </div>

          <div className="rounded-2xl bg-white p-5 dark:bg-zinc-900">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                {draft.id ? "Edit note" : "New note"}
              </h3>
              <div className="inline-flex rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
                {(["standard", "category"] as const).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => setDraft((prev) => ({ ...prev, kind }))}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-xs font-semibold capitalize",
                      draft.kind === kind
                        ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-50"
                        : "text-zinc-500",
                    )}
                  >
                    {kind}
                  </button>
                ))}
              </div>
            </div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-zinc-500" htmlFor="qm-title">
              Title
            </label>
            <input
              id="qm-title"
              value={draft.title}
              maxLength={TITLE_MAX}
              onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
              placeholder={draft.kind === "category" ? "e.g. Self-harm" : "e.g. Everyday photos are fine"}
              className="mb-4 h-11 w-full rounded-xl border border-zinc-200 bg-white px-3.5 text-sm font-semibold text-zinc-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-zinc-500" htmlFor="qm-body">
              Text
            </label>
            <textarea
              id="qm-body"
              value={draft.body}
              maxLength={BODY_MAX}
              onChange={(e) => setDraft((prev) => ({ ...prev, body: e.target.value }))}
              placeholder="Write what the quality manager should treat as a problem, or what it should leave alone."
              className="min-h-[220px] w-full resize-y rounded-xl border border-zinc-200 bg-white px-3.5 py-3 text-sm leading-relaxed text-zinc-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
              <label className="flex items-center gap-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                <Switch
                  checked={draft.enabled}
                  onCheckedChange={(value) => setDraft((prev) => ({ ...prev, enabled: value }))}
                />
                In use
              </label>
              <div className="flex items-center gap-2">
                {draft.id ? (
                  <button
                    type="button"
                    onClick={() => void remove()}
                    disabled={deleting}
                    className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400"
                  >
                    {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    Delete
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void save()}
                  disabled={saving || !draft.title.trim()}
                  className="inline-flex items-center gap-2 rounded-xl bg-sky-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-sky-800 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {draft.id ? "Save changes" : "Add note"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function NoteList({
  title,
  hint,
  notes,
  loading,
  activeId,
  onOpen,
  onNew,
  onToggle,
}: {
  title: string;
  hint: string;
  notes: QualityNote[];
  loading: boolean;
  activeId: string | null;
  onOpen: (note: QualityNote) => void;
  onNew: () => void;
  onToggle: (note: QualityNote, enabled: boolean) => void;
}) {
  return (
    <div className="rounded-2xl bg-white p-4 dark:bg-zinc-900">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-200">{title}</h3>
        <button
          type="button"
          onClick={onNew}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-50 dark:text-sky-300"
        >
          <Plus className="h-3.5 w-3.5" /> New
        </button>
      </div>
      <p className="mb-3 text-xs text-zinc-500">{hint}</p>
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
        </div>
      ) : notes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-200 px-3 py-4 text-center text-xs text-zinc-500 dark:border-zinc-700">
          None yet. The built-in list still applies.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {notes.map((note) => (
            <li key={note.id}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => onOpen(note)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpen(note);
                  }
                }}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5",
                  activeId === note.id ? "bg-sky-50 ring-1 ring-sky-200 dark:bg-sky-500/10 dark:ring-sky-500/30" : "hover:bg-zinc-50 dark:hover:bg-zinc-800/60",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate text-sm font-semibold", !note.enabled && "text-zinc-400 line-through")}>
                    {note.title}
                  </p>
                  <p className="truncate text-xs text-zinc-500">{note.body}</p>
                </div>
                <Switch
                  checked={note.enabled}
                  onCheckedChange={(value) => onToggle(note, value)}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={note.enabled ? "Turn off" : "Turn on"}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
