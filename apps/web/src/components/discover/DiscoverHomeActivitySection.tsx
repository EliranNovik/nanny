import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { apiPost } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  CommunityPostCard,
  type CommunityFeedPost,
  type CommunityPostImage,
  type CommunityPostWithMeta,
} from "@/components/community/CommunityPostCard";
import { JobCardsCarousel } from "@/components/jobs/JobCardsCarousel";
import { buildJobsUrlFromTabId } from "@/components/jobs/jobsPerspective";
import { useDiscoverShortcutsCounts } from "@/hooks/useDiscoverShortcutsCounts";
import { openCommunityContact } from "@/lib/communityContact";
import { ExpiryCountdown } from "@/components/ExpiryCountdown";
import { LiveTimer } from "@/components/LiveTimer";
import { StarRating } from "@/components/StarRating";
import type { LucideIcon } from "lucide-react";
import {
  Baby,
  Banknote,
  Bell,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock,
  Languages,
  ListChecks,
  Loader2,
  MapPin,
  MessageSquare,
  Sparkles,
  Timer,
  Users,
  XCircle,
} from "lucide-react";

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

function serviceHeroImageSrc(job: { service_type?: string }) {
  if (job.service_type === "cleaning") return "/cleaning-mar22.png";
  if (job.service_type === "cooking") return "/cooking-mar22.png";
  if (job.service_type === "pickup_delivery") return "";
  if (job.service_type === "nanny") return "/nanny-mar22.png";
  if (job.service_type === "other_help") return "/other-mar22.png";
  return "/nanny-mar22.png";
}

/** Icon + value only (no labels). Status / posted not included. */
function buildIncomingJobDetailLines(
  job: JobRequestRow
): Array<{ key: string; Icon: LucideIcon; text: string }> {
  const startAt = job.start_at ? new Date(job.start_at) : null;
  const hideNannyPlaceholders =
    Boolean(job.community_post_id) && job.service_type !== "nanny";
  const out: Array<{ key: string; Icon: LucideIcon; text: string }> = [];

  if (job.location_city?.trim()) {
    out.push({ key: "loc", Icon: MapPin, text: job.location_city.trim() });
  }
  if (startAt) {
    out.push({ key: "start", Icon: CalendarClock, text: startAt.toLocaleString() });
  }
  if (job.shift_hours) {
    out.push({ key: "shift", Icon: Clock, text: String(job.shift_hours) });
  }
  if (job.time_duration) {
    out.push({
      key: "dur",
      Icon: Timer,
      text: job.time_duration.replace(/_/g, " "),
    });
  }
  if (job.care_type && !hideNannyPlaceholders) {
    out.push({ key: "care", Icon: Baby, text: String(job.care_type) });
  }
  if (job.children_count != null && !hideNannyPlaceholders && job.children_count > 0) {
    out.push({ key: "children", Icon: Users, text: String(job.children_count) });
  }
  if (job.children_age_group && !hideNannyPlaceholders) {
    out.push({ key: "age", Icon: Users, text: String(job.children_age_group) });
  }
  if (Array.isArray(job.languages_pref) && job.languages_pref.length > 0) {
    out.push({ key: "lang", Icon: Languages, text: job.languages_pref.join(", ") });
  }
  if (Array.isArray(job.requirements) && job.requirements.length > 0) {
    out.push({ key: "req", Icon: ListChecks, text: job.requirements.join(", ") });
  }
  if (job.budget_min != null || job.budget_max != null) {
    const min = job.budget_min != null ? String(job.budget_min) : "";
    const max = job.budget_max != null ? String(job.budget_max) : "";
    out.push({
      key: "budget",
      Icon: Banknote,
      text: [min, max].filter(Boolean).join(" – ") || "—",
    });
  }

  return out;
}

export function DiscoverHomeActivitySection() {
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

  async function handleDecline(notifId: string) {
    setDeleting(notifId);
    try {
      const { error } = await supabase.from("job_candidate_notifications").delete().eq("id", notifId);
      if (error) throw error;
      setInbound((prev) => prev.filter((n) => n.id !== notifId));
      addToast({ title: "Declined", variant: "default" });
    } catch (err: unknown) {
      addToast({
        title: "Failed to decline",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "error",
      });
    } finally {
      setDeleting(null);
    }
  }

  const secondTabLabel = "Incoming requests";
  const secondTabCount = incomingRequestsCount;
  /** Matches the carousel in this tab (same feed as loadFeed). */
  const availabilityPostsCount = feedPosts.length;

  return (
    <section className="mt-8 overflow-visible px-1 pt-1" aria-label="Availability and requests">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          At a glance
        </p>
        <Sparkles className="h-4 w-4 text-orange-500" aria-hidden />
      </div>

      <Tabs defaultValue="feed" className="w-full overflow-visible">
        <TabsList className="mb-2 flex h-12 w-full items-stretch gap-1 overflow-visible rounded-2xl border border-border/60 bg-muted/70 p-1 shadow-inner dark:border-border/50 dark:bg-muted/50">
          <TabsTrigger
            value="feed"
            className="relative min-w-0 flex-1 overflow-visible rounded-xl border-0 bg-transparent px-2 py-1.5 text-[11px] font-semibold leading-tight text-muted-foreground shadow-none ring-offset-0 transition-all duration-200 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-orange-500/20 dark:data-[state=active]:bg-card dark:data-[state=active]:ring-orange-400/25 sm:text-xs sm:font-bold"
          >
            <span className="flex h-full min-h-0 w-full items-center justify-center px-1 text-center leading-tight">
              <span className="line-clamp-2">Availability posts</span>
            </span>
            {!feedLoading && availabilityPostsCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -right-1 -top-1 z-[2] flex h-7 min-h-7 min-w-7 items-center justify-center rounded-full border-[3px] border-background px-1.5 text-[11px] font-black leading-none shadow-md dark:border-card"
              >
                {availabilityPostsCount > 99 ? "99+" : availabilityPostsCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="action"
            className="relative min-w-0 flex-1 overflow-visible rounded-xl border-0 bg-transparent px-2 py-1.5 text-[11px] font-semibold leading-tight text-muted-foreground shadow-none ring-offset-0 transition-all duration-200 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-orange-500/20 dark:data-[state=active]:bg-card dark:data-[state=active]:ring-orange-400/25 sm:text-xs sm:font-bold"
          >
            <span className="flex h-full min-h-0 w-full items-center justify-center px-1 text-center leading-tight">
              <span className="line-clamp-2">{secondTabLabel}</span>
            </span>
            {secondTabCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -right-1 -top-1 z-[2] flex h-7 min-h-7 min-w-7 items-center justify-center rounded-full border-[3px] border-background px-1.5 text-[11px] font-black leading-none shadow-md dark:border-card"
              >
                {secondTabCount > 99 ? "99+" : secondTabCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="feed" className="mt-5 space-y-5">
          {feedLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-9 w-9 animate-spin text-orange-500" />
            </div>
          ) : feedPosts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No availability posts right now.</p>
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
        </TabsContent>

        <TabsContent value="action" className="mt-5 space-y-5">
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
              <JobCardsCarousel>
                {inbound.map((notif) => {
                  const job = notif.job_requests;
                  const notes =
                    typeof job.notes === "string" && job.notes.trim() ? job.notes.trim() : null;
                  const hero = serviceHeroImageSrc(job);
                  const detailLines = buildIncomingJobDetailLines(job);
                  return (
                    <div
                      key={notif.id}
                      data-job-card
                      className="relative min-w-[min(88vw,320px)] max-w-[320px] shrink-0 snap-start overflow-hidden bg-transparent"
                    >
                      <Badge className="absolute right-0 top-1 z-10 h-6 rounded-full border-none bg-amber-500 px-2.5 text-[9px] font-black uppercase leading-none text-white shadow-sm">
                        Request
                      </Badge>
                      <div className="flex flex-col gap-6">
                        <div className="flex items-start gap-4 px-4 pb-1 pr-20 pt-4">
                          <button
                            type="button"
                            className="flex min-w-0 flex-1 gap-4 rounded-xl text-left outline-none transition hover:bg-muted/50"
                            onClick={() => navigate(`/profile/${job.client_id}`)}
                          >
                            <Avatar className="h-14 w-14 shrink-0 border border-neutral-200 dark:border-neutral-600">
                              <AvatarImage src={job.profiles?.photo_url || ""} />
                              <AvatarFallback className="bg-orange-100 text-lg font-bold text-orange-900">
                                {(job.profiles?.full_name || "?").charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1 pt-0.5">
                              <span className="block truncate text-base font-semibold text-foreground">
                                {job.profiles?.full_name || "Client"}
                              </span>
                              {job.profiles?.average_rating ? (
                                <StarRating
                                  rating={job.profiles.average_rating}
                                  size="sm"
                                  showCount={false}
                                  className="mt-1"
                                />
                              ) : (
                                <p className="mt-1 text-xs text-muted-foreground">New client</p>
                              )}
                            </div>
                          </button>
                        </div>

                        <div className="flex gap-4 px-4">
                          <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-border/40 bg-muted/20 dark:border-border/50">
                            {hero ? (
                              <img
                                src={hero}
                                alt=""
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center px-1 text-center text-[10px] font-semibold text-muted-foreground">
                                Map / details in job
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1 space-y-3">
                            <p className="text-base font-bold leading-tight tracking-tight text-foreground">
                              {formatJobTitle(job)}
                            </p>
                            {detailLines.length > 0 ? (
                              <div className="max-h-[11rem] space-y-2.5 overflow-y-auto pr-0.5 [scrollbar-width:thin]">
                                {detailLines.map(({ key, Icon, text }) => (
                                  <div
                                    key={key}
                                    className="flex items-start gap-2 text-[12px] leading-snug text-foreground/95"
                                  >
                                    <Icon
                                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600/85 dark:text-amber-400/90"
                                      aria-hidden
                                    />
                                    <span className="min-w-0 flex-1">{text}</span>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>

                        {notes ? (
                          <div className="mx-4 flex items-start gap-3 px-0.5">
                            <MessageSquare
                              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground"
                              aria-hidden
                            />
                            <p className="min-w-0 flex-1 whitespace-pre-wrap text-[12px] font-medium leading-relaxed text-foreground/95">
                              {notes}
                            </p>
                          </div>
                        ) : null}

                        <div className="space-y-4 border-t border-border/35 px-4 py-5 dark:border-border/50">
                          {job.community_post_expires_at ? (
                            <div className="flex flex-wrap items-center gap-1 text-sm font-semibold text-orange-600">
                              <ExpiryCountdown
                                expiresAtIso={job.community_post_expires_at}
                                endedLabel="Ended"
                              />
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                              <span className="text-xs font-bold uppercase tracking-wide">Posted</span>
                              <LiveTimer createdAt={job.created_at} />
                            </div>
                          )}
                          <div className="flex flex-nowrap gap-3 overflow-x-auto pb-0.5 pt-1 [-webkit-overflow-scrolling:touch]">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="min-w-[6.5rem] shrink-0 gap-1.5 rounded-xl font-bold"
                              disabled={deleting === notif.id || confirming === notif.id}
                              onClick={() => void handleDecline(notif.id)}
                            >
                              {deleting === notif.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <XCircle className="h-4 w-4" />
                              )}
                              Decline
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              className="min-w-[6.5rem] shrink-0 gap-1.5 rounded-xl bg-emerald-600 font-bold hover:bg-emerald-700"
                              disabled={deleting === notif.id || confirming === notif.id}
                              onClick={() => void handleConfirm(job.id, notif.id)}
                            >
                              {confirming === notif.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-4 w-4" />
                              )}
                              Select
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
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
        </TabsContent>
      </Tabs>
    </section>
  );
}
