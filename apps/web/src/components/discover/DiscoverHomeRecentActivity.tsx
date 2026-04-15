import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Loader2, MessageCircle, Sparkles, Star, UserPlus } from "lucide-react";

export type DiscoverHomeRecentActivityViewer = "client" | "freelancer";

type ActivityKind = "review" | "comment" | "hire_received" | "hire_sent";

type ActivityRow = {
  kind: ActivityKind;
  id: string;
  at: string;
  title: string;
  subtitle?: string;
  href: string;
  rating?: number;
};

function clampNote(s: string, n: number): string {
  const t = s.trim();
  if (t.length <= n) return t;
  return `${t.slice(0, Math.max(0, n - 1)).trimEnd()}…`;
}

function StarRow({ rating }: { rating: number }) {
  const r = Math.round(Math.min(5, Math.max(1, rating)));
  return (
    <span
      className="flex items-center gap-0.5"
      aria-label={`${r} out of 5 stars`}
    >
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={cn(
            "h-3.5 w-3.5",
            i < r
              ? "fill-amber-400 text-amber-400"
              : "fill-muted/30 text-muted-foreground/40",
          )}
          strokeWidth={1.5}
          aria-hidden
        />
      ))}
    </span>
  );
}

const iconForKind: Record<ActivityKind, typeof Star> = {
  review: Star,
  comment: MessageCircle,
  hire_received: UserPlus,
  hire_sent: Sparkles,
};

export function DiscoverHomeRecentActivity({
  viewerRole,
}: {
  viewerRole: DiscoverHomeRecentActivityViewer;
}) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ActivityRow[]>([]);

  const load = useCallback(async () => {
    if (!user?.id) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const uid = user.id;

      const [reviewsRes, myPostsRes] = await Promise.all([
        supabase
          .from("job_reviews")
          .select(
            `
            id,
            rating,
            review_text,
            created_at,
            reviewer:profiles!reviewer_id ( id, full_name, photo_url )
          `,
          )
          .eq("reviewee_id", uid)
          .order("created_at", { ascending: false })
          .limit(12),
        supabase
          .from("community_posts")
          .select("id, title")
          .eq("author_id", uid),
      ]);

      if (reviewsRes.error) {
        console.warn("[DiscoverHomeRecentActivity] reviews", reviewsRes.error);
      }

      if (myPostsRes.error) {
        console.warn("[DiscoverHomeRecentActivity] my posts", myPostsRes.error);
      }
      const myPosts = myPostsRes.data ?? [];
      const myPostIds = myPosts.map((p) => p.id as string);
      const titleByPostId = new Map(
        myPosts.map((p) => [
          p.id as string,
          String(p.title ?? "").trim() || "Your post",
        ]),
      );

      let commentsRaw: {
        id: string;
        body: string;
        created_at: string;
        author_id: string;
        post_id: string;
      }[] = [];

      let hireReceivedRaw: {
        id: string;
        created_at: string;
        status: string;
        community_post_id: string;
        client_id: string;
      }[] = [];

      let hireSentRaw: {
        id: string;
        created_at: string;
        status: string;
        community_post_id: string;
      }[] = [];

      if (myPostIds.length > 0) {
        const [cRes, hRes] = await Promise.all([
          supabase
            .from("community_post_comments")
            .select("id, body, created_at, author_id, post_id")
            .in("post_id", myPostIds)
            .order("created_at", { ascending: false })
            .limit(12),
          supabase
            .from("community_post_hire_interests")
            .select("id, created_at, status, community_post_id, client_id")
            .in("community_post_id", myPostIds)
            .order("created_at", { ascending: false })
            .limit(12),
        ]);
        if (cRes.error)
          console.warn("[DiscoverHomeRecentActivity] comments", cRes.error);
        else commentsRaw = (cRes.data ?? []) as typeof commentsRaw;
        if (hRes.error)
          console.warn(
            "[DiscoverHomeRecentActivity] hire received",
            hRes.error,
          );
        else hireReceivedRaw = (hRes.data ?? []) as typeof hireReceivedRaw;
      }

      if (viewerRole === "client") {
        const sRes = await supabase
          .from("community_post_hire_interests")
          .select("id, created_at, status, community_post_id")
          .eq("client_id", uid)
          .order("created_at", { ascending: false })
          .limit(12);
        if (sRes.error)
          console.warn("[DiscoverHomeRecentActivity] hire sent", sRes.error);
        else hireSentRaw = (sRes.data ?? []) as typeof hireSentRaw;
      }

      const profileIds = new Set<string>();
      for (const c of commentsRaw) profileIds.add(c.author_id);
      for (const h of hireReceivedRaw) profileIds.add(h.client_id);

      const profilesMap = new Map<
        string,
        { full_name: string | null; photo_url: string | null }
      >();
      if (profileIds.size > 0) {
        const { data: profs, error: pErr } = await supabase
          .from("profiles")
          .select("id, full_name, photo_url")
          .in("id", [...profileIds]);
        if (!pErr && profs) {
          for (const p of profs) {
            profilesMap.set(p.id as string, {
              full_name: p.full_name as string | null,
              photo_url: p.photo_url as string | null,
            });
          }
        }
      }

      const sentPostIds = [
        ...new Set(hireSentRaw.map((h) => h.community_post_id)),
      ];
      const extraTitles = new Map<string, string>();
      if (sentPostIds.length > 0) {
        const { data: posts } = await supabase
          .from("community_posts")
          .select("id, title")
          .in("id", sentPostIds);
        for (const p of posts ?? []) {
          extraTitles.set(
            p.id as string,
            String(p.title ?? "").trim() || "Post",
          );
        }
      }

      const merged: ActivityRow[] = [];

      for (const r of reviewsRes.data ?? []) {
        const row = r as {
          id: string;
          rating: number;
          review_text: string | null;
          created_at: string;
          reviewer:
            | { full_name: string | null; photo_url: string | null }
            | { full_name: string | null; photo_url: string | null }[]
            | null;
        };
        const rev = Array.isArray(row.reviewer)
          ? row.reviewer[0]
          : row.reviewer;
        const name = rev?.full_name?.trim() || "Someone";
        merged.push({
          kind: "review",
          id: `rev-${row.id}`,
          at: row.created_at,
          rating: Number(row.rating) || 5,
          title: `${name} left you a review`,
          subtitle: row.review_text
            ? clampNote(row.review_text, 100)
            : undefined,
          href:
            viewerRole === "client" ? "/dashboard" : "/freelancer/dashboard",
        });
      }

      for (const c of commentsRaw) {
        const prof = profilesMap.get(c.author_id);
        const name = prof?.full_name?.trim() || "Someone";
        const postTitle = titleByPostId.get(c.post_id) ?? "Your post";
        merged.push({
          kind: "comment",
          id: `com-${c.id}`,
          at: c.created_at,
          title: `${name} commented on “${clampNote(postTitle, 40)}”`,
          subtitle: clampNote(c.body, 120),
          href: `/public/posts?post=${encodeURIComponent(c.post_id)}`,
        });
      }

      for (const h of hireReceivedRaw) {
        const prof = profilesMap.get(h.client_id);
        const name = prof?.full_name?.trim() || "Someone";
        const postTitle = titleByPostId.get(h.community_post_id) ?? "your post";
        const st = (h.status || "").toLowerCase();
        merged.push({
          kind: "hire_received",
          id: `hir-${h.id}`,
          at: h.created_at,
          title: `${name} sent hire interest`,
          subtitle: `On “${clampNote(postTitle, 48)}” · ${st}`,
          href: `/availability/post/${encodeURIComponent(h.community_post_id)}/hires`,
        });
      }

      for (const h of hireSentRaw) {
        const postTitle = extraTitles.get(h.community_post_id) ?? "a post";
        const st = (h.status || "").toLowerCase();
        merged.push({
          kind: "hire_sent",
          id: `his-${h.id}`,
          at: h.created_at,
          title: `You sent hire interest`,
          subtitle: `On “${clampNote(postTitle, 48)}” · ${st}`,
          href: `/public/posts?post=${encodeURIComponent(h.community_post_id)}`,
        });
      }

      merged.sort(
        (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
      );
      setItems(merged.slice(0, 14));
    } catch (e) {
      console.error("[DiscoverHomeRecentActivity]", e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id, viewerRole]);

  useEffect(() => {
    void load();
  }, [load]);

  const showLoginPrompt = !user?.id;

  const emptyLoggedIn = user?.id && !loading && items.length === 0;

  function ActivityIcon({ kind }: { kind: ActivityKind }) {
    const I = iconForKind[kind];
    return (
      <I
        className="h-4 w-4 shrink-0 text-muted-foreground"
        strokeWidth={2}
        aria-hidden
      />
    );
  }

  return (
    <section className="mb-6 px-1" aria-label="Your recent activity">
      <p className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
        Recent activity
      </p>

      {showLoginPrompt ? (
        <p className="mt-4 text-sm text-muted-foreground">
          <Link
            to="/login"
            className="font-semibold text-foreground underline-offset-4 hover:underline"
          >
            Sign in
          </Link>{" "}
          to see your reviews, comments, and hire activity.
        </p>
      ) : loading ? (
        <div className="mt-6 flex justify-center py-6">
          <Loader2
            className="h-8 w-8 animate-spin text-muted-foreground"
            aria-hidden
          />
        </div>
      ) : emptyLoggedIn ? (
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Nothing here yet. When someone comments on your post, sends hire
          interest, or leaves a review, it will show up here.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-0 divide-y divide-border/60 rounded-xl border border-border/50 bg-card/30 dark:bg-card/10">
          {items.map((row) => (
            <li key={row.id} className="first:rounded-t-xl last:rounded-b-xl">
              <Link
                to={row.href}
                className={cn(
                  "flex gap-3 px-3 py-3 text-left transition-colors",
                  "hover:bg-muted/50 active:bg-muted/70",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                )}
              >
                <div className="mt-0.5">
                  <ActivityIcon kind={row.kind} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-sm font-semibold text-foreground">
                      {row.title}
                    </span>
                    {row.kind === "review" && row.rating != null ? (
                      <StarRow rating={row.rating} />
                    ) : null}
                  </div>
                  {row.subtitle ? (
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {row.subtitle}
                    </p>
                  ) : null}
                  <p className="mt-1.5 text-[11px] font-medium text-muted-foreground">
                    {formatDistanceToNow(new Date(row.at), { addSuffix: true })}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
