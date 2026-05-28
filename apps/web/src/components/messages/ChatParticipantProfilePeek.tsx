import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { BadgeCheck, ChevronRight, HelpCircle, Loader2, Star } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { HIRE_CATEGORY_TILE_UI } from "@/lib/discoverCategoryTileIcons";
import {
  isServiceCategoryId,
  serviceCategoryLabel,
} from "@/lib/serviceCategories";
import { supabase } from "@/lib/supabase";
import { WhatsAppIcon, TelegramIcon } from "@/components/BrandIcons";
import { getTelegramLink, getWhatsAppLink } from "@/lib/socialContactLinks";
import { ProfileKnockMenu } from "@/components/ProfileKnockMenu";
import { useAuth } from "@/context/AuthContext";

export type ChatParticipantPreview = {
  full_name: string | null;
  photo_url: string | null;
  city?: string | null;
};

export type ChatParticipantProfile = ChatParticipantPreview & {
  id: string;
  role?: "client" | "freelancer" | string;
  bio?: string | null;
  is_verified?: boolean;
  rating_avg?: number | null;
  rating_count?: number | null;
  whatsapp_number_e164?: string | null;
  telegram_username?: string | null;
  share_whatsapp?: boolean;
  share_telegram?: boolean;
  categories?: string[];
};

type ChatParticipantProfilePeekProps = {
  userId: string | null | undefined;
  preview?: ChatParticipantPreview | null;
  /** When available (e.g. from ChatPage), skips refetch. */
  profile?: ChatParticipantProfile | null;
  children: ReactNode;
  className?: string;
  panelClassName?: string;
};

function initials(name: string | null | undefined): string {
  const t = String(name ?? "").trim();
  if (!t) return "?";
  const parts = t.split(/\s+/).filter(Boolean);
  return (
    (parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "")
  ).toUpperCase() || "?";
}

function ProfileStarRating({
  rating,
  reviewCount,
}: {
  rating: number | null | undefined;
  reviewCount: number | null | undefined;
}) {
  const value = Math.max(0, Math.min(5, rating ?? 0));
  const count = reviewCount ?? 0;
  const label =
    count > 0
      ? `${value.toFixed(1)} out of 5, ${count} reviews`
      : "No reviews yet";

  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      role="img"
      aria-label={label}
    >
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }, (_, i) => {
          const starIndex = i + 1;
          const filled = value >= starIndex - 0.25;
          const partial = !filled && value > starIndex - 1;
          return (
            <Star
              key={starIndex}
              className={cn(
                "h-4 w-4 shrink-0",
                filled
                  ? "fill-amber-400 text-amber-400"
                  : partial
                    ? "fill-amber-200 text-amber-400"
                    : "fill-zinc-200 text-zinc-200 dark:fill-zinc-600 dark:text-zinc-600",
              )}
              strokeWidth={0}
              aria-hidden
            />
          );
        })}
      </div>
      {count > 0 ? (
        <span className="text-sm font-semibold tabular-nums text-zinc-800 dark:text-zinc-200">
          {value.toFixed(1)}
          <span className="ml-1 font-normal text-zinc-500 dark:text-zinc-400">
            ({count})
          </span>
        </span>
      ) : (
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
          No reviews yet
        </span>
      )}
    </div>
  );
}

function ProfileCategories({ categories }: { categories: string[] }) {
  if (!categories.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((catId) => {
        const label = serviceCategoryLabel(catId);
        const Icon = isServiceCategoryId(catId)
          ? HIRE_CATEGORY_TILE_UI[catId].Icon
          : HelpCircle;
        const iconClass = isServiceCategoryId(catId)
          ? HIRE_CATEGORY_TILE_UI[catId].iconClass
          : "text-zinc-500";
        return (
          <Badge
            key={catId}
            variant="secondary"
            className="inline-flex items-center gap-2 rounded-full border-zinc-200/80 bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:border-zinc-600/80 dark:bg-zinc-800 dark:text-zinc-200"
          >
            <Icon
              className={cn("h-4 w-4 shrink-0", iconClass)}
              strokeWidth={2}
              aria-hidden
            />
            {label}
          </Badge>
        );
      })}
    </div>
  );
}

async function fetchParticipantProfile(
  userId: string,
): Promise<ChatParticipantProfile | null> {
  const { data: row, error } = await supabase
    .from("profiles")
    .select(
      "id, full_name, photo_url, city, role, bio, is_verified, categories, whatsapp_number_e164, telegram_username, share_whatsapp, share_telegram, average_rating, total_ratings",
    )
    .eq("id", userId)
    .maybeSingle();

  if (error || !row) return null;

  const categories = Array.isArray(row.categories)
    ? (row.categories as string[]).filter(
        (c): c is string => typeof c === "string" && c.length > 0,
      )
    : [];

  let bio = (row.bio as string | null) ?? null;
  let rating_avg = (row.average_rating as number | null) ?? null;
  let rating_count = (row.total_ratings as number | null) ?? null;

  if (row.role === "freelancer") {
    const { data: fp } = await supabase
      .from("freelancer_profiles")
      .select("bio, rating_avg, rating_count")
      .eq("user_id", userId)
      .maybeSingle();
    if (fp) {
      bio = fp.bio ?? bio;
      rating_avg = fp.rating_avg ?? rating_avg;
      rating_count = fp.rating_count ?? rating_count;
    }
  }

  return {
    id: row.id,
    full_name: row.full_name,
    photo_url: row.photo_url,
    city: row.city,
    role: row.role,
    bio,
    is_verified: row.is_verified ?? false,
    rating_avg,
    rating_count,
    whatsapp_number_e164: row.whatsapp_number_e164,
    telegram_username: row.telegram_username,
    share_whatsapp: row.share_whatsapp ?? false,
    share_telegram: row.share_telegram ?? false,
    categories,
  };
}

export function ChatParticipantProfilePeek({
  userId,
  preview,
  profile: profileProp,
  children,
  className,
  panelClassName,
}: ChatParticipantProfilePeekProps) {
  const navigate = useNavigate();
  const { user: viewer, profile: viewerProfile } = useAuth();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState<ChatParticipantProfile | null>(null);
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => setIsMobileViewport(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const profile = useMemo(() => {
    if (!profileProp && !fetched) return null;
    if (!profileProp) return fetched;
    if (!fetched) return profileProp;
    return { ...profileProp, ...fetched };
  }, [profileProp, fetched]);
  const displayName =
    profile?.full_name?.trim() || preview?.full_name?.trim() || "Member";
  const photoUrl = profile?.photo_url ?? preview?.photo_url ?? undefined;
  const city = profile?.city ?? preview?.city;

  const showWhatsApp =
    Boolean(profile?.share_whatsapp && profile?.whatsapp_number_e164);
  const showTelegram =
    Boolean(profile?.share_telegram && profile?.telegram_username);

  useEffect(() => {
    if (!open || !userId) return;
    let cancelled = false;
    setLoading(true);
    void fetchParticipantProfile(userId).then((data) => {
      if (!cancelled) {
        setFetched(data);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, userId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointer = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      const panel = document.getElementById("chat-participant-profile-peek-panel");
      if (panel?.contains(target)) return;
      const el = rootRef.current;
      if (el && !el.contains(target)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    if (!isMobileViewport) {
      document.addEventListener("mousedown", onPointer);
      document.addEventListener("touchstart", onPointer);
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
    };
  }, [open, isMobileViewport]);

  const disabled = !userId;

  const panelCard = (
    <div className="overflow-hidden bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100 max-md:rounded-none max-md:rounded-b-2xl max-md:border-x-0 max-md:border-t-0 md:rounded-2xl md:border md:border-zinc-200/90 md:shadow-xl md:ring-1 md:ring-black/5 dark:md:border-zinc-700/90 dark:md:ring-white/5">
      <div className="relative bg-white px-4 py-4 dark:bg-zinc-900 max-md:pt-[max(0.75rem,env(safe-area-inset-top,0px))]">
        {(showWhatsApp || showTelegram) && !loading ? (
          <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
            {showWhatsApp && profile?.whatsapp_number_e164 ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Open WhatsApp"
                className="h-10 w-10 shrink-0 rounded-full border-emerald-500/30 bg-emerald-50 hover:bg-emerald-100 dark:border-emerald-500/40 dark:bg-emerald-950/50 dark:hover:bg-emerald-950"
                onClick={() => {
                  window.open(
                    getWhatsAppLink(profile.whatsapp_number_e164!),
                    "_blank",
                    "noopener,noreferrer",
                  );
                }}
              >
                <WhatsAppIcon className="h-5 w-5 fill-[#25D366]" />
              </Button>
            ) : null}
            {showTelegram && profile?.telegram_username ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Open Telegram"
                className="h-10 w-10 shrink-0 rounded-full border-sky-500/30 bg-sky-50 hover:bg-sky-100 dark:border-sky-500/40 dark:bg-sky-950/50 dark:hover:bg-sky-950"
                onClick={() => {
                  window.open(
                    getTelegramLink(profile.telegram_username!),
                    "_blank",
                    "noopener,noreferrer",
                  );
                }}
              >
                <TelegramIcon className="h-5 w-5 fill-[#0088cc]" />
              </Button>
            ) : null}
          </div>
        ) : null}
        <div
          className={cn(
            "flex items-start gap-3.5",
            showWhatsApp && showTelegram && !loading && "pr-28",
            (showWhatsApp || showTelegram) &&
              !(showWhatsApp && showTelegram) &&
              !loading &&
              "pr-14",
          )}
        >
          <Avatar className="h-[4.5rem] w-[4.5rem] shrink-0 border-2 border-zinc-100 shadow-sm dark:border-zinc-700">
            <AvatarImage src={photoUrl} className="object-cover" />
            <AvatarFallback className="bg-orange-50 text-xl font-bold text-orange-600 dark:bg-orange-950/60 dark:text-orange-400">
              {initials(displayName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-lg font-bold leading-tight text-zinc-900 dark:text-zinc-50">
                {displayName}
              </p>
              {profile?.is_verified ? (
                <BadgeCheck
                  className="h-[1.125rem] w-[1.125rem] shrink-0 text-sky-500"
                  aria-label="Verified"
                />
              ) : null}
            </div>
            {!loading ? (
              <ProfileStarRating
                rating={profile?.rating_avg}
                reviewCount={profile?.rating_count}
              />
            ) : null}
            {city ? (
              <p className="truncate text-sm leading-tight text-zinc-500 dark:text-zinc-400">
                {city}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="space-y-3 bg-white px-4 py-3 dark:bg-zinc-900">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2
              className="h-6 w-6 animate-spin text-zinc-400"
              aria-hidden
            />
          </div>
        ) : (
          <>
            {profile?.categories && profile.categories.length > 0 ? (
              <ProfileCategories categories={profile.categories} />
            ) : null}
            {profile?.bio?.trim() ? (
              <p className="line-clamp-4 text-base leading-relaxed text-zinc-600 dark:text-zinc-300">
                {profile.bio.trim()}
              </p>
            ) : (
              <p className="text-base text-zinc-500 dark:text-zinc-400">
                Tap below to view their full profile and posts.
              </p>
            )}
          </>
        )}

        <div className="flex items-stretch gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-10 min-h-10 flex-1 rounded-xl border-primary bg-white font-semibold text-primary hover:bg-orange-50 hover:text-primary dark:bg-zinc-800 dark:hover:bg-zinc-700"
            onClick={() => {
              setOpen(false);
              navigate(`/profile/${userId}`);
            }}
          >
            See profile
            <ChevronRight className="ml-1 h-4 w-4 text-primary" aria-hidden />
          </Button>
          {userId &&
          viewer?.id &&
          viewer.id !== userId &&
          profile?.categories &&
          profile.categories.length > 0 ? (
            <ProfileKnockMenu
              variant="peek"
              dropdownOpens="up"
              targetUserId={userId}
              targetRole={profile.role ?? null}
              categories={profile.categories}
              viewerId={viewer.id}
              viewerRole={viewerProfile?.role ?? null}
              viewerName={viewerProfile?.full_name ?? null}
              className="shrink-0"
            />
          ) : null}
        </div>
      </div>
    </div>
  );

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`${displayName} — profile summary`}
        className={cn(
          "inline-flex rounded-full outline-none",
          !disabled &&
            "cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          disabled && "pointer-events-none opacity-50",
        )}
        onClick={(e) => {
          if (disabled) return;
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            setOpen((v) => !v);
          }
        }}
      >
        {children}
      </div>

      {open && userId && isMobileViewport && typeof document !== "undefined"
        ? createPortal(
            <>
              <button
                type="button"
                aria-label="Close profile summary"
                className="fixed inset-0 z-[90] bg-black/30 animate-in fade-in duration-200"
                onClick={() => setOpen(false)}
              />
              <div
                id="chat-participant-profile-peek-panel"
                role="dialog"
                aria-label={`${displayName} profile`}
                className={cn(
                  "fixed inset-x-0 top-0 z-[100] w-full max-w-none",
                  "origin-top animate-in fade-in slide-in-from-top-2 duration-200",
                  "border-b border-zinc-200/90 shadow-lg dark:border-zinc-700/90",
                  panelClassName,
                )}
              >
                {panelCard}
              </div>
            </>,
            document.body,
          )
        : null}
      {open && userId && !isMobileViewport ? (
        <div
          id="chat-participant-profile-peek-panel"
          role="dialog"
          aria-label={`${displayName} profile`}
          className={cn(
            "absolute left-0 top-[calc(100%+0.5rem)] z-[80] w-[min(20rem,calc(100vw-2rem))]",
            "origin-top animate-in fade-in slide-in-from-top-2 duration-200",
            panelClassName,
          )}
        >
          {panelCard}
        </div>
      ) : null}
    </div>
  );
}
