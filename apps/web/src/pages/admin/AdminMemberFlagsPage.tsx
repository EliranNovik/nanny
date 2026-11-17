import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { format } from "date-fns";
import { ArrowLeft, Loader2 } from "lucide-react";
import { apiGet } from "@/lib/api";

type FlagItem = {
  id: string;
  kind: string;
  result: "Flagged" | "Blocked";
  summary: string;
  excerpt: string | null;
  reasons: string;
  createdAt: string;
  state: "Open" | "Dismissed" | null;
};

function when(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return format(date, "d MMM yyyy");
}

export default function AdminMemberFlagsPage() {
  const { userId = "" } = useParams();
  const [items, setItems] = useState<FlagItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    apiGet<{ items: FlagItem[] }>(`/api/admin/users/${userId}/flags`)
      .then((data) => {
        if (!cancelled) setItems(data.items ?? []);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load these flags.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const flagged = items.filter((item) => item.result === "Flagged").length;
  const blocked = items.length - flagged;

  return (
    <div className="admin-page min-h-screen overflow-y-auto overscroll-contain bg-zinc-100 pb-16 dark:bg-zinc-950 md:h-[calc(100dvh-4rem)] md:min-h-0">
      <div className="w-full px-4 py-6 md:px-8 xl:px-10">
        <Link
          to={`/admin/members/${userId}`}
          className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          <ArrowLeft className="h-4 w-4" />
          Member
        </Link>
        <h1 className="text-3xl font-black tracking-tight text-zinc-950 dark:text-zinc-50">Flagged and blocked</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {loading
            ? "Loading moderation items."
            : `${flagged} flagged, ${blocked} blocked.`}
        </p>

        {loading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          </div>
        ) : error ? (
          <p className="mt-8 rounded-3xl bg-white px-6 py-16 text-center text-sm text-zinc-600 dark:bg-zinc-900">{error}</p>
        ) : items.length === 0 ? (
          <p className="mt-8 rounded-3xl bg-white px-6 py-16 text-center text-sm text-zinc-500 dark:bg-zinc-900">
            Nothing flagged or blocked for this member.
          </p>
        ) : (
          <div className="mt-6 overflow-hidden rounded-3xl bg-white shadow-sm dark:bg-zinc-900">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="bg-zinc-50 text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:bg-zinc-800/60">
                  <tr>
                    <th className="px-4 py-3">Kind</th>
                    <th className="px-4 py-3">Result</th>
                    <th className="px-4 py-3">Summary</th>
                    <th className="px-4 py-3">Excerpt</th>
                    <th className="px-4 py-3">Reasons</th>
                    <th className="px-4 py-3">When</th>
                    <th className="px-4 py-3">State</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {items.map((item) => (
                    <tr key={item.id} className="align-top">
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-100">{item.kind}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={
                            item.result === "Blocked"
                              ? "font-bold text-red-600"
                              : "font-bold text-amber-600"
                          }
                        >
                          {item.result}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-zinc-800 dark:text-zinc-100">{item.summary}</td>
                      <td className="max-w-xs px-4 py-3 text-zinc-600 dark:text-zinc-300">{item.excerpt?.trim() || "—"}</td>
                      <td className="max-w-xs px-4 py-3 text-zinc-600 dark:text-zinc-300">{item.reasons || "—"}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-zinc-600 dark:text-zinc-300">{when(item.createdAt)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-zinc-600 dark:text-zinc-300">{item.state || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
