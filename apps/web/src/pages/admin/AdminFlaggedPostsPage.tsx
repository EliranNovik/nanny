import { useCallback, useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Loader2, Shield, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { apiPost } from "@/lib/api";
import { useToast } from "@/components/ui/toast";

type FlagReason = {
  category?: string;
  confidence?: number;
  detail?: string;
};

type FlagRow = {
  id: string;
  profile_post_id: string | null;
  community_post_id: string | null;
  author_id: string;
  title: string | null;
  excerpt: string | null;
  reasons: FlagReason[];
  created_at: string;
  authorName: string;
};

export default function AdminFlaggedPostsPage() {
  const { addToast } = useToast();
  const [rows, setRows] = useState<FlagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("quality_post_flags")
      .select("id, profile_post_id, community_post_id, author_id, title, excerpt, reasons, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      setTableMissing(/quality_post_flags|schema cache|does not exist/i.test(error.message));
      setLoading(false);
      return;
    }
    const flags = (data ?? []) as Omit<FlagRow, "authorName">[];
    const authorIds = [...new Set(flags.map((row) => row.author_id))];
    const names = new Map<string, string>();
    if (authorIds.length > 0) {
      const { data: people } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", authorIds);
      for (const person of people ?? []) {
        names.set(person.id, person.full_name || "Member");
      }
    }
    setRows(flags.map((row) => ({ ...row, authorName: names.get(row.author_id) || "Member" })));
    setTableMissing(false);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = async (row: FlagRow) => {
    if (removingId) return;
    if (!window.confirm("Remove this post from Tebnu?")) return;
    setRemovingId(row.id);
    try {
      await apiPost(`/api/admin/quality-flags/${row.id}/remove`, {});
      setRows((prev) => prev.filter((item) => item.id !== row.id));
      addToast({ title: "Post removed", variant: "success" });
    } catch (err) {
      addToast({
        title: "Could not remove it",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "error",
      });
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="admin-page min-h-screen bg-zinc-100 pb-10 dark:bg-zinc-950 md:h-[calc(100dvh-4rem)] md:min-h-0 md:overflow-y-auto">
      <div className="w-full px-2 py-6 md:px-4 lg:px-6 xl:px-8">
        <h1 className="mb-2 flex items-center gap-2 text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
          <Shield className="h-8 w-8 text-sky-600" /> Flagged by AI
        </h1>
        <p className="mb-6 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          Posts the quality manager was unsure about. They are already visible. Remove one here if it should not stay up.
        </p>

        {tableMissing ? (
          <div className="rounded-2xl bg-white p-6 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
            Run <code className="rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">db/sql/159_quality_manager.sql</code> in
            the Supabase SQL editor, then reload.
          </div>
        ) : loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl bg-white px-6 py-12 text-center text-sm text-zinc-500 dark:bg-zinc-900">
            Nothing is waiting for a look.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl bg-white dark:bg-zinc-900">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-bold">When</th>
                  <th className="px-4 py-3 font-bold">Author</th>
                  <th className="px-4 py-3 font-bold">Post</th>
                  <th className="px-4 py-3 font-bold">Why</th>
                  <th className="px-4 py-3 font-bold" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-zinc-100 align-top dark:border-zinc-800">
                    <td className="whitespace-nowrap px-4 py-3 text-zinc-500">
                      {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}
                      <div className="mt-1 text-[11px] uppercase tracking-wider">
                        {row.community_post_id ? "Availability" : "Post"}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-100">{row.authorName}</td>
                    <td className="max-w-xs px-4 py-3">
                      <p className="font-semibold text-zinc-900 dark:text-zinc-100">{row.title || "Untitled"}</p>
                      {row.excerpt ? <p className="mt-1 line-clamp-3 text-zinc-500">{row.excerpt}</p> : null}
                    </td>
                    <td className="px-4 py-3">
                      <ul className="space-y-2">
                        {(Array.isArray(row.reasons) ? row.reasons : []).map((reason, index) => (
                          <li key={`${row.id}-${index}`}>
                            <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                              {reason.category || "Other"} · {Math.round(reason.confidence ?? 0)}%
                            </span>
                            {reason.detail ? <p className="text-zinc-500">{reason.detail}</p> : null}
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => void remove(row)}
                        disabled={removingId === row.id}
                        className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-500/10"
                      >
                        {removingId === row.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
