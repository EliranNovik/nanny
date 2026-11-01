import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowUp,
  BadgeCheck,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Flag,
  HelpCircle,
  Hourglass,
  List,
  Loader2,
  MapPin,
  MessageCircle,
  Radar,
  Star,
  Tag,
  User,
  Users,
  X,
} from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import {
  getServiceCategoryImage,
  isServiceCategoryId,
  otherHelpSubcategoryLabel,
  serviceCategoryLabel,
} from "@/lib/serviceCategories";
import { publicProfileMediaPublicUrl } from "@/lib/publicProfileMedia";
import { respondsWithinCardLabel } from "@/lib/liveCanStart";
import { isFreelancerInActive24hLiveWindow } from "@/lib/freelancerLiveWindow";
import {
  AnimatedProfileRing,
  AvailabilityCard,
  MemberSinceBadge,
  type PublicAvailability,
} from "@/components/profile/PublicProfileAppFeatures";
import { bidirectionalTextProps } from "@/lib/textDirection";
import { useToast } from "@/components/ui/toast";

type FreelancerProfile = {
  bio: string | null;
  languages: string[];
  hourly_rate_min: number | null;
  hourly_rate_max: number | null;
  rating_avg: number;
  rating_count: number;
  live_until?: string | null;
  live_can_start_in?: string | null;
};

type Freelancer = {
  id: string;
  full_name: string;
  photo_url: string | null;
  city: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  is_verified?: boolean | null;
  confirmation_note?: string | null;
  is_open_job_accepted?: boolean;
  freelancer_profiles: FreelancerProfile;
};

type ProfileMedia = {
  id: string;
  media_type: "image" | "video";
  storage_path: string;
  sort_order: number;
};

type Review = {
  id: string;
  rating: number;
  review_text: string | null;
  created_at: string;
  reviewer: { full_name: string | null; photo_url: string | null } | null;
};

type ProfileDetails = {
  bio: string | null;
  created_at: string | null;
  categories: string[];
  languages: string[];
  availability: PublicAvailability | null;
  media: ProfileMedia[];
  reviews: Review[];
};

const EMPTY_PROFILE: ProfileDetails = {
  bio: null,
  created_at: null,
  categories: [],
  languages: [],
  availability: null,
  media: [],
  reviews: [],
};

function elapsed(createdAt?: string | null) {
  const start = createdAt ? new Date(createdAt).getTime() : Date.now();
  const seconds = Math.max(0, Math.floor((Date.now() - start) / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h
    ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function FakeStaticMap() {
  return (
    <svg
      viewBox="0 0 400 240"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 h-full w-full"
      aria-hidden
    >
      <rect width="400" height="240" className="fill-[#E9EAED] dark:fill-[#1B1E23]" />
      <path d="M349 -10 C330 55 377 91 351 145 C337 176 363 212 344 250 H410 V-10Z" className="fill-[#D8E3EE] dark:fill-[#18212C]" />
      <rect x="21" y="143" width="78" height="68" rx="9" className="fill-[#DCE8DC] dark:fill-[#1D2722]" />
      {[
        [18, 14, 65, 37], [104, 11, 70, 50], [195, 15, 62, 39], [275, 10, 55, 52],
        [10, 72, 90, 48], [121, 77, 52, 55], [195, 72, 70, 50], [284, 80, 44, 42],
        [112, 151, 61, 63], [193, 147, 56, 42], [267, 143, 62, 62], [16, 218, 82, 35],
        [181, 207, 76, 38],
      ].map(([x, y, w, h], index) => (
        <rect key={index} x={x} y={y} width={w} height={h} rx="5" className="fill-[#E0E1E5] dark:fill-[#21252B]" />
      ))}
      <g className="stroke-[#F7F7F8] dark:stroke-[#282C33]" fill="none" strokeWidth="6">
        <path d="M0 62 H400" /><path d="M0 132 H400" /><path d="M103 0 V240" />
        <path d="M181 0 V240" /><path d="M268 0 V240" /><path d="M337 0 V240" />
      </g>
      <g className="stroke-white dark:stroke-[#30353D]" fill="none" strokeWidth="11" strokeLinecap="round">
        <path d="M-15 192 C71 172 139 110 210 112 C276 115 302 182 420 170" />
        <path d="M44 -12 C70 49 159 72 227 45 C294 18 335 49 415 100" />
      </g>
      <path d="M-20 235 L410 20" className="stroke-[#F7F7F8] dark:stroke-[#282C33]" fill="none" strokeWidth="5" />
    </svg>
  );
}

function StaticMapHero({ job, freelancers }: { job: any; freelancers: Freelancer[] }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => tick((value) => value + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  const category = serviceCategoryLabel(job?.service_type).toLowerCase();
  const location = job?.location_city?.trim();
  const pickup = job?.service_type === "pickup_delivery";

  return (
    <section className="relative h-[min(26vh,220px)] min-h-[168px] w-full overflow-hidden">
      <FakeStaticMap />
      {pickup ? (
        <>
          <div className="absolute left-[23%] top-[58%] z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-orange-500 text-white shadow-md"><ArrowUp className="h-4 w-4" /></div>
          <div className="absolute right-[19%] top-[30%] z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-violet-500 text-white shadow-md"><Flag className="h-4 w-4" /></div>
          <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
            <line x1="27%" y1="64%" x2="77%" y2="36%" stroke="#f97316" strokeWidth="4" strokeDasharray="10 6" />
          </svg>
        </>
      ) : (
        <div className="absolute left-1/2 top-1/2 z-10 h-28 w-28 -translate-x-1/2 -translate-y-1/2">
          {[0, 1, 2].map((index) => (
            <span key={index} className="absolute inset-0 animate-ping rounded-full border border-emerald-500/50" style={{ animationDelay: `${index * 600}ms`, animationDuration: "2400ms" }} />
          ))}
          <span className="absolute inset-5 rounded-full border border-emerald-500/50" />
          <span className="absolute inset-[33px] rounded-full border border-emerald-500/60" />
          <span className="absolute left-1/2 top-1/2 flex h-[46px] w-[46px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[3px] border-white bg-orange-500 text-white shadow-lg">
            <Radar className="h-[26px] w-[26px]" />
          </span>
        </div>
      )}
      {!pickup && freelancers.slice(0, 30).map((helper, index) => {
        const angle = index * 2.4;
        const radius = 58 + (index % 3) * 12;
        return (
          <span
            key={helper.id}
            className={cn("absolute left-1/2 top-1/2 z-20 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-white shadow", helper.is_open_job_accepted ? "bg-amber-500" : "bg-emerald-500")}
            style={{ transform: `translate(calc(-50% + ${Math.cos(angle) * radius}px), calc(-50% + ${Math.sin(angle) * radius}px))` }}
          >
            <User className="h-[13px] w-[13px] fill-current" />
          </span>
        );
      })}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,.18),transparent_25%,transparent_50%,rgba(0,0,0,.66))]" />
      <div className="absolute left-3 top-3 z-30 inline-flex h-[34px] items-center gap-2 rounded-full bg-black/55 px-3 font-mono text-[13px] font-bold tabular-nums text-white">
        <Clock3 className="h-[18px] w-[18px]" /> {elapsed(job?.created_at)}
      </div>
      <p className="absolute inset-x-4 bottom-3 z-30 text-center text-[15px] font-semibold text-white">
        Searching for {category} help {location ? `near ${location}` : "near you"}…
      </p>
    </section>
  );
}

function RowSkeleton() {
  return (
    <div className="flex h-[114px] gap-3 rounded-[20px] bg-white p-[5px] shadow-[0_4px_12px_rgba(15,23,42,.08)] dark:bg-[#111214] dark:shadow-none">
      <div className="h-[104px] w-[104px] animate-pulse rounded-[15px] bg-muted" />
      <div className="flex flex-1 flex-col gap-2 py-2">
        <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
        <div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
        <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}

function PageSkeleton({ onBack }: { onBack: () => void }) {
  return (
    <main className="min-h-screen bg-white pb-28 dark:bg-black">
      <header className="flex h-[58px] items-center gap-2 px-2 pb-2 pt-2">
        <button onClick={onBack} className="flex h-10 w-10 items-center justify-center"><ChevronLeft /></button>
        <div className="h-[34px] w-[34px] animate-pulse rounded-full bg-muted" />
        <div className="h-4 w-[132px] animate-pulse rounded bg-muted" />
        <div className="ml-auto h-9 w-[52px] animate-pulse rounded-full bg-muted" />
      </header>
      <div className="relative h-[min(26vh,220px)] min-h-[168px] overflow-hidden"><FakeStaticMap /><div className="absolute inset-0 bg-white/25 dark:bg-black/25" /><div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full bg-muted/80" /></div>
      <div className="flex gap-2 px-3 py-4">{[72, 82, 62].map((w) => <div key={w} className="h-9 animate-pulse rounded-full bg-muted" style={{ width: w }} />)}</div>
      <div className="grid grid-cols-1 gap-2.5 px-2.5 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2, 3].map((key) => <RowSkeleton key={key} />)}</div>
    </main>
  );
}

function ApplicantRow({ helper, gallery, replyLabel, onClick }: { helper: Freelancer; gallery: ProfileMedia[]; replyLabel: string | null; onClick: () => void }) {
  const fp = helper.freelancer_profiles;
  const firstImage = gallery.find((item) => item.media_type === "image");
  const image = helper.photo_url || (firstImage ? publicProfileMediaPublicUrl(firstImage.storage_path) : null);
  const categories = fp.live_until && isFreelancerInActive24hLiveWindow(fp) ? ["Available now"] : ["Helper"];
  const rate = fp.hourly_rate_min != null
    ? fp.hourly_rate_max != null && fp.hourly_rate_max !== fp.hourly_rate_min
      ? `₪${fp.hourly_rate_min}–${fp.hourly_rate_max}/hr`
      : `₪${fp.hourly_rate_min}/hr`
    : null;
  return (
    <button type="button" onClick={onClick} className="relative flex w-full gap-3 rounded-[20px] bg-white p-[5px] pe-3 text-start shadow-[0_4px_12px_rgba(15,23,42,.08)] transition active:opacity-80 dark:bg-[#111214] dark:shadow-none">
      <div className="relative h-[104px] w-[104px] shrink-0 overflow-hidden rounded-[15px] bg-muted">
        {image ? <img src={image} alt="" className="h-full w-full object-cover" /> : <img src={getServiceCategoryImage("other_help")} alt="" className="h-full w-full object-cover" />}
        <span className={cn("absolute bottom-1.5 right-1.5 h-4 w-4 rounded-full border-[2.5px] border-white", isFreelancerInActive24hLiveWindow(fp) ? "bg-emerald-500" : "bg-slate-400")} />
      </div>
      <div className="min-w-0 flex-1 space-y-[5px] pt-1">
        <div className="flex items-center gap-1">
          <span className="truncate text-base font-extrabold">{helper.full_name || "Helper"}</span>
          {helper.is_verified ? <BadgeCheck className="h-[17px] w-[17px] shrink-0 fill-emerald-500 text-white" /> : null}
        </div>
        <p className="flex items-center gap-1.5 truncate text-[13.5px] font-semibold text-muted-foreground"><Briefcase className="h-[17px] w-[17px] shrink-0" />{categories.join(" · ")}</p>
        {helper.city ? <p className="flex items-center gap-1.5 truncate text-[13.5px] font-semibold text-muted-foreground"><MapPin className="h-[17px] w-[17px] shrink-0" />{helper.city}</p> : null}
        <p className={cn("flex items-center gap-1.5 truncate font-bold", rate ? "text-[15.5px]" : "text-[13.5px] text-emerald-600")}>
          {rate ? <Tag className="h-[17px] w-[17px] shrink-0" /> : <MessageCircle className="h-[17px] w-[17px] shrink-0" />}
          {rate || (replyLabel ? `Replies · ${replyLabel}` : "Replies")}
        </p>
        {fp.rating_count > 0 ? <p className="flex items-center gap-1 text-[13px] font-semibold text-muted-foreground"><Star className="h-[15px] w-[15px] fill-amber-400 text-amber-400" />{fp.rating_avg.toFixed(1)} ({fp.rating_count})</p> : null}
      </div>
      <ChevronRight className="absolute bottom-3 right-3 h-5 w-5 text-muted-foreground" />
    </button>
  );
}

function ProfileSheet({
  helper,
  profile,
  loading,
  busy,
  onClose,
  onDecline,
  onSelect,
  onProfile,
}: {
  helper: Freelancer | null;
  profile: ProfileDetails;
  loading: boolean;
  busy: boolean;
  onClose: () => void;
  onDecline: () => void;
  onSelect: () => void;
  onProfile: () => void;
}) {
  if (!helper) return null;
  const fp = helper.freelancer_profiles;
  const categories = profile.categories.length ? profile.categories : ["Helper"];
  const gallery = profile.media;
  return (
    <div className="fixed inset-0 z-[300] bg-black/45" role="dialog" aria-modal="true" aria-label={`${helper.full_name} profile preview`}>
      <button className="absolute inset-0" onClick={onClose} aria-label="Close" />
      <section className="absolute inset-x-0 bottom-0 mx-auto flex h-[88dvh] max-w-[700px] flex-col overflow-hidden rounded-t-[28px] bg-background shadow-2xl">
        <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-muted-foreground/30" />
        <button onClick={onClose} className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-muted"><X className="h-5 w-5" /></button>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-4">
          <div className="flex gap-4">
            <button onClick={onProfile} className="shrink-0"><AnimatedProfileRing photoUrl={helper.photo_url} name={helper.full_name || "Helper"} helper className="origin-top-left scale-[.74] -mb-[31px] -mr-[31px]" /></button>
            <div className="min-w-0 flex-1 space-y-1 pt-1">
              {profile.created_at ? <MemberSinceBadge createdAt={profile.created_at} helper /> : <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600"><Users className="h-5 w-5" /></span>}
              <h2 className="flex items-center gap-1 text-[22px] font-extrabold"><span className="truncate">{helper.full_name}</span>{helper.is_verified ? <BadgeCheck className="h-[17px] w-[17px] shrink-0 fill-emerald-500 text-white" /> : null}</h2>
              {helper.city ? <p className="-mt-1 text-[15px] font-semibold text-muted-foreground">{helper.city}</p> : null}
              {fp.rating_count ? <p className="flex items-center gap-1 text-sm font-bold"><Star className="h-4 w-4 fill-amber-400 text-amber-400" />{fp.rating_avg.toFixed(1)} ({fp.rating_count})</p> : <p className="text-xs font-extrabold uppercase text-emerald-600">New helper</p>}
            </div>
          </div>
          <div className="-mx-5 mt-5 flex gap-2 overflow-x-auto px-5 pb-1">
            {categories.map((category) => <span key={category} className="inline-flex shrink-0 items-center gap-2 rounded-full bg-muted px-3.5 py-2 text-sm font-bold"><HelpCircle className="h-[19px] w-[19px] text-emerald-600" />{isServiceCategoryId(category) ? serviceCategoryLabel(category) : category}</span>)}
          </div>
          {gallery.length ? (
            <div className="-mx-5 mt-4 flex snap-x gap-2 overflow-x-auto px-5">
              {gallery.map((item) => <div key={item.id} className="aspect-[1.28] w-full shrink-0 snap-center overflow-hidden rounded-[18px] bg-muted">{item.media_type === "video" ? <video src={publicProfileMediaPublicUrl(item.storage_path)} controls className="h-full w-full object-cover" /> : <img src={publicProfileMediaPublicUrl(item.storage_path)} alt="" className="h-full w-full object-cover" />}</div>)}
            </div>
          ) : null}
          {helper.confirmation_note ? <section className={cn("mt-4 rounded-2xl p-4", helper.is_open_job_accepted ? "bg-orange-500/10" : "bg-muted")}><h3 className="text-[11px] font-extrabold uppercase">Note from helper</h3><p {...bidirectionalTextProps(helper.confirmation_note, "mt-1 text-[15px]")}>{helper.confirmation_note}</p></section> : null}
          {loading ? <div className="mt-5 flex justify-center"><Loader2 className="animate-spin" /></div> : null}
          {(profile.bio || fp.bio) ? <section className="mt-5"><h3 className="text-[17px] font-extrabold">About</h3><p {...bidirectionalTextProps(profile.bio || fp.bio || "", "mt-2 text-base font-medium leading-[23px]")}>{profile.bio || fp.bio}</p></section> : null}
          {profile.availability ? <section className="mt-5"><h3 className="mb-2 text-[17px] font-extrabold">Available hours</h3><AvailabilityCard value={profile.availability} /></section> : null}
          {profile.reviews.length ? <section className="mt-5"><h3 className="text-[17px] font-extrabold">Reviews ({profile.reviews.length})</h3><div className="-mx-5 mt-2 flex snap-x gap-3 overflow-x-auto px-5">{profile.reviews.map((review) => <article key={review.id} className="w-[86%] shrink-0 snap-center rounded-2xl bg-[#F7F7F8] p-4 dark:bg-[#2C3038]"><div className="flex justify-between font-bold"><span>{review.reviewer?.full_name || "Member"}</span><span>★ {review.rating}</span></div><p {...bidirectionalTextProps(review.review_text || "No comments provided", "mt-3 line-clamp-4")}>“{review.review_text || "No comments provided"}”</p></article>)}</div></section> : null}
          <section className="mt-5 space-y-2 rounded-2xl bg-muted/60 p-3.5 text-sm">
            {fp.hourly_rate_min != null ? <p className="flex gap-2"><Tag className="h-5 w-5" /><b>₪{fp.hourly_rate_min}{fp.hourly_rate_max && fp.hourly_rate_max !== fp.hourly_rate_min ? `–${fp.hourly_rate_max}` : ""}/hr</b></p> : null}
            {profile.languages.length ? <p className="flex gap-2"><MessageCircle className="h-5 w-5" />{profile.languages.join(" · ")}</p> : null}
          </section>
          <button onClick={onProfile} className="mt-5 flex h-[50px] w-full items-center justify-center gap-2 rounded-[14px] bg-muted font-bold"><User className="h-5 w-5" />View profile<ChevronRight className="h-5 w-5" /></button>
        </div>
        <footer className="flex gap-2.5 border-t bg-background px-4 pb-[max(10px,env(safe-area-inset-bottom))] pt-2.5">
          <button disabled={busy} onClick={onDecline} className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-full bg-[#f2f2f4] text-[15px] font-extrabold text-rose-500 disabled:opacity-50 dark:bg-[#25282f]">{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <X className="h-[22px] w-[22px]" />}Decline</button>
          <button disabled={busy} onClick={onSelect} className={cn("flex h-[52px] flex-[1.5] items-center justify-center gap-2 rounded-full text-sm font-extrabold uppercase text-white disabled:opacity-50", helper.is_open_job_accepted ? "bg-[#059669]" : "bg-emerald-600")}>{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <MessageCircle className="h-[21px] w-[21px]" />}Select & Chat</button>
        </footer>
      </section>
    </div>
  );
}

export default function ConfirmedListParity() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { addToast } = useToast();
  const seededJob = (location.state as { job?: any } | null)?.job ?? null;
  const [job, setJob] = useState<any>(seededJob);
  const [freelancers, setFreelancers] = useState<Freelancer[]>([]);
  const [gallery, setGallery] = useState<Record<string, ProfileMedia[]>>({});
  const [replyStats, setReplyStats] = useState<Record<string, { avg_seconds: number; sample_count: number }>>({});
  const [loading, setLoading] = useState(!seededJob);
  const [helpersLoading, setHelpersLoading] = useState(true);
  const [selected, setSelected] = useState<Freelancer | null>(null);
  const [profile, setProfile] = useState<ProfileDetails>(EMPTY_PROFILE);
  const [profileLoading, setProfileLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const fetchConfirmed = useCallback(async () => {
    if (!jobId) return;
    try {
      const data = await apiGet<{ freelancers: Freelancer[]; job: any }>(`/api/jobs/${jobId}/confirmed`);
      setJob((current: any) => current ? { ...current, ...data.job } : data.job);
      setFreelancers(data.freelancers || []);
      const ids = (data.freelancers || []).map((item) => item.id);
      if (ids.length) {
        const [mediaResult, statsResult] = await Promise.all([
          supabase.from("public_profile_media").select("id,user_id,media_type,storage_path,sort_order").in("user_id", ids).order("sort_order"),
          supabase.rpc("get_helper_chat_response_stats", { p_helper_ids: ids }),
        ]);
        const nextGallery: Record<string, ProfileMedia[]> = {};
        for (const item of (mediaResult.data || []) as (ProfileMedia & { user_id: string })[]) (nextGallery[item.user_id] ||= []).push(item);
        setGallery(nextGallery);
        const nextStats: Record<string, { avg_seconds: number; sample_count: number }> = {};
        for (const item of (statsResult.data || []) as any[]) nextStats[item.helper_id] = { avg_seconds: Number(item.avg_seconds), sample_count: Number(item.sample_count) };
        setReplyStats(nextStats);
      }
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load job details");
    } finally {
      setLoading(false);
      setHelpersLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    void fetchConfirmed();
    const id = window.setInterval(() => void fetchConfirmed(), 15_000);
    const focus = () => void fetchConfirmed();
    window.addEventListener("focus", focus);
    return () => { window.clearInterval(id); window.removeEventListener("focus", focus); };
  }, [fetchConfirmed]);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setProfile(EMPTY_PROFILE);
    setProfileLoading(true);
    void Promise.all([
      supabase.from("profiles").select("bio,created_at,categories,languages,availability").eq("id", selected.id).maybeSingle(),
      supabase.from("job_reviews").select("id,rating,review_text,created_at,reviewer:profiles!reviewer_id(full_name,photo_url)").eq("reviewee_id", selected.id).order("created_at", { ascending: false }),
    ]).then(([profileResult, reviewsResult]) => {
      if (cancelled) return;
      const data = profileResult.data as any;
      setProfile({
        bio: data?.bio || null,
        created_at: data?.created_at || null,
        categories: Array.isArray(data?.categories) ? data.categories : [],
        languages: Array.isArray(data?.languages) ? data.languages : selected.freelancer_profiles.languages || [],
        availability: (data?.availability as PublicAvailability | null) || null,
        media: gallery[selected.id] || [],
        reviews: (reviewsResult.data || []) as unknown as Review[],
      });
      setProfileLoading(false);
    });
    return () => { cancelled = true; };
  }, [selected, gallery]);

  async function decline() {
    if (!selected || !jobId) return;
    setBusy(true);
    try {
      await apiPost(`/api/jobs/${jobId}/decline`, { freelancer_id: selected.id });
      setFreelancers((rows) => rows.filter((row) => row.id !== selected.id));
      setSelected(null);
    } catch (cause) {
      setSelected(null);
      setError(cause instanceof Error ? cause.message : "Failed to decline helper");
    } finally { setBusy(false); }
  }

  async function selectAndChat() {
    if (!selected || !jobId) return;
    setBusy(true);
    try {
      const result = await apiPost<{ conversation_id: string }>(`/api/jobs/${jobId}/select`, { freelancer_id: selected.id });
      navigate(`/chat/${result.conversation_id}`, { replace: true });
    } catch (cause) {
      setSelected(null);
      setError(cause instanceof Error ? cause.message : "Failed to select helper");
      setBusy(false);
    }
  }

  async function stopRequest() {
    if (!jobId || !window.confirm("Stop request?\n\nThis removes your open request. Helpers will no longer see it.")) return;
    setDeleting(true);
    const { error: deleteError } = await supabase.from("job_requests").delete().eq("id", jobId);
    if (deleteError) {
      addToast({ title: "Failed to stop request", description: deleteError.message, variant: "error" });
      setDeleting(false);
      return;
    }
    navigate(-1);
  }

  const categoryLabel = useMemo(() => {
    if (!job) return "Live request";
    if (job.service_type === "other_help") {
      const subtype = job.service_details?.other_type;
      return otherHelpSubcategoryLabel(subtype) || serviceCategoryLabel(job.service_type);
    }
    return serviceCategoryLabel(job.service_type);
  }, [job]);

  if (loading) return <PageSkeleton onBack={() => navigate(-1)} />;

  return (
    <main className="relative min-h-screen bg-white pb-[calc(88px+env(safe-area-inset-bottom))] dark:bg-black">
      <header className="flex min-h-[58px] items-center gap-2 px-2 pb-2 pt-[max(8px,env(safe-area-inset-top))]">
        <button onClick={() => navigate(-1)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" aria-label="Back"><ChevronLeft className="h-6 w-6" /></button>
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          {isServiceCategoryId(job?.service_type) ? <img src={getServiceCategoryImage(job.service_type)} alt="" className="h-[34px] w-[34px] shrink-0 rounded-full object-cover" /> : <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600"><HelpCircle className="h-[22px] w-[22px]" /></span>}
          <h1 className="truncate text-base font-extrabold">{categoryLabel || "Live request"}</h1>
        </div>
        <button onClick={stopRequest} disabled={deleting} className="flex h-9 min-w-[52px] items-center justify-center rounded-full bg-red-500/15 px-3 text-[13px] font-extrabold text-red-500/75">{deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Stop"}</button>
      </header>
      <StaticMapHero job={job} freelancers={freelancers} />
      <section className="flex flex-wrap gap-2 px-3 py-4">
        {freelancers.length ? <span className="inline-flex h-9 items-center gap-2 rounded-full bg-black/[.06] px-3 text-[15px] font-extrabold dark:bg-white/[.06]"><Users className="h-5 w-5" />{freelancers.length} helper{freelancers.length === 1 ? "" : "s"}</span> : null}
        <button onClick={() => navigate(`/client/helpers?category=${encodeURIComponent(job?.service_type || "")}`)} className="inline-flex h-9 items-center gap-2 rounded-full bg-green-500/15 px-3 text-[15px] font-extrabold text-green-600"><span className="h-2.5 w-2.5 rounded-full bg-green-500" />{freelancers.filter((item) => isFreelancerInActive24hLiveWindow(item.freelancer_profiles)).length} online</button>
        <span className="inline-flex h-9 items-center gap-2 rounded-full bg-[#25282f] px-3 text-[15px] font-extrabold text-white"><MessageCircle className="h-[18px] w-[18px]" />0</span>
      </section>
      {error ? <div className="mx-2.5 mb-3 rounded-xl bg-red-500/10 p-3 text-sm text-red-600">{error}</div> : null}
      <section className="grid grid-cols-1 gap-2.5 px-2.5 md:grid-cols-2 xl:grid-cols-3">
        {helpersLoading ? [0, 1, 2].map((key) => <RowSkeleton key={key} />) : freelancers.map((helper) => {
          const stat = replyStats[helper.id];
          return <ApplicantRow key={helper.id} helper={helper} gallery={gallery[helper.id] || []} replyLabel={respondsWithinCardLabel(stat?.avg_seconds, stat?.sample_count)} onClick={() => setSelected(helper)} />;
        })}
      </section>
      {!helpersLoading && !freelancers.length ? <section className="px-5 py-10 text-center"><Hourglass className="mx-auto h-10 w-10 text-muted-foreground" /><h2 className="mt-4 text-lg font-extrabold">No confirmations yet</h2><button onClick={() => navigate("/community/feed")} className="mt-6 h-12 rounded-[14px] bg-emerald-600 px-5 font-bold text-white">View or share posts</button><div><button onClick={() => navigate(`/jobs/${jobId}/details?edit=1`)} className="mt-3 rounded-full bg-muted px-4 py-2 text-sm font-bold">Add media</button></div></section> : null}
      <button onClick={() => navigate(`/jobs/${jobId}/details`)} className="fixed bottom-[max(18px,env(safe-area-inset-bottom))] right-[max(16px,env(safe-area-inset-right))] z-40 flex h-[52px] min-w-[88px] items-center justify-center rounded-full bg-background px-[22px] shadow-xl" aria-label="Add more information to your request"><List className="h-7 w-7" /></button>
      <ProfileSheet helper={selected} profile={profile} loading={profileLoading} busy={busy} onClose={() => !busy && setSelected(null)} onDecline={() => void decline()} onSelect={() => void selectAndChat()} onProfile={() => { if (selected) { setSelected(null); navigate(`/profile/${encodeURIComponent(selected.id)}`); } }} />
    </main>
  );
}
