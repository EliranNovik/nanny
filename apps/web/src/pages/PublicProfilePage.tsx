import { useState, useEffect, useRef } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { 
  MessageSquare, 
  ArrowLeft, 
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
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { StarRating } from "@/components/StarRating";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { buildJobsUrl } from "@/components/jobs/jobsPerspective";
import { PUBLIC_PROFILE_MEDIA_BUCKET, publicProfileMediaPublicUrl } from "@/lib/publicProfileMedia";
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
import { isServiceCategoryId, serviceCategoryLabel, type ServiceCategoryId } from "@/lib/serviceCategories";
import { apiPost } from "@/lib/api";
import { readPublicProfileCache, writePublicProfileCache } from "@/lib/publicProfileCache";
import { ProfileKnockMenu } from "@/components/ProfileKnockMenu";

type PostedHelpEngagement = "idle" | "loading" | "can_respond" | "accepted" | "declined" | "not_invited" | "hidden";

function canActAsHelper(profile: { role?: string | null; is_available_for_jobs?: boolean | null } | null): boolean {
  if (!profile?.role) return false;
  if (profile.role === "freelancer") return true;
  if (profile.role === "client" && profile.is_available_for_jobs === true) return true;
  return false;
}

function livePostCategoryLabel(category: string): string {
  return isServiceCategoryId(category) ? serviceCategoryLabel(category as ServiceCategoryId) : category.replace(/_/g, " ");
}

function livePostSummaryLine(payload: AvailabilityPayload | null, note: string | null): string {
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
  if (s === "completed") return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
  if (s === "cancelled") return "bg-slate-500/10 text-slate-600 dark:text-slate-400";
  if (s === "confirmed" || s === "active") return "bg-orange-500/10 text-orange-700 dark:text-orange-400";
  return "bg-amber-500/10 text-amber-800 dark:text-amber-300";
}

function jobRequestStatusLabel(status: string): string {
  const s = status.toLowerCase();
  if (["pending", "opened", "ready", "notifying", "confirmations_closed"].includes(s)) {
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
  userB: string
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

export default function PublicProfilePage() {
  const { userId } = useParams();
  const { user: currentUser, profile: currentProfile } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [sharedJobs, setSharedJobs] = useState<SharedJob[]>([]);
  const [reviews, setReviews] = useState<UserReview[]>([]);
  const [mediaItems, setMediaItems] = useState<PublicProfileMediaRow[]>([]);
  const [liveCommunityPosts, setLiveCommunityPosts] = useState<LiveCommunityPostRow[]>([]);
  const [postedHelpRequests, setPostedHelpRequests] = useState<ProfilePostedHelpRequest[]>([]);
  const [postedHelpPreviewJob, setPostedHelpPreviewJob] = useState<Record<string, unknown> | null>(null);
  const [postedHelpMapJob, setPostedHelpMapJob] = useState<Record<string, unknown> | null>(null);
  const [postedHelpEngagement, setPostedHelpEngagement] = useState<PostedHelpEngagement>("idle");
  const [postedHelpNotifId, setPostedHelpNotifId] = useState<string | null>(null);
  const [postedHelpConfirming, setPostedHelpConfirming] = useState(false);
  const [postedHelpDeclining, setPostedHelpDeclining] = useState(false);
  const [loadingPostedHelpPreviewId, setLoadingPostedHelpPreviewId] = useState<string | null>(null);
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
  const [profileVideoLightboxUrl, setProfileVideoLightboxUrl] = useState<string | null>(null);

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
        description: "You can only message someone in the opposite role (client ↔ helper).",
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
      const msg = e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : "Please try again.";
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
      } else {
        const { error } = await supabase.from("profile_favorites").insert({
          user_id: currentUser.id,
          favorite_user_id: userId,
        });
        if (error) throw error;
        setProfileFavorited(true);
        addToast({ title: "Saved — view under Saved", variant: "success" });
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
      setLiveCommunityPosts(cached.liveCommunityPosts as LiveCommunityPostRow[]);
      setPostedHelpRequests(cached.postedHelpRequests as ProfilePostedHelpRequest[]);
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
          .select("id, full_name, photo_url, role, city, categories, whatsapp_number_e164, telegram_username, average_rating, total_ratings")
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
          whatsapp_number: profileData.whatsapp_number_e164
        };
        setProfile(nextProfile);

        // 3. Jobs + pending notifications strictly between viewer (A) and profile (B) only.
        // Use separate queries — a single `.or(and(...),and(...))` on job_requests can misparse; and
        // `.in(freelancer_id, [A,B])` pulls rows where freelancer is A but client is a third party.
        const profileId = userId;

        const jrSelect = "id, service_type, status, created_at, client_id, selected_freelancer_id" as const;
        const notifSelect = `
              job_id, status, created_at, freelancer_id,
              job_requests (
                ${jrSelect}
              )
            `;

        const [jobsViewerClient, jobsProfileClient, notifWhenProfileIsHelper, notifWhenViewerIsHelper] =
          await Promise.all([
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
          ]);

        if (jobsViewerClient.error) throw jobsViewerClient.error;
        if (jobsProfileClient.error) throw jobsProfileClient.error;
        if (notifWhenProfileIsHelper.error) throw notifWhenProfileIsHelper.error;
        if (notifWhenViewerIsHelper.error) throw notifWhenViewerIsHelper.error;

        const shared: SharedJob[] = [
          ...((jobsViewerClient.data || []) as SharedJob[]),
          ...((jobsProfileClient.data || []) as SharedJob[]),
        ];

        function embeddedJobRequest(n: { job_requests?: unknown }): SharedJob | null {
          const raw = n.job_requests;
          const jr = (Array.isArray(raw) ? raw[0] : raw) as
            | {
                id: string;
                service_type: string;
                status: string;
                created_at: string;
                client_id: string;
                selected_freelancer_id: string | null;
              }
            | undefined
            | null;
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

        type NotifRow = { job_requests?: unknown; freelancer_id?: string };
        const profileHelperRows = (notifWhenProfileIsHelper.data ?? []) as NotifRow[];
        const viewerHelperRows = (notifWhenViewerIsHelper.data ?? []) as NotifRow[];

        for (const n of profileHelperRows) {
          const jr = embeddedJobRequest(n);
          if (!jr) continue;
          // Profile is the notified helper → client must be the viewer (not a third party).
          if (jr.client_id !== viewerId || n.freelancer_id !== profileId) {
            continue;
          }
          pendingFromNotifications.push({
            ...jr,
            status: jr.status || "pending",
            selected_freelancer_id: jr.selected_freelancer_id ?? profileId,
          });
        }

        for (const n of viewerHelperRows) {
          const jr = embeddedJobRequest(n);
          if (!jr) continue;
          // Viewer is the notified helper → client must be the profile user.
          if (jr.client_id !== profileId || n.freelancer_id !== viewerId) {
            continue;
          }
          pendingFromNotifications.push({
            ...jr,
            status: jr.status || "pending",
            selected_freelancer_id: jr.selected_freelancer_id ?? viewerId,
          });
        }

        const mergedMap = new Map<string, SharedJob>();
        [...shared, ...pendingFromNotifications].forEach((job: SharedJob) => {
          if (!mergedMap.has(job.id)) mergedMap.set(job.id, job);
        });
        const merged = Array.from(mergedMap.values()).filter((job) =>
          jobIsBetweenUsers(job, viewerId, profileId)
        );
        setSharedJobs(merged);

        // 4. Fetch Reviews
        const { data: reviewsData, error: reviewsError } = await supabase
          .from("job_reviews")
          .select(`
            id,
            rating,
            review_text,
            created_at,
            reviewer:profiles!reviewer_id (
              full_name,
              photo_url
            )
          `)
          .eq("reviewee_id", userId)
          .order("created_at", { ascending: false });

        if (reviewsError) throw reviewsError;
        const nextReviews = (reviewsData as any[]).map(r => ({
          ...r,
          reviewer: r.reviewer || { full_name: "Anonymous", photo_url: null }
        }));
        setReviews(nextReviews);

        const nowIso = new Date().toISOString();
        const [mediaRes, livePostsRes] = await Promise.all([
          supabase
            .from("public_profile_media")
            .select("id, user_id, media_type, storage_path, sort_order, created_at")
            .eq("user_id", userId)
            .order("sort_order", { ascending: true })
            .order("created_at", { ascending: true }),
          supabase
            .from("community_posts")
            .select("id, category, title, note, expires_at, availability_payload, created_at")
            .eq("author_id", userId)
            .eq("status", "active")
            .gt("expires_at", nowIso)
            .order("created_at", { ascending: false }),
        ]);

        let nextMedia: PublicProfileMediaRow[] = [];
        if (mediaRes.error) {
          console.warn("[PublicProfile] public_profile_media:", mediaRes.error);
          setMediaItems([]);
        } else {
          nextMedia = (mediaRes.data as PublicProfileMediaRow[]) ?? [];
          setMediaItems(nextMedia);
        }

        let nextLive: LiveCommunityPostRow[] = [];
        if (livePostsRes.error) {
          console.warn("[PublicProfile] community_posts:", livePostsRes.error);
          setLiveCommunityPosts([]);
        } else {
          const rows = (livePostsRes.data || []) as Record<string, unknown>[];
          nextLive = rows.map((r) => ({
            id: String(r.id),
            category: String(r.category ?? ""),
            title: String(r.title ?? ""),
            note: (r.note as string | null) ?? null,
            expires_at: String(r.expires_at ?? ""),
            availability_payload: (r.availability_payload as AvailabilityPayload | null) ?? null,
            created_at: String(r.created_at ?? ""),
          }));
          setLiveCommunityPosts(nextLive);
        }

        const { data: postedReqData, error: postedReqErr } = await supabase.rpc(
          "get_public_profile_client_job_requests",
          { p_client_id: userId }
        );
        let nextPosted: ProfilePostedHelpRequest[] = [];
        if (postedReqErr) {
          console.warn("[PublicProfile] get_public_profile_client_job_requests:", postedReqErr);
          setPostedHelpRequests([]);
        } else {
          const rows = (postedReqData || []) as Record<string, unknown>[];
          nextPosted = rows.map((r) => ({
            id: String(r.id),
            service_type: String(r.service_type ?? "other_help"),
            status: String(r.status ?? ""),
            created_at: String(r.created_at ?? ""),
            location_city: String(r.location_city ?? "").trim(),
          }));
          setPostedHelpRequests(nextPosted);
        }

        if (!cancelled) {
          writePublicProfileCache(viewerId, userId, {
            profile: nextProfile,
            sharedJobs: merged,
            reviews: nextReviews,
            mediaItems: nextMedia,
            liveCommunityPosts: nextLive,
            postedHelpRequests: nextPosted,
          });
        }

      } catch (error: any) {
        console.error("Error fetching public profile:", error);
        if (!fromCache) {
          addToast({
            title: "Error",
            description: "Could not load user profile.",
            variant: "error",
          });
          navigate(-1);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchProfileAndJobs();

    return () => {
      cancelled = true;
    };
  }, [userId, currentUser?.id, navigate, addToast]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) return null;

  const isOwnProfile = Boolean(currentUser && userId && currentUser.id === userId);
  const imageRows = mediaItems.filter((m) => m.media_type === "image");
  const videoRows = mediaItems.filter((m) => m.media_type === "video");
  const galleryImageUrls = imageRows.map((r) => publicProfileMediaPublicUrl(r.storage_path));

  async function handleProfileMediaUpload(file: File, kind: "image" | "video") {
    if (!userId || !currentUser || currentUser.id !== userId) return;
    const isImg = file.type.startsWith("image/");
    const isVid = file.type.startsWith("video/");
    if (kind === "image" && !isImg) {
      addToast({ title: "Choose an image file", variant: "warning" });
      return;
    }
    if (kind === "video" && !isVid) {
      addToast({ title: "Choose a video file", variant: "warning" });
      return;
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || (kind === "image" ? "jpg" : "mp4");
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const nextSort =
      mediaItems.length === 0 ? 0 : Math.max(...mediaItems.map((m) => m.sort_order), -1) + 1;

    setUploadingMedia(true);
    try {
      const { error: upErr } = await supabase.storage
        .from(PUBLIC_PROFILE_MEDIA_BUCKET)
        .upload(path, file, { upsert: false, contentType: file.type || undefined });

      if (upErr) {
        const msg =
          upErr.message?.toLowerCase().includes("bucket") &&
          upErr.message?.toLowerCase().includes("not found")
            ? `Storage bucket "${PUBLIC_PROFILE_MEDIA_BUCKET}" is missing. Run db/sql/048_public_profile_media.sql in Supabase.`
            : upErr.message;
        addToast({ title: "Upload failed", description: msg, variant: "error" });
        return;
      }

      const { data: row, error: insErr } = await supabase
        .from("public_profile_media")
        .insert({
          user_id: userId,
          media_type: kind,
          storage_path: path,
          sort_order: nextSort,
        })
        .select("id, user_id, media_type, storage_path, sort_order, created_at")
        .single();

      if (insErr) throw insErr;
      if (row) setMediaItems((prev) => [...prev, row as PublicProfileMediaRow]);
      addToast({ title: kind === "image" ? "Photo added" : "Video added", variant: "success" });
    } catch (e: unknown) {
      console.error(e);
      const msg =
        e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : "Upload failed.";
      addToast({ title: "Could not save media", description: msg, variant: "error" });
    } finally {
      setUploadingMedia(false);
    }
  }

  async function handleDeleteProfileMedia(row: PublicProfileMediaRow) {
    if (!userId || !currentUser || currentUser.id !== userId) return;
    setUploadingMedia(true);
    try {
      const { error: stErr } = await supabase.storage.from(PUBLIC_PROFILE_MEDIA_BUCKET).remove([row.storage_path]);
      if (stErr) console.warn(stErr);

      const { error: delErr } = await supabase.from("public_profile_media").delete().eq("id", row.id);
      if (delErr) throw delErr;
      setMediaItems((prev) => prev.filter((m) => m.id !== row.id));
      addToast({ title: "Removed", variant: "success" });
    } catch (e: unknown) {
      console.error(e);
      addToast({ title: "Could not remove", variant: "error" });
    } finally {
      setUploadingMedia(false);
    }
  }

  const activeJobs = sharedJobs.filter(j => j.status === "confirmed" || j.status === "active");
  const pendingJobs = sharedJobs.filter(j =>
    j.status === "pending" ||
    j.status === "opened" ||
    j.status === "ready" ||
    j.status === "notifying" ||
    j.status === "confirmations_closed"
  );
  const pastJobs = sharedJobs.filter(j => j.status === "completed" || j.status === "cancelled");
  const helpedOthersCount = sharedJobs.filter(j => j.selected_freelancer_id === userId).length;
  const gotHelpedCount = sharedJobs.filter(j => j.client_id === userId).length;
  const photoInitials = profile.full_name?.slice(0, 2) || "??";
  const profileFirstName = profile.full_name?.trim().split(/\s+/)[0] ?? "";
  const profileDisplayName = profile.full_name?.trim() || profileFirstName || "This user";

  async function loadPostedHelpEngagement(
    jobId: string,
    clientId: string
  ): Promise<{ engagement: PostedHelpEngagement; notifId: string | null }> {
    if (!currentUser?.id) return { engagement: "hidden", notifId: null };
    if (currentUser.id === clientId) return { engagement: "hidden", notifId: null };
    if (!canActAsHelper(currentProfile)) return { engagement: "hidden", notifId: null };

    const [confRes, notifRes] = await Promise.all([
      supabase
        .from("job_confirmations")
        .select("status")
        .eq("job_id", jobId)
        .eq("freelancer_id", currentUser.id)
        .maybeSingle(),
      supabase
        .from("job_candidate_notifications")
        .select("id, status")
        .eq("job_id", jobId)
        .eq("freelancer_id", currentUser.id)
        .maybeSingle(),
    ]);

    if (confRes.error) console.warn("[PublicProfile] job_confirmations", confRes.error);
    if (notifRes.error) console.warn("[PublicProfile] job_candidate_notifications", notifRes.error);

    const st = confRes.data?.status;
    if (st === "available") return { engagement: "accepted", notifId: null };
    if (st === "declined") return { engagement: "declined", notifId: null };

    const n = notifRes.data;
    if (n && (n.status === "pending" || n.status === "opened")) {
      return { engagement: "can_respond", notifId: n.id };
    }
    return { engagement: "not_invited", notifId: null };
  }

  async function openPostedHelpPreview(jobId: string) {
    setLoadingPostedHelpPreviewId(jobId);
    setPostedHelpPreviewJob(null);
    setPostedHelpMapJob(null);
    setPostedHelpEngagement("loading");
    setPostedHelpNotifId(null);
    try {
      const { data, error } = await supabase.rpc("get_public_job_request_preview", {
        p_job_id: jobId,
      });
      if (error) throw error;
      const job = data as Record<string, unknown> | null;
      if (!job || typeof job.id !== "string") {
        addToast({ title: "Could not load request", description: "Try again later.", variant: "error" });
        return;
      }
      const clientId = String(job.client_id ?? "");
      const eng = await loadPostedHelpEngagement(jobId, clientId);
      setPostedHelpEngagement(eng.engagement);
      setPostedHelpNotifId(eng.notifId);

      if (job.service_type === "pickup_delivery") {
        setPostedHelpMapJob(job);
      } else {
        setPostedHelpPreviewJob(job);
      }
    } catch (e: unknown) {
      console.error(e);
      addToast({
        title: "Could not load request",
        description: e instanceof Error ? e.message : "Try again.",
        variant: "error",
      });
      setPostedHelpEngagement("idle");
    } finally {
      setLoadingPostedHelpPreviewId(null);
    }
  }

  const activePostedHelpJob = postedHelpPreviewJob ?? postedHelpMapJob;

  async function handlePostedHelpConfirm() {
    const job = activePostedHelpJob;
    if (!job || typeof job.id !== "string" || !postedHelpNotifId) return;
    setPostedHelpConfirming(true);
    try {
      await apiPost(`/api/jobs/${job.id}/notifications/${postedHelpNotifId}/open`, {});
      await apiPost(`/api/jobs/${job.id}/confirm`, {});
      setPostedHelpEngagement("accepted");
      setPostedHelpNotifId(null);
      addToast({
        title: "Job accepted",
        description: "It's been moved to Pending Jobs while we wait for the client's final confirmation.",
        variant: "success",
      });
    } catch (err: unknown) {
      console.error(err);
      addToast({
        title: "Could not accept",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "error",
      });
    } finally {
      setPostedHelpConfirming(false);
    }
  }

  async function handlePostedHelpDecline() {
    if (!postedHelpNotifId) return;
    setPostedHelpDeclining(true);
    try {
      const { error } = await supabase.from("job_candidate_notifications").delete().eq("id", postedHelpNotifId);
      if (error) throw error;
      setPostedHelpEngagement("declined");
      setPostedHelpNotifId(null);
      addToast({
        title: "Request declined",
        description: "The job request has been removed from your list.",
        variant: "success",
      });
    } catch (err: unknown) {
      console.error(err);
      addToast({
        title: "Could not decline",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "error",
      });
    } finally {
      setPostedHelpDeclining(false);
    }
  }

  const postedHelpIncomingActionMessage = (() => {
    if (postedHelpEngagement === "accepted") return "You have already accepted.";
    if (postedHelpEngagement === "declined") return "You have already declined.";
    if (postedHelpEngagement === "not_invited") {
      return "You can respond here once this client sends you a request.";
    }
    if (postedHelpEngagement === "hidden") {
      if (!currentUser?.id) return "Sign in to accept or decline requests.";
      const openJobClientId =
        activePostedHelpJob && typeof (activePostedHelpJob as { client_id?: unknown }).client_id === "string"
          ? (activePostedHelpJob as { client_id: string }).client_id
          : null;
      if (openJobClientId && currentUser.id === openJobClientId) {
        return "This is your posted request.";
      }
      return "Switch to a helper account or enable “Receive job requests” in your profile settings to respond.";
    }
    return null;
  })();

  const showPostedHelpRespond =
    postedHelpEngagement === "can_respond" && postedHelpNotifId != null;

  /** Same grey card shell as “helped you in…” (past jobs). */
  const profileHistoryCardClass =
    "group border-none shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_8px_30px_rgba(0,0,0,0.35)] rounded-[24px] overflow-hidden bg-card/80 transition-all";

  const historyRowChevronClass =
    "h-5 w-5 shrink-0 text-slate-400 transition-colors group-hover:text-slate-700 dark:group-hover:text-slate-200";

  const renderPostedHelpRow = (job: ProfilePostedHelpRequest) => (
    <button
      key={job.id}
      type="button"
      onClick={() => void openPostedHelpPreview(job.id)}
      disabled={loadingPostedHelpPreviewId === job.id}
      className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-70"
    >
      <Card className={cn(profileHistoryCardClass, "w-full cursor-pointer")}>
        <CardContent className="flex items-center justify-between p-6">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800/70">
              <HeartHandshake className="h-6 w-6 text-slate-500 dark:text-slate-400" />
            </div>
            <div className="min-w-0 text-left">
              <p className="font-bold text-slate-900 dark:text-white">
                <span className="capitalize">{jobServiceLabel(job.service_type)}</span>
                {job.location_city ? (
                  <>
                    {" "}
                    <span className="font-semibold text-muted-foreground">in</span>{" "}
                    <span className="font-bold">{job.location_city}</span>
                  </>
                ) : null}
              </p>
              <p className="text-xs font-medium text-slate-400">
                Posted {new Date(job.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge
              className={cn(
                "border-none px-3 py-1 text-[10px] font-black uppercase tracking-wider",
                jobRequestStatusBadgeClass(job.status)
              )}
            >
              {jobRequestStatusLabel(job.status)}
            </Badge>
            {loadingPostedHelpPreviewId === job.id ? (
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" aria-hidden />
            ) : (
              <ChevronRight className={historyRowChevronClass} aria-hidden />
            )}
          </div>
        </CardContent>
      </Card>
    </button>
  );

  return (
    <div className="min-h-screen gradient-mesh pb-6 md:pb-8">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="md:hidden fixed z-[60] pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-card/90 backdrop-blur-md border border-border/60 shadow-lg text-slate-600 dark:text-slate-300 hover:bg-card dark:hover:bg-muted transition-all active:scale-95"
        style={{ top: "max(0.75rem, env(safe-area-inset-top))", left: "max(0.75rem, env(safe-area-inset-left))" }}
        aria-label="Back"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>

      <div className="app-desktop-shell pt-[calc(4.75rem+env(safe-area-inset-top))] md:pt-10">

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: User Card */}
          <div className="lg:col-span-1 space-y-6">
            <Card
              className={cn(
                "border-0 shadow-none rounded-none bg-transparent overflow-visible backdrop-blur-none",
                "md:border md:border-slate-200/70 md:dark:border-border/50",
                "md:shadow-[0_12px_35px_rgba(15,23,42,0.08)] md:dark:shadow-[0_12px_35px_rgba(0,0,0,0.35)]",
                "md:rounded-[28px] md:overflow-hidden md:bg-card/90 md:backdrop-blur-md"
              )}
            >
              <CardContent className="p-0 flex flex-col">
                {/* Mobile: avatar + name / rating; categories full-width below image row */}
                <div className="relative md:hidden">
                  {!isOwnProfile && currentUser && (
                    <div className="absolute right-3 top-2 z-30">
                      <button
                        type="button"
                        onClick={() => void toggleProfileFavorite()}
                        disabled={favoriteBusy}
                        title={profileFavorited ? "Remove from saved" : "Save profile"}
                        aria-label={profileFavorited ? "Remove from saved profiles" : "Save profile to Saved"}
                        aria-pressed={profileFavorited}
                        className="flex h-11 w-11 items-center justify-center rounded-full border border-rose-200/90 bg-white/95 text-rose-500 shadow-md backdrop-blur-sm transition hover:scale-105 active:scale-95 disabled:opacity-60 dark:border-rose-900/40 dark:bg-zinc-900/95 dark:text-rose-400"
                      >
                        {favoriteBusy ? (
                          <Loader2 className="h-5 w-5 animate-spin text-rose-500" aria-hidden />
                        ) : (
                          <Heart
                            className={cn("h-6 w-6", profileFavorited && "fill-rose-500 text-rose-500")}
                            strokeWidth={profileFavorited ? 0 : 2.25}
                            aria-hidden
                          />
                        )}
                      </button>
                    </div>
                  )}
                  <div className="flex gap-6 px-4 pt-2 pb-1 items-start">
                    <div className="relative h-32 w-32 shrink-0 self-start">
                      {profile.photo_url ? (
                        <button
                          type="button"
                          onClick={() => {
                            const url = profile.photo_url;
                            if (!url) return;
                            setProfileMediaLightbox({
                              urls: [url],
                              initialIndex: 0,
                            });
                          }}
                          className="relative block h-full w-full rounded-full ring-2 ring-slate-200/90 transition active:scale-[0.98] dark:ring-zinc-600"
                          aria-label="View profile photo full screen"
                        >
                          <img
                            src={profile.photo_url}
                            alt={profile.full_name ? `${profile.full_name} profile photo` : "Profile photo"}
                            className="h-full w-full rounded-full object-cover"
                            loading="eager"
                          />
                          <div className="pointer-events-none absolute -bottom-0.5 -right-0.5 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-emerald-500 text-white shadow-md dark:border-zinc-900">
                            <ShieldCheck className="h-4 w-4" />
                          </div>
                        </button>
                      ) : (
                        <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-primary/20 via-muted to-primary/10 ring-2 ring-slate-200/90 dark:ring-zinc-600">
                          <span className="text-3xl font-black uppercase tracking-tight text-primary/60">
                            {photoInitials}
                          </span>
                        </div>
                      )}
                      {!profile.photo_url ? (
                        <div className="absolute -bottom-0.5 -right-0.5 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-emerald-500 text-white shadow-md dark:border-zinc-900">
                          <ShieldCheck className="h-4 w-4" />
                        </div>
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1 flex flex-col items-stretch justify-start gap-0.5 pr-12 text-left pt-0 md:pr-0">
                      <h1 className="text-[1.65rem] font-black leading-[1.15] tracking-tight text-slate-900 dark:text-white sm:text-[1.75rem]">
                        {profile.full_name}
                      </h1>
                      <div className="mt-1.5 mb-0">
                        <StarRating
                          rating={profile.average_rating || 0}
                          totalRatings={profile.total_ratings || 0}
                          size="lg"
                          className="justify-start"
                        />
                      </div>
                      {profile.city?.trim() ? (
                        <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-400">
                          <MapPin className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-500" aria-hidden />
                          <span>{profile.city.trim()}</span>
                        </p>
                      ) : null}
                    </div>
                  </div>
                  {profile.categories && profile.categories.length > 0 && (
                    <div className="mt-5 -mx-4 px-4 pb-2 sm:-mx-6 sm:px-6">
                      <p className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 font-bold mb-2.5 text-left">
                        Job With
                      </p>
                      <div className="flex w-full flex-wrap gap-2.5 gap-y-2.5">
                        {profile.categories.map((category, idx) => (
                          <Badge
                            key={idx}
                            variant="secondary"
                            className="rounded-full border border-slate-200/80 bg-white/80 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.04em] text-slate-800 shadow-sm dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-slate-200"
                          >
                            {category.replace(/_/g, " ")}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Desktop / tablet: full-width hero */}
                <div className="relative hidden w-full aspect-[3/4] bg-muted sm:aspect-[4/5] md:block">
                  {profile.photo_url ? (
                    <img
                      src={profile.photo_url}
                      alt={profile.full_name ? `${profile.full_name} profile photo` : "Profile photo"}
                      className="absolute inset-0 h-full w-full object-cover"
                      loading="eager"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/20 via-muted to-primary/10">
                      <span className="text-5xl font-black uppercase tracking-tight text-primary/50 sm:text-6xl">
                        {photoInitials}
                      </span>
                    </div>
                  )}
                  {profile.photo_url ? (
                    <button
                      type="button"
                      onClick={() => {
                        const url = profile.photo_url;
                        if (!url) return;
                        setProfileMediaLightbox({
                          urls: [url],
                          initialIndex: 0,
                        });
                      }}
                      className="absolute inset-0 z-[5] cursor-zoom-in bg-transparent"
                      aria-label="View profile photo full screen"
                    />
                  ) : null}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/35 to-transparent" aria-hidden />
                  <div className="pointer-events-auto absolute right-3 top-3 z-20 flex flex-row-reverse items-center gap-2">
                    {!isOwnProfile && currentUser && (
                      <button
                        type="button"
                        onClick={() => void toggleProfileFavorite()}
                        disabled={favoriteBusy}
                        title={profileFavorited ? "Remove from saved" : "Save profile"}
                        aria-label={profileFavorited ? "Remove from saved profiles" : "Save profile to Saved"}
                        aria-pressed={profileFavorited}
                        className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white/90 bg-white/95 text-rose-500 shadow-lg backdrop-blur-sm transition hover:scale-105 active:scale-95 disabled:opacity-60 dark:border-zinc-900 dark:bg-zinc-900/95 dark:text-rose-400"
                      >
                        {favoriteBusy ? (
                          <Loader2 className="h-5 w-5 animate-spin text-rose-500" aria-hidden />
                        ) : (
                          <Heart
                            className={cn("h-[22px] w-[22px]", profileFavorited && "fill-rose-500 text-rose-500")}
                            strokeWidth={profileFavorited ? 0 : 2.25}
                            aria-hidden
                          />
                        )}
                      </button>
                    )}
                    <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white/90 bg-emerald-500 text-white shadow-lg dark:border-zinc-900">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                  </div>
                </div>

                <div className="hidden md:flex flex-col items-center px-7 pb-0 pt-7 text-center sm:px-8">
                <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white mb-2">
                  {profile.full_name}
                </h1>
                
                <div className="flex flex-col items-center gap-2 mb-6">
                  <StarRating 
                    rating={profile.average_rating || 0} 
                    totalRatings={profile.total_ratings || 0}
                    size="md"
                  />
                  {profile.city?.trim() ? (
                    <p className="flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-400">
                      <MapPin className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-500" aria-hidden />
                      <span>{profile.city.trim()}</span>
                    </p>
                  ) : null}
                </div>

                {profile.categories && profile.categories.length > 0 && (
                  <div className="w-full mb-6">
                    <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2 text-center">
                      Job With
                    </p>
                    <div className="flex flex-wrap justify-center gap-2.5">
                      {profile.categories.map((category, idx) => (
                        <Badge
                          key={idx}
                          variant="secondary"
                          className="rounded-full border border-slate-200/80 bg-card/90 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-700 shadow-[0_6px_14px_rgba(15,23,42,0.08)] transition-all hover:-translate-y-[1px] hover:shadow-[0_10px_18px_rgba(15,23,42,0.12)] dark:border-zinc-700 dark:bg-zinc-800/90 dark:text-slate-200"
                        >
                          {category.replace(/_/g, " ")}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                </div>

                <div className="flex flex-col items-stretch px-4 pt-5 pb-4 text-left sm:px-5 md:items-center md:px-7 md:pt-2 md:pb-4 md:text-center sm:px-8">
                <div className="w-full border-t-0 pt-0 md:border-t md:border-slate-100 md:pt-6 md:dark:border-white/5">
                  <div className="mb-6 flex flex-wrap items-center justify-center gap-4 py-3 sm:gap-5 md:mb-8 md:gap-4 md:py-2">
                    <button
                      type="button"
                      onClick={() => void handleOpenDirectChat()}
                      disabled={openingChat}
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg shadow-slate-900/20 transition-all hover:scale-105 active:scale-95 disabled:pointer-events-none disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:shadow-slate-100/20 md:h-11 md:w-11"
                      title="Messages"
                      aria-label="Open messages"
                    >
                      {openingChat ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <MessageSquare className="h-5 w-5" strokeWidth={2} />
                      )}
                    </button>
                    {!isOwnProfile &&
                      currentUser &&
                      profile.categories &&
                      profile.categories.length > 0 && (
                        <ProfileKnockMenu
                          variant="contact"
                          targetUserId={userId!}
                          targetRole={profile.role}
                          categories={profile.categories}
                          viewerId={currentUser.id}
                          viewerRole={currentProfile?.role ?? null}
                          viewerName={currentProfile?.full_name ?? null}
                        />
                      )}
                    {profile.whatsapp_number && (
                      <button
                        type="button"
                        onClick={() =>
                          window.open(`https://wa.me/${profile.whatsapp_number}`, "_blank")
                        }
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-green-500/20 transition-all hover:scale-105 active:scale-95 md:h-11 md:w-11"
                        title="WhatsApp"
                        aria-label="WhatsApp"
                      >
                        <Phone className="h-5 w-5 fill-current" />
                      </button>
                    )}
                    {profile.telegram_username && (
                      <button
                        type="button"
                        onClick={() =>
                          window.open(`https://t.me/${profile.telegram_username}`, "_blank")
                        }
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#0088cc] text-white shadow-lg shadow-blue-500/20 transition-all hover:scale-105 active:scale-95 md:h-11 md:w-11"
                        title="Telegram"
                        aria-label="Telegram"
                      >
                        <Send className="h-5 w-5 translate-x-[-1px] translate-y-[1px] fill-current" />
                      </button>
                    )}
                  </div>
                </div>

                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleProfileMediaUpload(f, "image");
                    e.target.value = "";
                  }}
                />
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleProfileMediaUpload(f, "video");
                    e.target.value = "";
                  }}
                />

                <Tabs defaultValue="images" className="w-full px-0 pb-4 md:px-0 md:pb-6">
                  <TabsList
                    className="grid h-12 w-full grid-cols-3 gap-1 rounded-2xl border border-slate-200/80 bg-slate-100/80 p-1 dark:border-zinc-700 dark:bg-zinc-800/80"
                    aria-label="Profile sections"
                  >
                    <TabsTrigger
                      value="images"
                      className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-zinc-900"
                      aria-label="Photos"
                      title="Photos"
                    >
                      <ImageIcon className="h-5 w-5 text-slate-700 dark:text-slate-200" />
                    </TabsTrigger>
                    <TabsTrigger
                      value="videos"
                      className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-zinc-900"
                      aria-label="Videos"
                      title="Videos"
                    >
                      <Video className="h-5 w-5 text-slate-700 dark:text-slate-200" />
                    </TabsTrigger>
                    <TabsTrigger
                      value="about"
                      className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-zinc-900"
                      aria-label="About me"
                      title="About me"
                    >
                      <UserCircle className="h-5 w-5 text-slate-700 dark:text-slate-200" />
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="images" className="mt-4 space-y-3">
                    {isOwnProfile && (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          disabled={uploadingMedia}
                          onClick={() => imageInputRef.current?.click()}
                          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-slate-200 dark:hover:bg-zinc-800"
                        >
                          {uploadingMedia ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                          Add photo
                        </button>
                      </div>
                    )}
                    {imageRows.length === 0 ? (
                      <div className="flex flex-col items-center gap-3 py-6 text-center">
                        <ImageIcon className="h-10 w-10 text-slate-300 dark:text-slate-600" aria-hidden />
                        <p className="text-sm font-medium text-slate-400 dark:text-slate-500">No photos yet.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {imageRows.map((row, idx) => (
                          <div key={row.id} className="group relative aspect-square overflow-hidden rounded-xl bg-muted">
                            <button
                              type="button"
                              onClick={() =>
                                setProfileMediaLightbox({
                                  urls: galleryImageUrls,
                                  initialIndex: idx,
                                })
                              }
                              className="absolute inset-0 block h-full w-full"
                              aria-label="View photo full screen"
                            >
                              <img
                                src={publicProfileMediaPublicUrl(row.storage_path)}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            </button>
                            {isOwnProfile && (
                              <button
                                type="button"
                                disabled={uploadingMedia}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleDeleteProfileMedia(row);
                                }}
                                className="absolute right-1.5 top-1.5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white opacity-0 shadow-md transition hover:bg-black/70 group-hover:opacity-100 md:opacity-100"
                                aria-label="Remove photo"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="videos" className="mt-4 space-y-3">
                    {isOwnProfile && (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          disabled={uploadingMedia}
                          onClick={() => videoInputRef.current?.click()}
                          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-slate-200 dark:hover:bg-zinc-800"
                        >
                          {uploadingMedia ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                          Add video
                        </button>
                      </div>
                    )}
                    {videoRows.length === 0 ? (
                      <div className="flex flex-col items-center gap-3 py-6 text-center">
                        <Video className="h-10 w-10 text-slate-300 dark:text-slate-600" aria-hidden />
                        <p className="text-sm font-medium text-slate-400 dark:text-slate-500">No videos yet.</p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-4">
                        {videoRows.map((row) => {
                          const videoSrc = publicProfileMediaPublicUrl(row.storage_path);
                          return (
                            <div key={row.id} className="group relative overflow-hidden rounded-xl bg-black">
                              <div
                                role="button"
                                tabIndex={0}
                                onClick={() => setProfileVideoLightboxUrl(videoSrc)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    setProfileVideoLightboxUrl(videoSrc);
                                  }
                                }}
                                className="cursor-pointer outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-orange-500"
                                aria-label="Open video full screen"
                              >
                                <video
                                  src={videoSrc}
                                  muted
                                  playsInline
                                  preload="metadata"
                                  className="pointer-events-none max-h-[min(70vh,420px)] w-full object-contain"
                                />
                              </div>
                              {isOwnProfile && (
                                <button
                                  type="button"
                                  disabled={uploadingMedia}
                                  onClick={() => void handleDeleteProfileMedia(row)}
                                  className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white shadow-md transition hover:bg-black/70"
                                  aria-label="Remove video"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="about" className="mt-4">
                    {profile.bio?.trim() ? (
                      <p className="text-left text-base leading-relaxed text-slate-700 dark:text-slate-300 md:text-center md:text-sm">
                        {profile.bio}
                      </p>
                    ) : (
                      <div className="flex flex-col items-center gap-3 py-6 text-center">
                        <UserCircle className="h-10 w-10 text-slate-300 dark:text-slate-600" aria-hidden />
                        <p className="text-sm font-medium text-slate-400 dark:text-slate-500">No bio yet.</p>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-3 px-1 sm:gap-4 sm:px-0">
              <div className="rounded-2xl border border-slate-200/70 bg-card/85 p-5 dark:border-border/50 md:rounded-[20px] md:p-6">
                <p className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-500 md:text-[10px] md:text-slate-400">
                  Helped Others
                </p>
                <p className="text-3xl font-black text-slate-900 dark:text-white md:text-2xl">{helpedOthersCount}</p>
              </div>
              <div className="rounded-2xl border border-slate-200/70 bg-card/85 p-5 dark:border-border/50 md:rounded-[20px] md:p-6">
                <p className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-500 md:text-[10px] md:text-slate-400">
                  Got Helped
                </p>
                <p className="text-3xl font-black text-slate-900 dark:text-white md:text-2xl">{gotHelpedCount}</p>
              </div>
            </div>
          </div>

          {/* Right Column: Job History */}
          <div className="lg:col-span-2 space-y-8">
            {/* Live availability pulses (public board) */}
            <div>
              <div className="mb-6 flex items-center gap-3 px-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
                  {profileDisplayName} offers help in…
                </h2>
              </div>

              <div className="space-y-4">
                {liveCommunityPosts.length > 0 ? (
                  liveCommunityPosts.map((post) => (
                    <Link
                      key={post.id}
                      to={`/public/posts?post=${encodeURIComponent(post.id)}`}
                      className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      <Card className={cn(profileHistoryCardClass, "cursor-pointer")}>
                        <CardContent className="flex items-center justify-between p-6">
                          <div className="flex min-w-0 flex-1 items-center gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800/70">
                              <Sparkles className="h-6 w-6 text-slate-500 dark:text-slate-400" />
                            </div>
                            <div className="min-w-0 text-left">
                              <p className="line-clamp-1 font-bold text-slate-900 dark:text-white">
                                {post.title}
                              </p>
                              <p className="mt-0.5 line-clamp-2 text-xs font-medium text-slate-400">
                                {livePostSummaryLine(post.availability_payload, post.note)}
                              </p>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <Badge
                              variant="secondary"
                              className="rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide"
                            >
                              {livePostCategoryLabel(post.category)}
                            </Badge>
                            <ExpiryCountdown
                              expiresAtIso={post.expires_at}
                              compact
                              className="text-[11px] font-semibold text-orange-600 dark:text-orange-400"
                            />
                            <ChevronRight className={historyRowChevronClass} aria-hidden />
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))
                ) : (
                  <div className="flex flex-col items-center gap-3 px-2 py-4 text-center sm:py-6">
                    <Sparkles className="h-10 w-10 text-slate-300 dark:text-slate-600" aria-hidden />
                    <p className="text-sm font-medium text-slate-400 dark:text-slate-500">
                      No live availability on the public board right now.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Job requests this user posted as client (public, via RPC) */}
            <div>
              <div className="mb-6 flex items-center gap-3 px-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-500/10">
                  <HeartHandshake className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                </div>
                <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
                  {profileDisplayName} needs your help in…
                </h2>
              </div>

              <div className="space-y-4">
                {postedHelpRequests.length > 0 ? (
                  postedHelpRequests.map((job) => renderPostedHelpRow(job))
                ) : (
                  <div className="flex flex-col items-center gap-3 px-2 py-4 text-center sm:py-6">
                    <HeartHandshake className="h-10 w-10 text-slate-300 dark:text-slate-600" aria-hidden />
                    <p className="text-sm font-medium text-slate-400 dark:text-slate-500">
                      {profileDisplayName} doesn’t have any open help requests right now.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Active Engagements — same grey cards as offers / needs / helped you */}
            <div>
              <div className="mb-6 flex items-center gap-3 px-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-500/10">
                  <Clock className="h-5 w-5 text-orange-500" />
                </div>
                <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white uppercase">
                  Active Engagements
                </h2>
              </div>

              <div className="space-y-4">
                {[...pendingJobs, ...activeJobs].length > 0 ? (
                  [...pendingJobs, ...activeJobs].map((job) => {
                    const isPending = pendingJobs.some((p) => p.id === job.id);
                    const card = (
                      <Card className={cn(profileHistoryCardClass, isPending && "cursor-pointer")}>
                        <CardContent className="flex items-center justify-between p-6">
                          <div className="flex min-w-0 flex-1 items-center gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800/70">
                              <Clock className="h-6 w-6 text-slate-500 dark:text-slate-400" />
                            </div>
                            <div className="min-w-0 text-left">
                              <p className="font-bold capitalize text-slate-900 dark:text-white">
                                {String(job.service_type ?? "").replace(/_/g, " ")}
                              </p>
                              <p className="text-xs font-medium text-slate-400">
                                {isPending
                                  ? `Requested on ${new Date(job.created_at).toLocaleDateString()}`
                                  : `Started ${new Date(job.created_at).toLocaleDateString()}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {isPending ? (
                              <Badge className="border-none bg-amber-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-amber-600 hover:bg-amber-500/20 dark:text-amber-500">
                                Waiting for confirmation
                              </Badge>
                            ) : (
                              <Badge className="border-none bg-orange-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-orange-600 hover:bg-orange-500/20">
                                {job.status}
                              </Badge>
                            )}
                            <ChevronRight className={historyRowChevronClass} aria-hidden />
                          </div>
                        </CardContent>
                      </Card>
                    );
                    if (isPending) {
                      return (
                        <button
                          key={job.id}
                          type="button"
                          onClick={() => navigate(buildJobsUrl("freelancer", "pending"))}
                          className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        >
                          {card}
                        </button>
                      );
                    }
                    return (
                      <div key={job.id} className="w-full">
                        {card}
                      </div>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center gap-3 px-2 py-4 text-center sm:py-6">
                    <Clock className="h-12 w-12 text-slate-300 dark:text-slate-600" aria-hidden />
                    <p className="font-medium text-slate-400 dark:text-slate-500">No active jobs with this user</p>
                  </div>
                )}
              </div>
            </div>

            {/* Past Jobs */}
            <div>
              <div className="flex items-center gap-3 mb-6 px-2">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                </div>
                <h2 className="text-xl font-black tracking-tight">
                  {`${profile.full_name || "This user"}, helped you in ...`}
                </h2>
              </div>

              <div className="space-y-4">
                {pastJobs.length > 0 ? pastJobs.map(job => (
                  <Card
                    key={job.id}
                    onClick={() => navigate(`/jobs/${job.id}/details`)}
                    className={cn(profileHistoryCardClass, "cursor-pointer")}
                  >
                    <CardContent className="flex items-center justify-between p-6">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800/70">
                          <CheckCircle2 className="h-6 w-6 text-slate-500 dark:text-slate-400" />
                        </div>
                        <div>
                          <p className="font-bold capitalize text-slate-900 dark:text-white">
                            {job.service_type?.replace('_', ' ')}
                          </p>
                          <p className="text-xs font-medium text-slate-400">
                            Completed on {new Date(job.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-right">
                        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-[10px] font-bold uppercase tracking-widest text-emerald-600">
                          {job.status}
                        </Badge>
                        <ChevronRight className={historyRowChevronClass} />
                      </div>
                    </CardContent>
                  </Card>
                )) : (
                  <div className="flex flex-col items-center gap-3 px-2 py-4 text-center sm:py-6">
                    <CheckCircle2 className="h-12 w-12 text-slate-300 dark:text-slate-600" aria-hidden />
                    <p className="text-slate-400 font-medium dark:text-slate-500">No past history with this user</p>
                  </div>
                )}
              </div>
            </div>

            {/* Reviews Section - LandingPage Style */}
            <div className="pt-4">
              <div className="flex items-center gap-3 mb-8 px-2">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                  <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                </div>
                <h2 className="text-xl font-black tracking-tight uppercase">User Reviews</h2>
              </div>

              <div className="space-y-10">
                {reviews.length > 0 ? reviews.map((review, idx) => {
                  const gradients = [
                    "from-blue-400 to-purple-500",
                    "from-green-400 to-teal-500",
                    "from-orange-400 to-pink-500",
                    "from-red-400 to-indigo-500",
                    "from-purple-400 to-blue-500",
                  ];
                  const gradient = gradients[idx % gradients.length];

                  return (
                    <div
                      key={review.id}
                      className="relative rounded-3xl border border-slate-200/90 bg-white p-8 pt-14 mt-10 shadow-md shadow-slate-950/5 transition-all duration-500 hover:shadow-lg dark:border-border/50 dark:bg-zinc-900 dark:shadow-black/20 dark:hover:shadow-lg group"
                    >
                      {/* Floating Avatar */}
                      <div className={cn(
                        "absolute -top-10 left-8 h-20 w-20 rounded-full bg-gradient-to-br p-1.5 shadow-xl group-hover:scale-110 transition-transform duration-500",
                        gradient
                      )}>
                        <Avatar className="h-full w-full border-4 border-white dark:border-zinc-900">
                          <AvatarImage src={review.reviewer.photo_url || undefined} className="object-cover" />
                          <AvatarFallback className="bg-transparent text-white font-bold text-2xl">
                            {review.reviewer.full_name?.slice(0, 2).toUpperCase() || "??"}
                          </AvatarFallback>
                        </Avatar>
                      </div>

                      <div className="flex flex-col">
                        <div className="flex items-center justify-between gap-4 mb-4">
                          <div>
                            <h4 className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-primary transition-colors">
                              {review.reviewer.full_name}
                            </h4>
                            <p className="text-[11px] text-slate-400 font-medium mt-0.5">{new Date(review.created_at).toLocaleDateString()}</p>
                          </div>
                          <div className="flex items-center gap-1.5 bg-yellow-400/10 px-3 py-1 rounded-full border border-yellow-400/20">
                            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                            <span className="text-[13px] font-black text-yellow-700 dark:text-yellow-500">{review.rating}</span>
                          </div>
                        </div>
                        <p className="text-gray-700 dark:text-slate-300 leading-relaxed italic text-base md:text-lg">
                          "{review.review_text || "No comments provided."}"
                        </p>
                      </div>
                    </div>
                  );
                }) : (
                  <div className="flex flex-col items-center gap-3 px-2 py-4 text-center sm:py-6">
                    <UserIcon className="h-12 w-12 text-slate-300 dark:text-slate-600" aria-hidden />
                    <p className="text-slate-400 font-medium dark:text-slate-500">No reviews yet for this user</p>
                  </div>
                )}
              </div>
            </div>

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
            currentUser.id === (postedHelpPreviewJob as { client_id?: string }).client_id
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
