import { useState, useEffect, useRef } from "react";
import { formatDistanceToNow } from "date-fns";
import { Link, useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import {
  MessageSquare,
  Clock,
  ChevronRight,
  BadgeCheck,
  Star,
  Phone,
  Send,
  Loader2,
  Image as ImageIcon,
  Video,
  UserCircle,
  Plus,
  Trash2,
  Sparkles,
  HelpCircle,
  HeartHandshake,
  Heart,
  User as UserIcon,
  LayoutGrid,
  Medal,
  Trophy,
  Crown,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { StarRating } from "@/components/StarRating";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { isFreelancerLiveWindowActive } from "@/lib/freelancerLiveWindow";
import {
  canStartInCardLabel,
  respondsWithinCardLabel,
} from "@/lib/liveCanStart";

import {
  PUBLIC_PROFILE_MEDIA_BUCKET,
  publicProfileMediaPublicUrl,
} from "@/lib/publicProfileMedia";
import { FullscreenMapModal } from "@/components/FullscreenMapModal";
import { ImageLightboxModal } from "@/components/ImageLightboxModal";
import { VideoLightboxModal } from "@/components/VideoLightboxModal";
import { type AvailabilityPayload } from "@/lib/availabilityPosts";
import {
  getServiceCategoryImage,
  isServiceCategoryId,
  serviceCategoryLabel,
  type ServiceCategoryId,
} from "@/lib/serviceCategories";
import { HIRE_CATEGORY_TILE_UI } from "@/lib/discoverCategoryTileIcons";
import { apiPost } from "@/lib/api";
import { ProfilePostsFeed } from "@/components/profile/ProfilePostsFeed";
import {
  readPublicProfileCache,
  writePublicProfileCache,
} from "@/lib/publicProfileCache";
import {
  playFavoriteAddedToLikedTabFlight,
  playFavoriteRemovedFromLikedTabFlight,
} from "@/lib/favoriteToLikedTabFlight";
import { ProfileKnockMenu } from "@/components/ProfileKnockMenu";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type PostedHelpEngagement =
  | "idle"
  | "loading"
  | "can_respond"
  | "accepted"
  | "declined"
  | "not_invited"
  | "hidden";



function livePostCategoryLabel(category: string): string {
  return isServiceCategoryId(category)
    ? serviceCategoryLabel(category as ServiceCategoryId)
    : category.replace(/_/g, " ");
}

/** Medal @1, trophy @6–10, crown @11+ — same tiers as helper search / confirmed cards. */
function liveHelpCornerTierFromCount(
  n: number | null | undefined,
): { kind: "medal" | "trophy" | "crown"; title: string } | null {
  if (n == null || n <= 0) return null;
  if (n === 1)
    return {
      kind: "medal",
      title: "First live help booking this week",
    };
  if (n > 10)
    return {
      kind: "crown",
      title: "Top tier · over 10 live help bookings this week",
    };
  if (n > 5)
    return {
      kind: "trophy",
      title: "Great week · over 5 live help bookings",
    };
  return null;
}

type LiveCommunityPostRow = {
  id: string;
  category: string;
  title: string;
  note: string | null;
  expires_at: string;
  availability_payload: AvailabilityPayload | null;
  created_at: string;
};

function jobServiceLabel(serviceType: string | undefined): string {
  if (!serviceType) return "Job";
  return isServiceCategoryId(serviceType)
    ? serviceCategoryLabel(serviceType)
    : serviceType.replace(/_/g, " ");
}



type ProfilePostedHelpRequest = {
  id: string;
  service_type: string;
  status: string;
  created_at: string;
  location_city: string;
};

interface PublicProfile {
  id: string;
  full_name: string | null;
  photo_url: string | null;
  bio: string | null;
  role: string | null;
  /** Client accounts that offer help (`get_helpers_near_location` / HelpersPage). */
  is_available_for_jobs?: boolean | null;
  is_verified?: boolean | null;
  city: string | null;
  categories?: string[];
  whatsapp_number?: string | null;
  telegram_username?: string | null;
  average_rating?: number;
  total_ratings?: number;
}

/** Mirrors HelpersPage / `get_helpers_near_location` — freelancer or active client-helper. */
function canActAsHelperOnPublicProfile(
  p: PublicProfile | null,
): boolean {
  if (!p?.role) return false;
  if (p.role === "freelancer") return true;
  if (p.role === "client" && p.is_available_for_jobs === true) return true;
  return false;
}

type FreelancerMeta = {
  live_until?: string | null;
  live_can_start_in?: string | null;
  available_now?: boolean | null;
};

type HelperReplyStats = { avg_seconds: number; sample_count: number };

interface UserReview {
  id: string;
  rating: number;
  review_text: string | null;
  created_at: string;
  reviewer: {
    full_name: string | null;
    photo_url: string | null;
  };
}

interface SharedJob {
  id: string;
  service_type: string;
  status: string;
  created_at: string;
  client_id: string;
  selected_freelancer_id: string | null;
}



interface PublicProfileMediaRow {
  id: string;
  user_id: string;
  media_type: "image" | "video";
  storage_path: string;
  sort_order: number;
  created_at: string;
}

type ProfileMediaSectionTab = "images" | "videos" | "posts" | "about";

function publicProfileCategoryBadgeIcon(categoryId: string) {
  const id = categoryId.toLowerCase();
  if (!isServiceCategoryId(id)) {
    return (
      <HelpCircle
        className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400"
        strokeWidth={2.25}
        aria-hidden
      />
    );
  }
  const { Icon, iconClass } = HIRE_CATEGORY_TILE_UI[id];
  return (
    <Icon
      className={cn("h-4 w-4 shrink-0", iconClass)}
      strokeWidth={2.25}
      aria-hidden
    />
  );
}

export default function PublicProfilePage() {
  const { userId } = useParams();
  const { user: currentUser, profile: currentProfile } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [freelancerMeta, setFreelancerMeta] = useState<FreelancerMeta | null>(
    null,
  );
  const [helperReplyStats, setHelperReplyStats] =
    useState<HelperReplyStats | null>(null);
  const [editingBio, setEditingBio] = useState(false);
  const [bioDraft, setBioDraft] = useState("");
  const [savingBio, setSavingBio] = useState(false);
  const [sharedJobs, setSharedJobs] = useState<SharedJob[]>([]);
  const [reviews, setReviews] = useState<UserReview[]>([]);
  const [mediaItems, setMediaItems] = useState<PublicProfileMediaRow[]>([]);
  const [liveCommunityPosts, setLiveCommunityPosts] = useState<
    LiveCommunityPostRow[]
  >([]);
  const [postedHelpRequests, setPostedHelpRequests] = useState<
    ProfilePostedHelpRequest[]
  >([]);
  const [postedHelpMapJob, setPostedHelpMapJob] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [postedHelpEngagement, setPostedHelpEngagement] =
    useState<PostedHelpEngagement>("idle");
  const [, setPostedHelpNotifId] = useState<string | null>(null);

  const [postedHelpConfirming, setPostedHelpConfirming] = useState(false);
  const [postedHelpDeclining, setPostedHelpDeclining] = useState(false);
  const [loading, setLoading] = useState(true);
  const [openingChat, setOpeningChat] = useState(false);
  const [profileFavorited, setProfileFavorited] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [profileMediaLightbox, setProfileMediaLightbox] = useState<{
    urls: string[];
    initialIndex: number;
  } | null>(null);
  const [profileVideoLightboxUrl, setProfileVideoLightboxUrl] = useState<
    string | null
  >(null);
  const [profileMediaTab, setProfileMediaTab] =
    useState<ProfileMediaSectionTab>("posts");
  /** Completed live-help bookings in the last 7 days (helpers only). */
  const [liveHelpWeekCount, setLiveHelpWeekCount] = useState<number | null>(
    null,
  );
  const profileFavoriteButtonRef = useRef<HTMLButtonElement>(null);

  async function saveBio(nextBio: string) {
    if (!userId || !isOwnProfile) return;
    setSavingBio(true);
    try {
      const bio = nextBio.trim() || null;
      const { error } = await supabase
        .from("profiles")
        .update({ bio })
        .eq("id", userId);
      if (error) throw error;

      // Keep legacy freelancer_profiles.bio in sync when applicable.
      if ((profile?.role || "") === "freelancer") {
        await supabase
          .from("freelancer_profiles")
          .update({ bio })
          .eq("user_id", userId);
      }

      setProfile((p) => (p ? { ...p, bio } : p));
      setEditingBio(false);
      addToast({ title: "Bio updated", variant: "success" });
    } catch (e) {
      addToast({ title: "Could not update bio", variant: "error" });
    } finally {
      setSavingBio(false);
    }
  }

  async function handleOpenDirectChat() {
    if (!userId || !currentUser || !profile) return;
    if (userId === currentUser.id) return;

    if (!currentProfile?.role) {
      addToast({
        title: "Please wait",
        description: "Your profile is still loading. Try again in a moment.",
        variant: "default",
      });
      return;
    }

    const myRole = currentProfile.role;
    const theirRole = profile.role;

    if (myRole !== "client" && myRole !== "freelancer") {
      addToast({
        title: "Messaging unavailable",
        description: "Your account cannot start a chat from here.",
        variant: "error",
      });
      return;
    }
    if (theirRole !== "client" && theirRole !== "freelancer") {
      addToast({
        title: "Messaging unavailable",
        description: "You can only message clients or helpers.",
        variant: "error",
      });
      return;
    }
    if (myRole === theirRole) {
      addToast({
        title: "Messaging unavailable",
        description:
          "You can only message someone in the opposite role (client ↔ helper).",
        variant: "default",
      });
      return;
    }

    const clientId = myRole === "client" ? currentUser.id : userId;
    const freelancerId = myRole === "freelancer" ? currentUser.id : userId;

    setOpeningChat(true);
    try {
      const { data: existing, error: findErr } = await supabase
        .from("conversations")
        .select("id")
        .eq("client_id", clientId)
        .eq("freelancer_id", freelancerId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (findErr) throw findErr;

      if (existing?.id) {
        navigate(`/messages?conversation=${existing.id}`);
        return;
      }

      const { data: created, error: insErr } = await supabase
        .from("conversations")
        .insert({
          job_id: null,
          client_id: clientId,
          freelancer_id: freelancerId,
        })
        .select("id")
        .single();

      if (insErr) throw insErr;

      navigate(`/messages?conversation=${created.id}`);
    } catch (e: unknown) {
      console.error(e);
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as { message: string }).message)
          : "Please try again.";
      addToast({
        title: "Could not open chat",
        description: msg,
        variant: "error",
      });
    } finally {
      setOpeningChat(false);
    }
  }

  async function toggleProfileFavorite() {
    if (!currentUser || !userId || currentUser.id === userId) return;
    setFavoriteBusy(true);
    try {
      if (profileFavorited) {
        const { error } = await supabase
          .from("profile_favorites")
          .delete()
          .eq("user_id", currentUser.id)
          .eq("favorite_user_id", userId);
        if (error) throw error;
        setProfileFavorited(false);
        addToast({ title: "Removed from saved profiles", variant: "success" });
        requestAnimationFrame(() => {
          playFavoriteRemovedFromLikedTabFlight(
            profileFavoriteButtonRef.current,
          );
        });
      } else {
        const { error } = await supabase.from("profile_favorites").insert({
          user_id: currentUser.id,
          favorite_user_id: userId,
        });
        if (error) throw error;
        setProfileFavorited(true);
        addToast({ title: "Saved — view under Saved", variant: "success" });
        requestAnimationFrame(() => {
          playFavoriteAddedToLikedTabFlight(profileFavoriteButtonRef.current);
        });
      }
    } catch (e: unknown) {
      addToast({
        title: "Could not update",
        description: e instanceof Error ? e.message : "Try again.",
        variant: "error",
      });
    } finally {
      setFavoriteBusy(false);
    }
  }

  useEffect(() => {
    if (!currentUser?.id || !userId || currentUser.id === userId) {
      setProfileFavorited(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("profile_favorites")
        .select("favorite_user_id")
        .eq("user_id", currentUser.id)
        .eq("favorite_user_id", userId)
        .maybeSingle();
      if (!cancelled) setProfileFavorited(!!data);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id, userId]);

  useEffect(() => {
    if (!userId || !currentUser?.id) return;

    const viewerId = currentUser.id;
    const cached = readPublicProfileCache(viewerId, userId);

    if (cached) {
      setProfile(cached.profile as PublicProfile);
      setFreelancerMeta((cached.freelancerMeta as FreelancerMeta) ?? null);
      setHelperReplyStats((cached.helperReplyStats as HelperReplyStats) ?? null);
      setSharedJobs(cached.sharedJobs as SharedJob[]);
      setReviews(cached.reviews as UserReview[]);
      setMediaItems(cached.mediaItems as PublicProfileMediaRow[]);
      setLiveCommunityPosts(
        cached.liveCommunityPosts as LiveCommunityPostRow[],
      );
      setPostedHelpRequests(
        cached.postedHelpRequests as ProfilePostedHelpRequest[],
      );
      setLoading(false);
    } else {
      setLoading(true);
    }

    let cancelled = false;

    const fetchProfileAndJobs = async () => {
      try {
        const [{ data: profileData, error: profileError }, { data: freelancerData }] =
          await Promise.all([
            supabase
              .from("profiles")
              .select(
                "id, full_name, photo_url, role, is_available_for_jobs, is_verified, city, categories, bio, whatsapp_number_e164, telegram_username, average_rating, total_ratings",
              )
              .eq("id", userId)
              .single(),
            supabase
              .from("freelancer_profiles")
              .select("bio, live_until, live_can_start_in, available_now")
              .eq("user_id", userId)
              .maybeSingle(),
          ]);

        if (profileError) throw profileError;

        const bio =
          (profileData as { bio?: string | null } | null)?.bio ??
          freelancerData?.bio ??
          null;
        const nextProfile: PublicProfile = {
          ...profileData,
          bio,
          whatsapp_number: profileData.whatsapp_number_e164,
        };
        setProfile(nextProfile);
        setBioDraft(bio ?? "");
        setFreelancerMeta({
          live_until: freelancerData?.live_until ?? null,
          live_can_start_in: freelancerData?.live_can_start_in ?? null,
          available_now: freelancerData?.available_now ?? null,
        });

        // 3. Jobs + pending notifications strictly between viewer (A) and profile (B) only.
        const profileId = userId;

        const jrSelect =
          "id, service_type, status, created_at, client_id, selected_freelancer_id" as const;
        const notifSelect = `
              job_id, status, created_at, freelancer_id,
              job_requests (
                ${jrSelect}
              )
            `;

        const runHelperRpcs = canActAsHelperOnPublicProfile(nextProfile);
        const batchPromises: PromiseLike<unknown>[] = [
          supabase
            .from("job_requests")
            .select(jrSelect)
            .eq("client_id", viewerId)
            .eq("selected_freelancer_id", profileId)
            .order("created_at", { ascending: false }),
          supabase
            .from("job_requests")
            .select(jrSelect)
            .eq("client_id", profileId)
            .eq("selected_freelancer_id", viewerId)
            .order("created_at", { ascending: false }),
          supabase
            .from("job_candidate_notifications")
            .select(notifSelect)
            .in("status", ["pending", "opened"])
            .eq("freelancer_id", profileId)
            .order("created_at", { ascending: false }),
          supabase
            .from("job_candidate_notifications")
            .select(notifSelect)
            .in("status", ["pending", "opened"])
            .eq("freelancer_id", viewerId)
            .order("created_at", { ascending: false }),
          supabase
            .from("job_reviews")
            .select(
              "id, rating, review_text, created_at, reviewer:profiles!reviewer_id(full_name, photo_url)",
            )
            .eq("reviewee_id", userId)
            .order("created_at", { ascending: false }),
          supabase
            .from("public_profile_media")
            .select("*")
            .eq("user_id", userId)
            .order("sort_order", { ascending: true }),
          supabase
            .from("community_posts")
            .select(
              "id, category, title, note, expires_at, availability_payload, created_at",
            )
            .eq("author_id", userId)
            .order("created_at", { ascending: false })
            .limit(40),
          supabase
            .from("job_requests")
            .select("id, service_type, status, created_at, location_city")
            .eq("client_id", userId)
            .in("status", ["ready", "notifying", "confirmations_closed"])
            .order("created_at", { ascending: false })
            .limit(30),
        ];
        if (runHelperRpcs) {
          batchPromises.push(
            supabase.rpc("get_helper_chat_response_stats", {
              p_helper_ids: [userId],
            }),
            supabase.rpc("get_helpers_live_help_week_counts", {
              p_helper_ids: [userId],
            }),
          );
        }
        const batchResults = await Promise.all(batchPromises);

        type PgResult = { data: unknown; error: unknown };
        const [
          jobsViewerClient,
          jobsProfileClient,
          notifWhenProfileIsHelper,
          notifWhenViewerIsHelper,
          reviewsData,
          mediaData,
          communityData,
          postedHelpData,
        ] = batchResults.slice(0, 8) as [
          PgResult,
          PgResult,
          PgResult,
          PgResult,
          PgResult,
          PgResult,
          PgResult,
          PgResult,
        ];

        const statRpc: PgResult = runHelperRpcs
          ? (batchResults[8] as PgResult)
          : { data: null, error: null };
        const weekRpc: PgResult = runHelperRpcs
          ? (batchResults[9] as PgResult)
          : { data: null, error: null };

        let nextHelperReplyStats: HelperReplyStats | null = null;
        if (runHelperRpcs) {
          try {
            const statRows = statRpc.data as unknown[] | null;
            const statErr = statRpc.error;
            if (statErr && import.meta.env.DEV) {
              console.warn(
                "[PublicProfilePage] get_helper_chat_response_stats:",
                statErr,
              );
            }
            if (!statErr && Array.isArray(statRows) && statRows.length > 0) {
              type StatRow = {
                helper_id?: string | null;
                avg_seconds?: number | null;
                sample_count?: number | null;
              };
              let sr: StatRow | undefined;
              if (statRows.length === 1) {
                sr = statRows[0] as StatRow;
              } else {
                sr = (statRows as StatRow[]).find(
                  (r) =>
                    r.helper_id != null && String(r.helper_id) === String(userId),
                );
              }
              if (
                sr &&
                sr.helper_id != null &&
                sr.avg_seconds != null &&
                sr.sample_count != null
              ) {
                nextHelperReplyStats = {
                  avg_seconds: Number(sr.avg_seconds),
                  sample_count: Number(sr.sample_count),
                };
              }
            }
          } catch (e) {
            if (import.meta.env.DEV) {
              console.debug(
                "[PublicProfilePage] get_helper_chat_response_stats failed:",
                e,
              );
            }
          }
        }
        setHelperReplyStats(nextHelperReplyStats);

        let nextLiveHelpWeek: number | null = null;
        if (runHelperRpcs) {
          try {
            const weekRows = weekRpc.data as unknown[] | null;
            const weekErr = weekRpc.error;
            if (weekErr && import.meta.env.DEV) {
              console.warn(
                "[PublicProfilePage] get_helpers_live_help_week_counts:",
                weekErr,
              );
            }
            if (!weekErr && Array.isArray(weekRows)) {
              for (const wr of weekRows as {
                helper_id?: string | null;
                live_help_week_count?: number | string | null;
              }[]) {
                if (
                  !wr.helper_id ||
                  String(wr.helper_id) !== String(userId) ||
                  wr.live_help_week_count == null
                )
                  continue;
                const n = Number(wr.live_help_week_count);
                if (Number.isFinite(n) && n > 0) {
                  nextLiveHelpWeek = Math.floor(n);
                  break;
                }
              }
            }
          } catch (e) {
            if (import.meta.env.DEV) {
              console.debug(
                "[PublicProfilePage] get_helpers_live_help_week_counts failed:",
                e,
              );
            }
          }
        }
        if (!cancelled) setLiveHelpWeekCount(nextLiveHelpWeek);

        if (reviewsData.error) throw reviewsData.error;
        if (mediaData.error) throw mediaData.error;
        if (communityData.error) throw communityData.error;
        if (postedHelpData.error) throw postedHelpData.error;

        function embeddedJobRequest(n: any): SharedJob | null {
          const raw = n.job_requests;
          const jr = (Array.isArray(raw) ? raw[0] : raw) as any;
          if (!jr?.id) return null;
          return {
            id: jr.id,
            service_type: jr.service_type,
            status: jr.status,
            created_at: jr.created_at,
            client_id: jr.client_id,
            selected_freelancer_id: jr.selected_freelancer_id,
          };
        }

        const pendingFromNotifications: SharedJob[] = [];
        for (const n of (notifWhenProfileIsHelper.data ?? []) as any[]) {
          const jr = embeddedJobRequest(n);
          if (!jr) continue;
          if (jr.client_id === viewerId) {
            pendingFromNotifications.push({
              ...jr,
              status: "pending",
              selected_freelancer_id: profileId,
            });
          }
        }
        for (const n of (notifWhenViewerIsHelper.data ?? []) as any[]) {
          const jr = embeddedJobRequest(n);
          if (!jr) continue;
          if (jr.client_id === profileId) {
            pendingFromNotifications.push({
              ...jr,
              status: "pending",
              selected_freelancer_id: viewerId,
            });
          }
        }

        const shared: SharedJob[] = [
          ...((jobsViewerClient.data || []) as SharedJob[]),
          ...((jobsProfileClient.data || []) as SharedJob[]),
          ...pendingFromNotifications,
        ];

        if (!cancelled) {
          setSharedJobs(shared);
          setReviews((reviewsData.data || []) as unknown as UserReview[]);
          setMediaItems((mediaData.data || []) as PublicProfileMediaRow[]);
          setLiveCommunityPosts(communityData.data as LiveCommunityPostRow[]);
          setPostedHelpRequests(
            postedHelpData.data as ProfilePostedHelpRequest[],
          );
          setLoading(false);
          writePublicProfileCache(viewerId, userId, {
            profile: nextProfile,
            freelancerMeta: {
              live_until: freelancerData?.live_until ?? null,
              live_can_start_in: freelancerData?.live_can_start_in ?? null,
              available_now: freelancerData?.available_now ?? null,
            },
            helperReplyStats: nextHelperReplyStats,
            sharedJobs: shared,
            reviews: reviewsData.data,
            mediaItems: mediaData.data,
            liveCommunityPosts: communityData.data,
            postedHelpRequests: postedHelpData.data,
          });
        }
      } catch (e: unknown) {
        console.error(e);
        if (!cancelled) {
          setLoading(false);
          setLiveHelpWeekCount(null);
        }
      }
    };

    void fetchProfileAndJobs();
    return () => {
      cancelled = true;
    };
  }, [userId, currentUser?.id]);

  async function handleProfileMediaUpload(file: File, type: "image" | "video") {
    if (!userId || !currentUser || userId !== currentUser.id) return;
    setUploadingMedia(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(PUBLIC_PROFILE_MEDIA_BUCKET)
        .upload(path, file);
      if (upErr) throw upErr;

      const { error: insErr } = await supabase
        .from("public_profile_media")
        .insert({
          user_id: userId,
          media_type: type,
          storage_path: path,
          sort_order: mediaItems.length,
        });
      if (insErr) throw insErr;

      const { data: refreshed } = await supabase
        .from("public_profile_media")
        .select("*")
        .eq("user_id", userId)
        .order("sort_order", { ascending: true });
      if (refreshed) setMediaItems(refreshed);
      addToast({ title: "Media added", variant: "success" });
    } catch (e: unknown) {
      console.error(e);
      addToast({ title: "Upload failed", variant: "error" });
    } finally {
      setUploadingMedia(false);
    }
  }

  async function handleDeleteProfileMedia(item: PublicProfileMediaRow) {
    if (!userId || !currentUser || userId !== currentUser.id) return;
    setUploadingMedia(true);
    try {
      await supabase.storage
        .from(PUBLIC_PROFILE_MEDIA_BUCKET)
        .remove([item.storage_path]);
      await supabase
        .from("public_profile_media")
        .delete()
        .eq("id", item.id);
      setMediaItems((prev) => prev.filter((m) => m.id !== item.id));
      addToast({ title: "Media removed", variant: "success" });
    } catch (e) {
      console.error(e);
      addToast({ title: "Delete failed", variant: "error" });
    } finally {
      setUploadingMedia(false);
    }
  }

  const isOwnProfile = currentUser?.id === userId;

  const helpedOthersCount = sharedJobs.filter(
    (j) => j.status === "completed" && j.selected_freelancer_id === userId,
  ).length;
  const gotHelpedCount = sharedJobs.filter(
    (j) => j.status === "completed" && j.client_id === userId,
  ).length;

  const imageRows = mediaItems.filter((m) => m.media_type === "image");
  const videoRows = mediaItems.filter((m) => m.media_type === "video");
  const galleryImageUrls = imageRows.map((r) =>
    publicProfileMediaPublicUrl(r.storage_path),
  );

  const photoInitials = (profile?.full_name || "??")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);

  const showHelperBadges = canActAsHelperOnPublicProfile(profile);
  const isLiveNow = showHelperBadges
    ? isFreelancerLiveWindowActive(freelancerMeta)
    : false;
  const readyInLabel = showHelperBadges
    ? canStartInCardLabel(freelancerMeta?.live_can_start_in)
    : null;
  const respondsWithinLabel = showHelperBadges
    ? respondsWithinCardLabel(
        helperReplyStats?.avg_seconds,
        helperReplyStats?.sample_count,
      )
    : null;

  const showLiveHelpWeekBadge =
    showHelperBadges &&
    liveHelpWeekCount != null &&
    liveHelpWeekCount > 0;
  const liveHelpTier = showLiveHelpWeekBadge
    ? liveHelpCornerTierFromCount(liveHelpWeekCount)
    : null;

  /** On the avatar image; slightly past top-right rim, no ring — reads as “on” the photo. */
  const profileLiveNowDot = isLiveNow ? (
    <span
      className="pointer-events-none absolute right-0 top-0 z-20 flex h-9 w-9 translate-x-[12%] -translate-y-[12%] items-center justify-center"
      role="status"
      aria-label="Live now"
    >
      <span className="absolute inset-[5px] animate-ping rounded-full bg-emerald-400/45 motion-reduce:animate-none" />
      <span className="relative block h-[18px] w-[18px] rounded-full bg-emerald-500 shadow-[0_0_18px_rgba(16,185,129,0.95)]" />
    </span>
  ) : null;

  const helperBadgesRow =
    readyInLabel ||
    respondsWithinLabel ||
    showLiveHelpWeekBadge ? (
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {showLiveHelpWeekBadge && liveHelpWeekCount != null ? (
          <span
            className={cn(
              "relative inline-flex min-w-[7.75rem] flex-col items-stretch gap-0.5 self-start rounded-xl py-2 pl-3",
              liveHelpTier?.kind === "crown" ? "pr-[3.5rem]" : "pr-[2.75rem]",
              "bg-gradient-to-br from-violet-600/90 to-fuchsia-600/75 text-white shadow-md shadow-violet-900/20 ring-1 ring-inset ring-white/20 dark:from-violet-600/85 dark:to-fuchsia-600/70",
            )}
            role="status"
            title="Completed bookings in the last 7 days"
            aria-label={`${liveHelpWeekCount} completed live help bookings in the last 7 days`}
          >
            {liveHelpTier ? (
              <span
                className={cn(
                  "pointer-events-none absolute right-1 top-1 inline-flex shrink-0 items-center justify-center rounded-full bg-black/28 shadow-md ring-1 ring-inset ring-white/25 backdrop-blur-md",
                  liveHelpTier.kind === "crown" && "right-0.5 top-0.5 p-1.5",
                  liveHelpTier.kind === "trophy" && "right-1 top-1 p-1.5",
                  liveHelpTier.kind === "medal" && "right-1 top-1 p-1.5",
                )}
                title={liveHelpTier.title}
                aria-hidden
              >
                {liveHelpTier.kind === "medal" ? (
                  <Medal
                    className="h-[15px] w-[15px] text-amber-200 drop-shadow-sm"
                    strokeWidth={2.25}
                    aria-hidden
                  />
                ) : liveHelpTier.kind === "trophy" ? (
                  <Trophy
                    className="h-[22px] w-[22px] text-amber-200 drop-shadow-[0_0_8px_rgba(251,191,36,0.45)]"
                    strokeWidth={2.35}
                    aria-hidden
                  />
                ) : (
                  <Crown
                    className="h-8 w-8 text-amber-200 drop-shadow-[0_0_12px_rgba(251,191,36,0.55)]"
                    strokeWidth={2.25}
                    aria-hidden
                  />
                )}
              </span>
            ) : null}
            <span className="text-center text-[9px] font-black uppercase leading-none tracking-[0.12em]">
              Live help
            </span>
            <span className="text-center text-[20px] font-black tabular-nums leading-none tracking-tight">
              {liveHelpWeekCount}
            </span>
            <span className="text-center text-[8px] font-bold uppercase tracking-wide text-white/90">
              this week
            </span>
          </span>
        ) : null}
        {respondsWithinLabel ? (
          <span
            className={cn(
              "inline-flex min-h-[2.75rem] min-w-[4.5rem] flex-col justify-center gap-0.5 rounded-lg px-2 py-1",
              "bg-gradient-to-br from-sky-600 to-cyan-700 text-white",
              "shadow-md shadow-sky-900/20 ring-1 ring-inset ring-white/20",
            )}
            role="status"
            title={`Typical reply time ${respondsWithinLabel}`}
          >
            <span className="flex items-center gap-1 text-[8px] font-bold uppercase leading-none tracking-wide text-white/90">
              <MessageSquare
                className="h-2.5 w-2.5 shrink-0 opacity-95"
                strokeWidth={2.75}
                aria-hidden
              />
              Responds
            </span>
            <span className="text-[11px] font-black tabular-nums leading-none tracking-tight">
              {respondsWithinLabel}
            </span>
          </span>
        ) : null}
        {readyInLabel ? (
          <span
            className={cn(
              "inline-flex min-h-[2.75rem] min-w-[4.5rem] flex-col justify-center gap-0.5 rounded-lg px-2 py-1",
              "bg-gradient-to-br from-amber-500 to-orange-600 text-white",
              "shadow-md shadow-amber-900/25 ring-1 ring-inset ring-white/25",
            )}
            role="status"
            title={`Can start ${readyInLabel}`}
          >
            <span className="flex items-center gap-1 text-[8px] font-bold uppercase leading-none tracking-wide text-white/90">
              <Clock
                className="h-2.5 w-2.5 shrink-0 opacity-95"
                strokeWidth={2.75}
                aria-hidden
              />
              Ready in
            </span>
            <span className="text-[11px] font-black tabular-nums leading-none tracking-tight">
              {readyInLabel}
            </span>
          </span>
        ) : null}
      </div>
    ) : null;

  const desktopTabs = [
    { id: "posts" as const, label: "Social Feed", Icon: LayoutGrid },
    { id: "images" as const, label: "Photos", Icon: ImageIcon },
    { id: "videos" as const, label: "Videos", Icon: Video },
    { id: "about" as const, label: "About", Icon: UserCircle },
  ];

  async function handlePostedHelpConfirm() {
    const jobId = (postedHelpMapJob as { id?: string } | null)?.id;
    if (!jobId || !currentUser?.id) return;
    setPostedHelpConfirming(true);
    try {
      const res = (await apiPost("/api/jobs/respond", {
        jobId,
        action: "accept",
      })) as { error?: string | null };
      if (res?.error) throw new Error(res.error);
      addToast({ title: "Response sent", variant: "success" });
      setPostedHelpEngagement("accepted");
    } catch (e) {
      addToast({
        title: "Action failed",
        description: String(e),
        variant: "error",
      });
    } finally {
      setPostedHelpConfirming(false);
    }
  }

  async function handlePostedHelpDecline() {
    const jobId = (postedHelpMapJob as { id?: string } | null)?.id;
    if (!jobId || !currentUser?.id) return;
    setPostedHelpDeclining(true);
    try {
      const res = (await apiPost("/api/jobs/respond", {
        jobId,
        action: "decline",
      })) as { error?: string | null };
      if (res?.error) throw new Error(res.error);
      setPostedHelpEngagement("declined");
    } catch (e) {
      console.error(e);
    } finally {
      setPostedHelpDeclining(false);
    }
  }

  const showPostedHelpRespond = postedHelpEngagement === "can_respond";
  const postedHelpIncomingActionMessage =
    postedHelpEngagement === "accepted"
      ? "You accepted this request!"
      : postedHelpEngagement === "declined"
        ? "You declined this request."
        : null;

  function renderPostedHelpRow(job: ProfilePostedHelpRequest) {
    return (
      <button
        key={job.id}
        type="button"
        onClick={() =>
          navigate(
            `/freelancer/jobs/match?focus_job_id=${encodeURIComponent(job.id)}`,
          )
        }
        className="block w-full focus-visible:outline-none"
      >
        <Card
          className={cn(
            "cursor-pointer overflow-hidden rounded-2xl border-0 bg-zinc-50 shadow-sm transition-all",
            "sm:rounded-2xl sm:border-0 sm:bg-zinc-50 sm:shadow-sm",
            "hover:bg-zinc-50/90 hover:shadow-md active:scale-[0.99]",
            "dark:border dark:border-white/10 dark:bg-zinc-900 dark:shadow-none dark:hover:border-white/15",
            "dark:sm:border dark:sm:border-white/10 dark:sm:bg-zinc-900",
          )}
        >
          <CardContent className="flex items-center justify-between gap-3.5 p-5 sm:p-6">
            <div className="flex min-w-0 flex-1 items-center gap-4 sm:gap-5">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-slate-200/60 dark:bg-zinc-800">
                <img
                  src={getServiceCategoryImage(job.service_type)}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div className="min-w-0 text-left">
                <p className="line-clamp-1 text-base font-bold capitalize leading-tight text-slate-900 dark:text-white sm:text-[1.05rem]">
                  {jobServiceLabel(job.service_type)}
                </p>
                <p className="mt-1 line-clamp-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                  {job.location_city || "Anywhere"}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2.5">
              <Badge
                variant="secondary"
                className="max-w-[8.5rem] truncate border-0 bg-white/90 px-3 py-1 text-[11px] font-bold tabular-nums text-slate-600 shadow-none dark:bg-zinc-800/90 dark:text-slate-300"
                title={new Date(job.created_at).toLocaleString()}
              >
                {formatDistanceToNow(new Date(job.created_at), {
                  addSuffix: true,
                })}
              </Badge>
              <ChevronRight className="h-6 w-6 shrink-0 text-slate-400 dark:text-slate-500" />
            </div>
          </CardContent>
        </Card>
      </button>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-black">
        <Loader2 className="h-10 w-10 animate-spin text-orange-600" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white p-6 text-center dark:bg-black">
        <UserCircle className="h-16 w-16 text-slate-200 dark:text-slate-800" />
        <h2 className="text-xl font-black text-slate-900 dark:text-white">
          Profile not found
        </h2>
        <p className="text-slate-500 dark:text-slate-400">
          This user may have left or the link is invalid.
        </p>
        <Button onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black pb-24 md:pb-8">
      {/* 
        Sticky Header (Mobile & Desktop)
        Used for back button and profile name breadcrumb. 
      */}
      {/* 
        The top sticky header is now handled globally by BottomNav
        to ensure consistent scroll-away behavior.
      */}

      {/* Desktop Hero section — hidden on mobile */}
      <div className="hidden md:block bg-white/50 dark:bg-zinc-950/20 pt-20 pb-4 md:pt-24 md:pb-8 border-b border-slate-200/50 dark:border-white/5">
        <div className="app-desktop-shell px-4">
          <div className="flex flex-col md:flex-row gap-6 md:items-start">
            {/* Avatar block — hidden on mobile hero layout to move it below header */}
            <div className="hidden md:block h-32 w-32 shrink-0 lg:h-40 lg:w-40">
              {profile.photo_url ? (
                <button
                  type="button"
                  onClick={() => setProfileMediaLightbox({ urls: [profile.photo_url!], initialIndex: 0 })}
                  className="relative block h-full w-full overflow-visible rounded-full ring-4 ring-white shadow-xl transition hover:scale-[1.02] active:scale-[0.98] dark:ring-zinc-900"
                  aria-label="View profile photo full screen"
                >
                  <span className="absolute inset-0 overflow-hidden rounded-full">
                    <img
                      src={profile.photo_url}
                      alt={profile.full_name ?? "Profile"}
                      className="h-full w-full object-cover"
                      loading="eager"
                    />
                  </span>
                  {profileLiveNowDot}
                </button>
              ) : (
                <div className="relative flex h-full w-full items-center justify-center overflow-visible rounded-full bg-gradient-to-br from-primary/20 via-muted to-primary/10 ring-4 ring-white shadow-xl dark:ring-zinc-900">
                  <span className="text-4xl font-black uppercase tracking-tight text-primary/60">
                    {photoInitials}
                  </span>
                  {profileLiveNowDot}
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0 pb-2">
              <div className="flex items-start justify-between gap-6 flex-wrap">
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <h1 className="truncate text-[2rem] font-black leading-tight tracking-tight text-slate-900 dark:text-white">
                        {profile.full_name}
                      </h1>
                      {profile.is_verified ? (
                        <BadgeCheck
                          className="h-7 w-7 shrink-0 fill-emerald-500 text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.2)] dark:drop-shadow-[0_1px_6px_rgba(0,0,0,0.45)]"
                          strokeWidth={2.35}
                          aria-label="Certified verified helper"
                        />
                      ) : null}
                    </div>
                    {profile.city?.trim() ? (
                      <span className="shrink-0 text-sm font-medium text-slate-500 dark:text-slate-400">
                        {profile.city.trim()}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-4">
                    <StarRating rating={profile.average_rating || 0} totalRatings={profile.total_ratings || 0} size="md" className="justify-start" />
                  </div>
                  {helperBadgesRow}
                  {profile.categories && profile.categories.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {profile.categories.map((cat, i) => (
                        <Badge
                          key={i}
                          variant="secondary"
                          className="inline-flex items-center gap-1.5 rounded-full border-transparent bg-white/80 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-700 shadow-sm dark:bg-zinc-800/80 dark:text-slate-200"
                        >
                          {publicProfileCategoryBadgeIcon(cat)}
                          {cat.replace(/_/g, " ")}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 shrink-0 self-start mt-1">
                  {!isOwnProfile && currentUser && (
                    <button
                      type="button"
                      onClick={() => void toggleProfileFavorite()}
                      disabled={favoriteBusy}
                      title={profileFavorited ? "Remove from saved" : "Save profile"}
                      aria-label={profileFavorited ? "Remove from saved profiles" : "Save profile to Saved"}
                      aria-pressed={profileFavorited}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-rose-200/90 bg-white/95 text-rose-500 shadow-md transition-all hover:scale-105 active:scale-95 disabled:opacity-60 dark:border-rose-800/50 dark:bg-zinc-900/95 dark:text-rose-400"
                    >
                      {favoriteBusy
                        ? <Loader2 className="h-5 w-5 animate-spin text-rose-500" aria-hidden />
                        : <Heart className={cn("h-5 w-5", profileFavorited && "fill-rose-500")} strokeWidth={profileFavorited ? 0 : 2.25} aria-hidden />}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleOpenDirectChat()}
                    disabled={openingChat}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg shadow-slate-900/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900"
                    title="Messages" aria-label="Open messages"
                  >
                    {openingChat ? <Loader2 className="h-5 w-5 animate-spin" /> : <MessageSquare className="h-5 w-5" strokeWidth={2} />}
                  </button>
                  {!isOwnProfile && currentUser && profile.categories && profile.categories.length > 0 && (
                    <ProfileKnockMenu variant="contact" targetUserId={userId!} targetRole={profile.role} categories={profile.categories} viewerId={currentUser.id} viewerRole={currentProfile?.role ?? null} viewerName={currentProfile?.full_name ?? null} />
                  )}
                  {profile.whatsapp_number && (
                    <button type="button" onClick={() => window.open(`https://wa.me/${profile.whatsapp_number}`, "_blank")} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-green-500/20 transition-all hover:scale-105 active:scale-95" title="WhatsApp" aria-label="WhatsApp">
                      <Phone className="h-5 w-5 fill-current" />
                    </button>
                  )}
                  {profile.telegram_username && (
                    <button type="button" onClick={() => window.open(`https://t.me/${profile.telegram_username}`, "_blank")} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0088cc] text-white shadow-lg shadow-blue-500/20 transition-all hover:scale-105 active:scale-95" title="Telegram" aria-label="Telegram">
                      <Send className="h-5 w-5 translate-x-[-1px] translate-y-[1px] fill-current" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Inline quick-stats — Hidden on mobile as they are moved to About tab */}
          <div className="hidden md:flex items-center gap-8 pb-3 border-b border-border/30">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black text-slate-900 dark:text-white">{helpedOthersCount}</span>
              <span className="text-sm font-medium text-muted-foreground">helped others</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black text-slate-900 dark:text-white">{gotHelpedCount}</span>
              <span className="text-sm font-medium text-muted-foreground">got helped</span>
            </div>
            {reviews.length > 0 && (
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-black text-slate-900 dark:text-white">{reviews.length}</span>
                <span className="text-sm font-medium text-muted-foreground">reviews</span>
              </div>
            )}
          </div>

          {/* Tab bar — responsive layout */}
          <div className="flex items-center -mb-px overflow-x-auto no-scrollbar">
            {desktopTabs.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setProfileMediaTab(id)}
                className={cn(
                  "flex items-center gap-2 px-5 py-3.5 text-sm font-semibold shrink-0 relative transition-colors border-b-2",
                  profileMediaTab === id
                    ? "text-orange-600 dark:text-orange-400 border-orange-600 dark:border-orange-400"
                    : "text-muted-foreground hover:text-foreground/80 border-transparent",
                )}
              >
                <Icon className="h-[1.05rem] w-[1.05rem] shrink-0" strokeWidth={2.25} aria-hidden />
                <span className="md:inline">{id === "about" ? "Details" : label}</span>
              </button>
            ))}
            {isOwnProfile && (profileMediaTab === "images" || profileMediaTab === "videos") && (
              <button
                type="button"
                disabled={uploadingMedia}
                onClick={() => (profileMediaTab === "images" ? imageInputRef.current?.click() : videoInputRef.current?.click())}
                className="ml-auto hidden md:inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-slate-200"
              >
                {uploadingMedia ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Add {profileMediaTab === "images" ? "photo" : "video"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Shared hidden file inputs */}
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleProfileMediaUpload(f, "image"); e.target.value = ""; }} />
      <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleProfileMediaUpload(f, "video"); e.target.value = ""; }} />

      {/* ══════════════════════════════════════════════════════════
          MOBILE CONTENT FLOW
      ══════════════════════════════════════════════════════════ */}
      <div className="md:hidden">
        {/* Profile Hero Header Info (Below header bar) */}
        <div className="px-5 pb-6 pt-[max(2.75rem,calc(env(safe-area-inset-top,0px)+2.5rem))] bg-white dark:bg-black">
          <div className="flex gap-4 items-start mb-6">
            <div className="h-36 w-36 shrink-0">
              {profile.photo_url ? (
                <button
                  type="button"
                  onClick={() =>
                    setProfileMediaLightbox({
                      urls: [profile.photo_url!],
                      initialIndex: 0,
                    })
                  }
                  className="relative block h-full w-full overflow-visible rounded-full ring-2 ring-slate-100 shadow-lg shadow-black/5 transition active:scale-[0.98] dark:ring-white/10"
                  aria-label="View profile photo full screen"
                >
                  <span className="absolute inset-0 overflow-hidden rounded-full">
                    <img
                      src={profile.photo_url}
                      alt={profile.full_name ?? "Profile"}
                      className="h-full w-full object-cover"
                      loading="eager"
                    />
                  </span>
                  {profileLiveNowDot}
                </button>
              ) : (
                <div className="relative flex h-full w-full items-center justify-center overflow-visible rounded-full bg-slate-100 ring-2 ring-slate-100 shadow-lg shadow-black/5 dark:bg-white/5 dark:ring-white/10">
                  <span className="text-4xl font-black text-slate-400">{photoInitials}</span>
                  {profileLiveNowDot}
                </div>
              )}
            </div>
            <div className="flex flex-1 min-w-0 flex-col pt-1">
              <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
                <div className="flex min-w-0 items-center gap-2">
                  <h1 className="min-w-0 truncate text-3xl font-black leading-none tracking-tight text-slate-900 dark:text-white">
                    {profile.full_name}
                  </h1>
                  {profile.is_verified ? (
                    <BadgeCheck
                      className="h-6 w-6 shrink-0 fill-emerald-500 text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.2)] dark:drop-shadow-[0_1px_6px_rgba(0,0,0,0.45)]"
                      strokeWidth={2.35}
                      aria-label="Certified verified helper"
                    />
                  ) : null}
                </div>
                {profile.city?.trim() ? (
                  <span className="shrink-0 text-[11px] font-black uppercase tracking-widest text-slate-950/60 dark:text-white/60">
                    {profile.city.trim()}
                  </span>
                ) : null}
              </div>
              <div className="mt-2 flex items-center gap-1">
                <StarRating rating={profile.average_rating || 0} totalRatings={profile.total_ratings || 0} size="sm" className="origin-left scale-110" />
              </div>
              {helperBadgesRow}
            </div>
          </div>

          {profile.categories && profile.categories.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {profile.categories.map((cat, i) => (
                <Badge
                  key={i}
                  variant="secondary"
                  className="inline-flex items-center gap-1.5 rounded-full border-transparent bg-slate-100/30 px-3.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-950 shadow-none dark:bg-white/5 dark:text-white"
                >
                  {publicProfileCategoryBadgeIcon(cat)}
                  {cat.replace(/_/g, " ")}
                </Badge>
              ))}
            </div>
          ) : null}

          {/* Bio (under categories) */}
          <div className="mt-6">
            <p className="text-[10px] uppercase font-black tracking-[.2em] text-slate-400 dark:text-slate-500 mb-2 ml-0.5">
              About me
            </p>
            {editingBio && isOwnProfile ? (
              <div className="space-y-3">
                <Textarea
                  value={bioDraft}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setBioDraft(e.target.value)
                  }
                  placeholder="Write a short bio…"
                  maxLength={700}
                  rows={4}
                  className="min-h-[110px] resize-none rounded-2xl border border-slate-200 bg-white/80 p-3 text-sm dark:border-white/10 dark:bg-white/5"
                  disabled={savingBio}
                />
                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    className="rounded-full"
                    onClick={() => {
                      setEditingBio(false);
                      setBioDraft(profile.bio ?? "");
                    }}
                    disabled={savingBio}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    className="rounded-full"
                    onClick={() => void saveBio(bioDraft)}
                    disabled={savingBio}
                  >
                    {savingBio ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save bio"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-slate-700 dark:text-white/85 whitespace-pre-wrap">
                  {profile.bio?.trim() ? profile.bio : "No bio shared yet."}
                </p>
                {isOwnProfile ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0 rounded-full"
                    onClick={() => setEditingBio(true)}
                  >
                    {!profile.bio?.trim() ? <Plus className="mr-1.5 h-4 w-4" aria-hidden /> : null}
                    {profile.bio?.trim() ? "Edit bio" : "Add bio"}
                  </Button>
                ) : null}
              </div>
            )}
          </div>

          {/* Connect Actions */}
          {!isOwnProfile && (
             <div className="flex items-center gap-3 mt-8">
                <button
                  type="button"
                  onClick={() => void handleOpenDirectChat()}
                  disabled={openingChat}
                  className="flex-1 h-12 flex items-center justify-center gap-2 rounded-full bg-slate-950 dark:bg-white text-white dark:text-black font-black text-sm uppercase tracking-widest shadow-xl shadow-black/10 active:scale-95 transition-all disabled:opacity-50"
                >
                  {openingChat ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4 shrink-0" />}
                  Message
                </button>
                
                <div className="flex gap-2">
                   {profile.whatsapp_number && (
                    <button type="button" onClick={() => window.open(`https://wa.me/${profile.whatsapp_number}`, "_blank")} className="h-12 w-12 flex items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg active:scale-90 transition-all">
                      <Phone className="h-5 w-5 fill-current" />
                    </button>
                  )}
                  {profile.telegram_username && (
                    <button type="button" onClick={() => window.open(`https://t.me/${profile.telegram_username}`, "_blank")} className="h-12 w-12 flex items-center justify-center rounded-full bg-[#0088cc] text-white shadow-lg active:scale-90 transition-all">
                      <Send className="h-5 w-5 fill-current translate-x-[-1px] translate-y-[1px]" />
                    </button>
                  )}
                   <button
                    ref={profileFavoriteButtonRef}
                    type="button"
                    onClick={() => void toggleProfileFavorite()}
                    disabled={favoriteBusy}
                    className="h-12 w-12 flex items-center justify-center rounded-full bg-white dark:bg-zinc-900 border border-slate-100 dark:border-white/10 text-rose-500 shadow-md active:scale-90 transition-all"
                  >
                    {favoriteBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Heart className={cn("h-5 w-5", profileFavorited && "fill-rose-500")} />}
                  </button>
                </div>
             </div>
          )}
        </div>

        {/* New Mobile Sections using TabsContent Logic */}
        <Tabs value={profileMediaTab} onValueChange={(v) => setProfileMediaTab(v as ProfileMediaSectionTab)} className="w-full">
           {/* Tab selection pill */}
           <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl dark:bg-black/80 border-b border-slate-100 dark:border-white/5 py-1">
              <div className="relative grid grid-cols-4 h-11 w-full max-w-sm mx-auto items-center p-1">
                 <div className={cn("absolute top-1 bottom-1 left-1 w-[calc((100%-0.5rem)/4)] rounded-full bg-orange-600 transition-transform duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] shadow-lg shadow-orange-500/20", profileMediaTab === "posts" && "translate-x-0", profileMediaTab === "images" && "translate-x-full", profileMediaTab === "videos" && "translate-x-[200%]", profileMediaTab === "about" && "translate-x-[300%]")} />
                 {[
                   { id: "posts", Icon: LayoutGrid },
                   { id: "images", Icon: ImageIcon },
                   { id: "videos", Icon: Video },
                   { id: "about", Icon: UserCircle },
                 ].map(t => (
                   <button key={t.id} onClick={() => setProfileMediaTab(t.id as any)} className={cn("relative z-10 flex h-full items-center justify-center transition-colors duration-300", profileMediaTab === t.id ? "text-white" : "text-slate-400 dark:text-zinc-600")}>
                      <t.Icon className="h-5 w-5" strokeWidth={2.5} />
                   </button>
                 ))}
              </div>
           </div>

           <TabsContent value="images" className="m-0 focus-visible:outline-none">
              {imageRows.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center text-slate-300">
                  <ImageIcon className="h-12 w-12 mb-3 opacity-20" />
                  <p className="text-xs font-black uppercase tracking-widest opacity-40">No photos</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-1 px-4">
                   {imageRows.map((row, idx) => (
                    <div key={row.id} className="aspect-square relative group">
                       <button type="button" onClick={() => setProfileMediaLightbox({ urls: galleryImageUrls, initialIndex: idx })} className="absolute inset-0 block h-full w-full">
                          <img src={publicProfileMediaPublicUrl(row.storage_path)} alt="" className="h-full w-full object-cover" />
                       </button>
                       {isOwnProfile && (
                         <button onClick={(e) => { e.stopPropagation(); void handleDeleteProfileMedia(row); }} className="absolute top-1 right-1 h-6 w-6 flex items-center justify-center rounded-full bg-black/40 text-white">
                            <Plus className="h-3 w-3 rotate-45" strokeWidth={3} />
                         </button>
                       )}
                    </div>
                   ))}
                </div>
              )}
              {isOwnProfile && (
                 <div className="p-4 flex justify-center">
                    <button onClick={() => imageInputRef.current?.click()} className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-slate-100 dark:bg-white/5 font-black text-[11px] uppercase tracking-widest text-slate-900 dark:text-white">
                       <Plus className="h-4 w-4" strokeWidth={3} />
                       Add a photo
                    </button>
                 </div>
              )}
           </TabsContent>

           <TabsContent value="videos" className="m-0 focus-visible:outline-none">
              {videoRows.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center text-slate-300">
                  <Video className="h-12 w-12 mb-3 opacity-20" />
                  <p className="text-xs font-black uppercase tracking-widest opacity-40">No videos</p>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                   {videoRows.map(row => (
                      <div key={row.id} className="relative aspect-[4/5] bg-black">
                         <video src={publicProfileMediaPublicUrl(row.storage_path)} className="h-full w-full object-cover" onClick={() => setProfileVideoLightboxUrl(publicProfileMediaPublicUrl(row.storage_path))} />
                         {isOwnProfile && (
                            <button onClick={() => void handleDeleteProfileMedia(row)} className="absolute top-4 right-4 h-9 w-9 flex items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md">
                               <Trash2 className="h-4 w-4" />
                            </button>
                         )}
                      </div>
                   ))}
                </div>
              )}
           </TabsContent>

           <TabsContent value="posts" className="m-0 focus-visible:outline-none">
              <div className="bg-white dark:bg-black pt-1">
                 <ProfilePostsFeed userId={userId!} isOwnProfile={isOwnProfile} />
              </div>
           </TabsContent>

           <TabsContent value="about" className="m-0 px-5 py-8 focus-visible:outline-none space-y-12">
              {/* Bio first */}
              <section>
                 <h2 className="text-[10px] font-black uppercase tracking-[.25em] text-slate-400 mb-4 ml-0.5">About Me</h2>
                 {profile.bio?.trim() ? (
                    <p className="text-lg font-bold leading-[1.6] text-slate-800 dark:text-slate-100">
                       {profile.bio}
                    </p>
                 ) : (
                    <p className="text-sm font-medium text-slate-400 italic">No bio shared yet.</p>
                 )}
              </section>

              <section className="flex flex-wrap items-baseline gap-x-8 gap-y-2 px-0.5">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-black tabular-nums text-slate-900 dark:text-white">
                    {helpedOthersCount}
                  </span>
                  <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    helped others
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-black tabular-nums text-slate-900 dark:text-white">
                    {gotHelpedCount}
                  </span>
                  <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    got helped
                  </span>
                </div>
              </section>

              {/* History sections moved here */}
              <section className="space-y-10">
                 {/* Needs Help — Restored to original styles */}
                  <div>
                    <div className="mb-6 flex items-center gap-3 px-2"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-500/10"><HeartHandshake className="h-5 w-5 text-rose-600 dark:text-rose-400" /></div><h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Open Help Requests</h2></div>
                    <div className="space-y-4">{postedHelpRequests.length > 0 ? postedHelpRequests.map((job) => renderPostedHelpRow(job)) : (<div className="flex flex-col items-center gap-3 px-2 py-4 text-center"><HeartHandshake className="h-10 w-10 text-slate-300 dark:text-slate-600" aria-hidden /><p className="text-sm font-medium text-slate-400 dark:text-slate-500">No open help requests right now.</p></div>)}</div>
                  </div>

                 {/* User Reviews — Full Restored Design with gradients and floating avatars */}
                  <div className="pt-4">
                    <div className="flex items-center gap-3 mb-6 px-2"><div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center"><Star className="w-5 h-5 text-amber-500 fill-amber-500" /></div><h2 className="text-xl font-black tracking-tight uppercase">User Reviews</h2></div>
                    {reviews.length > 0 ? (
                      <div
                        className="-mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-5 pb-3 pt-16 [-webkit-overflow-scrolling:touch]"
                        role="list"
                        aria-label="User reviews"
                      >
                        {reviews.map((review, idx) => {
                          const gradients = [
                            "from-blue-400 to-orange-500",
                            "from-green-400 to-teal-500",
                            "from-orange-400 to-pink-500",
                            "from-red-400 to-indigo-500",
                            "from-orange-400 to-blue-500",
                          ];
                          const gradient = gradients[idx % gradients.length];
                          return (
                            <div
                              key={review.id}
                              role="listitem"
                              className="group relative flex w-[min(19rem,calc(100vw-2.5rem))] max-w-sm shrink-0 snap-start snap-always flex-col rounded-3xl bg-white p-6 pt-12 shadow-md transition-all duration-500 dark:bg-zinc-900 dark:shadow-black/20"
                            >
                              <div
                                className={cn(
                                  "absolute -top-10 left-6 h-20 w-20 rounded-full bg-gradient-to-br p-1.5 shadow-xl transition-transform duration-500 group-hover:scale-110",
                                  gradient,
                                )}
                              >
                                <Avatar className="h-full w-full border-4 border-white dark:border-zinc-900">
                                  <AvatarImage
                                    src={review.reviewer.photo_url || undefined}
                                    className="object-cover"
                                  />
                                  <AvatarFallback className="bg-transparent text-2xl font-bold text-white">
                                    {review.reviewer.full_name?.slice(0, 2).toUpperCase() || "??"}
                                  </AvatarFallback>
                                </Avatar>
                              </div>
                              <div className="flex min-h-0 flex-1 flex-col">
                                <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                                  <div className="min-w-0 pr-2">
                                    <h4 className="truncate text-lg font-bold text-gray-900 transition-colors group-hover:text-primary dark:text-white">
                                      {review.reviewer.full_name}
                                    </h4>
                                    <p className="mt-0.5 text-[11px] font-medium text-slate-400">
                                      {new Date(review.created_at).toLocaleDateString()}
                                    </p>
                                  </div>
                                  <div className="flex shrink-0 items-center gap-1.5 self-start rounded-full border border-yellow-400/20 bg-yellow-400/10 px-2.5 py-1">
                                    <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                                    <span className="text-[12px] font-black text-yellow-700 dark:text-yellow-500">
                                      {review.rating}
                                    </span>
                                  </div>
                                </div>
                                <p className="line-clamp-4 text-base italic leading-relaxed text-gray-700 dark:text-slate-300">
                                  {`"${review.review_text || "No comments provided."}"`}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3 px-2 py-4 text-center">
                        <UserIcon className="h-12 w-12 text-slate-300 dark:text-slate-600" aria-hidden />
                        <p className="font-medium text-slate-400 dark:text-slate-500">
                          No reviews yet for this user
                        </p>
                      </div>
                    )}
                  </div>
              </section>
           </TabsContent>
        </Tabs>
      </div>

      {/* ══════════════════════════════════════════════════════════
          DESKTOP MAIN CONTENT — hidden on mobile
      ══════════════════════════════════════════════════════════ */}
      <div className="hidden md:block app-desktop-shell py-8">
        <div className="grid grid-cols-3 gap-8 items-start">
          {/* Main content (2/3) */}
          <div className="col-span-2">
            {profileMediaTab === "images" && (
              <div className="space-y-4">
                {imageRows.length === 0 ? (
                  <div className="flex flex-col items-center gap-4 py-16 text-center rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800">
                    <ImageIcon className="h-12 w-12 text-slate-300 dark:text-slate-600" aria-hidden />
                    <p className="text-sm font-medium text-slate-400 dark:text-slate-500">No photos yet.</p>
                    {isOwnProfile && <button type="button" disabled={uploadingMedia} onClick={() => imageInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white px-5 py-2 text-sm font-semibold text-orange-600 shadow-sm hover:bg-orange-50 disabled:opacity-50 dark:border-orange-800 dark:bg-zinc-900 dark:text-orange-400">{uploadingMedia ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Add first photo</button>}
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 lg:grid-cols-4">
                    {imageRows.map((row, idx) => (<div key={row.id} className="group relative aspect-square overflow-hidden rounded-xl bg-muted"><button type="button" onClick={() => setProfileMediaLightbox({ urls: galleryImageUrls, initialIndex: idx })} className="absolute inset-0 block h-full w-full" aria-label="View photo full screen"><img src={publicProfileMediaPublicUrl(row.storage_path)} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" /></button>{isOwnProfile && <button type="button" disabled={uploadingMedia} onClick={(e) => { e.stopPropagation(); void handleDeleteProfileMedia(row); }} className="absolute right-1.5 top-1.5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white opacity-0 shadow-md transition hover:bg-black/70 group-hover:opacity-100" aria-label="Remove photo"><Trash2 className="h-4 w-4" /></button>}</div>))}
                  </div>
                )}
              </div>
            )}
            {profileMediaTab === "videos" && (
              <div className="space-y-4">
                {videoRows.length === 0 ? (
                  <div className="flex flex-col items-center gap-4 py-16 text-center rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800">
                    <Video className="h-12 w-12 text-slate-300 dark:text-slate-600" aria-hidden />
                    <p className="text-sm font-medium text-slate-400 dark:text-slate-500">No videos yet.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {videoRows.map((row) => { const videoSrc = publicProfileMediaPublicUrl(row.storage_path); return (
                      <div key={row.id} className="group relative overflow-hidden rounded-2xl bg-black shadow-lg">
                        <div role="button" tabIndex={0} onClick={() => setProfileVideoLightboxUrl(videoSrc)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setProfileVideoLightboxUrl(videoSrc); } }} className="cursor-pointer outline-none" aria-label="Open video full screen"><video src={videoSrc} muted playsInline preload="metadata" className="pointer-events-none max-h-[min(70vh,540px)] w-full object-contain" /></div>
                        {isOwnProfile && <button type="button" disabled={uploadingMedia} onClick={() => void handleDeleteProfileMedia(row)} className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white shadow-md transition hover:bg-black/70" aria-label="Remove video"><Trash2 className="h-4 w-4" /></button>}
                      </div>
                    ); })}
                  </div>
                )}
              </div>
            )}
            {profileMediaTab === "posts" && <ProfilePostsFeed userId={userId!} isOwnProfile={isOwnProfile} />}
            {profileMediaTab === "about" && (
              <div className="rounded-[2.5rem] border border-border/40 bg-card/80 p-10 shadow-xl shadow-black/5">
                <div className="max-w-2xl">
                    <h2 className="text-[11px] font-black uppercase tracking-[.25em] text-slate-400 mb-6">Introduction</h2>
                    {profile.bio?.trim() ? (
                        <p className="text-xl font-bold leading-relaxed text-slate-800 dark:text-slate-100 whitespace-pre-wrap">{profile.bio}</p>
                    ) : (
                        <div className="flex flex-col items-center gap-3 py-8 text-center bg-slate-50/50 dark:bg-white/5 rounded-3xl">
                            <UserCircle className="h-12 w-12 text-slate-300 dark:text-slate-600" aria-hidden />
                            <p className="text-sm font-medium text-slate-400 dark:text-slate-500">No bio added yet.</p>
                        </div>
                    )}
                </div>
              </div>
            )}
          </div>

          {/* Desktop Sidebar (1/3) */}
          <div className="col-span-1 space-y-6">
            <div className="rounded-[2rem] border border-border/40 bg-card/80 p-6 shadow-xl shadow-black/5">
              <div className="flex items-center gap-2.5 mb-5"><Sparkles className="h-4 w-4 text-orange-500 shrink-0" /><h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Public Service Board</h3></div>
              {liveCommunityPosts.length > 0 ? (
                <div className="space-y-2">
                  {liveCommunityPosts.map((post) => (<Link key={post.id} to={`/public/posts?post=${encodeURIComponent(post.id)}`} className="flex flex-col gap-1 rounded-2xl p-4 bg-white/60 dark:bg-white/5 border border-slate-100/50 dark:border-white/5 hover:bg-white dark:hover:bg-white/10 transition-all group outline-none focus-visible:ring-2 focus-visible:ring-orange-500/30"><div className="flex items-center justify-between gap-2 overflow-hidden"><p className="text-sm font-black text-slate-900 dark:text-white truncate group-hover:text-orange-600 transition-colors uppercase tracking-tight">{post.title}</p><ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0 transition-transform group-hover:translate-x-0.5" /></div><div className="flex items-center gap-2"><Badge variant="secondary" className="text-[9px] font-black uppercase tracking-widest h-5 border-transparent bg-slate-100/90 px-2 text-slate-800 dark:bg-white/10 dark:text-slate-200">{livePostCategoryLabel(post.category)}</Badge></div></Link>))}
                </div>
              ) : <p className="text-xs text-muted-foreground py-2 text-center bg-slate-50/50 dark:bg-white/5 rounded-2xl">No live board posts.</p>}
            </div>

            {reviews.length > 0 && (
                <div className="rounded-[2rem] border border-border/40 bg-card/80 p-6 shadow-xl shadow-black/5">
                    <div className="flex items-center gap-2.5 mb-5"><Star className="h-4 w-4 text-amber-500 fill-amber-500 shrink-0" /><h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Latest Review</h3></div>
                    <div className="bg-white/60 dark:bg-white/5 p-4 rounded-2xl border border-slate-100/50 dark:border-white/5">
                        <p className="text-sm font-bold italic leading-relaxed line-clamp-3">"{reviews[0].review_text}"</p>
                        <div className="mt-3 flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                                <AvatarImage src={reviews[0].reviewer.photo_url || ""} />
                                <AvatarFallback>{reviews[0].reviewer.full_name?.slice(0, 1)}</AvatarFallback>
                            </Avatar>
                            <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">{reviews[0].reviewer.full_name}</span>
                        </div>
                    </div>
                </div>
            )}
          </div>
        </div>
      </div>

      <FullscreenMapModal
        job={postedHelpMapJob}
        isOpen={Boolean(postedHelpMapJob)}
        onClose={() => {
          setPostedHelpMapJob(null);
          setPostedHelpEngagement("idle");
          setPostedHelpNotifId(null);
        }}
        incomingActionMessage={postedHelpIncomingActionMessage}
        showAcceptButton={showPostedHelpRespond}
        onConfirm={showPostedHelpRespond ? handlePostedHelpConfirm : undefined}
        onDecline={showPostedHelpRespond ? handlePostedHelpDecline : undefined}
        isConfirming={postedHelpConfirming}
        isDeclining={postedHelpDeclining}
      />

      <ImageLightboxModal
        images={profileMediaLightbox?.urls ?? []}
        initialIndex={profileMediaLightbox?.initialIndex ?? 0}
        isOpen={profileMediaLightbox != null}
        onClose={() => setProfileMediaLightbox(null)}
      />
      <VideoLightboxModal
        src={profileVideoLightboxUrl}
        isOpen={profileVideoLightboxUrl != null}
        onClose={() => setProfileVideoLightboxUrl(null)}
      />
    </div>
  );
}
