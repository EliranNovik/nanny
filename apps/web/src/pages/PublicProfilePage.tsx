import { useState, useEffect } from "react";
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
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { StarRating } from "@/components/StarRating";
import { cn } from "@/lib/utils";

interface PublicProfile {
  id: string;
  full_name: string | null;
  photo_url: string | null;
  bio: string | null;
  role: string | null;
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

export default function PublicProfilePage() {
  const { userId } = useParams();
  const { user: currentUser, profile: currentProfile } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [sharedJobs, setSharedJobs] = useState<SharedJob[]>([]);
  const [reviews, setReviews] = useState<UserReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingChat, setOpeningChat] = useState(false);

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
          .select("id, full_name, photo_url, role, categories, whatsapp_number_e164, telegram_username, average_rating, total_ratings")
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

  return (
    <div className="min-h-screen gradient-mesh pb-32">
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
            <Card className="border border-slate-200/70 dark:border-border/50 shadow-[0_12px_35px_rgba(15,23,42,0.08)] dark:shadow-[0_12px_35px_rgba(0,0,0,0.35)] rounded-[28px] overflow-hidden bg-card/90 backdrop-blur-md">
              <CardContent className="p-0 flex flex-col">
                {/* Full-width hero — replaces circular avatar */}
                <div className="relative w-full aspect-[3/4] bg-muted sm:aspect-[4/5]">
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
                        {profile.full_name?.slice(0, 2) || "??"}
                      </span>
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/35 to-transparent" aria-hidden />
                  <div className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white/90 bg-emerald-500 text-white shadow-lg dark:border-zinc-900">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                </div>

                <div className="flex flex-col items-center px-7 pb-8 pt-6 text-center sm:px-8 sm:pt-7">
                <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white mb-2">
                  {profile.full_name}
                </h1>
                
                <div className="flex flex-col items-center gap-3 mb-6">
                  <StarRating 
                    rating={profile.average_rating || 0} 
                    totalRatings={profile.total_ratings || 0}
                    size="md"
                  />
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

                {profile.bio && (
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-8">
                    "{profile.bio}"
                  </p>
                )}

                <div className="w-full pt-6 border-t border-slate-100 dark:border-white/5">
                  {/* Contact Buttons: Round Icons */}
                  <div className="flex items-center justify-center gap-4 py-2">
                    <button
                      type="button"
                      onClick={() => void handleOpenDirectChat()}
                      disabled={openingChat}
                      className="w-11 h-11 rounded-full bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 flex items-center justify-center shadow-lg shadow-slate-900/20 dark:shadow-slate-100/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-60 disabled:pointer-events-none"
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
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-card/85 p-6 rounded-[20px] border border-slate-200/70 dark:border-border/50">
                <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Helped Others</p>
                <p className="text-2xl font-black text-slate-900 dark:text-white">{helpedOthersCount}</p>
              </div>
              <div className="bg-card/85 p-6 rounded-[20px] border border-slate-200/70 dark:border-border/50">
                <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Got Helped</p>
                <p className="text-2xl font-black text-slate-900 dark:text-white">{gotHelpedCount}</p>
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
                        navigate("/jobs", { state: { tab: "pending" } });
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
                      className="relative bg-card rounded-3xl border border-gray-100 dark:border-border/40 shadow-xl p-8 pt-14 mt-10 hover:shadow-2xl transition-all duration-500 group"
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
