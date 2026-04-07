import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { 
  MessageSquare, 
  Briefcase, 
  ArrowLeft, 
  ChevronRight,
  CheckCircle2,
  ShieldCheck,
  Clock,
  Star,
  Phone,
  Send,
  User as UserIcon,
  Loader2,
  Image as ImageIcon,
  Video,
  UserCircle,
  Plus,
  Trash2,
  MapPin,
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
  const [loading, setLoading] = useState(true);
  const [openingChat, setOpeningChat] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    const fetchProfileAndJobs = async () => {
      if (!userId || !currentUser) return;

      try {
        setLoading(true);

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

        setProfile({
          ...profileData,
          bio: freelancerData?.bio || null,
          whatsapp_number: profileData.whatsapp_number_e164
        });

        // 3. Fetch Shared Jobs + Pending notifications between these two users
        const [jobsRes, pendingRes] = await Promise.all([
          supabase
            .from("job_requests")
            .select("id, service_type, status, created_at, client_id, selected_freelancer_id")
            .or(`and(client_id.eq.${currentUser.id},selected_freelancer_id.eq.${userId}),and(client_id.eq.${userId},selected_freelancer_id.eq.${currentUser.id})`)
            .order("created_at", { ascending: false }),
          supabase
            .from("job_candidate_notifications")
            .select(`
              job_id, status, created_at, freelancer_id,
              job_requests (
                id, service_type, status, created_at, client_id, selected_freelancer_id
              )
            `)
            .in("status", ["pending", "opened"])
            .in("freelancer_id", [currentUser.id, userId])
            .order("created_at", { ascending: false })
        ]);

        if (jobsRes.error) throw jobsRes.error;
        if (pendingRes.error) throw pendingRes.error;

        const shared = jobsRes.data || [];
        const pendingFromNotifications: SharedJob[] = (pendingRes.data || [])
          .filter((n: any) => {
            const jr = n.job_requests;
            if (!jr) return false;

            // Keep only pending jobs between current user and viewed user
            const isCurrentAsClient = jr.client_id === currentUser.id && n.freelancer_id === userId;
            const isViewedAsClient = jr.client_id === userId && n.freelancer_id === currentUser.id;
            return isCurrentAsClient || isViewedAsClient;
          })
          .map((n: any) => ({
            id: n.job_requests.id,
            service_type: n.job_requests.service_type,
            status: "pending",
            created_at: n.job_requests.created_at || n.created_at,
            client_id: n.job_requests.client_id,
            selected_freelancer_id: n.job_requests.selected_freelancer_id || null,
          }));

        // Merge while avoiding duplicates by job id
        const mergedMap = new Map<string, SharedJob>();
        [...shared, ...pendingFromNotifications].forEach((job: SharedJob) => {
          if (!mergedMap.has(job.id)) mergedMap.set(job.id, job);
        });
        setSharedJobs(Array.from(mergedMap.values()));

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
        setReviews((reviewsData as any[]).map(r => ({
          ...r,
          reviewer: r.reviewer || { full_name: "Anonymous", photo_url: null }
        })));

        const { data: mediaData, error: mediaErr } = await supabase
          .from("public_profile_media")
          .select("id, user_id, media_type, storage_path, sort_order, created_at")
          .eq("user_id", userId)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true });

        if (mediaErr) {
          console.warn("[PublicProfile] public_profile_media:", mediaErr);
          setMediaItems([]);
        } else {
          setMediaItems((mediaData as PublicProfileMediaRow[]) ?? []);
        }

      } catch (error: any) {
        console.error("Error fetching public profile:", error);
        addToast({
          title: "Error",
          description: "Could not load user profile.",
          variant: "error",
        });
        navigate(-1);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileAndJobs();
  }, [userId, currentUser, navigate, addToast]);

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
                <div className="md:hidden">
                  <div className="flex gap-6 px-4 pt-2 pb-1 items-start">
                    <div className="relative h-32 w-32 shrink-0 self-start">
                      {profile.photo_url ? (
                        <img
                          src={profile.photo_url}
                          alt={profile.full_name ? `${profile.full_name} profile photo` : "Profile photo"}
                          className="h-full w-full rounded-full object-cover ring-2 ring-slate-200/90 dark:ring-zinc-600"
                          loading="eager"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-primary/20 via-muted to-primary/10 ring-2 ring-slate-200/90 dark:ring-zinc-600">
                          <span className="text-3xl font-black uppercase tracking-tight text-primary/60">
                            {photoInitials}
                          </span>
                        </div>
                      )}
                      <div className="absolute -bottom-0.5 -right-0.5 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-emerald-500 text-white shadow-md dark:border-zinc-900">
                        <ShieldCheck className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="min-w-0 flex-1 flex flex-col items-stretch justify-start gap-0.5 text-left pt-0">
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
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/35 to-transparent" aria-hidden />
                  <div className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white/90 bg-emerald-500 text-white shadow-lg dark:border-zinc-900">
                    <ShieldCheck className="h-4 w-4" />
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
                  {/* Contact Buttons: Round Icons */}
                  <div className="mb-8 flex items-center justify-center gap-5 py-4 md:mb-10 md:gap-4 md:py-3">
                    <button
                      type="button"
                      onClick={() => void handleOpenDirectChat()}
                      disabled={openingChat}
                      className="h-12 w-12 rounded-full bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 flex items-center justify-center shadow-lg shadow-slate-900/20 dark:shadow-slate-100/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-60 disabled:pointer-events-none md:h-11 md:w-11"
                      title="Open messages"
                    >
                      {openingChat ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <MessageSquare className="h-5 w-5" />
                      )}
                    </button>
                    {profile.whatsapp_number && (
                      <button 
                        onClick={() => window.open(`https://wa.me/${profile.whatsapp_number}`, '_blank')}
                        className="w-12 h-12 rounded-full bg-[#25D366] text-white flex items-center justify-center shadow-lg shadow-green-500/20 hover:scale-110 active:scale-95 transition-all"
                        title="WhatsApp"
                      >
                        <Phone className="w-5 h-5 fill-current" />
                      </button>
                    )}
                    {profile.telegram_username && (
                      <button 
                        onClick={() => window.open(`https://t.me/${profile.telegram_username}`, '_blank')}
                        className="w-12 h-12 rounded-full bg-[#0088cc] text-white flex items-center justify-center shadow-lg shadow-blue-500/20 hover:scale-110 active:scale-95 transition-all"
                        title="Telegram"
                      >
                        <Send className="w-5 h-5 fill-current translate-x-[-1px] translate-y-[1px]" />
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
                      <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">No photos yet.</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {imageRows.map((row) => (
                          <div key={row.id} className="group relative aspect-square overflow-hidden rounded-xl bg-muted">
                            <img
                              src={publicProfileMediaPublicUrl(row.storage_path)}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                            {isOwnProfile && (
                              <button
                                type="button"
                                disabled={uploadingMedia}
                                onClick={() => void handleDeleteProfileMedia(row)}
                                className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white opacity-0 shadow-md transition hover:bg-black/70 group-hover:opacity-100 md:opacity-100"
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
                      <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">No videos yet.</p>
                    ) : (
                      <div className="flex flex-col gap-4">
                        {videoRows.map((row) => (
                          <div key={row.id} className="group relative overflow-hidden rounded-xl bg-black">
                            <video
                              src={publicProfileMediaPublicUrl(row.storage_path)}
                              controls
                              playsInline
                              className="max-h-[min(70vh,420px)] w-full"
                            />
                            {isOwnProfile && (
                              <button
                                type="button"
                                disabled={uploadingMedia}
                                onClick={() => void handleDeleteProfileMedia(row)}
                                className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white shadow-md transition hover:bg-black/70"
                                aria-label="Remove video"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="about" className="mt-4">
                    {profile.bio?.trim() ? (
                      <p className="text-left text-base leading-relaxed text-slate-700 dark:text-slate-300 md:text-center md:text-sm">
                        {profile.bio}
                      </p>
                    ) : (
                      <p className="py-4 text-center text-sm text-slate-500 dark:text-slate-400">No bio yet.</p>
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
            
            {/* Active Jobs */}
            <div>
              <div className="flex items-center gap-3 mb-6 px-2">
                <div className="w-10 h-10 rounded-2xl bg-orange-500/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-orange-500" />
                </div>
                <h2 className="text-xl font-black tracking-tight uppercase">Active Engagements</h2>
              </div>
              
              <div className="space-y-4">
                {[...pendingJobs, ...activeJobs].length > 0 ? [...pendingJobs, ...activeJobs].map(job => (
                  <Card
                    key={job.id}
                    onClick={() => {
                      if (pendingJobs.some((p) => p.id === job.id)) {
                        navigate(buildJobsUrl("freelancer", "pending"));
                      }
                    }}
                    className={cn(
                      "group border-none shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)] transition-all rounded-[24px] overflow-hidden bg-card/80",
                      pendingJobs.some((p) => p.id === job.id) && "cursor-pointer"
                    )}
                  >
                    <CardContent className="p-6 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                          <Briefcase className="w-6 h-6 text-slate-400 group-hover:text-primary transition-colors" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors capitalize">
                            {job.service_type?.replace('_', ' ')}
                          </p>
                          <p className="text-xs text-slate-400 font-medium">
                            {pendingJobs.some((p) => p.id === job.id)
                              ? `Requested on ${new Date(job.created_at).toLocaleDateString()}`
                              : `Started ${new Date(job.created_at).toLocaleDateString()}`}
                          </p>
                        </div>
                      </div>
                      {pendingJobs.some((p) => p.id === job.id) ? (
                        <div className="flex items-center gap-2">
                          <Badge className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border-none px-4 py-1.5 rounded-full font-black text-[10px] uppercase tracking-widest">
                            Waiting for confirmation
                          </Badge>
                          <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors" />
                        </div>
                      ) : (
                        <Badge className="bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 border-none px-4 py-1.5 rounded-full font-black text-[10px] uppercase tracking-widest">
                          {job.status}
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                )) : (
                  <div className="p-12 text-center rounded-[32px] border-2 border-dashed border-slate-200 dark:border-white/5 bg-slate-100/30 dark:bg-white/2">
                    <Clock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-400 font-medium">No active jobs with this user</p>
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
                    className="group cursor-pointer border-none shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] rounded-[24px] overflow-hidden bg-card/80"
                  >
                    <CardContent className="p-6 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
                          <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white capitalize">
                            {job.service_type?.replace('_', ' ')}
                          </p>
                          <p className="text-xs text-slate-400 font-medium">Completed on {new Date(job.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 border-emerald-200 bg-emerald-50">
                          {job.status}
                        </Badge>
                        <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors" />
                      </div>
                    </CardContent>
                  </Card>
                )) : (
                  <div className="p-12 text-center rounded-[32px] border-2 border-dashed border-slate-200 dark:border-white/5 bg-slate-100/30 dark:bg-white/2">
                    <CheckCircle2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-400 font-medium">No past history with this user</p>
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
                  <div className="p-12 text-center rounded-[32px] border-2 border-dashed border-slate-200 dark:border-white/5 bg-slate-100/30 dark:bg-white/2">
                    <UserIcon className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-400 font-medium">No reviews yet for this user</p>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
