import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Briefcase,
  Users,
  Baby,
  Sparkles,
  Star,
  BadgeCheck,
  CheckCircle2,
  Soup,
  ChevronLeft,
  ChevronRight,
  Truck,
  ShieldCheck,
  Loader2,
  HelpingHand,
  HeartHandshake,
  HelpCircle,
  MapPin,
  Clock,
  CalendarDays,
  Hourglass,
  Coins,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  StickyNote,
} from "lucide-react";
import Benefits from "@/components/Benefits";
import React, { useState, useRef, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LandingSiteHeader } from "@/components/LandingSiteHeader";
import { WhatIsTebnuDialog } from "@/components/WhatIsTebnuDialog";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { Footer } from "@/components/Footer";
import { cn } from "@/lib/utils";
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE, usePageSeo } from "@/lib/seo";
import {
  communityFeedRequestScrollState,
  communityFeedScrollState,
} from "@/lib/communityFeedNav";
import {
  globalFeedPostTypeAccentClass,
  globalFeedPrimaryCtaClass,
} from "@/lib/globalFeedPostUi";
import { useTheme } from "@/context/ThemeContext";
import { useTranslation } from "react-i18next";
import { useLandingPagePreview } from "@/hooks/data/useLandingPagePreview";
import { LandingHeroCollage } from "@/components/landing/LandingHeroCollage";
import {
  HIRE_CATEGORY_TILE_UI,
  OTHER_HELP_SUBCATEGORY_UI,
  resolveHelpCategoryIconId,
} from "@/lib/discoverCategoryTileIcons";
import { isServiceCategoryId } from "@/lib/serviceCategories";
import { formatPostedAgo } from "@/components/community/CommunityPostCard";
import type { LandingActivityKind } from "@/lib/fetchLandingRecentActivity";
import type {
  IsolatedFeedDetailKind,
  IsolatedFeedDetailRow,
} from "@/lib/isolatedFeedPostDetails";

function landingCategoryGradient(categoryId: string | null): string {
  const k = (categoryId || "").toLowerCase();
  if (k.includes("clean")) return "from-emerald-400 to-teal-500";
  if (k.includes("cook")) return "from-orange-400 to-red-500";
  if (k.includes("nanny") || k.includes("child")) return "from-violet-400 to-indigo-500";
  if (k.includes("pickup") || k.includes("deliver")) return "from-sky-400 to-blue-500";
  return "from-orange-400 to-amber-500";
}

function landingActivityTypeId(kind: LandingActivityKind): "request_help" | "offer_service" {
  return kind === "request" ? "request_help" : "offer_service";
}

function landingActivityTypeLabel(kind: LandingActivityKind): string {
  return kind === "request" ? "Request" : "Offer";
}

function landingActivityCtaLabel(kind: LandingActivityKind, authorName: string): string {
  if (kind === "request") return "Offer help";
  const first = authorName.trim().split(/\s+/)[0] || "user";
  return `Message ${first}`;
}

const HOW_IT_WORKS_STEPS = [
  {
    step: 1,
    image: "/images/how-it-works/how-it-works-post-request.png",
    imageDark: "/images/how-it-works/how-it-works-post-request-dark.png",
  },
  {
    step: 2,
    image: "/images/how-it-works/how-it-works-get-matched.png",
    imageDark: "/images/how-it-works/how-it-works-get-matched-dark.png",
  },
  {
    step: 3,
    image: "/images/how-it-works/how-it-works-choose-helper.png",
    imageDark: "/images/how-it-works/how-it-works-choose-helper-dark.png",
  },
  {
    step: 4,
    image: "/images/how-it-works/how-it-works-chat-confirm.png",
    imageDark: "/images/how-it-works/how-it-works-chat-confirm-dark.png",
  },
  {
    step: 5,
    image: "/images/how-it-works/how-it-works-youre-set.png",
    imageDark: "/images/how-it-works/how-it-works-youre-set-dark.png",
  },
] as const;

function LandingActivityDetailIcon({
  kind,
  className,
}: {
  kind: IsolatedFeedDetailKind;
  className?: string;
}) {
  const iconClass = cn("h-3.5 w-3.5 shrink-0", className);
  switch (kind) {
    case "location":
      return <MapPin className={iconClass} aria-hidden />;
    case "from":
      return <ArrowUpRight className={iconClass} aria-hidden />;
    case "to":
      return <ArrowDownRight className={iconClass} aria-hidden />;
    case "when":
    case "shift":
      return <Clock className={iconClass} aria-hidden />;
    case "schedule":
      return <CalendarDays className={iconClass} aria-hidden />;
    case "duration":
      return <Hourglass className={iconClass} aria-hidden />;
    case "careType":
      return <Briefcase className={iconClass} aria-hidden />;
    case "frequency":
      return <RefreshCw className={iconClass} aria-hidden />;
    case "budget":
    case "rate":
      return <Coins className={iconClass} aria-hidden />;
    case "people":
      return <Users className={iconClass} aria-hidden />;
    case "kids":
      return <Baby className={iconClass} aria-hidden />;
    case "notes":
      return <StickyNote className={iconClass} aria-hidden />;
    default:
      return <Sparkles className={iconClass} aria-hidden />;
  }
}

const MEDIA_BADGE_KIND_ORDER: IsolatedFeedDetailKind[] = [
  "location",
  "when",
  "schedule",
  "duration",
  "from",
  "to",
  "budget",
  "rate",
];

function LandingCategoryIcon({
  categoryId,
  customCategory,
}: {
  categoryId: string | null;
  customCategory?: string | null;
}) {
  const id = resolveHelpCategoryIconId(categoryId, customCategory);
  const ui =
    (id ? OTHER_HELP_SUBCATEGORY_UI[id] : null) ??
    (id && isServiceCategoryId(id) ? HIRE_CATEGORY_TILE_UI[id] : null);
  const Icon = ui?.Icon ?? HelpCircle;
  return (
    <Icon
      className={cn(
        "h-6 w-6 shrink-0 md:h-7 md:w-7",
        ui?.iconClass ?? "text-slate-500",
      )}
      strokeWidth={2.25}
      aria-hidden
    />
  );
}

function landingVisibleDetailPoints(
  points: IsolatedFeedDetailRow[],
): IsolatedFeedDetailRow[] {
  return points.filter((point) => {
    if (point.kind === "budget") return false;
    const label = `${point.key} ${point.value}`.toLowerCase();
    if (label.includes("renewed")) return false;
    return true;
  });
}

function landingMediaBadgePoints(
  points: IsolatedFeedDetailRow[],
): IsolatedFeedDetailRow[] {
  const rank = (kind: IsolatedFeedDetailKind) => {
    const index = MEDIA_BADGE_KIND_ORDER.indexOf(kind);
    return index === -1 ? 99 : index;
  };
  return landingVisibleDetailPoints(points)
    .filter((point) => point.kind !== "notes")
    .sort((a, b) => rank(a.kind) - rank(b.kind))
    .slice(0, 2);
}

function LandingActivityMedia({
  src,
  kind,
  children,
}: {
  src: string;
  kind: "image" | "video";
  children?: React.ReactNode;
}) {
  const [orientation, setOrientation] = useState<"portrait" | "landscape" | null>(
    null,
  );

  function applySize(width: number, height: number) {
    if (!width || !height) return;
    const next = width / height >= 1.05 ? "landscape" : "portrait";
    setOrientation((prev) => (prev === next ? prev : next));
  }

  const mediaClass = cn(
    "h-full w-full object-center",
    orientation === "portrait" ? "object-contain" : "object-cover",
  );

  return (
    <div className="relative mt-3 aspect-[16/10] w-full overflow-hidden rounded-xl bg-black/90">
      {kind === "video" ? (
        <video
          src={src}
          muted
          playsInline
          preload="metadata"
          className={mediaClass}
          onLoadedMetadata={(e) => {
            applySize(e.currentTarget.videoWidth, e.currentTarget.videoHeight);
          }}
        />
      ) : (
        <img
          src={src}
          alt=""
          className={mediaClass}
          loading="lazy"
          decoding="async"
          onLoad={(e) => {
            applySize(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight);
          }}
        />
      )}
      {children}
    </div>
  );
}

function helperInitials(name: string | null | undefined): string {
  const parts = (name || "H").trim().split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);
}

export default function LandingPage() {
  usePageSeo({
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    path: "/",
  });
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDarkTheme = theme === "dark";
  const buttonsRef = useRef<HTMLDivElement>(null);
  const mobileHeroButtonsRef = useRef<HTMLDivElement>(null);
  const reviewsRef = useRef<HTMLDivElement>(null);
  const showcaseRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const [heroScrolledPast, setHeroScrolledPast] = useState(false);
  const [activeCategoryIndex, setActiveCategoryIndex] = useState(0);
  const [showFixedButtons, setShowFixedButtons] = useState(false);
  const [showMobileFixedButtons, setShowMobileFixedButtons] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const { activityLoading, activityItems, heroPosts, heroPostsLoading, reviewsLoading, reviews } =
    useLandingPagePreview();

  const showcaseCategories = [
    { id: "special_video", icon: <Sparkles />, image: "/videos/promo-video.mp4" },
    { id: "childcare", icon: <Baby />, image: "/nanny-mar22.png" },
    { id: "cleaning", icon: <Sparkles />, image: "/pexels-silverkblack-36715260.jpg" },
    { id: "cooking", icon: <Soup />, image: "/images/private-chef.jpg" },
    { id: "pickup", icon: <Truck />, image: "/other-mar22.png" },
    { id: "handyman", icon: <Briefcase />, image: "/images/handyman.jpg" },
  ] as const;

  const experienceCopy = (id: (typeof showcaseCategories)[number]["id"]) => {
    const bullets = t(`landing.experience.${id}.bullets`, { returnObjects: true });
    return {
      title: t(`landing.experience.${id}.title`),
      phrase: t(`landing.experience.${id}.phrase`),
      blurb: t(`landing.experience.${id}.blurb`),
      details: t(`landing.experience.${id}.details`),
      cta: t(`landing.experience.${id}.cta`),
      bullets: Array.isArray(bullets) ? (bullets as string[]) : [],
    };
  };
  const activeExperience = experienceCopy(showcaseCategories[activeCategoryIndex].id);

  const scrollLeft = (ref: React.RefObject<HTMLDivElement>) => {
    if (ref.current) {
      ref.current.scrollBy({ left: -400, behavior: "smooth" });
    }
  };

  const scrollRight = (ref: React.RefObject<HTMLDivElement>) => {
    if (ref.current) {
      ref.current.scrollBy({ left: 400, behavior: "smooth" });
    }
  };

  // Scroll Reveal Animation Effect
  useEffect(() => {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: "0px 0px -50px 0px",
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("opacity-100", "translate-y-0");
          entry.target.classList.remove("opacity-0", "translate-y-10");
        }
      });
    }, observerOptions);

    const revealElements = document.querySelectorAll(".scroll-reveal");
    revealElements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setHeroScrolledPast(entry.boundingClientRect.bottom < 72);
      },
      { threshold: [0, 0.05, 0.15, 0.35, 0.6, 1] },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        const isPast =
          !entry.isIntersecting && entry.boundingClientRect.top < 0;
        setShowFixedButtons(isPast);
      },
      { threshold: 0 },
    );

    if (buttonsRef.current) {
      observer.observe(buttonsRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        const isPast =
          !entry.isIntersecting && entry.boundingClientRect.top < 0;
        setShowMobileFixedButtons(isPast);
      },
      { threshold: 0 },
    );

    if (mobileHeroButtonsRef.current) {
      observer.observe(mobileHeroButtonsRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const handleSearchingForJob = () => {
    // Navigate directly to onboarding with role param
    navigate("/onboarding?role=freelancer");
  };

  const handleHiringHelper = () => {
    // Navigate directly to onboarding with role param
    navigate("/onboarding?role=client");
  };

  return (
    <div className="flex min-h-[100dvh] min-h-[-webkit-fill-available] flex-col bg-white text-slate-900 dark:bg-background dark:text-foreground max-md:pb-[calc(4.75rem+var(--app-safe-bottom,env(safe-area-inset-bottom,0px)))]">
      <LandingSiteHeader
        hideLeftLogo
        hideBackButton
        hideBackButtonMobile
        heroOverlay
        heroOverlayScrolled={heroScrolledPast}
        onBrandClick={() => setAboutOpen(true)}
      />

      <WhatIsTebnuDialog open={aboutOpen} onOpenChange={setAboutOpen} />

      {/* Sticky hero CTAs when scrolled past — desktop only */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-8 z-[60] hidden justify-center px-6 transition-all duration-500 md:flex",
          showFixedButtons
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-10 pointer-events-none",
        )}
      >
        <div className="flex flex-wrap items-center justify-center gap-2.5 rounded-2xl bg-white/95 p-2 shadow-2xl backdrop-blur-xl dark:bg-zinc-800/90">
          <Button
            onClick={handleSearchingForJob}
            className="h-12 gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 px-5 text-sm font-bold text-white shadow-md hover:from-emerald-600 hover:to-green-700"
          >
            <HelpingHand className="h-8 w-8" strokeWidth={2.25} />
            {t("landing.offerHelp")}
          </Button>
          <Button
            onClick={handleHiringHelper}
            className="h-12 gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-600 px-5 text-sm font-bold text-white shadow-md hover:from-orange-600 hover:to-red-700"
          >
            <HeartHandshake className="h-8 w-8" strokeWidth={2.25} />
            {t("landing.needHelp")}
          </Button>
        </div>
      </div>

      <main className="flex-1">
        {/* Full-Screen Hero Section */}
        <section
          ref={heroRef}
          className="relative w-full min-h-[90vh] overflow-visible group/hero md:min-h-screen md:bg-white dark:md:bg-background"
        >
          {/* Mobile — white hero with same post collage as desktop */}
          <div className="relative bg-white dark:bg-background md:hidden">
            <div className="relative flex flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(5.75rem,calc(env(safe-area-inset-top,0px)+4.5rem))]">
              <div className="relative z-10 space-y-4 pb-1 animate-in fade-in slide-in-from-bottom-3 duration-700">
                <h1 className="max-w-[20rem] text-[2.5rem] font-black leading-[1.05] tracking-tight text-slate-900 dark:text-zinc-50 sm:text-[2.65rem]">
                  {t("landing.heroTitleBefore")}
                  <span className="inline-block rotate-[-1deg] rounded-xl bg-orange-50 px-2.5 py-0.5 text-orange-600 shadow-[0_8px_24px_-12px_rgba(249,115,22,0.25)] dark:bg-orange-500/15 dark:text-orange-400">
                    {t("landing.heroTitleHighlight")}
                  </span>
                  <span className="block">{t("landing.heroTitleAfter")}</span>
                </h1>
                <p className="max-w-[22rem] text-[1.05rem] font-medium leading-relaxed text-slate-600 dark:text-zinc-400">
                  {t("landing.heroDescription")}
                </p>
              </div>

              <div data-nosnippet>
                <LandingHeroCollage
                  embedded
                  posts={heroPosts}
                  loading={heroPostsLoading}
                  className="relative left-1/2 z-0 mt-1 w-screen max-w-[100vw] -translate-x-1/2"
                />
              </div>

              <div ref={mobileHeroButtonsRef} className="mt-2 space-y-3">
                <div className="grid grid-cols-2 gap-2.5">
                  <Button
                    type="button"
                    onClick={handleHiringHelper}
                    className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-red-600 text-sm font-black text-white shadow-md transition-all hover:from-orange-600 hover:to-red-700 active:scale-[0.98]"
                  >
                    <HeartHandshake className="h-8 w-8 shrink-0" strokeWidth={2.25} aria-hidden />
                    {t("landing.needHelp")}
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSearchingForJob}
                    className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 text-sm font-black text-white shadow-md transition-all hover:from-emerald-600 hover:to-green-700 active:scale-[0.98]"
                  >
                    <HelpingHand className="h-8 w-8 shrink-0" strokeWidth={2.25} aria-hidden />
                    {t("landing.offerHelp")}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Desktop — side portraits with centered copy */}
          <div className="relative hidden min-h-svh bg-white dark:bg-background md:block">
            <div
              className="pointer-events-none absolute inset-0 overflow-hidden rounded-none"
              aria-hidden
            >
              <img
                src="/ChatGPT Image Aug 23, 2026 at 11_08_39 AM.png"
                alt=""
                className="h-full w-full object-cover object-center"
              />
              <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/40 to-transparent" />
            </div>

            <div className="relative z-10 flex min-h-svh flex-col items-center justify-center px-8 pt-24 pb-56 text-center">
              <div className="relative w-full max-w-3xl animate-in fade-in duration-1000">
                <div
                  className="pointer-events-none absolute -inset-x-16 -inset-y-12 rounded-full bg-black/20 blur-3xl"
                  aria-hidden
                />
                <div className="relative">
                <h1 className="text-6xl font-black leading-[1.08] tracking-tight text-white drop-shadow-[0_2px_20px_rgba(0,0,0,0.55)] lg:text-7xl">
                  {t("landing.heroTitleBefore")}
                  <span className="inline-block rounded-2xl border-0 bg-white/40 px-3.5 py-1 text-orange-500 shadow-none outline-none ring-0 backdrop-blur-md">
                    {t("landing.heroTitleHighlight")}
                  </span>
                  <span className="block">{t("landing.heroTitleAfter")}</span>
                </h1>
                <p className="mx-auto mt-6 max-w-2xl text-xl font-semibold text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.5)] lg:text-2xl">
                  {t("landing.heroDescription")}
                </p>
                <p className="mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-base font-bold text-white/90 drop-shadow-[0_2px_12px_rgba(0,0,0,0.45)] lg:text-lg">
                  <span>{t("landing.verifiedUsers")}</span>
                  <span className="text-white/70" aria-hidden>
                    ·
                  </span>
                  <span>{t("landing.localHelpers")}</span>
                  <span className="text-white/70" aria-hidden>
                    ·
                  </span>
                  <span>{t("landing.fastResponse")}</span>
                </p>

                <div
                  ref={buttonsRef}
                  className="relative z-20 mt-9 flex flex-wrap items-center justify-center gap-5"
                >
                  <Button
                    onClick={handleSearchingForJob}
                    className="group/btn flex h-16 items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 px-8 text-lg font-bold text-white shadow-lg shadow-emerald-500/30 transition-all hover:from-emerald-600 hover:to-green-700 active:scale-[0.98] lg:h-[4.5rem] lg:px-9 lg:text-xl"
                  >
                    <HelpingHand className="h-10 w-10 shrink-0 lg:h-11 lg:w-11" strokeWidth={2.25} />
                    {t("landing.offerHelp")}
                  </Button>
                  <Button
                    onClick={handleHiringHelper}
                    className="group/btn flex h-16 items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-orange-500 to-red-600 px-8 text-lg font-bold text-white shadow-lg shadow-orange-500/30 transition-all hover:from-orange-600 hover:to-red-700 active:scale-[0.98] lg:h-[4.5rem] lg:px-9 lg:text-xl"
                  >
                    <HeartHandshake className="h-10 w-10 shrink-0 lg:h-11 lg:w-11" strokeWidth={2.25} />
                    {t("landing.needHelp")}
                  </Button>
                </div>
                </div>
              </div>
            </div>

            <div className="absolute inset-x-0 bottom-0 z-20 flex shadow-[0_-16px_40px_-20px_rgba(15,23,42,0.35)]">
              <div
                className="flex min-w-0 flex-1 items-stretch overflow-hidden bg-white dark:bg-zinc-800"
                aria-label={t("landing.verifiedAria")}
              >
                <div className="relative w-28 shrink-0 self-stretch sm:w-32 lg:w-36">
                  <img
                    src="/ChatGPT Image Jan 27, 2026, 05_31_05 PM.png"
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover object-[center_20%]"
                  />
                </div>
                <div className="min-w-0 flex-1 px-5 py-3.5 lg:px-6 lg:py-4">
                  <p className="text-base font-bold leading-snug text-slate-900 dark:text-zinc-100 md:text-lg">
                    {t("landing.verifiedTitleBefore")}{" "}
                    <span className="inline-flex items-center gap-1.5 text-xl font-black text-emerald-600 dark:text-emerald-400 md:text-2xl">
                      {t("landing.verifiedDidit")}
                      <ShieldCheck
                        className="h-5 w-5 shrink-0 md:h-6 md:w-6"
                        strokeWidth={2.5}
                        aria-hidden
                      />
                    </span>
                  </p>
                  <p className="mt-1.5 text-sm font-medium leading-snug text-slate-600 dark:text-zinc-400">
                    {t("landing.verifiedSubtitle")}
                  </p>
                  <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
                    {[
                      t("landing.verifiedCheck1"),
                      t("landing.verifiedCheck2"),
                    ].map((line) => (
                      <li
                        key={line}
                        className="text-sm font-semibold leading-snug text-slate-500 dark:text-zinc-400"
                      >
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="flex min-w-0 flex-1 items-stretch overflow-hidden border-l border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-800">
                <div className="relative w-44 shrink-0 self-stretch sm:w-52 lg:w-60">
                  <img
                    src="/ChatGPT Image Aug 31, 2026, 08_52_25 AM.png"
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover object-center"
                  />
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-center px-5 py-3.5 lg:px-6 lg:py-4">
                  <p className="text-base font-bold leading-snug text-slate-900 dark:text-zinc-100 md:text-lg">
                    {t("landing.postsTitle")}
                  </p>
                  <p className="mt-1.5 text-sm font-medium leading-snug text-slate-500 dark:text-zinc-400">
                    {t("landing.postsSubtitle")}
                  </p>
                  <Link
                    to="/community/feed"
                    className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-orange-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-orange-700"
                  >
                    {t("landing.postsCta")}
                    <ArrowRight className="h-4 w-4" strokeWidth={2.4} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          className="relative w-full scroll-reveal opacity-0 translate-y-10 pt-24 pb-28 transition-all duration-1000 delay-200 md:pt-32 md:pb-36 lg:pt-40 lg:pb-44"
          aria-labelledby="how-it-works-heading"
        >
          <div className="bg-primary px-5 pb-28 pt-16 sm:px-8 sm:pb-32 sm:pt-20 lg:px-12 lg:pb-36">
            <div className="mx-auto max-w-3xl text-center">
              <h2
                id="how-it-works-heading"
                className="text-3xl font-black tracking-tight text-white md:text-5xl"
              >
                {t("landing.howItWorksTitle")}
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-base font-medium text-white/90 md:text-lg">
                {t("landing.howItWorksSubtitle")}
              </p>
            </div>
          </div>

          <div className="relative z-10 mx-auto -mt-20 max-w-7xl px-4 sm:-mt-24 sm:px-6 lg:-mt-28 lg:px-8">
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-5 lg:gap-5">
              {HOW_IT_WORKS_STEPS.map((step) => (
                <article
                  key={step.step}
                  className="relative flex h-full flex-col items-center rounded-2xl bg-white px-5 pb-7 pt-12 text-center shadow-[0_16px_40px_-12px_rgba(15,23,42,0.16)] dark:bg-zinc-800 dark:shadow-[0_16px_40px_-12px_rgba(0,0,0,0.45)]"
                >
                  <span className="absolute -top-6 left-1/2 flex h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full border-2 border-primary bg-white text-xl font-black text-primary dark:bg-zinc-800">
                    {step.step}
                  </span>
                  <img
                    src={isDarkTheme ? step.imageDark : step.image}
                    alt={t(`landing.steps.${step.step}.imageAlt`)}
                    className="mb-4 h-32 w-32 object-contain"
                  />
                  <h3 className="mb-2 text-[17px] font-bold leading-tight text-slate-900 dark:text-zinc-100">
                    {t(`landing.steps.${step.step}.title`)}
                  </h3>
                  <p className="text-sm font-medium leading-relaxed text-slate-500 dark:text-zinc-400">
                    {t(`landing.steps.${step.step}.desc`)}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Interactive Job Category Showcase — equal cards, horizontal scroll */}
        <section className="w-full scroll-reveal pt-32 pb-24 opacity-0 transition-all delay-300 duration-1000 translate-y-10 md:pt-40">
          <div className="mb-10 space-y-4 px-5 text-center sm:px-8 lg:px-12 xl:px-16">
            <h2 className="text-4xl font-black leading-tight tracking-tight text-slate-900 dark:text-zinc-50 md:text-6xl">
              {t("landing.experienceTitleBefore")}
              <span className="text-primary italic">{t("landing.experienceTitleBrand")}</span>
              {t("landing.experienceTitleAfter")}
            </h2>
            <p className="mx-auto max-w-2xl text-lg font-medium text-slate-500 dark:text-zinc-400">
              {t("landing.experienceSubtitle")}
            </p>
          </div>

          <div className="relative flex w-full flex-col items-center">
            <div className="relative w-full">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Scroll categories left"
                className="absolute left-3 top-1/2 z-30 h-9 w-9 -translate-y-1/2 rounded-full border-0 bg-white/55 text-slate-900 shadow-none ring-0 backdrop-blur-xl backdrop-saturate-150 transition-all hover:bg-white/70 active:scale-95 dark:bg-zinc-800/70 dark:text-zinc-100 dark:hover:bg-zinc-700/80 sm:left-6 sm:h-10 sm:w-10 md:left-8 md:h-12 md:w-12 lg:left-10"
                onClick={() => scrollLeft(showcaseRef)}
              >
                <ChevronLeft className="h-5 w-5 md:h-6 md:w-6" />
              </Button>

              <div
                ref={showcaseRef}
                className="flex w-full snap-x snap-mandatory items-center gap-5 overflow-x-auto scroll-smooth overscroll-x-contain py-3 scrollbar-hide px-5 sm:gap-6 sm:px-8 lg:gap-7 lg:px-12 xl:px-16"
              >
                {showcaseCategories.map((cat, idx) => {
                  const isActive = idx === activeCategoryIndex;
                  const copy = experienceCopy(cat.id);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={(e) => {
                        setActiveCategoryIndex(idx);
                        e.currentTarget.scrollIntoView({
                          behavior: "smooth",
                          inline: "center",
                          block: "nearest",
                        });
                      }}
                      className={cn(
                        "group relative shrink-0 snap-start overflow-hidden rounded-[1.75rem] bg-slate-100 text-left shadow-[0_24px_48px_-16px_rgba(0,0,0,0.28)] transition-all duration-500",
                        isActive
                          ? "w-[min(90vw,32rem)] sm:w-[30rem] md:w-[32rem] md:ring-2 md:ring-primary md:ring-offset-2 lg:w-[34rem]"
                          : "w-[min(86vw,28rem)] sm:w-[26rem] md:w-[28rem] lg:w-[30rem]",
                      )}
                    >
                      <div className="relative aspect-[4/3] w-full">
                        {cat.id === "special_video" ? (
                          <video
                            autoPlay
                            loop
                            muted
                            playsInline
                            className="h-full w-full object-cover object-center"
                          >
                            <source
                              src="/videos/promo-video.mp4"
                              type="video/mp4"
                            />
                          </video>
                        ) : (
                          <img
                            src={cat.image}
                            alt={copy.title}
                            className="h-full w-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
                          />
                        )}

                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent" />

                        <div className="absolute inset-x-4 bottom-4 z-20 sm:inset-x-6 sm:bottom-6">
                          <div className="mb-1.5 flex items-center gap-2.5">
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 p-3 text-white backdrop-blur-md">
                              {React.cloneElement(
                                cat.icon as React.ReactElement,
                                { className: "h-full w-full text-white" },
                              )}
                            </div>
                            <h3 className="text-2xl font-black uppercase leading-none tracking-tighter text-white drop-shadow-md md:text-3xl">
                              {copy.title}
                            </h3>
                          </div>
                          <p className="line-clamp-2 text-sm font-medium leading-snug text-white/90 drop-shadow-sm md:text-base">
                            {copy.blurb}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <Button
                variant="ghost"
                size="icon"
                aria-label="Scroll categories right"
                className="absolute right-3 top-1/2 z-30 h-9 w-9 -translate-y-1/2 rounded-full border-0 bg-white/55 text-slate-900 shadow-none ring-0 backdrop-blur-xl backdrop-saturate-150 transition-all hover:bg-white/70 active:scale-95 dark:bg-zinc-800/70 dark:text-zinc-100 dark:hover:bg-zinc-700/80 sm:right-6 sm:h-10 sm:w-10 md:right-8 md:h-12 md:w-12 lg:right-10"
                onClick={() => scrollRight(showcaseRef)}
              >
                <ChevronRight className="h-5 w-5 md:h-6 md:w-6" />
              </Button>
            </div>

            {/* Details Revealed Below Active Card */}
            <div className="mt-8 w-full animate-in fade-in slide-in-from-top-4 duration-700 px-5 sm:px-8 lg:px-12 xl:px-16">
              <div className="max-h-[700px] w-full space-y-12 overflow-y-auto py-8 scrollbar-hide">
                <div className="grid grid-cols-1 items-start gap-8 md:grid-cols-2">
                  <div className="space-y-4">
                    <div className="hidden h-1 w-12 rounded-full bg-primary sm:block" />
                    <h4 className="text-2xl font-black leading-tight text-slate-900 dark:text-zinc-50 md:text-3xl">
                      {activeExperience.phrase}
                    </h4>
                    <p className="text-lg font-medium leading-relaxed text-slate-600 dark:text-zinc-400">
                      {activeExperience.details}
                    </p>
                  </div>

                  <div className="space-y-4">
                    <h5 className="text-sm font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 md:text-base">
                      {t("landing.whyChooseUs")}
                    </h5>
                    <ul className="space-y-3">
                      {activeExperience.bullets.map(
                        (bullet, i) => (
                          <li
                            key={i}
                            className="flex items-center justify-start gap-3 font-bold text-slate-700 dark:text-zinc-300"
                          >
                            <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
                            <span className="text-[15px]">{bullet}</span>
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                </div>

                <div className="flex justify-center border-t border-slate-200/50 pt-8 dark:border-zinc-800 sm:justify-start">
                  <Button
                    onClick={handleHiringHelper}
                    size="lg"
                    className="h-14 w-full rounded-2xl bg-primary px-10 text-lg font-bold text-white shadow-xl shadow-primary/20 transition-all hover:scale-105 hover:bg-primary/90 active:scale-95 sm:w-auto"
                  >
                    {activeExperience.cta}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <div className="scroll-reveal pb-16 opacity-0 translate-y-10 transition-all duration-1000 md:pb-24">
          <Benefits />
        </div>

        {/* Recent Activity — responsive grid */}
        <div className="w-full pt-20 scroll-reveal opacity-0 translate-y-10 transition-all duration-1000 md:pt-28">
          <div className="mb-10 px-5 sm:px-8 lg:px-12 xl:px-16">
            <h2 className="text-2xl font-bold text-black dark:text-zinc-50 md:text-3xl">
              Recent Activity
            </h2>
          </div>

          <div
            data-nosnippet
            className="grid w-full grid-cols-1 items-stretch gap-5 px-0 pb-8 sm:grid-cols-2 sm:gap-6 sm:px-8 lg:grid-cols-3 lg:gap-7 lg:px-12 xl:px-16"
          >
            {activityLoading ? (
              <div className="col-span-full flex min-h-[220px] w-full items-center justify-center text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : activityItems.length === 0 ? (
              <div className="col-span-full px-2 py-10 text-sm font-medium text-slate-500 dark:text-zinc-400">
                No open requests or offers yet — be the first to post on Tebnu.
              </div>
            ) : (
              activityItems.slice(0, 8).map((item) => {
                const typeId = landingActivityTypeId(item.kind);
                const locationLabel =
                  item.detailPoints.find((point) => point.kind === "location")?.value ?? null;
                const detailPoints = landingVisibleDetailPoints(item.detailPoints)
                  .filter((point) => point.kind !== "location")
                  .slice(0, 4);
                const mediaBadgePoints = landingMediaBadgePoints(item.detailPoints).filter(
                  (point) => point.kind !== "location",
                );
                const postedAgo = formatPostedAgo(item.created_at);
                return (
                  <Link
                    key={`${item.kind}-${item.id}`}
                    to={item.href}
                    state={
                      item.feedTarget === "request"
                        ? communityFeedRequestScrollState(item.id)
                        : communityFeedScrollState(item.id)
                    }
                    className={cn(
                      "group flex min-h-[320px] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-lg shadow-slate-900/10 ring-1 ring-slate-100 transition-shadow duration-300 hover:shadow-xl hover:shadow-slate-900/15 dark:bg-zinc-800 dark:shadow-black/30 dark:ring-0 dark:hover:shadow-black/40",
                    )}
                  >
                    <div className="flex items-start gap-3 px-4 pt-3.5 pb-5">
                      {item.authorPhotoUrl ? (
                        <Avatar className="h-16 w-16 shrink-0 ring-2 ring-white dark:ring-0">
                          <AvatarImage src={item.authorPhotoUrl} alt="" />
                          <AvatarFallback className="text-base font-bold">
                            {item.authorInitials}
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <div
                          className={cn(
                            "flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-base font-bold text-white ring-2 ring-white dark:ring-0",
                            landingCategoryGradient(item.categoryId),
                          )}
                        >
                          {item.authorInitials}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-start justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-1">
                            <h3 className="truncate text-base font-bold leading-tight text-slate-900 transition-colors group-hover:text-primary dark:text-zinc-100 lg:text-[17px]">
                              {item.authorName}
                            </h3>
                            {item.authorVerified ? (
                              <BadgeCheck
                                className="h-[18px] w-[18px] shrink-0 fill-sky-500 text-white"
                                aria-label="Verified"
                              />
                            ) : null}
                          </div>
                          <span
                            className={cn(
                              "shrink-0 text-[11px] font-bold uppercase tracking-wide",
                              globalFeedPostTypeAccentClass(typeId),
                            )}
                          >
                            {landingActivityTypeLabel(item.kind)}
                          </span>
                        </div>
                        {locationLabel ? (
                          <p className="mt-1 truncate text-xs font-medium text-slate-500 dark:text-zinc-400">
                            {locationLabel}
                          </p>
                        ) : null}
                        {postedAgo ? (
                          <time
                            dateTime={item.created_at}
                            className="mt-1 block text-xs font-medium tabular-nums text-slate-500 dark:text-zinc-400"
                          >
                            Posted {postedAgo}
                          </time>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-1 flex-col px-4 pb-3">
                      <p className="mb-2 flex items-center justify-start gap-2 text-sm font-bold uppercase tracking-wide text-slate-900 dark:text-zinc-100 md:text-base">
                        <LandingCategoryIcon
                          categoryId={item.categoryId}
                          customCategory={item.customCategory}
                        />
                        <span className="min-w-0 truncate">{item.roleLabel}</span>
                      </p>
                      <p className="line-clamp-4 text-sm leading-relaxed text-slate-800 dark:text-zinc-300 lg:text-[15px]">
                        {item.description}
                      </p>
                      {item.mediaUrl ? (
                        <LandingActivityMedia
                          src={item.mediaUrl}
                          kind={item.mediaKind === "video" ? "video" : "image"}
                        >
                          {mediaBadgePoints.length > 0 ? (
                            <div className="absolute right-2 top-2 max-w-[72%] rounded-xl bg-white/40 px-2.5 py-1.5 shadow-sm ring-1 ring-white/50 backdrop-blur-md">
                              <ul className="space-y-1">
                                {mediaBadgePoints.map((point) => (
                                  <li
                                    key={point.key}
                                    className="flex items-center gap-1.5 text-[11px] font-semibold leading-tight text-slate-800"
                                  >
                                    <LandingActivityDetailIcon
                                      kind={point.kind}
                                      className="text-slate-700"
                                    />
                                    <span className="min-w-0 truncate">{point.value}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                        </LandingActivityMedia>
                      ) : detailPoints.length > 0 ? (
                        <div className="mt-auto grid grid-cols-2 gap-x-3.5 gap-y-2.5 pt-5">
                          {detailPoints.map((point) => (
                            <div
                              key={point.key}
                              className={cn(
                                "flex min-w-0 items-start gap-2 text-[13px] font-semibold leading-snug text-slate-600 dark:text-zinc-400 lg:text-sm",
                                point.kind === "notes" && "col-span-2",
                              )}
                            >
                              <LandingActivityDetailIcon
                                kind={point.kind}
                                className="mt-0.5 h-4 w-4 text-slate-400"
                              />
                              <span className="min-w-0 line-clamp-2">{point.value}</span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-auto border-t border-slate-100 px-4 py-3 dark:border-zinc-800">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          {item.rateLabel ? (
                            <>
                              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
                                Budget
                              </span>
                              <p
                                className={cn(
                                  "truncate text-base font-bold lg:text-lg",
                                  globalFeedPostTypeAccentClass(typeId),
                                )}
                              >
                                {item.rateLabel}
                              </p>
                            </>
                          ) : (
                            <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">Open request</p>
                          )}
                        </div>
                        <span
                          className={cn(
                            "inline-flex h-9 shrink-0 items-center justify-center rounded-lg px-3 text-[11px] font-bold uppercase tracking-wide text-white transition-opacity group-hover:opacity-95",
                            globalFeedPrimaryCtaClass(typeId),
                          )}
                        >
                          {landingActivityCtaLabel(item.kind, item.authorName)}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>

          {!activityLoading && activityItems.length > 0 ? (
            <div className="flex justify-center px-5 pb-4 sm:px-8 lg:px-12 xl:px-16">
              <Link
                to="/community/feed"
                className="inline-flex items-center gap-1.5 rounded-full bg-orange-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-orange-700"
              >
                {t("common.showMore")}
                <ArrowRight className="h-4 w-4" strokeWidth={2.4} />
              </Link>
            </div>
          ) : null}
        </div>

        {/* About our helpers — full-width horizontal scroll on large screens */}
        <div className="w-full pt-32 scroll-reveal opacity-0 translate-y-10 transition-all duration-1000 md:pt-40">
          <div className="mb-10 flex items-center justify-between gap-4 px-5 sm:px-8 lg:px-12 xl:px-16">
            <h2 className="text-2xl font-bold text-black dark:text-zinc-50 md:text-3xl">
              About our helpers
            </h2>
            <div className="hidden shrink-0 gap-2 md:flex">
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-full border-gray-200 bg-white/50 shadow-sm backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-800/70"
                onClick={() => scrollLeft(reviewsRef)}
              >
                <ChevronLeft className="h-5 w-5 text-gray-700 dark:text-zinc-200" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-full border-gray-200 bg-white/50 shadow-sm backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-800/70"
                onClick={() => scrollRight(reviewsRef)}
              >
                <ChevronRight className="h-5 w-5 text-gray-700 dark:text-zinc-200" />
              </Button>
            </div>
          </div>

          <div
            ref={reviewsRef}
            data-nosnippet
            className="flex w-full snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth pb-12 scrollbar-hide px-5 sm:gap-6 sm:px-8 lg:gap-7 lg:px-12 xl:px-16"
          >
            {reviewsLoading ? (
              <div className="flex min-h-[240px] w-full items-center justify-center text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : reviews.length === 0 ? (
              <div className="px-2 py-10 text-sm font-medium text-slate-500">
                Reviews from completed jobs will appear here as the community grows.
              </div>
            ) : (
              reviews.map((review) => {
                const helper = review.reviewee!;
                const helperName = helper.full_name?.trim() || "Helper";
                const reviewerName =
                  review.reviewer?.full_name?.trim() || "Community member";
                const reviewText =
                  review.review_text?.trim() ||
                  "Great experience working together on Tebnu.";

                return (
                  <article
                    key={review.id}
                    className="group relative mt-10 w-[min(88vw,320px)] shrink-0 snap-start rounded-3xl bg-white p-8 pt-14 shadow-xl transition-all duration-500 hover:shadow-2xl dark:bg-zinc-800 dark:shadow-black/40 sm:w-[360px] md:w-[400px] lg:w-[420px] xl:w-[440px]"
                  >
                    <Link
                      to={`/profile/${helper.id}`}
                      className="absolute -top-10 left-8 block h-20 w-20 rounded-full bg-gradient-to-br from-orange-400 to-red-500 p-1.5 shadow-xl transition-transform duration-500 group-hover:scale-110"
                      aria-label={`View ${helperName}'s profile`}
                    >
                      <Avatar className="h-full w-full">
                        <AvatarImage
                          src={helper.photo_url || undefined}
                          alt=""
                          className="object-cover"
                        />
                        <AvatarFallback className="bg-transparent text-2xl font-bold text-white">
                          {helperInitials(helperName)}
                        </AvatarFallback>
                      </Avatar>
                    </Link>

                    <div className="flex flex-col">
                      <div className="mb-4 flex items-center justify-between gap-4">
                        <Link
                          to={`/profile/${helper.id}`}
                          className="text-xl font-bold text-gray-900 transition-colors group-hover:text-primary dark:text-zinc-100"
                        >
                          {helperName}
                        </Link>
                        <div className="flex items-center gap-1.5 rounded-full border border-yellow-400/20 bg-yellow-400/10 px-3 py-1">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          <span className="text-[13px] font-black text-yellow-700 dark:text-yellow-400">
                            {Number(review.rating).toFixed(1)}
                          </span>
                        </div>
                      </div>
                      <p className="text-base italic leading-relaxed text-gray-700 dark:text-zinc-300 md:text-lg">
                        &ldquo;{reviewText}&rdquo;
                      </p>
                      <p className="mt-4 text-xs font-semibold text-slate-500 dark:text-zinc-400">
                        Reviewed by {reviewerName.split(" ")[0]}
                      </p>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </div>
      </main>

      <Footer />

      {/* Fixed bottom bar - Mobile only, shown when scrolled past */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-[var(--app-safe-bottom,env(safe-area-inset-bottom,0px))] z-40 bg-white/95 p-4 pt-3 pb-3 shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.1)] backdrop-blur-md transition-all duration-500 transform dark:bg-zinc-800/90 md:hidden",
          showMobileFixedButtons
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-10 pointer-events-none",
        )}
      >
        <div className="mx-auto flex flex-row items-center justify-center gap-2.5 px-1">
          <Button
            onClick={handleSearchingForJob}
            className="flex h-12 w-auto gap-2 rounded-[1.25rem] bg-gradient-to-r from-emerald-500 to-green-600 px-4 text-sm font-black tracking-tight text-white shadow-md shadow-emerald-500/20 hover:from-emerald-600 hover:to-green-700"
          >
            <HelpingHand className="h-8 w-8" strokeWidth={2.25} />
            {t("landing.offerHelp")}
          </Button>
          <Button
            onClick={handleHiringHelper}
            className="flex h-12 w-auto gap-2 rounded-[1.25rem] bg-gradient-to-r from-orange-500 to-red-600 px-4 text-sm font-black tracking-tight text-white shadow-md shadow-orange-500/20 hover:from-orange-600 hover:to-red-700"
          >
            <HeartHandshake className="h-8 w-8" strokeWidth={2.25} />
            {t("landing.needHelp")}
          </Button>
        </div>
      </div>
      {/* WhatsApp Floating Contact Button */}
      <WhatsAppButton
        phoneNumber="972541234567"
        message="Hi Tebnu! I have a question about your services."
        className="max-md:bottom-[calc(4.75rem+var(--app-safe-bottom,env(safe-area-inset-bottom,0px)))] md:bottom-28"
      />
    </div>
  );
}
