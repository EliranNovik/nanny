import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { apiPost } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { Badge } from "@/components/ui/badge";
import type {
  CommunityFeedPost,
  CommunityPostImage,
  CommunityPostWithMeta,
} from "@/components/community/CommunityPostCard";
import { AvailabilityStoriesStrip } from "@/components/discover/AvailabilityStoriesStrip";
import { IncomingRequestsStoriesStrip } from "@/components/discover/IncomingRequestsStoriesStrip";
import type { IncomingJobRequestCardJob } from "@/components/jobs/IncomingJobRequestCard";
import { buildJobsUrlFromTabId } from "@/components/jobs/jobsPerspective";
import { useDiscoverShortcutsCounts } from "@/hooks/useDiscoverShortcutsCounts";
import { openCommunityContact } from "@/lib/communityContact";
import { FullscreenMapModal } from "@/components/FullscreenMapModal";
import { JobDetailsModal } from "@/components/JobDetailsModal";
import { cn } from "@/lib/utils";
import { Bell, Loader2, Plus, Radio } from "lucide-react";

type JobRequestRow = {
  id: string;
  client_id: string;
  status: string;
  community_post_id?: string | null;
  community_post_expires_at?: string | null;
  service_type?: string;
  location_city: string;
  start_at: string | null;
  created_at: string;
  notes?: string | null;
  care_type?: string | null;
  care_frequency?: string | null;
  children_count?: number | null;
  children_age_group?: string | null;
  shift_hours?: string | null;
  time_duration?: string | null;
  languages_pref?: string[] | null;
  requirements?: string[] | null;
  budget_min?: number | null;
  budget_max?: number | null;
  stage?: string | null;
  offered_hourly_rate?: number | null;
  price_offer_status?: string | null;
  schedule_confirmed?: boolean | null;
  acceptedCount?: number;
  service_details?: { images?: unknown };
};

type InboundNotification = {
  id: string;
  job_id: string;
  status: string;
  created_at: string;
  isConfirmed?: boolean;
  isDeclined?: boolean;
  job_requests: JobRequestRow & {
    profiles?: {
      full_name: string;
      photo_url: string | null;
      average_rating?: number;
      total_ratings?: number;
      city?: string | null;
    };
  };
};

function formatJobTitle(job: { service_type?: string }) {
  if (job.service_type === "cleaning") return "Cleaning";
  if (job.service_type === "cooking") return "Cooking";
  if (job.service_type === "pickup_delivery") return "Pickup & Delivery";
  if (job.service_type === "nanny") return "Nanny";
  if (job.service_type === "other_help") return "Other Help";
  return "Service request";
}

export type DiscoverHomeActivityMode = "hire" | "work";

export function DiscoverHomeActivitySection({ mode }: { mode: DiscoverHomeActivityMode }) {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { addToast } = useToast();
  const { incomingRequestsCount } = useDiscoverShortcutsCounts();

  const [feedPosts, setFeedPosts] = useState<CommunityPostWithMeta[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(() => new Set());
  const [hiringPostId, setHiringPostId] = useState<string | null>(null);
  const [pendingHirePostIds, setPendingHirePostIds] = useState<Set<string>>(() => new Set());

  const [inbound, setInbound] = useState<InboundNotification[]>([]);
  const [inboundLoading, setInboundLoading] = useState(true);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [selectedMapJob, setSelectedMapJob] = useState<JobRequestRow | null>(null);
  const [selectedJobDetails, setSelectedJobDetails] = useState<JobRequestRow | null>(null);

  function goToIncomingJob(job: JobRequestRow | null) {
    if (!job) {
      setSelectedMapJob(null);
      setSelectedJobDetails(null);
      return;
    }
    if (job.service_type === "pickup_delivery") {
      setSelectedMapJob(job);
      setSelectedJobDetails(null);
    } else {
      setSelectedJobDetails(job);
      setSelectedMapJob(null);
    }
  }

  const incomingJobsUrl = buildJobsUrlFromTabId("requests");
  const loginRedirect = "/public/posts";

  const postIdsKey = useMemo(
    () =>
      feedPosts
        .map((p) => p.id)
        .sort()
        .join(","),
    [feedPosts]
  );

  const loadFeed = useCallback(async () => {
    setFeedLoading(true);
    try {
      const { data: rows, error } = await supabase.rpc("get_community_feed_public", {
        p_category: null,
      });
      if (error) throw error;
      const list = (rows || []) as CommunityFeedPost[];
      if (list.length === 0) {
        setFeedPosts([]);
        return;
      }
      const postIds = list.map((p) => p.id);
      const { data: imgs, error: imgErr } = await supabase
        .from("community_post_images")
        .select("id, post_id, image_url, sort_order")
        .in("post_id", postIds)
        .order("sort_order", { ascending: true });
      if (imgErr) throw imgErr;
      const imagesByPost = new Map<string, CommunityPostImage[]>();
      for (const img of imgs || []) {
        const pid = img.post_id as string;
        if (!imagesByPost.has(pid)) imagesByPost.set(pid, []);
        imagesByPost.get(pid)!.push({
          id: img.id as string,
          image_url: img.image_url as string,
          sort_order: Number(img.sort_order) || 0,
        });
      }
      const withImages = list.map((p) => ({
        ...p,
        images: imagesByPost.get(p.id) ?? [],
      }));
      const uid = user?.id;
      setFeedPosts(uid ? withImages.filter((p) => p.author_id !== uid) : withImages);
    } catch (e) {
      console.error("[DiscoverHomeActivitySection] feed", e);
      setFeedPosts([]);
    } finally {
      setFeedLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

  useEffect(() => {
    if (!user?.id || feedPosts.length === 0) {
      setFavoritedIds(new Set());
      return;
    }
    const ids = feedPosts.map((p) => p.id);
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("community_post_favorites")
        .select("post_id")
        .eq("user_id", user.id)
        .in("post_id", ids);
      if (cancelled) return;
      if (error) {
        console.error("[DiscoverHomeActivitySection] favorites", error);
        return;
      }
      setFavoritedIds(new Set((data || []).map((r) => r.post_id as string)));
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, postIdsKey]);

  useEffect(() => {
    if (!user?.id || profile?.role !== "client") {
      setPendingHirePostIds(new Set());
      return;
    }
    if (feedPosts.length === 0) {
      setPendingHirePostIds(new Set());
      return;
    }
    const ids = feedPosts.map((p) => p.id);
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("community_post_hire_interests")
        .select("community_post_id")
        .eq("client_id", user.id)
        .eq("status", "pending")
        .in("community_post_id", ids);
      if (cancelled) return;
      if (error) {
        console.error("[DiscoverHomeActivitySection] pending hire", error);
        return;
      }
      setPendingHirePostIds(new Set((data || []).map((r) => r.community_post_id as string)));
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, profile?.role, postIdsKey]);

  const toggleFavorite = async (postId: string) => {
    if (!user?.id) {
      navigate(`/login?redirect=${encodeURIComponent(loginRedirect)}`);
      return;
    }
    const wasFav = favoritedIds.has(postId);
    setFavoritedIds((prev: Set<string>) => {
      const next = new Set(prev);
      if (wasFav) next.delete(postId);
      else next.add(postId);
      return next;
    });
    try {
      if (wasFav) {
        const { error } = await supabase
          .from("community_post_favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("post_id", postId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("community_post_favorites").insert({
          user_id: user.id,
          post_id: postId,
        });
        if (error) throw error;
      }
    } catch (e) {
      setFavoritedIds((prev: Set<string>) => {
        const next = new Set(prev);
        if (wasFav) next.add(postId);
        else next.delete(postId);
        return next;
      });
      addToast({
        title: "Could not update favorites",
        description: e instanceof Error ? e.message : "Try again.",
        variant: "error",
      });
    }
  };

  const handleHireFromPost = async (postId: string): Promise<boolean> => {
    setHiringPostId(postId);
    try {
      await apiPost<{ interest_id: string; already_pending?: boolean }>("/api/jobs/from-community-post", {
        community_post_id: postId,
      });
      setPendingHirePostIds((prev) => {
        const next = new Set(prev);
        next.add(postId);
        return next;
      });
      addToast({
        title: "Interest sent",
        description: "The helper can confirm to start a live job and chat.",
        variant: "success",
      });
      return true;
    } catch (e) {
      addToast({
        title: "Could not start hire",
        description: e instanceof Error ? e.message : "Try again.",
        variant: "error",
      });
      return false;
    } finally {
      setHiringPostId(null);
    }
  };

  const loadIncomingNotifications = useCallback(async () => {
    if (!user?.id) {
      setInbound([]);
      setInboundLoading(false);
      return;
    }
    setInboundLoading(true);
    try {
      const [notifsRes, confsRes] = await Promise.all([
        supabase
          .from("job_candidate_notifications")
          .select(
            `
            id, job_id, status, created_at,
            job_requests (
              id, client_id, community_post_id, community_post_expires_at, service_type, location_city, start_at, notes, created_at, status,
              care_type, care_frequency, children_count, children_age_group, shift_hours, time_duration, languages_pref, requirements, budget_min, budget_max,
              stage, offered_hourly_rate, price_offer_status, schedule_confirmed,
              service_details,
              profiles!job_requests_client_id_fkey ( full_name, photo_url, average_rating, total_ratings, city )
            )
          `
          )
          .eq("freelancer_id", user.id)
          .in("status", ["pending", "opened"])
          .order("created_at", { ascending: false }),
        supabase.from("job_confirmations").select("job_id, status").eq("freelancer_id", user.id),
      ]);

      const notificationsData = notifsRes.data || [];
      const confirmedJobIds = new Set(
        (confsRes.data || []).filter((c) => c.status === "available").map((c) => c.job_id)
      );
      const declinedJobIds = new Set(
        (confsRes.data || []).filter((c) => c.status === "declined").map((c) => c.job_id)
      );

      const valid = notificationsData
        .filter(
          (n: any) =>
            n.job_requests &&
            !n.job_requests.community_post_id &&
            n.job_requests.client_id !== user.id
        )
        .map((n: any) => ({
          ...n,
          isConfirmed: confirmedJobIds.has(n.job_id),
          isDeclined: declinedJobIds.has(n.job_id),
        })) as InboundNotification[];

      setInbound(valid.filter((n) => !n.isConfirmed));
    } catch (e) {
      console.error("[DiscoverHomeActivitySection] inbound", e);
      setInbound([]);
    } finally {
      setInboundLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadIncomingNotifications();
  }, [loadIncomingNotifications]);

  async function handleConfirm(jobId: string, notifId: string) {
    const nextNotif = (() => {
      const i = inbound.findIndex((n) => n.id === notifId);
      return i >= 0 ? inbound[i + 1] : null;
    })();
    setConfirming(notifId);
    try {
      await apiPost(`/api/jobs/${jobId}/notifications/${notifId}/open`, {});
      await apiPost(`/api/jobs/${jobId}/confirm`, {});
      setInbound((prev) => prev.filter((n) => n.id !== notifId));
      addToast({
        title: "Accepted",
        description: "Moved to Pending while the client confirms.",
        variant: "success",
      });
      goToIncomingJob((nextNotif?.job_requests as JobRequestRow | undefined) ?? null);
    } catch (err: unknown) {
      addToast({
        title: "Failed to accept",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "error",
      });
    } finally {
      setConfirming(null);
    }
  }

  async function handleDecline(notifId: string): Promise<boolean> {
    const nextNotif = (() => {
      const i = inbound.findIndex((n) => n.id === notifId);
      return i >= 0 ? inbound[i + 1] : null;
    })();
    setDeleting(notifId);
    try {
      const { error } = await supabase.from("job_candidate_notifications").delete().eq("id", notifId);
      if (error) throw error;
      setInbound((prev) => prev.filter((n) => n.id !== notifId));
      addToast({ title: "Declined", variant: "default" });
      goToIncomingJob((nextNotif?.job_requests as JobRequestRow | undefined) ?? null);
      return true;
    } catch (err: unknown) {
      addToast({
        title: "Failed to decline",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "error",
      });
      return false;
    } finally {
      setDeleting(null);
    }
  }

  function openJobPreview(job: IncomingJobRequestCardJob) {
    if (job.service_type === "pickup_delivery") setSelectedMapJob(job as JobRequestRow);
    else setSelectedJobDetails(job as JobRequestRow);
  }

  const availabilityPostsCount = feedPosts.length;

  /** Hide section titles when the empty state is shown (no live posts / no requests). */
  const showHireActivityTitle = feedLoading || feedPosts.length > 0;
  const showWorkActivityTitle = inboundLoading || inbound.length > 0;

  const seeMoreLinkClassName = cn(
    "group flex w-[3.5rem] shrink-0 flex-col items-center gap-1 pb-0.5 text-center outline-none",
    "transition-transform active:scale-[0.97]",
    "focus-visible:ring-2 focus-visible:ring-slate-400/55 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "dark:focus-visible:ring-slate-500/50"
  );

  const seeMoreCircleClassName = cn(
    "flex h-[3.5rem] w-[3.5rem] shrink-0 items-center justify-center rounded-full",
    "border border-dashed border-slate-300/90 bg-slate-100/80 shadow-[0_1px_8px_-3px_rgba(0,0,0,0.08)]",
    "transition-transform duration-300 group-hover:scale-[1.03]",
    "dark:border-slate-600/80 dark:bg-slate-800/60"
  );

  const hireSeeMoreLink = (
    <Link to="/public/posts" className={seeMoreLinkClassName}>
      <div className={seeMoreCircleClassName} aria-hidden>
        <Plus className="h-5 w-5 text-slate-600 dark:text-slate-400" strokeWidth={2.25} />
      </div>
      <span className="max-w-full px-0.5 text-[9px] font-semibold leading-tight text-slate-600 dark:text-slate-400">
        See more
      </span>
    </Link>
  );

  const workSeeMoreLink = (
    <Link to={incomingJobsUrl} className={seeMoreLinkClassName}>
      <div className={seeMoreCircleClassName} aria-hidden>
        <Plus className="h-5 w-5 text-slate-600 dark:text-slate-400" strokeWidth={2.25} />
      </div>
      <span className="max-w-full px-0.5 text-[9px] font-semibold leading-tight text-slate-600 dark:text-slate-400">
        See more
      </span>
    </Link>
  );

  const hireSection = (
    <>
      {showHireActivityTitle && (
        <div className="mb-3 flex items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Available now
            </p>
            {!feedLoading && availabilityPostsCount > 0 && (
              <Badge
                variant="destructive"
                className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-black leading-none"
              >
                {availabilityPostsCount > 99 ? "99+" : availabilityPostsCount}
              </Badge>
            )}
          </div>
        </div>
      )}
      <div className={cn("space-y-5", showHireActivityTitle && "mt-2")}>
        {feedLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-9 w-9 animate-spin text-orange-500" />
          </div>
        ) : feedPosts.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <Radio className="h-8 w-8 text-orange-500/40 dark:text-orange-400/35" aria-hidden />
            <p className="text-sm text-muted-foreground">
              No one is live on the board right now.
            </p>
          </div>
        ) : (
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <AvailabilityStoriesStrip
                posts={feedPosts}
                user={user}
                profile={profile}
                loginRedirect={loginRedirect}
                favoritedIds={favoritedIds}
                onToggleFavorite={toggleFavorite}
                hiringPostId={hiringPostId}
                pendingHirePostIds={pendingHirePostIds}
                onHireFromPost={handleHireFromPost}
                onOpenChat={(post) => {
                  if (!user || !profile) return;
                  void openCommunityContact({
                    supabase,
                    user,
                    myRole: profile.role,
                    targetUserId: post.author_id,
                    targetRole: post.author_role,
                    navigate,
                    addToast,
                  });
                }}
              />
            </div>
            {hireSeeMoreLink}
          </div>
        )}
      </div>
    </>
  );

  const workSection = (
    <>
      {showWorkActivityTitle && (
        <div className="mb-3 flex items-center gap-2">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Community needs your help in…
          </p>
          {incomingRequestsCount > 0 && (
            <Badge
              variant="destructive"
              className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-black leading-none"
            >
              {incomingRequestsCount > 99 ? "99+" : incomingRequestsCount}
            </Badge>
          )}
        </div>
      )}
      <div className={cn("space-y-5", showWorkActivityTitle && "mt-2")}>
        {inboundLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-9 w-9 animate-spin text-amber-500" />
          </div>
        ) : inbound.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <Bell className="h-8 w-8 text-muted-foreground/50" aria-hidden />
            <p className="text-sm text-muted-foreground">No community requests right now.</p>
          </div>
        ) : (
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <IncomingRequestsStoriesStrip
                inbound={inbound}
                formatJobTitle={formatJobTitle}
                onOpenPreview={openJobPreview}
              />
            </div>
            {workSeeMoreLink}
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      <section
        className="mt-8 overflow-visible px-1 pt-1"
        aria-label={
          mode === "hire"
            ? showHireActivityTitle
              ? "Available helpers live now"
              : "No helpers live on the board"
            : showWorkActivityTitle
              ? "Community needs your help"
              : "No community requests right now"
        }
      >
        {mode === "hire" ? hireSection : workSection}
      </section>

      <FullscreenMapModal
        job={selectedMapJob}
        isOpen={!!selectedMapJob}
        sheetPresentation
        onClose={() => setSelectedMapJob(null)}
        onConfirm={
          selectedMapJob
            ? () => {
                const notif = inbound.find((n) => n.job_id === selectedMapJob.id);
                if (notif) void handleConfirm(selectedMapJob.id, notif.id);
              }
            : undefined
        }
        isConfirming={confirming !== null}
        showAcceptButton={
          selectedMapJob
            ? inbound.some((n) => n.job_id === selectedMapJob.id && !n.isConfirmed && !n.isDeclined)
            : false
        }
        onDecline={
          selectedMapJob
            ? async () => {
                const notif = inbound.find((n) => n.job_id === selectedMapJob.id);
                if (notif) await handleDecline(notif.id);
              }
            : undefined
        }
        isDeclining={
          selectedMapJob != null &&
          deleting === inbound.find((n) => n.job_id === selectedMapJob.id)?.id
        }
      />

      <JobDetailsModal
        isOpen={!!selectedJobDetails}
        onOpenChange={(open) => !open && setSelectedJobDetails(null)}
        sheetPresentation
        job={selectedJobDetails}
        formatJobTitle={formatJobTitle}
        isOwnRequest={selectedJobDetails?.client_id === user?.id}
        onConfirm={
          selectedJobDetails
            ? () => {
                const notif = inbound.find((n) => n.job_id === selectedJobDetails.id);
                if (notif) void handleConfirm(selectedJobDetails.id, notif.id);
              }
            : undefined
        }
        isConfirming={confirming !== null}
        showAcceptButton={
          selectedJobDetails
            ? inbound.some(
                (n) => n.job_id === selectedJobDetails.id && !n.isConfirmed && !n.isDeclined
              )
            : false
        }
        onDecline={
          selectedJobDetails
            ? async () => {
                const notif = inbound.find((n) => n.job_id === selectedJobDetails.id);
                if (notif) await handleDecline(notif.id);
              }
            : undefined
        }
        isDeclining={
          selectedJobDetails != null &&
          deleting === inbound.find((n) => n.job_id === selectedJobDetails.id)?.id
        }
      />
    </>
  );
}
