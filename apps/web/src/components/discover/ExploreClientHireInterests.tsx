import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, Clock } from "lucide-react";
import { ExpiryCountdown } from "@/components/ExpiryCountdown";
import {
  EXPLORE_PAGE_CARD_HOVER,
  EXPLORE_PAGE_CARD_SURFACE,
  EXPLORE_PAGE_CARD_THUMB,
} from "@/components/jobs/jobCardSharedClasses";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import {
  DISCOVER_HOME_CATEGORIES,
  SERVICE_CATEGORIES,
  isServiceCategoryId,
} from "@/lib/serviceCategories";
import { buildJobsUrl } from "@/components/jobs/jobsPerspective";
import { supabase } from "@/lib/supabase";

type HireRow = {
  id: string;
  created_at: string;
  status: string;
  community_post_id: string;
  job_request_id: string | null;
};

type PostRow = {
  id: string;
  title: string | null;
  category: string | null;
  note: string | null;
  created_at: string;
  expires_at: string;
  status: string;
  author_id: string;
  author?: {
    id: string;
    full_name: string | null;
    photo_url: string | null;
  } | null;
};

function formatCategoryLabel(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  return t
    .split("_")
    .map((p) => p.slice(0, 1).toUpperCase() + p.slice(1))
    .join(" ");
}

function postCategoryImageSrc(category: string | null): string | null {
  const id = (category || "").trim();
  if (!id) return null;
  const fromService = SERVICE_CATEGORIES.find((c) => c.id === id)?.imageSrc;
  if (fromService) return fromService;
  return DISCOVER_HOME_CATEGORIES.find((c) => c.id === id)?.imageSrc ?? null;
}

function clampNote(s: string, n: number): string {
  const t = s.trim();
  if (t.length <= n) return t;
  return `${t.slice(0, Math.max(0, n - 1)).trimEnd()}…`;
}

function formatPostTitle(p: PostRow): string {
  const title = p.title?.trim();
  if (title) return title;
  const note = p.note?.trim();
  if (note) return clampNote(note, 80);
  const cat = formatCategoryLabel(p.category || "");
  if (cat) return cat;
  return "Availability post";
}

function normalizeAuthor(
  raw: unknown,
): PostRow["author"] {
  if (raw == null) return null;
  const a = Array.isArray(raw) ? raw[0] : raw;
  if (!a || typeof a !== "object") return null;
  const o = a as Record<string, unknown>;
  return {
    id: String(o.id ?? ""),
    full_name: (o.full_name as string | null) ?? null,
    photo_url: (o.photo_url as string | null) ?? null,
  };
}

function statusLabel(status: string): string {
  const s = status.toLowerCase();
  if (s === "pending") return "Pending";
  if (s === "confirmed") return "Confirmed";
  if (s === "declined") return "Declined";
  return status;
}

function statusPillClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "confirmed")
    return "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300";
  if (s === "declined") return "bg-muted text-muted-foreground";
  return "bg-amber-500/12 text-amber-900 dark:text-amber-200";
}

type HireInterestsProps = {
  /** Only hires still waiting on the helper (pending). */
  pendingOnly?: boolean;
};

/**
 * Explore (client): hire interests the viewer sent on helpers’ availability posts.
 */
export function ExploreClientHireInterests({
  pendingOnly = false,
}: HireInterestsProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rows, setRows] = useState<
    { hire: HireRow; post: PostRow | null; coverUrl: string | null }[]
  >([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) {
      setRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data: hireData, error: hireErr } = await supabase
        .from("community_post_hire_interests")
        .select(
          "id, created_at, status, community_post_id, job_request_id",
        )
        .eq("client_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (hireErr) {
        console.warn("[ExploreClientHireInterests] hire rows", hireErr);
        setRows([]);
        return;
      }

      let hires = (hireData ?? []) as HireRow[];
      if (pendingOnly) {
        hires = hires.filter(
          (h) => String(h.status || "").toLowerCase() === "pending",
        );
      }
      const postIds = [...new Set(hires.map((h) => h.community_post_id))];
      if (postIds.length === 0) {
        setRows([]);
        return;
      }

      const { data: postData, error: postErr } = await supabase
        .from("community_posts")
        .select(
          `
          id, title, category, note, created_at, expires_at, status, author_id,
          author:profiles!author_id ( id, full_name, photo_url )
        `,
        )
        .in("id", postIds);

      if (postErr) {
        console.warn("[ExploreClientHireInterests] posts", postErr);
        setRows(
          hires.map((h) => ({
            hire: h,
            post: null,
            coverUrl: null,
          })),
        );
        return;
      }

      const postMap = new Map<string, PostRow>();
      for (const row of postData ?? []) {
        const p = row as Record<string, unknown>;
        const id = String(p.id ?? "");
        postMap.set(id, {
          id,
          title: (p.title as string | null) ?? null,
          category: (p.category as string | null) ?? null,
          note: (p.note as string | null) ?? null,
          created_at: String(p.created_at ?? ""),
          expires_at: String(p.expires_at ?? ""),
          status: String(p.status ?? ""),
          author_id: String(p.author_id ?? ""),
          author: normalizeAuthor(p.author),
        });
      }

      const { data: imgData, error: imgErr } = await supabase
        .from("community_post_images")
        .select("post_id, image_url, sort_order")
        .in("post_id", postIds)
        .order("sort_order", { ascending: true });

      if (imgErr) {
        console.warn("[ExploreClientHireInterests] images", imgErr);
      }

      const coverByPost = new Map<string, string>();
      for (const row of imgData ?? []) {
        const pid = String((row as { post_id: string }).post_id);
        const url = String((row as { image_url: string }).image_url ?? "");
        if (url && !coverByPost.has(pid)) coverByPost.set(pid, url);
      }

      setRows(
        hires.map((h) => {
          const pid = String(h.community_post_id);
          const post = postMap.get(pid) ?? null;
          return {
            hire: h,
            post,
            coverUrl: post ? coverByPost.get(pid) ?? null : null,
          };
        }),
      );
    } finally {
      setLoading(false);
    }
  }, [user?.id, pendingOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!user?.id) return null;

  return (
    <section
      className="space-y-4"
      aria-label={
        pendingOnly
          ? "Availability posts where your hire is pending a response"
          : "Your hire interest on availability posts"
      }
    >
      {loading ? (
        <div className="rounded-2xl border-0 bg-zinc-100 px-4 py-6 text-sm text-muted-foreground shadow-none dark:bg-zinc-900">
          Loading your hire responses…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border-0 bg-zinc-100 px-4 py-10 text-center shadow-none dark:bg-zinc-900/50">
          <p className="text-base font-semibold text-foreground">
            {pendingOnly
              ? "No pending hires"
              : "No hire responses yet"}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {pendingOnly
              ? "When you tap Hire on a helper’s availability and they haven’t confirmed yet, it shows here."
              : "When you tap Hire on a helper’s availability post, it shows up here."}
          </p>
          <Link
            to="/client/home"
            className="mt-5 inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
          >
            Browse Home
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ hire, post, coverUrl }) => {
            const title = post ? formatPostTitle(post) : "Availability post";
            const categoryImg = post ? postCategoryImageSrc(post.category) : null;
            const imgSrc = coverUrl || categoryImg;
            const catLabel =
              post && post.category
                ? formatCategoryLabel(post.category) || "Availability"
                : "Availability";
            const helperName = post?.author?.full_name?.trim();
            const subtitle = helperName
              ? `${catLabel} · ${helperName}`
              : catLabel;
            const hireStatus = String(hire.status || "").toLowerCase();
            const postCategory = post?.category?.trim();
            const publicPostHref = (() => {
              const p = new URLSearchParams();
              p.set("post", hire.community_post_id);
              if (postCategory && isServiceCategoryId(postCategory)) {
                p.set("category", postCategory);
              }
              return `/public/posts?${p.toString()}`;
            })();

            return (
              <button
                key={hire.id}
                type="button"
                onClick={() => {
                  const jrId =
                    hire.job_request_id != null
                      ? String(hire.job_request_id).trim()
                      : "";
                  if (hireStatus === "confirmed" && jrId) {
                    navigate(
                      `${buildJobsUrl("client", "jobs")}&highlightJob=${encodeURIComponent(jrId)}`,
                    );
                    return;
                  }
                  navigate(publicPostHref);
                }}
                className={cn(
                  "group relative w-full rounded-2xl p-4 text-left",
                  EXPLORE_PAGE_CARD_SURFACE,
                  EXPLORE_PAGE_CARD_HOVER,
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 flex-1 truncate text-base font-semibold text-foreground">
                    {title}
                  </p>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-black uppercase tracking-wide",
                      statusPillClass(hire.status),
                    )}
                  >
                    {statusLabel(hire.status)}
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <div className={EXPLORE_PAGE_CARD_THUMB} aria-hidden>
                    {imgSrc ? (
                      <img
                        src={imgSrc}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                    <div className="pointer-events-none absolute inset-0 bg-black/15" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-muted-foreground">
                      {subtitle}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      You tapped Hire{" "}
                      {new Date(hire.created_at).toLocaleDateString()}
                    </p>
                    {post?.expires_at ? (
                      <div
                        className="mt-1 flex min-w-0 items-center gap-1.5"
                        role="status"
                        aria-live="polite"
                      >
                        <Clock
                          className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                          aria-hidden
                        />
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Post
                        </span>
                        <ExpiryCountdown
                          expiresAtIso={post.expires_at}
                          compact
                          endedLabel="Ended"
                          className="!font-mono text-[11px] font-semibold tabular-nums text-emerald-700 dark:text-emerald-400"
                        />
                      </div>
                    ) : null}
                  </div>
                  <ChevronRight
                    className="h-5 w-5 shrink-0 text-muted-foreground"
                    aria-hidden
                    strokeWidth={2}
                  />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
