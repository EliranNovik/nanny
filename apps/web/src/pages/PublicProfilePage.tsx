import { useState, useEffect, useRef } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import {
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  ShieldCheck,
  Clock,
  Star,
  Phone,
  Send,
  Loader2,
  Image as ImageIcon,
  Video,
  UserCircle,
  Plus,
  Trash2,
  MapPin,
  Sparkles,
  HeartHandshake,
  Heart,
  User as UserIcon,
  LayoutGrid,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { StarRating } from "@/components/StarRating";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { buildJobsUrl } from "@/components/jobs/jobsPerspective";
import {
  PUBLIC_PROFILE_MEDIA_BUCKET,
  publicProfileMediaPublicUrl,
} from "@/lib/publicProfileMedia";
import { ExpiryCountdown } from "@/components/ExpiryCountdown";
import { JobDetailsModal } from "@/components/JobDetailsModal";
import { FullscreenMapModal } from "@/components/FullscreenMapModal";
import { ImageLightboxModal } from "@/components/ImageLightboxModal";
import { VideoLightboxModal } from "@/components/VideoLightboxModal";
import {
  formatPriceHintFromPayload,
  getAvailabilityStatusOption,
  getQuickDetailsOption,
  type AvailabilityPayload,
} from "@/lib/availabilityPosts";
import {
  isServiceCategoryId,
  serviceCategoryLabel,
  type ServiceCategoryId,
} from "@/lib/serviceCategories";
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

type PostedHelpEngagement =
  | "idle"
  | "loading"
  | "can_respond"
  | "accepted"
  | "declined"
  | "not_invited"
  | "hidden";

function canActAsHelper(
  profile: {
    role?: string | null;
    is_available_for_jobs?: boolean | null;
  } | null,
): boolean {
  if (!profile?.role) return false;
  if (profile.role === "freelancer") return true;
  if (profile.role === "client" && profile.is_available_for_jobs === true)
    return true;
  return false;
}

function livePostCategoryLabel(category: string): string {
  return isServiceCategoryId(category)
    ? serviceCategoryLabel(category as ServiceCategoryId)
    : category.replace(/_/g, " ");
}

function livePostSummaryLine(
  payload: AvailabilityPayload | null,
  note: string | null,
): string {
  const parts: string[] = [];
  if (payload?.availability_status) {
    const o = getAvailabilityStatusOption(String(payload.availability_status));
    if (o) parts.push(o.label);
  }
  if (payload?.quick_details) {
    const o = getQuickDetailsOption(String(payload.quick_details));
    if (o) parts.push(o.label);
  }
  const price = formatPriceHintFromPayload(payload);
  if (price) parts.push(price);
  const head = parts.join(" · ");
  if (head) return head;
  const n = note?.trim();
  if (n) return n.length > 72 ? `${n.slice(0, 69)}…` : n;
  return "Open full post on the public board";
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

function jobRequestStatusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "completed")
    return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
  if (s === "cancelled")
    return "bg-slate-500/10 text-slate-600 dark:text-slate-400";
  if (s === "confirmed" || s === "active")
    return "bg-orange-500/10 text-orange-700 dark:text-orange-400";
  return "bg-amber-500/10 text-amber-800 dark:text-amber-300";
}

function jobRequestStatusLabel(status: string): string {
  const s = status.toLowerCase();
  if (
    [
      "pending",
      "opened",
      "ready",
      "notifying",
      "confirmations_closed",
    ].includes(s)
  ) {
    return "In progress";
  }
  if (s === "confirmed" || s === "active" || s === "locked") return "Active";
  if (s === "completed") return "Completed";
  return status.replace(/_/g, " ");
}

function formatJobTitleForModal(job: { service_type?: string }) {
  if (job.service_type === "cleaning") return "Cleaning";
  if (job.service_type === "cooking") return "Cooking";
  if (job.service_type === "pickup_delivery") return "Pickup & Delivery";
  if (job.service_type === "nanny") return "Nanny";
  if (job.service_type === "other_help") return "Other Help";
  return "Service Request";
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
  city: string | null;
  categories?: string[];
  whatsapp_number?: string | null;
  telegram_username?: string | null;
  average_rating?: number;
  total_ratings?: number;
}

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

/** True when this job is strictly between two users (one client, the other selected helper). */
function jobIsBetweenUsers(
  job: SharedJob,
  userA: string,
  userB: string,
): boolean {
  const sf = job.selected_freelancer_id;
  if (!sf) return false;
  return (
    (job.client_id === userA && sf === userB) ||
    (job.client_id === userB && sf === userA)
  );
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

export default function PublicProfilePage() {
  const { userId } = useParams();
  const { user: currentUser, profile: currentProfile } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [sharedJobs, setSharedJobs] = useState<SharedJob[]>([]);
  const [reviews, setReviews] = useState<UserReview[]>([]);
  const [mediaItems, setMediaItems] = useState<PublicProfileMediaRow[]>([]);
  const [liveCommunityPosts, setLiveCommunityPosts] = useState<
    LiveCommunityPostRow[]
  >([]);
  const [postedHelpRequests, setPostedHelpRequests] = useState<
    ProfilePostedHelpRequest[]
  >([]);
  const [postedHelpPreviewJob, setPostedHelpPreviewJob] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [postedHelpMapJob, setPostedHelpMapJob] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [postedHelpEngagement, setPostedHelpEngagement] =
    useState<PostedHelpEngagement>("idle");
  const [postedHelpNotifId, setPostedHelpNotifId] = useState<string | null>(
    null,
  );
  const [postedHelpConfirming, setPostedHelpConfirming] = useState(false);
  const [postedHelpDeclining, setPostedHelpDeclining] = useState(false);
  const [loadingPostedHelpPreviewId, setLoadingPostedHelpPreviewId] = useState<
    string | null
  >(null);
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
  const profileFavoriteButtonRef = useRef<HTMLButtonElement>(null);

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
    let fromCache = false;

    if (cached) {
      fromCache = true;
      setProfile(cached.profile as PublicProfile);
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
        // 1. Fetch Basic Profile
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select(
            "id, full_name, photo_url, role, city, categories, whatsapp_number_e164, telegram_username, average_rating, total_ratings",
          )
          .eq("id", userId)
          .single();

        if (profileError) throw profileError;

        // 2. Fetch Bio/Freelancer Info if applicable
        const { data: freelancerData } = await supabase
          .from("freelancer_profiles")
          .select("bio")
          .eq("user_id", userId)
          .maybeSingle();

        const nextProfile: PublicProfile = {
          ...profileData,
          bio: freelancerData?.bio || null,
          whatsapp_number: profileData.whatsapp_number_e164,
        };
        setProfile(nextProfile);

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

        const [
          jobsViewerClient,
          jobsProfileClient,
          notifWhenProfileIsHelper,
          notifWhenViewerIsHelper,
          reviewsData,
          mediaData,
          communityData,
          postedHelpData,
        ] = await Promise.all([
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
            .select("*")
            .eq("author_id", userId)
            .order("created_at", { ascending: false }),
          supabase
            .from("job_requests")
            .select("id, service_type, status, created_at, location_city")
            .eq("client_id", userId)
            .in("status", ["ready", "notifying", "confirmations_closed"])
            .order("created_at", { ascending: false }),
        ]);

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
          setMediaItems(mediaData.data || []);
          setLiveCommunityPosts(communityData.data as LiveCommunityPostRow[]);
          setPostedHelpRequests(
            postedHelpData.data as ProfilePostedHelpRequest[],
          );
          setLoading(false);
          writePublicProfileCache(viewerId, userId, {
            profile: nextProfile,
            sharedJobs: shared,
            reviews: reviewsData.data,
            mediaItems: mediaData.data,
            liveCommunityPosts: communityData.data,
            postedHelpRequests: postedHelpData.data,
          });
        }
      } catch (e: unknown) {
        console.error(e);
        if (!cancelled) setLoading(false);
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

  const pastJobs = sharedJobs.filter((j) => j.status === "completed");
  const activeJobs = sharedJobs.filter(
    (j) => j.status === "confirmed" || j.status === "active",
  );
  const pendingJobs = sharedJobs.filter((j) => j.status === "pending");

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

  const desktopTabs = [
    { id: "posts" as const, label: "Social Feed", Icon: LayoutGrid },
    { id: "images" as const, label: "Photos", Icon: ImageIcon },
    { id: "videos" as const, label: "Videos", Icon: Video },
    { id: "about" as const, label: "About", Icon: UserCircle },
  ];

  async function openPostedHelpPreview(jobId: string) {
    setLoadingPostedHelpPreviewId(jobId);
    try {
      const { data, error } = await supabase
        .from("job_requests")
        .select("*")
        .eq("id", jobId)
        .single();
      if (error) throw error;
      setPostedHelpPreviewJob(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingPostedHelpPreviewId(null);
    }
  }

  async function handlePostedHelpConfirm() {
    if (!postedHelpPreviewJob?.id || !currentUser?.id) return;
    setPostedHelpConfirming(true);
    try {
      const { error } = await apiPost("/api/jobs/respond", {
        jobId: postedHelpPreviewJob.id,
        action: "accept",
      });
      if (error) throw new Error(error);
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
    if (!postedHelpPreviewJob?.id || !currentUser?.id) return;
    setPostedHelpDeclining(true);
    try {
      const { error } = await apiPost("/api/jobs/respond", {
        jobId: postedHelpPreviewJob.id,
        action: "decline",
      });
      if (error) throw new Error(error);
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

  const profileDisplayName = profile?.full_name?.split(" ")[0] || "This user";

  function renderPostedHelpRow(job: ProfilePostedHelpRequest) {
    return (
      <button
        key={job.id}
        type="button"
        onClick={() => void openPostedHelpPreview(job.id)}
        disabled={loadingPostedHelpPreviewId === job.id}
        className="block w-full focus-visible:outline-none"
      >
        <Card
          className={cn(
            "cursor-pointer bg-white shadow-md transition-all hover:shadow-lg active:scale-[0.99] dark:bg-zinc-900",
          )}
        >
          <CardContent className="flex items-center justify-between p-5">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-500/10">
                <HeartHandshake className="h-6 w-6 text-rose-600 dark:text-rose-400" />
              </div>
              <div className="min-w-0 text-left">
                <p className="line-clamp-1 font-bold capitalize text-slate-900 dark:text-white">
                  {jobServiceLabel(job.service_type)}
                </p>
                <p className="mt-0.5 line-clamp-1 text-xs font-medium text-slate-400">
                  {job.location_city || "Anywhere"}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <Badge variant="outline" className="opacity-70">
                Open
              </Badge>
              {loadingPostedHelpPreviewId === job.id ? (
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              ) : (
                <ChevronRight className="h-5 w-5 text-slate-300" />
              )}
            </div>
          </CardContent>
        </Card>
      </button>
    );
  }

  const profileHistoryCardClass =
    "bg-white/60 shadow-sm backdrop-blur-sm transition-all hover:shadow-md active:scale-[0.99] dark:bg-white/[0.02]";
  const historyRowChevronClass = "h-4 w-4 text-slate-300 dark:text-slate-600";

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
            <div className="hidden md:block relative h-32 w-32 shrink-0 lg:h-40 lg:w-40">
              {profile.photo_url ? (
                <button
                  type="button"
                  onClick={() => setProfileMediaLightbox({ urls: [profile.photo_url!], initialIndex: 0 })}
                  className="relative block h-full w-full rounded-full ring-4 ring-white shadow-xl transition hover:scale-[1.02] active:scale-[0.98] dark:ring-zinc-900"
                  aria-label="View profile photo full screen"
                >
                  <img
                    src={profile.photo_url}
                    alt={profile.full_name ?? "Profile"}
                    className="h-full w-full rounded-full object-cover"
                    loading="eager"
                  />
                </button>
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-primary/20 via-muted to-primary/10 ring-4 ring-white shadow-xl dark:ring-zinc-900">
                  <span className="text-4xl font-black uppercase tracking-tight text-primary/60">{photoInitials}</span>
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0 pb-2">
              <div className="flex items-start justify-between gap-6 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h1 className="text-[2rem] font-black leading-tight tracking-tight text-slate-900 dark:text-white truncate">
                      {profile.full_name}
                    </h1>
                    <ShieldCheck className="h-7 w-7 text-emerald-500 shrink-0" strokeWidth={2.5} />
                  </div>
                  <div className="flex items-center gap-4 mt-1 flex-wrap">
                    <StarRating rating={profile.average_rating || 0} totalRatings={profile.total_ratings || 0} size="md" className="justify-start" />
                    {profile.city?.trim() && (
                      <span className="flex items-center gap-1.5 text-sm font-medium text-slate-500 dark:text-slate-400">
                        <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                        {profile.city.trim()}
                      </span>
                    )}
                  </div>
                  {profile.categories && profile.categories.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {profile.categories.map((cat, i) => (
                        <Badge key={i} variant="secondary" className="rounded-full border border-slate-200/80 bg-white/80 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-700 shadow-sm dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-slate-200">
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
        <div className="px-5 pt-20 pb-6 bg-white dark:bg-black">
          <div className="flex gap-4 items-start mb-6">
            <div className="relative h-24 w-24 shrink-0">
               {profile.photo_url ? (
                <button type="button" onClick={() => setProfileMediaLightbox({ urls: [profile.photo_url!], initialIndex: 0 })} className="relative block h-full w-full rounded-full ring-2 ring-slate-100 transition active:scale-[0.98] dark:ring-white/10 overflow-hidden shadow-lg shadow-black/5" aria-label="View profile photo full screen">
                  <img src={profile.photo_url} alt={profile.full_name ?? "Profile"} className="h-full w-full object-cover" loading="eager" />
                </button>
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-full bg-slate-100 dark:bg-white/5 ring-2 ring-slate-100 dark:ring-white/10 shadow-lg shadow-black/5">
                  <span className="text-2xl font-black text-slate-400">{photoInitials}</span>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0 flex flex-col pt-1">
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-black leading-none tracking-tight text-slate-900 dark:text-white">{profile.full_name}</h1>
                <ShieldCheck className="h-6 w-6 text-emerald-500 shrink-0" strokeWidth={2.5} />
              </div>
              <div className="flex items-center gap-1 mt-3">
                 <StarRating rating={profile.average_rating || 0} totalRatings={profile.total_ratings || 0} size="sm" className="scale-110 origin-left" />
              </div>
              {profile.city?.trim() && (
                <p className="mt-3 flex items-center gap-1 text-[11px] font-black uppercase tracking-widest text-slate-950/60 dark:text-white/60">
                   <MapPin className="h-3 w-3" /> {profile.city.trim()}
                </p>
              )}
            </div>
          </div>

          {/* Job Categories */}
          {profile.categories && profile.categories.length > 0 && (
            <div className="mt-2">
              <p className="text-[10px] uppercase font-black tracking-[.2em] text-slate-400 dark:text-slate-500 mb-3 ml-0.5">Job With</p>
              <div className="flex flex-wrap gap-2">
                {profile.categories.map((cat, i) => (
                  <Badge key={i} variant="secondary" className="rounded-full border border-slate-100 bg-slate-100/30 text-slate-950 dark:border-white/5 dark:bg-white/5 dark:text-white px-3.5 py-1.5 text-[10px] font-black uppercase tracking-wider shadow-none">
                    {cat.replace(/_/g, " ")}
                  </Badge>
                ))}
              </div>
            </div>
          )}

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
                <div className="grid grid-cols-3 gap-0.5">
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

              {/* Quick Stats restored but without outlines */}
              <section className="grid grid-cols-2 gap-3 px-1 sm:gap-4 sm:px-0">
                <div className="rounded-2xl bg-card/85 p-5 shadow-md">
                  <p className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-500">Helped Others</p>
                  <p className="text-3xl font-black text-slate-900 dark:text-white">{helpedOthersCount}</p>
                </div>
                <div className="rounded-2xl bg-card/85 p-5 shadow-md">
                  <p className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-500">Got Helped</p>
                  <p className="text-3xl font-black text-slate-900 dark:text-white">{gotHelpedCount}</p>
                </div>
              </section>

              {/* History sections moved here */}
              <section className="space-y-10">
                 {/* Live Board */}
                 <div>
                    <h2 className="text-[10px] font-black uppercase tracking-[.25em] text-slate-400 mb-6 flex items-center gap-2">
                       <Sparkles className="h-3.5 w-3.5 text-orange-600" />
                       Active Public Posts
                    </h2>
                    <div className="space-y-3">
                       {liveCommunityPosts.length > 0 ? liveCommunityPosts.map(post => (
                         <Link key={post.id} to={`/public/posts?post=${encodeURIComponent(post.id)}`} className="block">
                            <Card className="rounded-3xl border-slate-100 dark:border-white/5 bg-white dark:bg-white/5 overflow-hidden shadow-none transition-active active:scale-[0.98]">
                               <CardContent className="p-5 flex flex-col gap-1">
                                  <div className="flex items-center justify-between">
                                     <span className="text-[10px] font-black uppercase tracking-widest text-orange-600">{livePostCategoryLabel(post.category)}</span>
                                     <ExpiryCountdown expiresAtIso={post.expires_at} compact className="text-[10px] font-bold" />
                                  </div>
                                  <h3 className="font-black text-lg text-slate-900 dark:text-white mt-1">{post.title}</h3>
                                  <p className="text-xs font-semibold text-slate-500 line-clamp-2">{livePostSummaryLine(post.availability_payload, post.note)}</p>
                               </CardContent>
                            </Card>
                         </Link>
                       )) : <p className="text-sm font-medium text-slate-400 py-2">No active board posts.</p>}
                    </div>
                 </div>

                 {/* Needs Help — Restored to original styles */}
                  <div>
                    <div className="mb-6 flex items-center gap-3 px-2"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-500/10"><HeartHandshake className="h-5 w-5 text-rose-600 dark:text-rose-400" /></div><h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Open Help Requests</h2></div>
                    <div className="space-y-4">{postedHelpRequests.length > 0 ? postedHelpRequests.map((job) => renderPostedHelpRow(job)) : (<div className="flex flex-col items-center gap-3 px-2 py-4 text-center"><HeartHandshake className="h-10 w-10 text-slate-300 dark:text-slate-600" aria-hidden /><p className="text-sm font-medium text-slate-400 dark:text-slate-500">No open help requests right now.</p></div>)}</div>
                  </div>

                 {/* User Reviews — Full Restored Design with gradients and floating avatars */}
                  <div className="pt-4">
                    <div className="flex items-center gap-3 mb-6 px-2"><div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center"><Star className="w-5 h-5 text-amber-500 fill-amber-500" /></div><h2 className="text-xl font-black tracking-tight uppercase">User Reviews</h2></div>
                    <div className="grid grid-cols-1 gap-x-6 gap-y-14 pt-8">{reviews.length > 0 ? reviews.map((review, idx) => { const gradients = ["from-blue-400 to-orange-500","from-green-400 to-teal-500","from-orange-400 to-pink-500","from-red-400 to-indigo-500","from-orange-400 to-blue-500"]; const gradient = gradients[idx % gradients.length]; return (<div key={review.id} className="relative flex h-full flex-col rounded-3xl bg-white p-6 pt-12 shadow-md transition-all duration-500 hover:shadow-lg dark:bg-zinc-900 dark:shadow-black/20 group"><div className={cn("absolute -top-10 left-6 h-20 w-20 rounded-full bg-gradient-to-br p-1.5 shadow-xl transition-transform duration-500 group-hover:scale-110", gradient)}><Avatar className="h-full w-full border-4 border-white dark:border-zinc-900"><AvatarImage src={review.reviewer.photo_url || undefined} className="object-cover" /><AvatarFallback className="bg-transparent text-white font-bold text-2xl">{review.reviewer.full_name?.slice(0, 2).toUpperCase() || "??"}</AvatarFallback></Avatar></div><div className="flex min-h-0 flex-1 flex-col"><div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4"><div className="min-w-0 pr-2"><h4 className="truncate text-lg font-bold text-gray-900 group-hover:text-primary transition-colors dark:text-white">{review.reviewer.full_name}</h4><p className="mt-0.5 text-[11px] font-medium text-slate-400">{new Date(review.created_at).toLocaleDateString()}</p></div><div className="flex shrink-0 items-center gap-1.5 self-start rounded-full border border-yellow-400/20 bg-yellow-400/10 px-2.5 py-1"><Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" /><span className="text-[12px] font-black text-yellow-700 dark:text-yellow-500">{review.rating}</span></div></div><p className="line-clamp-6 text-base italic leading-relaxed text-gray-700 dark:text-slate-300">"{review.review_text || "No comments provided."}"</p></div></div>); }) : (<div className="col-span-full flex flex-col items-center gap-3 px-2 py-4 text-center"><UserIcon className="h-12 w-12 text-slate-300 dark:text-slate-600" aria-hidden /><p className="text-slate-400 font-medium dark:text-slate-500">No reviews yet for this user</p></div>)}</div>
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
                  {liveCommunityPosts.map((post) => (<Link key={post.id} to={`/public/posts?post=${encodeURIComponent(post.id)}`} className="flex flex-col gap-1 rounded-2xl p-4 bg-white/60 dark:bg-white/5 border border-slate-100/50 dark:border-white/5 hover:bg-white dark:hover:bg-white/10 transition-all group outline-none focus-visible:ring-2 focus-visible:ring-orange-500/30"><div className="flex items-center justify-between gap-2 overflow-hidden"><p className="text-sm font-black text-slate-900 dark:text-white truncate group-hover:text-orange-600 transition-colors uppercase tracking-tight">{post.title}</p><ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0 transition-transform group-hover:translate-x-0.5" /></div><div className="flex items-center gap-2"><Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest h-5 px-2 border-slate-200">{livePostCategoryLabel(post.category)}</Badge></div></Link>))}
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

      <JobDetailsModal
        isOpen={Boolean(postedHelpPreviewJob)}
        onOpenChange={(open) => {
          if (!open) {
            setPostedHelpPreviewJob(null);
            setPostedHelpEngagement("idle");
            setPostedHelpNotifId(null);
          }
        }}
        job={postedHelpPreviewJob}
        formatJobTitle={formatJobTitleForModal}
        isOwnRequest={Boolean(
          currentUser?.id &&
          postedHelpPreviewJob &&
          currentUser.id ===
            (postedHelpPreviewJob as { client_id?: string }).client_id,
        )}
        previewLayout
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
