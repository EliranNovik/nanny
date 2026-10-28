import { useState, useEffect, useRef, useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import {
  MessageSquare,
  ChevronRight,
  BadgeCheck,
  Star,
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
  Globe,
  User as UserIcon,
  LayoutGrid,
  Medal,
  Trophy,
  Crown,
  MoreHorizontal,
  Share2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { StarRating } from "@/components/StarRating";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { isFreelancerLiveWindowActive } from "@/lib/freelancerLiveWindow";
import { applyPageSeo } from "@/lib/seo";
import { useTranslation } from "react-i18next";
import { feedLocationDisplayLabel } from "@/lib/globalFeedPostUi";
import type { TFunction } from "i18next";

import {
  PUBLIC_PROFILE_MEDIA_BUCKET,
  publicProfileMediaPublicUrl,
  publicProfileMediaUrl,
} from "@/lib/publicProfileMedia";
import { mediaUrl } from "@/lib/imageTransform";
import { FullscreenMapModal } from "@/components/FullscreenMapModal";
import { WhatsAppIcon, TelegramIcon } from "@/components/BrandIcons";
import { ImageLightboxModal } from "@/components/ImageLightboxModal";
import { VideoLightboxModal } from "@/components/VideoLightboxModal";
import { type PublicProfileServiceBoardPost, PublicProfileServiceBoard } from "@/components/profile/PublicProfileServiceBoard";
import { LandingSiteHeader, guestSiteHeaderChromeProps } from "@/components/LandingSiteHeader";
import { WhatIsTebnuDialog } from "@/components/WhatIsTebnuDialog";
import {
  getServiceCategoryImage,
  isServiceCategoryId,
  serviceCategoryLabel,
} from "@/lib/serviceCategories";
import {
  HIRE_CATEGORY_TILE_UI,
  resolveHelpCategoryIconId,
} from "@/lib/discoverCategoryTileIcons";
import { requestHeroWaveToneClass } from "@/components/discover/DiscoverRequestHeroWaves";
import { apiPost } from "@/lib/api";
import { ProfilePostsFeed } from "@/components/profile/ProfilePostsFeed";
import {
  ProfileReviewPreviewCard,
  ProfileReviewsSheet,
} from "@/components/profile/ProfileReviewsSheet";
import { scrollToProfilePostWhenReady } from "@/lib/profilePostShare";
import {
  globalFeedMobilePageClass,
  type ViewerLocation,
} from "@/lib/globalFeedPostUi";
import {
  readPublicProfileCache,
  writePublicProfileCache,
} from "@/lib/publicProfileCache";
import {
  playFavoriteAddedToLikedTabFlight,
  playFavoriteRemovedFromLikedTabFlight,
} from "@/lib/favoriteToLikedTabFlight";
import { ProfileKnockMenu } from "@/components/ProfileKnockMenu";
import { OwnProfileRecentPostersCarousel } from "@/components/profile/OwnProfileRecentPostersCarousel";
import {
  AnimatedProfileRing,
  AvailabilityCard,
  HourlyRateCard,
  MemberSinceBadge,
  type PublicAvailability,
  type PublicRate,
} from "@/components/profile/PublicProfileAppFeatures";
import { FREELANCER_LANGUAGES } from "@/hooks/useFreelancerProfileForm";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  bidirectionalInputProps,
  bidirectionalTextProps,
  textDirection,
} from "@/lib/textDirection";

type PostedHelpEngagement =
  | "idle"
  | "loading"
  | "can_respond"
  | "accepted"
  | "declined"
  | "not_invited"
  | "hidden";



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

function jobServiceLabel(serviceType: string | undefined): string {
  if (!serviceType) return "Job";
  return isServiceCategoryId(serviceType)
    ? serviceCategoryLabel(serviceType)
    : serviceType.replace(/_/g, " ");
}

function formatProfileLocationLabel(
  t: TFunction,
  city: string | null | undefined,
): string | null {
  const localized = feedLocationDisplayLabel(t, city);
  if (!localized) return null;

  const parts = localized
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const cityPart = parts[0];
  if (!cityPart) return null;

  const countryPart =
    parts.length > 1 ? parts[parts.length - 1] : t("feed.location.countryIsrael");

  return `${cityPart.toUpperCase()}, ${countryPart.toUpperCase()}`;
}

type ProfilePostedHelpRequest = {
  id: string;
  service_type: string;
  status: string;
  created_at: string;
  location_city: string;
  notes?: string | null;
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
  languages?: string[];
  created_at: string | null;
  is_admin?: boolean | null;
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

function publicProfileCategoryBadgeIcon(
  categoryId: string,
  iconClassName?: string,
) {
  const id = categoryId.toLowerCase();
  if (!isServiceCategoryId(id)) {
    return (
      <HelpCircle
        className={cn(
          "h-[1.125rem] w-[1.125rem] shrink-0",
          iconClassName ?? "text-slate-500 dark:text-slate-400",
        )}
        strokeWidth={2.25}
        aria-hidden
      />
    );
  }
  const { Icon, iconClass } = HIRE_CATEGORY_TILE_UI[id];
  return (
    <Icon
      className={cn(
        "h-[1.125rem] w-[1.125rem] shrink-0",
        iconClassName ?? iconClass,
      )}
      strokeWidth={2.25}
      aria-hidden
    />
  );
}

const profileCategoryBadgeClass =
  "inline-flex shrink-0 items-center gap-2 rounded-full border-transparent px-4 py-2 text-[12px] font-black uppercase tracking-wide shadow-none";

const profileCategoryScrollRowClass =
  "flex gap-2.5 overflow-x-auto scroll-smooth pb-0.5 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

const profileSidebarPanelClass =
  "rounded-[2rem] border border-zinc-100/70 bg-[#fafafa] p-6 dark:border-border/40 dark:bg-card/80 dark:shadow-xl dark:shadow-black/5";

const profileGalleryThumbTransform = {
  width: 480,
  height: 480,
  quality: 80,
  resize: "cover" as const,
};

function ProfilePhotosGrid({
  imageRows,
  isOwnProfile,
  uploadingMedia,
  compact = false,
  onAdd,
  onOpen,
  onDelete,
}: {
  imageRows: PublicProfileMediaRow[];
  isOwnProfile: boolean;
  uploadingMedia: boolean;
  compact?: boolean;
  onAdd: () => void;
  onOpen: (index: number) => void;
  onDelete: (row: PublicProfileMediaRow) => void;
}) {
  if (!isOwnProfile && imageRows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <ImageIcon className="mb-3 h-12 w-12 text-slate-300 opacity-40 dark:text-slate-600" aria-hidden />
        <p className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
          No photos
        </p>
      </div>
    );
  }

  return (
    <div dir="ltr" className={cn("grid grid-cols-3", compact ? "gap-1 px-4" : "gap-3")}>
      {isOwnProfile ? (
        <button
          type="button"
          disabled={uploadingMedia}
          onClick={onAdd}
          aria-label="Add photo"
          className="flex aspect-square w-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-slate-400 transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-slate-500 dark:hover:border-orange-800 dark:hover:bg-orange-950/40 dark:hover:text-orange-400"
        >
          {uploadingMedia ? (
            <Loader2 className={cn("animate-spin", compact ? "h-6 w-6" : "h-8 w-8")} />
          ) : (
            <Plus className={compact ? "h-7 w-7" : "h-9 w-9"} strokeWidth={2} />
          )}
        </button>
      ) : null}
      {imageRows.map((row, idx) => (
        <div
          key={row.id}
          className="group relative aspect-square overflow-hidden rounded-xl bg-muted"
        >
          <button
            type="button"
            onClick={() => onOpen(idx)}
            className="absolute inset-0"
            aria-label="View photo full screen"
          >
            <img
              src={publicProfileMediaUrl(row.storage_path, profileGalleryThumbTransform)}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </button>
          {isOwnProfile ? (
            <button
              type="button"
              disabled={uploadingMedia}
              onClick={(e) => {
                e.stopPropagation();
                onDelete(row);
              }}
              className={cn(
                "absolute right-1.5 top-1.5 z-10 flex items-center justify-center rounded-full bg-black/55 text-white shadow-md transition hover:bg-black/70 disabled:opacity-60",
                compact
                  ? "h-6 w-6"
                  : "h-8 w-8 opacity-0 group-hover:opacity-100",
              )}
              aria-label="Remove photo"
            >
              {compact ? (
                <Plus className="h-3 w-3 rotate-45" strokeWidth={3} />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function normalizeLanguages(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function ProfileLanguagesSection({
  languages,
  isOwnProfile,
  editing,
  draft,
  saving,
  onEdit,
  onCancel,
  onToggle,
  onSave,
}: {
  languages: string[];
  isOwnProfile: boolean;
  editing: boolean;
  draft: string[];
  saving: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onToggle: (lang: string) => void;
  onSave: () => void;
}) {
  if (!isOwnProfile && languages.length === 0) return null;

  return (
    <div className="mt-8">
      <div className="mb-3 flex items-center gap-2">
        <Globe className="h-4 w-4 shrink-0 text-orange-500" strokeWidth={2.25} aria-hidden />
        <h3 className="text-[10px] font-black uppercase tracking-[.25em] text-slate-400">
          Languages
        </h3>
      </div>
      {editing && isOwnProfile ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {Array.from(new Set([...FREELANCER_LANGUAGES, ...draft])).map((lang) => {
              const selected = draft.includes(lang);
              return (
                <button
                  key={lang}
                  type="button"
                  onClick={() => onToggle(lang)}
                  disabled={saving}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-[12px] font-bold transition-colors",
                    selected
                      ? "bg-orange-600 text-white"
                      : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700",
                  )}
                >
                  {lang}
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-full"
              onClick={onCancel}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="rounded-full"
              onClick={onSave}
              disabled={saving}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save languages"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {languages.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {languages.map((lang) => (
                <span
                  key={lang}
                  className="rounded-full bg-zinc-100 px-3.5 py-1.5 text-[12px] font-bold text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100"
                >
                  {lang}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm font-medium italic text-slate-400 dark:text-slate-500">
              No languages added yet.
            </p>
          )}
          {isOwnProfile ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={onEdit}
            >
              {languages.length > 0 ? "Edit languages" : "Add languages"}
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}

function OwnProfileBioActions({
  onEditBio,
  profileEditPath,
  editBioLabel,
  showAddBioIcon = false,
  className,
}: {
  onEditBio: () => void;
  profileEditPath: string;
  editBioLabel: string;
  showAddBioIcon?: boolean;
  className?: string;
}) {
  const navigate = useNavigate();

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-full"
        onClick={onEditBio}
      >
        {showAddBioIcon ? (
          <>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden />
            {editBioLabel}
          </>
        ) : (
          editBioLabel
        )}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-full"
        onClick={() => navigate(profileEditPath)}
      >
        Edit profile
      </Button>
    </div>
  );
}

function ProfileBioHeader({
  profile,
  isOwnProfile,
  editingBio,
  setEditingBio,
  bioDraft,
  setBioDraft,
  savingBio,
  onSave,
  variant,
  profileEditPath,
}: {
  profile: PublicProfile;
  isOwnProfile: boolean;
  editingBio: boolean;
  setEditingBio: (open: boolean) => void;
  bioDraft: string;
  setBioDraft: (value: string) => void;
  savingBio: boolean;
  onSave: (nextBio: string) => void;
  variant: "desktop" | "mobile" | "panel";
  profileEditPath?: string | null;
}) {
  const isDesktop = variant === "desktop";
  const isPanel = variant === "panel";
  const hasBio = Boolean(profile.bio?.trim());
  const draftDirection = textDirection(bioDraft);

  if (editingBio && isOwnProfile) {
    const draftInput = bidirectionalInputProps(
      bioDraft,
      cn(
        "w-full resize-none rounded-2xl border border-slate-200 bg-white/80 p-3 text-sm dark:border-white/10 dark:bg-white/5",
        isPanel || !isDesktop ? "min-h-[110px]" : "min-h-[88px]",
      ),
    );

    return (
      <div
        className={cn(
          "w-full",
          isPanel ? "space-y-3" : isDesktop ? "mt-2.5 max-w-2xl" : "mt-3 w-full",
        )}
        dir={draftDirection}
      >
        <Textarea
          value={bioDraft}
          onChange={(e) => setBioDraft(e.target.value)}
          placeholder="Write a short bio…"
          maxLength={700}
          rows={isPanel ? 4 : isDesktop ? 3 : 4}
          dir={draftInput.dir}
          className={draftInput.className}
          disabled={savingBio}
        />
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
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
            size="sm"
            className="rounded-full"
            onClick={() => onSave(bioDraft)}
            disabled={savingBio}
          >
            {savingBio ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Save bio"
            )}
          </Button>
        </div>
      </div>
    );
  }

  if (hasBio) {
    const bioTextProps = bidirectionalTextProps(
      profile.bio,
      cn(
        "w-full min-w-0 whitespace-pre-wrap font-medium leading-relaxed text-slate-600 dark:text-slate-300",
        isPanel
          ? "text-lg font-bold leading-[1.6] text-slate-800 dark:text-slate-100"
          : isDesktop
            ? "text-[15px]"
            : "text-sm",
      ),
    );

    if (isPanel) {
      return (
        <div className="w-full space-y-3" dir={bioTextProps.dir}>
          <p {...bioTextProps}>{profile.bio}</p>
          {isOwnProfile && profileEditPath ? (
            <OwnProfileBioActions
              onEditBio={() => setEditingBio(true)}
              profileEditPath={profileEditPath}
              editBioLabel="Edit bio"
              className="mt-1"
            />
          ) : null}
        </div>
      );
    }

    return (
      <div
        className={cn(
          "w-full",
          isDesktop ? "mt-2.5 max-w-2xl" : "mt-3 w-full",
          bioTextProps.className,
        )}
        dir={bioTextProps.dir}
      >
        <p {...bioTextProps}>{profile.bio}</p>
        {isOwnProfile && profileEditPath ? (
          <OwnProfileBioActions
            onEditBio={() => setEditingBio(true)}
            profileEditPath={profileEditPath}
            editBioLabel="Edit bio"
            className="mt-1.5"
          />
        ) : null}
      </div>
    );
  }

  if (!isOwnProfile) {
    if (!isPanel) return null;
    return (
      <p className="text-sm font-medium italic text-slate-400 dark:text-slate-500">
        No bio shared yet.
      </p>
    );
  }

  if (isPanel && !hasBio) {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <UserCircle
          className="h-12 w-12 text-slate-300 dark:text-slate-600"
          aria-hidden
        />
        <p className="text-sm font-medium text-slate-400 dark:text-slate-500">
          No bio added yet.
        </p>
        {profileEditPath ? (
          <OwnProfileBioActions
            onEditBio={() => setEditingBio(true)}
            profileEditPath={profileEditPath}
            editBioLabel="Add bio"
            showAddBioIcon
          />
        ) : (
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={() => setEditingBio(true)}
          >
            <Plus className="mr-1.5 h-4 w-4" aria-hidden />
            Add bio
          </Button>
        )}
      </div>
    );
  }

  return (
    profileEditPath ? (
      <OwnProfileBioActions
        onEditBio={() => setEditingBio(true)}
        profileEditPath={profileEditPath}
        editBioLabel="Add bio"
        showAddBioIcon
        className={cn(isDesktop ? "mt-2.5" : "mt-3")}
      />
    ) : (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn(
          "rounded-full border-orange-200 bg-orange-50/80 text-orange-700 hover:bg-orange-100 dark:border-orange-800/60 dark:bg-orange-950/30 dark:text-orange-300 dark:hover:bg-orange-950/50",
          isDesktop ? "mt-2.5" : "mt-3 w-full",
        )}
        onClick={() => setEditingBio(true)}
      >
        <Plus className="mr-1.5 h-4 w-4" aria-hidden />
        Add bio
      </Button>
    )
  );
}

export default function PublicProfilePage() {
  const { t } = useTranslation();
  const { userId } = useParams();
  const { user: currentUser, profile: currentProfile } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [freelancerMeta, setFreelancerMeta] = useState<FreelancerMeta | null>(
    null,
  );
  const [editingBio, setEditingBio] = useState(false);
  const [bioDraft, setBioDraft] = useState("");
  const [savingBio, setSavingBio] = useState(false);
  const [editingLanguages, setEditingLanguages] = useState(false);
  const [languagesDraft, setLanguagesDraft] = useState<string[]>([]);
  const [savingLanguages, setSavingLanguages] = useState(false);
  const [sharedJobs, setSharedJobs] = useState<SharedJob[]>([]);
  const [reviews, setReviews] = useState<UserReview[]>([]);
  const [mediaItems, setMediaItems] = useState<PublicProfileMediaRow[]>([]);
  const [serviceBoardPosts, setServiceBoardPosts] = useState<
    PublicProfileServiceBoardPost[]
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
  const [publicAvailability, setPublicAvailability] =
    useState<PublicAvailability | null>(null);
  const [publicRate, setPublicRate] = useState<PublicRate | null>(null);
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
  const [postsTabScrollToId, setPostsTabScrollToId] = useState<string | null>(
    null,
  );
  const [reviewsSheetOpen, setReviewsSheetOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
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

  async function saveLanguages(nextLanguages: string[]) {
    if (!userId || !isOwnProfile) return;
    setSavingLanguages(true);
    try {
      const languages = nextLanguages.filter((lang) => lang.trim().length > 0);
      const { error } = await supabase
        .from("profiles")
        .update({ languages })
        .eq("id", userId);
      if (error) throw error;

      if ((profile?.role || "") === "freelancer") {
        await supabase
          .from("freelancer_profiles")
          .update({ languages })
          .eq("user_id", userId);
      }

      setProfile((p) => (p ? { ...p, languages } : p));
      setLanguagesDraft(languages);
      setEditingLanguages(false);
      addToast({ title: "Languages updated", variant: "success" });
    } catch {
      addToast({ title: "Could not update languages", variant: "error" });
    } finally {
      setSavingLanguages(false);
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

    const [idA, idB] = [currentUser.id, userId].sort();
    const clientId = idA;
    const freelancerId = idB;

    setOpeningChat(true);
    try {
      const { data: existing, error: findErr } = await supabase
        .from("conversations")
        .select("id")
        .is("job_id", null)
        .or(`and(client_id.eq.${clientId},freelancer_id.eq.${freelancerId}),and(client_id.eq.${freelancerId},freelancer_id.eq.${clientId})`)
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
    if (!userId) return;
    const name = profile?.full_name?.trim();
    const city = profile?.city?.trim();
    const bio = profile?.bio?.replace(/\s+/g, " ").trim();
    const description =
      bio ||
      (name
        ? `${name} on Tebnu${city ? ` · ${city}` : ""}`
        : undefined);
    applyPageSeo({
      title: name || "Profile",
      description,
      path: `/profile/${userId}`,
    });
  }, [userId, profile]);

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
    if (!userId) {
      setPublicAvailability(null);
      setPublicRate(null);
      return;
    }
    let cancelled = false;
    void Promise.all([
      supabase
        .from("profiles")
        .select("availability")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("freelancer_profiles")
        .select("hourly_rate_min, hourly_rate_max, show_rates")
        .eq("user_id", userId)
        .maybeSingle(),
    ]).then(([availabilityResult, rateResult]) => {
      if (cancelled) return;
      if (!availabilityResult.error) {
        setPublicAvailability(
          (availabilityResult.data?.availability as PublicAvailability | null) ??
            null,
        );
      } else {
        setPublicAvailability(null);
      }
      if (!rateResult.error) {
        setPublicRate((rateResult.data as PublicRate | null) ?? null);
      } else {
        setPublicRate(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const viewerId = currentUser?.id ?? null;
    const cached = viewerId ? readPublicProfileCache(viewerId, userId) : null;

    if (cached) {
      const cachedProfile = cached.profile as PublicProfile;
      setProfile(cachedProfile);
      setBioDraft(cachedProfile.bio ?? "");
      setLanguagesDraft(normalizeLanguages(cachedProfile.languages));
      setFreelancerMeta((cached.freelancerMeta as FreelancerMeta) ?? null);
      setSharedJobs(cached.sharedJobs as SharedJob[]);
      setReviews(cached.reviews as UserReview[]);
      setMediaItems(cached.mediaItems as PublicProfileMediaRow[]);
      setServiceBoardPosts(
        (cached.serviceBoardPosts ??
          (cached as { liveCommunityPosts?: unknown }).liveCommunityPosts ??
          []) as PublicProfileServiceBoardPost[],
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
                "id, full_name, photo_url, role, is_available_for_jobs, is_verified, city, categories, bio, languages, whatsapp_number_e164, telegram_username, average_rating, total_ratings, created_at, is_admin",
              )
              .eq("id", userId)
              .single(),
            supabase
              .from("freelancer_profiles")
              .select("bio, languages, live_until, live_can_start_in, available_now")
              .eq("user_id", userId)
              .maybeSingle(),
          ]);

        if (profileError) throw profileError;
        if (profileData.is_admin === true && viewerId !== profileData.id) {
          if (cancelled) return;
          setProfile(null);
          setLoading(false);
          return;
        }

        const bio =
          (profileData as { bio?: string | null } | null)?.bio ??
          freelancerData?.bio ??
          null;
        const rawProfileLanguages = (profileData as { languages?: unknown } | null)
          ?.languages;
        const freelancerLanguages = normalizeLanguages(
          (freelancerData as { languages?: unknown } | null)?.languages,
        );
        const languages = Array.isArray(rawProfileLanguages)
          ? normalizeLanguages(rawProfileLanguages)
          : freelancerLanguages;
        const nextProfile: PublicProfile = {
          ...profileData,
          bio,
          languages,
          whatsapp_number: profileData.whatsapp_number_e164,
        };
        if (cancelled) return;
        setProfile(nextProfile);
        setBioDraft(bio ?? "");
        setLanguagesDraft(languages);
        setFreelancerMeta({
          live_until: freelancerData?.live_until ?? null,
          live_can_start_in: freelancerData?.live_can_start_in ?? null,
          available_now: freelancerData?.available_now ?? null,
        });
        // Render the profile and start its high-priority photo request immediately.
        // Reviews, posts, jobs, and other secondary data continue loading below.
        setLoading(false);

        const runHelperRpcs = canActAsHelperOnPublicProfile(nextProfile);

        // Guests: public profile data only (no viewer-specific jobs/notifications).
        if (!viewerId) {
          const guestBatch: PromiseLike<unknown>[] = [
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
              .from("profile_posts")
              .select(
                "id, caption, media_type, storage_path, created_at, post_type_id, post_metadata, ai_generated_copy, post_types (id, name, emoji, color)",
              )
              .eq("author_id", userId)
              .order("created_at", { ascending: false })
              .limit(12),
          ];
          if (runHelperRpcs) {
            guestBatch.push(
              supabase.rpc("get_helpers_live_help_week_counts", {
                p_helper_ids: [userId],
              }),
            );
          }
          const guestResults = await Promise.all(guestBatch);
          type PgResult = { data: unknown; error: unknown };
          const [reviewsData, mediaData, serviceBoardData] = guestResults.slice(
            0,
            3,
          ) as [PgResult, PgResult, PgResult];
          const weekRpc: PgResult = runHelperRpcs
            ? (guestResults[3] as PgResult)
            : { data: null, error: null };

          let nextLiveHelpWeek: number | null = null;
          if (runHelperRpcs) {
            try {
              const weekRows = weekRpc.data as unknown[] | null;
              const weekErr = weekRpc.error;
              if (!weekErr && Array.isArray(weekRows)) {
                for (const wr of weekRows as {
                  helper_id?: string | null;
                  live_help_week_count?: number | string | null;
                }[]) {
                  if (
                    !wr.helper_id ||
                    String(wr.helper_id) !== String(userId) ||
                    wr.live_help_week_count == null
                  ) {
                    continue;
                  }
                  const n = Number(wr.live_help_week_count);
                  if (Number.isFinite(n) && n > 0) {
                    nextLiveHelpWeek = Math.floor(n);
                    break;
                  }
                }
              }
            } catch {
              /* optional */
            }
          }

          if (reviewsData.error) throw reviewsData.error;
          if (mediaData.error) throw mediaData.error;
          if (serviceBoardData.error) throw serviceBoardData.error;

          if (!cancelled) {
            setLiveHelpWeekCount(nextLiveHelpWeek);
            setSharedJobs([]);
            setReviews((reviewsData.data || []) as unknown as UserReview[]);
            setMediaItems((mediaData.data || []) as PublicProfileMediaRow[]);
            setServiceBoardPosts(
              (serviceBoardData.data || []) as PublicProfileServiceBoardPost[],
            );
            setPostedHelpRequests([]);
            setLoading(false);
          }
          return;
        }

        // Signed-in viewer: jobs + notifications between viewer (A) and profile (B).
        const profileId = userId;

        const jrSelect =
          "id, service_type, status, created_at, client_id, selected_freelancer_id" as const;
        const notifSelect = `
              job_id, status, created_at, freelancer_id,
              job_requests (
                ${jrSelect}
              )
            `;

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
            .from("profile_posts")
            .select(
              "id, caption, media_type, storage_path, created_at, post_type_id, post_metadata, ai_generated_copy, post_types (id, name, emoji, color)",
            )
            .eq("author_id", userId)
            .order("created_at", { ascending: false })
            .limit(12),
          supabase
            .from("job_requests")
            .select("id, service_type, status, created_at, location_city, notes")
            .eq("client_id", userId)
            .in("status", ["ready", "notifying", "confirmations_closed"])
            .order("created_at", { ascending: false })
            .limit(30),
        ];
        if (runHelperRpcs) {
          batchPromises.push(
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
          serviceBoardData,
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

        const weekRpc: PgResult = runHelperRpcs
          ? (batchResults[8] as PgResult)
          : { data: null, error: null };

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
        if (serviceBoardData.error) throw serviceBoardData.error;
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
          setServiceBoardPosts(
            (serviceBoardData.data || []) as PublicProfileServiceBoardPost[],
          );
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
            sharedJobs: shared,
            reviews: reviewsData.data,
            mediaItems: mediaData.data,
            serviceBoardPosts: serviceBoardData.data,
            postedHelpRequests: postedHelpData.data,
          });
        }
      } catch (e: unknown) {
        console.error(e);
        if (!cancelled) {
          setProfile(null);
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

  async function sharePublicProfile() {
    if (!userId || !profile) return;
    const url = `https://www.tebnu.com/profile/${encodeURIComponent(userId)}`;
    const title = `${profile.full_name || "Tebnu member"} on Tebnu`;
    const categories = (profile.categories ?? [])
      .map((category) => category.replace(/_/g, " "))
      .join(" · ");
    const text = [profile.bio?.trim(), categories].filter(Boolean).join("\n\n");
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title, text: text || title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      addToast({ title: "Profile link copied", variant: "success" });
    } catch (error) {
      if ((error as { name?: string })?.name === "AbortError") return;
      addToast({ title: "Could not share profile", variant: "error" });
    }
  }

  const ownProfileEditPath = useMemo(() => {
    if (currentProfile?.role === "freelancer") return "/freelancer/profile";
    if (currentProfile?.role === "client") return "/client/profile";
    return "/dashboard";
  }, [currentProfile?.role]);

  const viewerLocation = useMemo<ViewerLocation | null>(() => {
    if (!currentProfile) return null;
    return {
      city: currentProfile.city ?? null,
      lat: currentProfile.location_lat ?? null,
      lng: currentProfile.location_lng ?? null,
    };
  }, [currentProfile]);

  const profilePostsFeedProps = useMemo(
    () => ({
      userId: userId!,
      isOwnProfile,
      appearance: "profile" as const,
      plainCards: true,
      globalFeedLayout: true,
      viewerLocation,
      scrollToPostId: postsTabScrollToId,
      onScrollToPostDone: () => setPostsTabScrollToId(null),
    }),
    [userId, isOwnProfile, viewerLocation, postsTabScrollToId],
  );

  const openServiceBoardPost = (postId: string) => {
    setProfileMediaTab("posts");
    setPostsTabScrollToId(postId);
    window.requestAnimationFrame(() => {
      const isDesktop = window.matchMedia("(min-width: 768px)").matches;
      const section = document.getElementById(
        isDesktop ? "profile-social-feed-desktop" : "profile-social-feed-mobile",
      );
      section?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    window.setTimeout(() => {
      scrollToProfilePostWhenReady(postId, {
        topInset: 96,
        maxAttempts: 24,
      });
    }, 120);
  };

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

  const profileLocationLabel = formatProfileLocationLabel(t, profile?.city);

  const showHelperBadges = canActAsHelperOnPublicProfile(profile);
  const isLiveNow = showHelperBadges
    ? isFreelancerLiveWindowActive(freelancerMeta)
    : false;

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

  const helperBadgesRow = showLiveHelpWeekBadge ? (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {liveHelpWeekCount != null ? (
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
    const categoryLabel = jobServiceLabel(job.service_type);
    const title = job.notes?.trim() || categoryLabel;
    const iconId = resolveHelpCategoryIconId(job.service_type, null);
    const CategoryIcon =
      (iconId && isServiceCategoryId(iconId)
        ? HIRE_CATEGORY_TILE_UI[iconId]?.Icon
        : null) ?? HelpCircle;
    const thumbSrc = getServiceCategoryImage(job.service_type);
    const timeAgo = formatDistanceToNow(new Date(job.created_at), {
      addSuffix: true,
    });
    const authorName = (profile?.full_name || "").trim().split(" ")[0] || "";

    return (
      <button
        key={job.id}
        type="button"
        onClick={() =>
          navigate(
            `/freelancer/jobs/match?focus_job_id=${encodeURIComponent(job.id)}`,
          )
        }
        className={cn(
          "flex w-full items-center gap-3.5 text-left sm:gap-3",
          "outline-none transition-opacity active:opacity-80",
          "focus-visible:ring-2 focus-visible:ring-orange-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        )}
      >
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-zinc-200 dark:bg-zinc-800">
          {thumbSrc ? (
            <img
              src={thumbSrc}
              alt=""
              className="h-full w-full object-cover object-center"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div
              className={cn(
                "flex h-full w-full items-center justify-center text-white",
                requestHeroWaveToneClass(iconId ?? job.service_type),
              )}
            >
              <CategoryIcon className="h-10 w-10 text-white" aria-hidden />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 items-center gap-1.5 text-[15px] font-semibold text-orange-700 dark:text-orange-400 sm:text-[13px]">
            <CategoryIcon className="h-4 w-4 shrink-0 sm:h-3.5 sm:w-3.5" aria-hidden />
            <span className="truncate">{categoryLabel}</span>
          </p>
          <p className="mt-0.5 line-clamp-2 text-[18px] font-bold leading-snug text-zinc-900 dark:text-white sm:text-[16px]">
            {title}
          </p>
          <p className="mt-0.5 truncate text-[15px] font-medium text-zinc-400 dark:text-zinc-500 sm:text-[13px]">
            {feedLocationDisplayLabel(t, job.location_city) || "Anywhere"}
          </p>
          <p className="mt-0.5 truncate text-[15px] font-medium text-zinc-400 dark:text-zinc-500 sm:text-[13px]">
            {authorName ? `${authorName} • ${timeAgo}` : timeAgo}
          </p>
        </div>

        <ChevronRight
          className="h-6 w-6 shrink-0 text-zinc-300 rtl-flip-icon dark:text-zinc-600 sm:h-5 sm:w-5"
          strokeWidth={2}
          aria-hidden
        />
      </button>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-orange-600" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
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
    <div
      className={cn(
        "min-h-screen bg-background pb-24 md:pb-8",
        globalFeedMobilePageClass,
      )}
      data-public-profile-page=""
      data-public-profile-guest={!currentUser ? "" : undefined}
    >
      {!currentUser ? (
        <>
          <LandingSiteHeader
            {...guestSiteHeaderChromeProps}
            overlayOnHero
            onBrandClick={() => setAboutOpen(true)}
          />
          <WhatIsTebnuDialog open={aboutOpen} onOpenChange={setAboutOpen} />
        </>
      ) : null}
      {/* 
        Sticky Header (Mobile & Desktop)
        Used for back button and profile name breadcrumb. 
      */}
      {/* 
        The top sticky header is now handled globally by BottomNav
        to ensure consistent scroll-away behavior.
      */}

      {/* Desktop Hero section — hidden on mobile */}
      <div
        className={cn(
          "hidden md:block bg-white dark:bg-background/50 pb-4 md:pb-8 border-b border-slate-200/50 dark:border-white/5",
          currentUser ? "pt-20 md:pt-24" : "pt-6 md:pt-8",
        )}
      >
        <div className="app-desktop-shell px-4">
          <div className="flex flex-col md:flex-row gap-6 md:items-start">
            {/* Avatar block — hidden on mobile hero layout to move it below header */}
            <div className="hidden h-[119px] w-[119px] shrink-0 md:block">
              <button
                type="button"
                className="relative block h-full w-full rounded-full transition hover:scale-[1.02] active:scale-[0.98]"
                onClick={() => profile?.photo_url && setProfileMediaLightbox({ urls: [profile.photo_url!], initialIndex: 0 })}
                aria-label="View profile photo full screen"
              >
                <AnimatedProfileRing
                  photoUrl={profile.photo_url}
                  name={profile.full_name ?? "Profile"}
                  helper={showHelperBadges}
                />
                {profileLiveNowDot}
              </button>
            </div>

            <div className="flex-1 min-w-0 pb-2">
              <div className="flex items-start justify-between gap-6 flex-wrap">
                <div className="min-w-0">
                  <MemberSinceBadge
                    createdAt={profile.created_at}
                    helper={showHelperBadges}
                  />
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
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-4">
                    <StarRating rating={profile.average_rating || 0} totalRatings={profile.total_ratings || 0} size="md" className="justify-start" />
                  </div>
                  {profileLocationLabel ? (
                    <p className="mt-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {profileLocationLabel}
                    </p>
                  ) : null}
                  <ProfileBioHeader
                    profile={profile}
                    isOwnProfile={isOwnProfile}
                    editingBio={editingBio}
                    setEditingBio={setEditingBio}
                    bioDraft={bioDraft}
                    setBioDraft={setBioDraft}
                    savingBio={savingBio}
                    onSave={(next) => void saveBio(next)}
                    variant="desktop"
                    profileEditPath={isOwnProfile ? ownProfileEditPath : null}
                  />
                  <div className="mt-3 max-w-2xl">
                    <AvailabilityCard value={publicAvailability} />
                  </div>
                  {helperBadgesRow}
                  {profile.categories && profile.categories.length > 0 && (
                    <div className={cn("mt-2.5", profileCategoryScrollRowClass)}>
                      {profile.categories.map((cat, i) => (
                        <Badge
                          key={i}
                          variant="secondary"
                          className={cn(
                            profileCategoryBadgeClass,
                            "bg-white/80 text-slate-700 dark:bg-zinc-800/80 dark:text-slate-200",
                          )}
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
                  {!isOwnProfile && (
                    <>
                      <button
                        type="button"
                        onClick={() => void handleOpenDirectChat()}
                        disabled={openingChat}
                        className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-slate-950 px-6 text-sm font-black uppercase tracking-widest text-white shadow-xl shadow-black/10 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 dark:bg-white dark:text-black"
                        title="Messages"
                        aria-label="Open messages"
                      >
                        {openingChat ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <MessageSquare className="h-6 w-6 shrink-0" fill="currentColor" strokeWidth={1.75} />
                        )}
                        Message
                      </button>
                      {profile.whatsapp_number ? (
                        <button
                          type="button"
                          onClick={() =>
                            window.open(
                              `https://wa.me/${profile.whatsapp_number}`,
                              "_blank",
                            )
                          }
                          disabled={!currentUser}
                          className={cn(
                            "flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-green-500/20 transition-all hover:scale-105 active:scale-95",
                            !currentUser && "opacity-50 grayscale cursor-not-allowed hover:scale-100 active:scale-100",
                          )}
                          title="WhatsApp"
                          aria-label="WhatsApp"
                        >
                          <WhatsAppIcon size={22} className="text-white" />
                        </button>
                      ) : null}
                      {profile.telegram_username ? (
                        <button
                          type="button"
                          onClick={() =>
                            window.open(
                              `https://t.me/${profile.telegram_username}`,
                              "_blank",
                            )
                          }
                          disabled={!currentUser}
                          className={cn(
                            "flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#0088cc] text-white shadow-lg shadow-blue-500/20 transition-all hover:scale-105 active:scale-95",
                            !currentUser && "opacity-50 grayscale cursor-not-allowed hover:scale-100 active:scale-100",
                          )}
                          title="Telegram"
                          aria-label="Telegram"
                        >
                          <TelegramIcon size={22} className="text-white" />
                        </button>
                      ) : null}
                    </>
                  )}
                  {!isOwnProfile && currentUser && (
                    <button
                      type="button"
                      onClick={() => void toggleProfileFavorite()}
                      disabled={favoriteBusy}
                      title={profileFavorited ? "Remove from saved" : "Save profile"}
                      aria-label={profileFavorited ? "Remove from saved profiles" : "Save profile to Saved"}
                      aria-pressed={profileFavorited}
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-rose-200/90 bg-white/95 text-rose-500 shadow-md transition-all hover:scale-105 active:scale-95 disabled:opacity-60 dark:border-rose-800/50 dark:bg-zinc-900/95 dark:text-rose-400"
                    >
                      {favoriteBusy
                        ? <Loader2 className="h-5 w-5 animate-spin text-rose-500" aria-hidden />
                        : <Heart className={cn("h-5 w-5", profileFavorited && "fill-rose-500")} strokeWidth={profileFavorited ? 0 : 2.25} aria-hidden />}
                    </button>
                  )}
                  {!isOwnProfile && currentUser && profile.categories && profile.categories.length > 0 && (
                    <ProfileKnockMenu variant="contact" targetUserId={userId!} targetRole={profile.role} categories={profile.categories} viewerId={currentUser.id} viewerRole={currentProfile?.role ?? null} viewerName={currentProfile?.full_name ?? null} />
                  )}
                  <details className="group relative">
                    <summary
                      className="flex h-12 w-12 cursor-pointer list-none items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-md transition-all hover:scale-105 active:scale-95 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 [&::-webkit-details-marker]:hidden"
                      aria-label="Profile actions"
                    >
                      <MoreHorizontal className="h-6 w-6" aria-hidden />
                    </summary>
                    <div className="absolute right-0 top-[calc(100%+0.4rem)] z-[80] min-w-48 overflow-hidden rounded-2xl border border-border/80 bg-card p-1.5 shadow-xl">
                      <button
                        type="button"
                        onClick={(event) => {
                          void sharePublicProfile();
                          event.currentTarget.closest("details")?.removeAttribute("open");
                        }}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-foreground transition-colors hover:bg-muted"
                      >
                        <Share2 className="h-5 w-5 text-primary" aria-hidden />
                        Share profile
                      </button>
                    </div>
                  </details>
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

          {isOwnProfile && currentUser ? (
            <OwnProfileRecentPostersCarousel
              viewerUserId={currentUser.id}
              className="mt-1 border-x-0 border-t-0 px-0"
            />
          ) : null}
        </div>
      </div>

      {/* Shared hidden file inputs */}
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleProfileMediaUpload(f, "image"); e.target.value = ""; }} />
      <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleProfileMediaUpload(f, "video"); e.target.value = ""; }} />

      {/* ══════════════════════════════════════════════════════════
          MOBILE CONTENT FLOW
      ══════════════════════════════════════════════════════════ */}
      <div className="md:hidden">
        {/* Profile hero + tab bar — solid white in light mode until the posts feed */}
        <div className="bg-white dark:bg-background">
        <div className="relative w-full overflow-hidden bg-muted h-[min(23.5rem,52vh)]">
          <button
            type="button"
            onClick={() =>
              profile?.photo_url && setProfileMediaLightbox({
                urls: [profile.photo_url!],
                initialIndex: 0,
              })
            }
            className="absolute inset-0 block bg-muted transition active:scale-[0.995]"
            aria-label="View profile photo full screen"
          >
            <div className="absolute inset-0 flex items-center justify-center text-5xl font-black text-slate-300 dark:text-white/20">
              {photoInitials}
            </div>
            {profile?.photo_url && (
              <img
                src={mediaUrl.hero(profile.photo_url)}
                alt={profile.full_name ?? "Profile"}
                className="absolute inset-0 h-full w-full object-cover"
                decoding="async"
                {...{ fetchpriority: "high" }}
              />
            )}
          </button>
          <div
            className="pointer-events-none absolute inset-x-0 top-0 z-10 h-20 bg-gradient-to-b from-black/20 to-transparent"
            aria-hidden
          />
          {isLiveNow ? (
            <span
              className="pointer-events-none absolute right-3 top-[calc(var(--app-safe-top,env(safe-area-inset-top,0px))+4.75rem)] z-20 flex h-9 w-9 items-center justify-center"
              role="status"
              aria-label="Live now"
            >
              <span className="absolute inset-[5px] animate-ping rounded-full bg-emerald-400/45 motion-reduce:animate-none" />
              <span className="relative block h-[18px] w-[18px] rounded-full bg-emerald-500 shadow-[0_0_18px_rgba(16,185,129,0.95)]" />
            </span>
          ) : null}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/45 via-black/20 to-transparent px-5 pb-4 pt-12">
            <div className="pointer-events-auto min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <h1 className="min-w-0 truncate text-[1.75rem] font-black leading-none tracking-tight text-white drop-shadow-[0_1px_8px_rgba(0,0,0,0.45)]">
                  {profile.full_name}
                </h1>
                {profile.is_verified ? (
                  <BadgeCheck
                    className="h-6 w-6 shrink-0 fill-emerald-500 text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.35)]"
                    strokeWidth={2.35}
                    aria-label="Certified verified helper"
                  />
                ) : null}
              </div>
              <div className="mt-2 flex min-w-0 items-center gap-2.5">
                {profileLocationLabel ? (
                  <p className="min-w-0 truncate text-[11px] font-black uppercase tracking-widest text-white/85">
                    {profileLocationLabel}
                  </p>
                ) : null}
                {reviews.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setReviewsSheetOpen(true)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg outline-none transition-opacity hover:opacity-80 active:opacity-70 focus-visible:ring-2 focus-visible:ring-white/60"
                    aria-label={`View all ${profile.total_ratings || reviews.length} reviews`}
                  >
                    <Star className="h-3.5 w-3.5 shrink-0 text-white" fill="currentColor" strokeWidth={0} aria-hidden />
                    <span className="text-[13px] font-black tabular-nums text-white">
                      {(profile.average_rating || 0) > 0
                        ? (profile.average_rating || 0).toFixed(1)
                        : "New"}
                    </span>
                    <span className="text-[13px] font-bold tabular-nums text-white/80">
                      ({profile.total_ratings || reviews.length})
                    </span>
                  </button>
                ) : (
                  <span className="inline-flex shrink-0 items-center gap-1">
                    <Star className="h-3.5 w-3.5 shrink-0 text-white" fill="currentColor" strokeWidth={0} aria-hidden />
                    <span className="text-[13px] font-black tabular-nums text-white">
                      {(profile.average_rating || 0) > 0
                        ? (profile.average_rating || 0).toFixed(1)
                        : "New"}
                    </span>
                    <span className="text-[13px] font-bold tabular-nums text-white/80">
                      ({profile.total_ratings || 0})
                    </span>
                  </span>
                )}
              </div>
              {profile.categories && profile.categories.length > 0 ? (
                <div
                  className={cn(
                    "-mx-5 mt-2.5 px-5",
                    profileCategoryScrollRowClass,
                  )}
                >
                  {profile.categories.map((cat, i) => (
                    <span
                      key={i}
                      className={cn(
                        profileCategoryBadgeClass,
                        "pointer-events-none select-none border-0 bg-black/45 px-3 py-1.5 text-[11px] text-white shadow-none ring-0",
                        "[-webkit-tap-highlight-color:transparent] backdrop-blur-xl backdrop-saturate-150",
                      )}
                    >
                      {publicProfileCategoryBadgeIcon(cat)}
                      {cat.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="px-5 pb-4 pt-4">
          <div className="-mt-16 mb-4 flex items-end gap-4">
            <AnimatedProfileRing
              photoUrl={profile.photo_url}
              name={profile.full_name ?? "Profile"}
              helper={showHelperBadges}
              className="z-20"
            />
            <div className="pb-1">
              <MemberSinceBadge
                createdAt={profile.created_at}
                helper={showHelperBadges}
              />
            </div>
          </div>
          {helperBadgesRow}

          <ProfileBioHeader
            profile={profile}
            isOwnProfile={isOwnProfile}
            editingBio={editingBio}
            setEditingBio={setEditingBio}
            bioDraft={bioDraft}
            setBioDraft={setBioDraft}
            savingBio={savingBio}
            onSave={(next) => void saveBio(next)}
            variant="mobile"
            profileEditPath={isOwnProfile ? ownProfileEditPath : null}
          />
          <div className="mt-4">
            <AvailabilityCard value={publicAvailability} />
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
                {openingChat ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-6 w-6 shrink-0" fill="currentColor" strokeWidth={1.75} />}
                Message
              </button>
              {profile.whatsapp_number ? (
                <button
                  type="button"
                  onClick={() =>
                    window.open(`https://wa.me/${profile.whatsapp_number}`, "_blank")
                  }
                  disabled={!currentUser}
                  className={cn(
                    "h-12 w-12 flex shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg active:scale-90 transition-all",
                    !currentUser && "opacity-50 grayscale cursor-not-allowed active:scale-100",
                  )}
                  title="WhatsApp"
                  aria-label="WhatsApp"
                >
                  <WhatsAppIcon size={22} className="text-white" />
                </button>
              ) : null}
              {profile.telegram_username ? (
                <button
                  type="button"
                  onClick={() =>
                    window.open(`https://t.me/${profile.telegram_username}`, "_blank")
                  }
                  disabled={!currentUser}
                  className={cn(
                    "h-12 w-12 flex shrink-0 items-center justify-center rounded-full bg-[#0088cc] text-white shadow-lg active:scale-90 transition-all",
                    !currentUser && "opacity-50 grayscale cursor-not-allowed active:scale-100",
                  )}
                  title="Telegram"
                  aria-label="Telegram"
                >
                  <TelegramIcon size={22} className="text-white" />
                </button>
              ) : null}
              {currentUser ? (
                <button
                  ref={profileFavoriteButtonRef}
                  type="button"
                  onClick={() => void toggleProfileFavorite()}
                  disabled={favoriteBusy}
                  className="h-12 w-12 flex shrink-0 items-center justify-center rounded-full bg-white dark:bg-zinc-900 border border-slate-100 dark:border-white/10 text-rose-500 shadow-md active:scale-90 transition-all"
                  aria-label={profileFavorited ? "Remove from saved profiles" : "Save profile to Saved"}
                  aria-pressed={profileFavorited}
                >
                  {favoriteBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Heart className={cn("h-5 w-5", profileFavorited && "fill-rose-500")} />}
                </button>
              ) : null}
            </div>
          )}
        </div>
        </div>

        <Tabs value={profileMediaTab} onValueChange={(v) => setProfileMediaTab(v as ProfileMediaSectionTab)} className="w-full">
          <div className="relative z-10 bg-transparent py-1">
            <div className="relative mx-auto grid h-11 w-full max-w-sm grid-cols-4 items-center p-1">
              <div
                className={cn(
                  "absolute top-1 bottom-1 left-1 w-[calc((100%-0.5rem)/4)] rounded-full bg-orange-600 shadow-none transition-transform duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]",
                  profileMediaTab === "posts" && "translate-x-0",
                  profileMediaTab === "images" && "translate-x-full",
                  profileMediaTab === "videos" && "translate-x-[200%]",
                  profileMediaTab === "about" && "translate-x-[300%]",
                )}
              />
              {[
                { id: "posts", Icon: LayoutGrid },
                { id: "images", Icon: ImageIcon },
                { id: "videos", Icon: Video },
                { id: "about", Icon: UserCircle },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setProfileMediaTab(t.id as ProfileMediaSectionTab)}
                  className={cn(
                    "relative z-10 flex h-full items-center justify-center bg-transparent transition-colors duration-200",
                    profileMediaTab === t.id
                      ? "text-white"
                      : "text-slate-400 dark:text-zinc-500",
                  )}
                  aria-label={t.id}
                >
                  <t.Icon className="h-5 w-5" strokeWidth={2.5} />
                </button>
              ))}
            </div>
          </div>

          {isOwnProfile && currentUser ? (
            <OwnProfileRecentPostersCarousel viewerUserId={currentUser.id} />
          ) : null}

          <TabsContent value="images" className="m-0 focus-visible:outline-none">
            <ProfilePhotosGrid
              imageRows={imageRows}
              isOwnProfile={isOwnProfile}
              uploadingMedia={uploadingMedia}
              compact
              onAdd={() => imageInputRef.current?.click()}
              onOpen={(idx) => setProfileMediaLightbox({ urls: galleryImageUrls, initialIndex: idx })}
              onDelete={(row) => void handleDeleteProfileMedia(row)}
            />
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
            <div
              id="profile-social-feed-mobile"
              className={cn(globalFeedMobilePageClass, "pt-1 scroll-mt-24")}
            >
              <ProfilePostsFeed {...profilePostsFeedProps} />
            </div>
          </TabsContent>

          <TabsContent value="about" className="m-0 px-5 py-8 focus-visible:outline-none space-y-12">
            <HourlyRateCard rate={publicRate} />
            <section className={profileSidebarPanelClass}>
              <h2 className="text-[10px] font-black uppercase tracking-[.25em] text-slate-400 mb-4 ml-0.5">About Me</h2>
              <ProfileBioHeader
                profile={profile}
                isOwnProfile={isOwnProfile}
                editingBio={editingBio}
                setEditingBio={setEditingBio}
                bioDraft={bioDraft}
                setBioDraft={setBioDraft}
                savingBio={savingBio}
                onSave={(next) => void saveBio(next)}
                variant="panel"
                profileEditPath={isOwnProfile ? ownProfileEditPath : null}
              />
              <ProfileLanguagesSection
                languages={profile.languages ?? []}
                isOwnProfile={isOwnProfile}
                editing={editingLanguages}
                draft={languagesDraft}
                saving={savingLanguages}
                onEdit={() => {
                  setLanguagesDraft(profile.languages ?? []);
                  setEditingLanguages(true);
                }}
                onCancel={() => {
                  setLanguagesDraft(profile.languages ?? []);
                  setEditingLanguages(false);
                }}
                onToggle={(lang) =>
                  setLanguagesDraft((prev) =>
                    prev.includes(lang)
                      ? prev.filter((item) => item !== lang)
                      : [...prev, lang],
                  )
                }
                onSave={() => void saveLanguages(languagesDraft)}
              />
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
                <div className="mb-6 flex items-center gap-3 px-2"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-500/10"><HeartHandshake className="h-5 w-5 text-orange-600 dark:text-orange-400" /></div><h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Open Help Requests</h2></div>
                <div className="grid grid-cols-1 gap-5">
                  {postedHelpRequests.length > 0 ? (
                    postedHelpRequests.map((job) => renderPostedHelpRow(job))
                  ) : (
                    <div className="flex flex-col items-center gap-3 px-2 py-4 text-center">
                      <HeartHandshake className="h-10 w-10 text-slate-300 dark:text-slate-600" aria-hidden />
                      <p className="text-sm font-medium text-slate-400 dark:text-slate-500">
                        No open help requests right now.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* User Reviews — Full Restored Design with gradients and floating avatars */}
              <div className={cn(profileSidebarPanelClass, "pt-6")}>
                <button
                  type="button"
                  onClick={() => reviews.length > 0 && setReviewsSheetOpen(true)}
                  disabled={reviews.length === 0}
                  className={cn(
                    "mb-6 flex w-full items-center gap-3 px-2 text-left outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-orange-500/50",
                    reviews.length > 0 && "cursor-pointer hover:opacity-80 active:opacity-70",
                  )}
                  aria-label={
                    reviews.length > 0
                      ? `View all ${reviews.length} reviews`
                      : "User reviews"
                  }
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10">
                    <Star className="h-5 w-5 fill-amber-500 text-amber-500" />
                  </div>
                  <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">
                    User Reviews
                  </h2>
                  {reviews.length > 0 ? (
                    <span className="ml-auto text-xs font-bold uppercase tracking-widest text-slate-400">
                      View all
                    </span>
                  ) : null}
                </button>
                {reviews.length > 0 ? (
                  <div
                    className="-mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-5 pb-3 pt-16 [-webkit-overflow-scrolling:touch]"
                    role="list"
                    aria-label="User reviews"
                  >
                    {reviews.map((review, idx) => (
                      <ProfileReviewPreviewCard
                        key={review.id}
                        review={review}
                        index={idx}
                        onClick={() => setReviewsSheetOpen(true)}
                      />
                    ))}
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
          <div id="profile-social-feed-desktop" className="col-span-2 scroll-mt-24">
            {profileMediaTab === "images" && (
              <ProfilePhotosGrid
                imageRows={imageRows}
                isOwnProfile={isOwnProfile}
                uploadingMedia={uploadingMedia}
                onAdd={() => imageInputRef.current?.click()}
                onOpen={(idx) => setProfileMediaLightbox({ urls: galleryImageUrls, initialIndex: idx })}
                onDelete={(row) => void handleDeleteProfileMedia(row)}
              />
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
                    {videoRows.map((row) => {
                      const videoSrc = publicProfileMediaPublicUrl(row.storage_path); return (
                        <div key={row.id} className="group relative overflow-hidden rounded-2xl bg-black shadow-lg">
                          <div role="button" tabIndex={0} onClick={() => setProfileVideoLightboxUrl(videoSrc)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setProfileVideoLightboxUrl(videoSrc); } }} className="cursor-pointer outline-none" aria-label="Open video full screen"><video src={videoSrc} muted playsInline preload="metadata" className="pointer-events-none max-h-[min(70vh,540px)] w-full object-contain" /></div>
                          {isOwnProfile && <button type="button" disabled={uploadingMedia} onClick={() => void handleDeleteProfileMedia(row)} className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white shadow-md transition hover:bg-black/70" aria-label="Remove video"><Trash2 className="h-4 w-4" /></button>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            {profileMediaTab === "posts" && <ProfilePostsFeed {...profilePostsFeedProps} />}
            {profileMediaTab === "about" && (
              <div className="space-y-4">
              <HourlyRateCard rate={publicRate} />
              <div className={cn(profileSidebarPanelClass, "rounded-[2.5rem] p-10")}>
                <div className="max-w-2xl">
                  <h2 className="text-[11px] font-black uppercase tracking-[.25em] text-slate-400 mb-6">Introduction</h2>
                  <ProfileBioHeader
                    profile={profile}
                    isOwnProfile={isOwnProfile}
                    editingBio={editingBio}
                    setEditingBio={setEditingBio}
                    bioDraft={bioDraft}
                    setBioDraft={setBioDraft}
                    savingBio={savingBio}
                    onSave={(next) => void saveBio(next)}
                    variant="panel"
                    profileEditPath={isOwnProfile ? ownProfileEditPath : null}
                  />
                  <ProfileLanguagesSection
                    languages={profile.languages ?? []}
                    isOwnProfile={isOwnProfile}
                    editing={editingLanguages}
                    draft={languagesDraft}
                    saving={savingLanguages}
                    onEdit={() => {
                      setLanguagesDraft(profile.languages ?? []);
                      setEditingLanguages(true);
                    }}
                    onCancel={() => {
                      setLanguagesDraft(profile.languages ?? []);
                      setEditingLanguages(false);
                    }}
                    onToggle={(lang) =>
                      setLanguagesDraft((prev) =>
                        prev.includes(lang)
                          ? prev.filter((item) => item !== lang)
                          : [...prev, lang],
                      )
                    }
                    onSave={() => void saveLanguages(languagesDraft)}
                  />
                </div>
              </div>
              </div>
            )}
          </div>

          {/* Desktop Sidebar (1/3) */}
          <div className="col-span-1 space-y-6">
            <div className={profileSidebarPanelClass}>
              <div className="flex items-center gap-2.5 mb-5"><Sparkles className="h-4 w-4 text-orange-500 shrink-0" /><h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Public Service Board</h3></div>
              <PublicProfileServiceBoard
                posts={serviceBoardPosts}
                onPostOpen={openServiceBoardPost}
              />
            </div>

            {profileMediaTab !== "about" && reviews.length > 0 ? (
              <div className={profileSidebarPanelClass}>
                <button
                  type="button"
                  onClick={() => setReviewsSheetOpen(true)}
                  className="mb-5 flex w-full items-center gap-2.5 text-left outline-none transition-opacity hover:opacity-80 active:opacity-70 focus-visible:ring-2 focus-visible:ring-orange-500/50"
                  aria-label={`View all ${reviews.length} reviews`}
                >
                  <Star className="h-4 w-4 shrink-0 fill-amber-500 text-amber-500" />
                  <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    User Reviews
                  </h3>
                  <span className="ml-auto text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    View all
                  </span>
                </button>
                <div
                  className="-mx-6 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-6 pb-3 pt-16 [-webkit-overflow-scrolling:touch]"
                  role="list"
                  aria-label="User reviews"
                >
                  {reviews.map((review, idx) => (
                    <ProfileReviewPreviewCard
                      key={review.id}
                      review={review}
                      index={idx}
                      onClick={() => setReviewsSheetOpen(true)}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {profileMediaTab === "about" ? (
            <div className={cn(profileSidebarPanelClass, "col-span-3")}>
              <button
                type="button"
                onClick={() => reviews.length > 0 && setReviewsSheetOpen(true)}
                disabled={reviews.length === 0}
                className={cn(
                  "mb-5 flex w-full items-center gap-2.5 text-left outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-orange-500/50",
                  reviews.length > 0 && "cursor-pointer hover:opacity-80 active:opacity-70",
                )}
                aria-label={
                  reviews.length > 0
                    ? `View all ${reviews.length} reviews`
                    : "User reviews"
                }
              >
                <Star className="h-4 w-4 shrink-0 fill-amber-500 text-amber-500" />
                <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  User Reviews
                </h3>
                {reviews.length > 0 ? (
                  <span className="ml-auto text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    View all
                  </span>
                ) : null}
              </button>
              {reviews.length > 0 ? (
                <div
                  className="-mx-6 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-6 pb-3 pt-16 [-webkit-overflow-scrolling:touch]"
                  role="list"
                  aria-label="User reviews"
                >
                  {reviews.map((review, idx) => (
                    <ProfileReviewPreviewCard
                      key={review.id}
                      review={review}
                      index={idx}
                      onClick={() => setReviewsSheetOpen(true)}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 px-2 py-6 text-center">
                  <UserIcon className="h-12 w-12 text-slate-300 dark:text-slate-600" aria-hidden />
                  <p className="font-medium text-slate-400 dark:text-slate-500">
                    No reviews yet for this user
                  </p>
                </div>
              )}
            </div>
          ) : null}
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

      <ProfileReviewsSheet
        open={reviewsSheetOpen}
        onOpenChange={setReviewsSheetOpen}
        reviews={reviews}
        averageRating={profile.average_rating || 0}
        totalRatings={profile.total_ratings || 0}
      />
    </div>
  );
}
