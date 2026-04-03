import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { apiPost } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CommunityPostCard,
  type CommunityFeedPost,
  type CommunityPostImage,
  type CommunityPostWithMeta,
} from "@/components/community/CommunityPostCard";
import { JobCardsCarousel } from "@/components/jobs/JobCardsCarousel";
import {
  IncomingJobRequestCard,
  type IncomingJobRequestCardJob,
} from "@/components/jobs/IncomingJobRequestCard";
import { buildJobsUrlFromTabId } from "@/components/jobs/jobsPerspective";
import { useDiscoverShortcutsCounts } from "@/hooks/useDiscoverShortcutsCounts";
import { useIsMinMd } from "@/hooks/useIsMinMd";
import { useJobCardEdgeOverlay } from "@/hooks/useJobCardEdgeOverlay";
import { openCommunityContact } from "@/lib/communityContact";
import { FullscreenMapModal } from "@/components/FullscreenMapModal";
import { JobDetailsModal } from "@/components/JobDetailsModal";
import { Bell, ChevronRight, Loader2, Sparkles } from "lucide-react";

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
  children_count?: number | null;
  children_age_group?: string | null;
  shift_hours?: string | null;
  time_duration?: string | null;
  languages_pref?: string[] | null;
  requirements?: string[] | null;
  budget_min?: number | null;
  budget_max?: number | null;
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

  const isMinMd = useIsMinMd();
  const inboundEdgeKey = useMemo(
    () =>
      `discover-inbound-${inbound.length}-${inbound
        .map((n) => n.id)
        .sort()
        .join(",")}-${inboundLoading ? 1 : 0}`,
    [inbound, inboundLoading]
  );
  const clippedCardIds = useJobCardEdgeOverlay(inboundEdgeKey);

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

  const handleHireFromPost = async (postId: string) => {
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
    } catch (e) {
      addToast({
        title: "Could not start hire",
        description: e instanceof Error ? e.message : "Try again.",
        variant: "error",
      });
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
              care_type, children_count, children_age_group, shift_hours, time_duration, languages_pref, requirements, budget_min, budget_max,
              service_details,
              profiles!job_requests_client_id_fkey ( full_name, photo_url, average_rating, total_ratings )
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
    setDeleting(notifId);
    try {
      const { error } = await supabase.from("job_candidate_notifications").delete().eq("id", notifId);
      if (error) throw error;
      setInbound((prev) => prev.filter((n) => n.id !== notifId));
      addToast({ title: "Declined", variant: "default" });
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

  function goToPublicProfile(e: MouseEvent, userId: string | null | undefined) {
    e.stopPropagation();
    if (!userId) return;
    navigate(`/profile/${userId}`);
  }

  const availabilityPostsCount = feedPosts.length;

  const hireSection = (
    <>
      <div className="mb-3 flex items-center justify-between gap-2">
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
        <Sparkles className="h-4 w-4 shrink-0 text-orange-500" aria-hidden />
      </div>
      <div className="mt-2 space-y-5">
        {feedLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-9 w-9 animate-spin text-orange-500" />
          </div>
        ) : feedPosts.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No one is live on the board right now. Check back soon or post a request.
          </p>
        ) : (
          <JobCardsCarousel>
            {feedPosts.map((post) => (
              <CommunityPostCard
                key={post.id}
                post={post}
                user={user}
                profile={profile}
                loginRedirect={loginRedirect}
                favoritedIds={favoritedIds}
                onToggleFavorite={toggleFavorite}
                hiringPostId={hiringPostId}
                pendingHirePostIds={pendingHirePostIds}
                onHireFromPost={handleHireFromPost}
                compact
                plain
                onOpenChat={() => {
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
            ))}
          </JobCardsCarousel>
        )}
        <div className="flex justify-end pt-1">
          <Button variant="link" size="sm" className="h-auto gap-1 px-2 text-xs font-bold" asChild>
            <Link to="/public/posts">
              See all
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </>
  );

  const workSection = (
    <>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Incoming requests
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
        <Bell className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
      </div>
      <div className="mt-2 space-y-5">
        {inboundLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-9 w-9 animate-spin text-amber-500" />
          </div>
        ) : inbound.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <Bell className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No incoming requests right now.</p>
            <Button variant="outline" size="sm" className="rounded-full" asChild>
              <Link to={incomingJobsUrl}>Open incoming requests</Link>
            </Button>
          </div>
        ) : (
          <>
            <JobCardsCarousel className="mt-0">
              {inbound.map((notif) => (
                <IncomingJobRequestCard
                  key={notif.id}
                  notif={notif}
                  isMinMd={isMinMd}
                  clippedCardIds={clippedCardIds}
                  deleting={deleting}
                  confirming={confirming}
                  formatJobTitle={formatJobTitle}
                  onDecline={handleDecline}
                  onConfirm={handleConfirm}
                  onOpenPreview={openJobPreview}
                  onProfileClick={goToPublicProfile}
                  showUserAttachments={false}
                />
              ))}
            </JobCardsCarousel>
              <div className="flex justify-end pt-1">
                <Button variant="link" size="sm" className="h-auto gap-1 px-2 text-xs font-bold" asChild>
                  <Link to={incomingJobsUrl}>
                    Open incoming requests
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </>
          )}
      </div>
    </>
  );

  return (
    <>
      <section
        className="mt-8 overflow-visible px-1 pt-1"
        aria-label={mode === "hire" ? "Available helpers live now" : "Incoming job requests"}
      >
        {mode === "hire" ? hireSection : workSection}
      </section>

      <FullscreenMapModal
        job={selectedMapJob}
        isOpen={!!selectedMapJob}
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
      />

      <JobDetailsModal
        isOpen={!!selectedJobDetails}
        onOpenChange={(open) => !open && setSelectedJobDetails(null)}
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
                if (!notif) return;
                const ok = await handleDecline(notif.id);
                if (ok) setSelectedJobDetails(null);
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
