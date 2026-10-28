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
import { ContactUsButton } from "@/components/ContactUsButton";
import { Footer } from "@/components/Footer";
import { cn } from "@/lib/utils";
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE, usePageSeo } from "@/lib/seo";
import {
  communityFeedRequestScrollState,
  communityFeedScrollState,
} from "@/lib/communityFeedNav";
import {
  feedCategoryLabel,
  feedLocationDisplayLabel,
  globalFeedPostTypeAccentClass,
  globalFeedPrimaryCtaClass,
} from "@/lib/globalFeedPostUi";
import { useTranslation } from "react-i18next";
import { useLandingPagePreview } from "@/hooks/data/useLandingPagePreview";
import { LandingHeroCollage } from "@/components/landing/LandingHeroCollage";
import {
  HIRE_CATEGORY_TILE_UI,
  OTHER_HELP_SUBCATEGORY_UI,
  resolveHelpCategoryIconId,
} from "@/lib/discoverCategoryTileIcons";
import { isServiceCategoryId } from "@/lib/serviceCategories";
import { format, formatDistanceToNow } from "date-fns";
import { dateFnsLocaleFor } from "@/lib/dateFnsLocale";
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

function landingActivityTypeLabel(
  kind: LandingActivityKind,
  t: (key: string) => string,
): string {
  return t(kind === "request" ? "feed.postType.request_help" : "feed.postType.offer_service");
}

function landingActivityCtaLabel(
  kind: LandingActivityKind,
  authorName: string,
  t: (key: string, opts?: Record<string, string>) => string,
): string {
  if (kind === "request") return t("feed.global.offerHelp");
  const first = authorName.trim().split(/\s+/)[0] || t("feed.defaultUser");
  return t("feed.global.messageName", { name: first });
}

function normalizeDetailToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
}

function landingActivityDetailValue(
  point: IsolatedFeedDetailRow,
  t: (key: string, opts?: { defaultValue?: string }) => string,
  language: string,
): string {
  if (point.dateIso) {
    const parsed = new Date(point.dateIso);
    if (!Number.isNaN(parsed.getTime())) {
      return format(parsed, "EEEE, d MMMM, HH:mm", {
        locale: dateFnsLocaleFor(language),
      });
    }
  }

  const token = normalizeDetailToken(point.token || point.value);
  const raw = point.value.toLowerCase();

  if (point.kind === "when") {
    if (token === "later_today") return t("landing.availability.laterToday");
    if (token === "now" && raw.includes("available")) {
      return t("landing.availability.now");
    }
    if (token === "this_week" && raw.includes("available")) {
      return t("landing.availability.thisWeek");
    }
    return t(`createJob.when.options.${token}`, { defaultValue: point.value });
  }

  if (point.kind === "duration" || point.kind === "shift") {
    const durationToken = token === "1_2h" ? "1_2_hours" : token;
    if (durationToken === "emergency") return t("landing.quickDetails.emergency");
    if (durationToken === "recurring") return t("landing.quickDetails.recurring");
    return t(`createJob.timeDuration.${durationToken}`, {
      defaultValue: point.value,
    });
  }

  if (point.kind === "frequency") {
    return t(`createJob.careFrequency.${token}`, { defaultValue: point.value });
  }

  return point.value;
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

function LandingActivityDescription({ text }: { text: string }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = textRef.current;
    if (!el || expanded) return;
    setCanExpand(el.scrollHeight > el.clientHeight + 1);
  }, [text, expanded]);

  return (
    <div>
      <p
        ref={textRef}
        className={cn(
          "text-base leading-relaxed text-slate-800 dark:text-zinc-300 md:text-sm lg:text-[15px]",
          !expanded && "line-clamp-2",
        )}
      >
        {text}
      </p>
      {canExpand || expanded ? (
        <button
          type="button"
          className="mt-1.5 inline-flex rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-bold text-orange-600 transition-colors hover:bg-orange-100 dark:bg-orange-500/15 dark:text-orange-300 dark:hover:bg-orange-500/25"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setExpanded((open) => !open);
          }}
        >
          {expanded ? t("common.showLess") : t("landing.activityMore")}
        </button>
      ) : null}
    </div>
  );
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
  useEffect(() => {
    const href = "/Cozy Bedtime Storytelling Moment.png";
    if (document.querySelector(`link[rel="preload"][href="${href}"]`)) return;
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "image";
    link.href = href;
    link.fetchPriority = "high";
    document.head.appendChild(link);
  }, []);
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isDarkTheme = false;
  useEffect(() => {
    const root = document.documentElement;
    const restoreDark = root.classList.contains("dark");
    const previousColorScheme = root.style.colorScheme;
    root.classList.remove("dark");
    root.style.colorScheme = "light";
    return () => {
      if (restoreDark) root.classList.add("dark");
      root.style.colorScheme = previousColorScheme;
    };
  }, []);
  const buttonsRef = useRef<HTMLDivElement>(null);
  const mobileHeroButtonsRef = useRef<HTMLDivElement>(null);
  const reviewsRef = useRef<HTMLDivElement>(null);
  const activityRef = useRef<HTMLDivElement>(null);
  const showcaseSwipeRef = useRef({
    startX: 0,
    pointerId: null as number | null,
    dragged: false,
  });
  const showcaseWheelLockRef = useRef(false);
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

  function stepShowcase(direction: -1 | 1) {
    setActiveCategoryIndex(
      (index) =>
        (index + direction + showcaseCategories.length) %
        showcaseCategories.length,
    );
  }

  function onShowcasePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("button")) return;
    showcaseSwipeRef.current = {
      startX: event.clientX,
      pointerId: event.pointerId,
      dragged: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onShowcasePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const swipe = showcaseSwipeRef.current;
    if (swipe.pointerId !== event.pointerId) return;
    if (Math.abs(event.clientX - swipe.startX) > 12) swipe.dragged = true;
  }

  function onShowcasePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const swipe = showcaseSwipeRef.current;
    if (swipe.pointerId !== event.pointerId) return;
    const dx = event.clientX - swipe.startX;
    const dragged = swipe.dragged;
    showcaseSwipeRef.current = { startX: 0, pointerId: null, dragged: false };
    if (!dragged || Math.abs(dx) < 48) return;
    event.preventDefault();
    stepShowcase(dx < 0 ? 1 : -1);
  }

  function onShowcaseWheel(event: React.WheelEvent<HTMLDivElement>) {
    if (Math.abs(event.deltaX) < 24 || Math.abs(event.deltaX) <= Math.abs(event.deltaY)) {
      return;
    }
    event.preventDefault();
    if (showcaseWheelLockRef.current) return;
    showcaseWheelLockRef.current = true;
    stepShowcase(event.deltaX > 0 ? 1 : -1);
    window.setTimeout(() => {
      showcaseWheelLockRef.current = false;
    }, 420);
  }

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
        hideThemeToggle
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
        <div className="flex flex-wrap items-center justify-center gap-2.5 rounded-2xl bg-white/95 p-2 pl-2.5 pr-2 shadow-2xl backdrop-blur-xl dark:bg-zinc-800/90">
          <Button
            onClick={handleSearchingForJob}
            className="h-auto min-h-12 gap-2 whitespace-normal rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 px-5 py-2 text-sm font-bold leading-tight text-white shadow-md hover:from-emerald-600 hover:to-green-700"
          >
            <HelpingHand className="h-7 w-7 shrink-0" strokeWidth={2.25} />
            <span>{t("landing.offerHelp")}</span>
          </Button>
          <Button
            onClick={handleHiringHelper}
            className="h-auto min-h-12 gap-2 whitespace-normal rounded-xl bg-gradient-to-r from-orange-500 to-red-600 px-5 py-2 text-sm font-bold leading-tight text-white shadow-md hover:from-orange-600 hover:to-red-700"
          >
            <HeartHandshake className="h-7 w-7 shrink-0" strokeWidth={2.25} />
            <span>{t("landing.needHelp")}</span>
          </Button>
          <span
            className="mx-0.5 hidden h-8 w-px bg-gradient-to-b from-transparent via-slate-300 to-transparent dark:via-white/20 sm:block"
            aria-hidden
          />
          <ContactUsButton variant="dock" />
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
            <div data-nosnippet>
              <LandingHeroCollage
                embedded
                posts={heroPosts}
                loading={heroPostsLoading}
                className="relative left-1/2 z-0 w-screen max-w-[100vw] -translate-x-1/2"
                heroActions={
                  <div ref={mobileHeroButtonsRef} className="flex w-full flex-col gap-3">
                    <Button
                      type="button"
                      onClick={handleHiringHelper}
                      className="flex h-14 w-full items-center justify-between gap-3 whitespace-normal rounded-2xl bg-gradient-to-r from-orange-500 to-red-600 px-4 text-left text-lg font-black leading-tight text-white shadow-lg transition-all hover:from-orange-600 hover:to-red-700 active:scale-[0.98]"
                    >
                      <span className="flex min-w-0 items-center justify-start gap-2.5">
                        <HeartHandshake className="h-7 w-7 shrink-0" strokeWidth={2.25} aria-hidden />
                        <span className="whitespace-pre-line">{t("landing.needHelp")}</span>
                      </span>
                      <ChevronRight className="h-6 w-6 shrink-0 rtl:rotate-180" strokeWidth={2.5} aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      onClick={handleSearchingForJob}
                      className="flex h-14 w-full items-center justify-between gap-3 whitespace-normal rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 px-4 text-left text-lg font-black leading-tight text-white shadow-lg transition-all hover:from-emerald-600 hover:to-green-700 active:scale-[0.98]"
                    >
                      <span className="flex min-w-0 items-center justify-start gap-2.5">
                        <HelpingHand className="h-7 w-7 shrink-0" strokeWidth={2.25} aria-hidden />
                        <span className="whitespace-pre-line">{t("landing.offerHelp")}</span>
                      </span>
                      <ChevronRight className="h-6 w-6 shrink-0 rtl:rotate-180" strokeWidth={2.5} aria-hidden />
                    </Button>
                  </div>
                }
              />
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
              <div className="flex min-w-0 flex-1 items-stretch overflow-hidden bg-white dark:bg-zinc-800">
                <div className="relative w-44 shrink-0 self-stretch sm:w-52 lg:w-60">
                  <img
                    src="/ChatGPT Image Aug 31, 2026, 08_52_25 AM.png"
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover object-center"
                  />
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-center px-5 py-3.5 lg:px-6 lg:py-4">
                  <div className="flex items-start justify-between gap-6">
                    <p className="min-w-0 text-base font-bold leading-snug text-slate-900 dark:text-zinc-100 md:text-lg">
                      {t("landing.postsTitle")}
                    </p>
                    <p className="flex shrink-0 flex-wrap items-center justify-end gap-x-5 text-base font-semibold text-slate-600 dark:text-zinc-300">
                      <span className="inline-flex items-center gap-1.5">
                        <BadgeCheck className="h-5 w-5 text-orange-500" strokeWidth={2.2} aria-hidden />
                        {t("landing.verifiedUsers")}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-5 w-5 text-orange-500" strokeWidth={2.2} aria-hidden />
                        {t("landing.localHelpers")}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="h-5 w-5 text-orange-500" strokeWidth={2.2} aria-hidden />
                        {t("landing.fastResponse")}
                      </span>
                    </p>
                  </div>
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
          className="relative w-full scroll-reveal opacity-0 translate-y-10 pt-16 pb-28 transition-all duration-1000 delay-200 md:pt-28 md:pb-36 lg:pt-36 lg:pb-44"
          aria-labelledby="how-it-works-heading"
        >
          <svg
            className="block h-14 w-full text-primary md:h-16"
            viewBox="0 0 375 56"
            preserveAspectRatio="none"
            aria-hidden
          >
            <path
              fill="currentColor"
              d="M0 56V22C70 50 128-4 198 26C268 54 322 8 375 30V56Z"
            />
          </svg>
          <div className="bg-primary px-5 pb-28 pt-8 sm:px-8 sm:pb-32 sm:pt-12 lg:px-12 lg:pb-36">
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
                    className="mb-4 h-40 w-40 object-contain"
                  />
                  <h3 className="mb-2 text-2xl font-bold leading-tight text-slate-900 dark:text-zinc-100">
                    {t(`landing.steps.${step.step}.title`)}
                  </h3>
                  <p className="text-lg font-medium leading-relaxed text-slate-500 dark:text-zinc-400">
                    {t(`landing.steps.${step.step}.desc`)}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Interactive Job Category Showcase — centered 3-up carousel */}
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
              <div className="relative mx-auto w-full max-w-[90rem] px-4 sm:px-8">
                <div
                  className="flex cursor-grab items-center justify-center gap-3 select-none touch-pan-y active:cursor-grabbing sm:gap-4 md:gap-5 lg:gap-6"
                  onPointerDown={onShowcasePointerDown}
                  onPointerMove={onShowcasePointerMove}
                  onPointerUp={onShowcasePointerUp}
                  onPointerCancel={onShowcasePointerUp}
                  onWheel={onShowcaseWheel}
                >
                  {(() => {
                    const count = showcaseCategories.length;
                    const slots = [
                      {
                        idx: (activeCategoryIndex - 1 + count) % count,
                        role: "left" as const,
                      },
                      { idx: activeCategoryIndex, role: "center" as const },
                      {
                        idx: (activeCategoryIndex + 1) % count,
                        role: "right" as const,
                      },
                    ];
                    return slots.map(({ idx, role }) => {
                      const cat = showcaseCategories[idx];
                      const isCenter = role === "center";
                      const copy = experienceCopy(cat.id);
                      return (
                        <div
                          key={`${role}-${cat.id}`}
                          role={isCenter ? undefined : "button"}
                          tabIndex={isCenter ? undefined : 0}
                          onClick={
                            isCenter
                              ? undefined
                              : () => {
                                  if (showcaseSwipeRef.current.dragged) return;
                                  setActiveCategoryIndex(idx);
                                }
                          }
                          onKeyDown={
                            isCenter
                              ? undefined
                              : (event) => {
                                  if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    setActiveCategoryIndex(idx);
                                  }
                                }
                          }
                          className={cn(
                            "group relative overflow-hidden rounded-[1.75rem] bg-slate-100 text-left shadow-[0_24px_48px_-16px_rgba(0,0,0,0.28)] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                            isCenter
                              ? "z-20 w-[min(72vw,28rem)] sm:w-[30rem] md:w-[32rem] lg:w-[34rem]"
                              : "z-10 w-[min(28vw,15rem)] cursor-pointer sm:w-[16.5rem] md:w-[18rem] lg:w-[20rem]",
                          )}
                        >
                          <div className="relative aspect-[4/3] w-full">
                            {cat.id === "special_video" ? (
                              <video
                                autoPlay={isCenter}
                                loop
                                muted
                                playsInline
                                ref={(el) => {
                                  if (!el) return;
                                  if (isCenter) void el.play();
                                  else el.pause();
                                }}
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
                            {!isCenter ? (
                              <div className="absolute inset-0 z-[12] bg-white/55 dark:bg-zinc-200/45" />
                            ) : null}

                            <div className="absolute inset-x-3 bottom-3 z-20 sm:inset-x-5 sm:bottom-5">
                              <div className="mb-1.5 flex items-center gap-2.5">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/20 p-2.5 text-white backdrop-blur-md md:h-14 md:w-14 md:p-3">
                                  {React.cloneElement(
                                    cat.icon as React.ReactElement,
                                    { className: "h-full w-full text-white" },
                                  )}
                                </div>
                                <h3 className="text-lg font-black uppercase leading-none tracking-tighter text-white drop-shadow-md md:text-3xl">
                                  {copy.title}
                                </h3>
                              </div>
                              {isCenter ? (
                                <p className="line-clamp-2 max-w-[70%] text-sm font-medium leading-snug text-white/90 drop-shadow-sm md:text-base">
                                  {copy.blurb}
                                </p>
                              ) : null}
                            </div>

                            {isCenter ? (
                              <Button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleHiringHelper();
                                }}
                                className="absolute bottom-3 right-3 z-30 h-10 rounded-full bg-primary px-4 text-sm font-bold text-white shadow-lg shadow-primary/25 hover:bg-primary/90 sm:bottom-5 sm:right-5 sm:h-11 sm:px-5"
                              >
                                {copy.cta}
                              </Button>
                            ) : null}

                            {role === "left" ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Previous category"
                                className="absolute right-2 top-1/2 z-30 h-10 w-10 -translate-y-1/2 rounded-full border-0 bg-white text-slate-900 shadow-lg shadow-slate-900/15 ring-1 ring-black/5 hover:scale-105 hover:bg-white active:scale-95 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-white/10 md:h-12 md:w-12"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setActiveCategoryIndex(
                                    (index) =>
                                      (index - 1 + showcaseCategories.length) %
                                      showcaseCategories.length,
                                  );
                                }}
                              >
                                <ChevronLeft className="h-5 w-5 md:h-6 md:w-6" />
                              </Button>
                            ) : null}
                            {role === "right" ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Next category"
                                className="absolute left-2 top-1/2 z-30 h-10 w-10 -translate-y-1/2 rounded-full border-0 bg-white text-slate-900 shadow-lg shadow-slate-900/15 ring-1 ring-black/5 hover:scale-105 hover:bg-white active:scale-95 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-white/10 md:h-12 md:w-12"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setActiveCategoryIndex(
                                    (index) =>
                                      (index + 1) % showcaseCategories.length,
                                  );
                                }}
                              >
                                <ChevronRight className="h-5 w-5 md:h-6 md:w-6" />
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
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

              </div>
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <div className="scroll-reveal pb-16 opacity-0 translate-y-10 transition-all duration-1000 md:pb-24">
          <Benefits />
        </div>

        {/* Recent Activity is temporarily hidden from the landing page. */}
        {false && (
        <div className="w-full pt-20 scroll-reveal opacity-0 translate-y-10 transition-all duration-1000 md:pt-28">
          <div className="mb-10 flex items-center justify-between gap-4 px-5 sm:px-8 lg:px-12 xl:px-16">
            <h2 className="text-2xl font-bold text-black dark:text-zinc-50 md:text-3xl">
              Recent Activity
            </h2>
            <div className="hidden shrink-0 gap-2 md:flex">
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-full border-gray-200 bg-white/50 shadow-sm backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-800/70"
                onClick={() => scrollLeft(activityRef)}
              >
                <ChevronLeft className="h-5 w-5 text-gray-700 dark:text-zinc-200" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-full border-gray-200 bg-white/50 shadow-sm backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-800/70"
                onClick={() => scrollRight(activityRef)}
              >
                <ChevronRight className="h-5 w-5 text-gray-700 dark:text-zinc-200" />
              </Button>
            </div>
          </div>

          <div
            ref={activityRef}
            data-nosnippet
            className="flex w-full snap-x snap-mandatory items-stretch gap-4 overflow-x-auto scroll-smooth overscroll-x-contain px-5 pb-8 scrollbar-hide md:gap-6 md:px-8 lg:gap-7 lg:px-12 xl:px-16"
          >
            {activityLoading ? (
              <div className="flex min-h-[220px] w-full shrink-0 items-center justify-center text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : activityItems.length === 0 ? (
              <div className="w-full shrink-0 px-2 py-10 text-sm font-medium text-slate-500 dark:text-zinc-400">
                No open requests or offers yet — be the first to post on Tebnu.
              </div>
            ) : (
              activityItems.slice(0, 12).map((item) => {
                const typeId = landingActivityTypeId(item.kind);
                const locationLabel = feedLocationDisplayLabel(
                  t,
                  item.detailPoints.find((point) => point.kind === "location")?.value ?? null,
                );
                const detailPoints = landingVisibleDetailPoints(item.detailPoints)
                  .filter((point) => point.kind !== "location")
                  .slice(0, 2);
                const mediaBadgePoints = landingMediaBadgePoints(item.detailPoints).filter(
                  (point) => point.kind !== "location",
                );
                const createdAt = new Date(item.created_at);
                const postedAgo = Number.isNaN(createdAt.getTime())
                  ? null
                  : formatDistanceToNow(createdAt, {
                      addSuffix: true,
                      locale: dateFnsLocaleFor(i18n.language),
                    });
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
                      "group flex min-h-[320px] w-[min(84vw,22.5rem)] shrink-0 snap-start flex-col overflow-hidden rounded-[1.75rem] bg-white shadow-[0_22px_44px_-20px_rgba(15,23,42,0.32)] ring-1 ring-slate-100/90 transition-shadow duration-300 hover:shadow-xl hover:shadow-slate-900/15 dark:bg-zinc-800 dark:shadow-black/40 dark:ring-0 dark:hover:shadow-black/50 md:w-[22.5rem] md:shadow-lg md:shadow-slate-900/10 lg:w-[23.5rem]",
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
                          <div className="flex min-w-0 flex-1 flex-col gap-1 leading-tight">
                            <div className="flex min-w-0 items-center gap-1">
                              <h3 className="truncate text-lg font-bold leading-tight text-slate-900 transition-colors group-hover:text-primary dark:text-zinc-100 md:text-base lg:text-[17px]">
                                {item.authorName}
                              </h3>
                              {item.authorVerified ? (
                                <BadgeCheck
                                  className="h-[18px] w-[18px] shrink-0 fill-sky-500 text-white"
                                  aria-label="Verified"
                                />
                              ) : null}
                            </div>
                            {locationLabel ? (
                              <p className="truncate text-sm font-medium leading-tight text-slate-500 dark:text-zinc-400 md:text-xs">
                                {locationLabel}
                              </p>
                            ) : null}
                          </div>
                          <span
                            className={cn(
                              "shrink-0 text-xs font-bold uppercase tracking-wide md:text-[11px]",
                              globalFeedPostTypeAccentClass(typeId),
                            )}
                          >
                            {landingActivityTypeLabel(item.kind, t)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-1 flex-col px-4 pb-3">
                      <p className="mb-2 flex items-center justify-start gap-2 text-base font-bold uppercase tracking-wide text-slate-900 dark:text-zinc-100 md:text-sm lg:text-base">
                        <LandingCategoryIcon
                          categoryId={item.categoryId}
                          customCategory={item.customCategory}
                        />
                        <span className="min-w-0 truncate">
                          {feedCategoryLabel(t, item.categoryId, item.customCategory)}
                        </span>
                      </p>
                      <LandingActivityDescription text={item.description} />
                      {postedAgo ? (
                        <time
                          dateTime={item.created_at}
                          className="mt-2 block text-sm font-medium tabular-nums text-slate-500 dark:text-zinc-400 md:text-xs"
                        >
                          {t("landing.postedAgo", { ago: postedAgo })}
                        </time>
                      ) : null}
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
                                    className="flex items-center gap-1.5 text-xs font-semibold leading-tight text-slate-800 md:text-[11px]"
                                  >
                                    <LandingActivityDetailIcon
                                      kind={point.kind}
                                      className="text-slate-700"
                                    />
                                    <span className="min-w-0 truncate">
                                      {landingActivityDetailValue(point, t, i18n.language)}
                                    </span>
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
                                "flex min-w-0 items-start gap-2 text-[15px] font-semibold leading-snug text-slate-600 dark:text-zinc-400 md:text-[13px] lg:text-sm",
                                point.kind === "notes" && "col-span-2",
                              )}
                            >
                              <LandingActivityDetailIcon
                                kind={point.kind}
                                className="mt-0.5 h-5 w-5 text-slate-400 md:h-4 md:w-4"
                              />
                              <span className="min-w-0 line-clamp-2">
                                {landingActivityDetailValue(point, t, i18n.language)}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-auto px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          {item.rateLabel ? (
                            <>
                              <span className="block text-xs font-bold uppercase leading-none tracking-widest text-slate-400 dark:text-zinc-500 md:text-[10px]">
                                {t("createJob.budget.label")}
                              </span>
                              <p
                                className={cn(
                                  "mt-0.5 truncate text-lg font-bold leading-none md:text-base lg:text-lg",
                                  globalFeedPostTypeAccentClass(typeId),
                                )}
                              >
                                {item.rateLabel}
                              </p>
                            </>
                          ) : null}
                        </div>
                        <span
                          className={cn(
                            "inline-flex h-11 shrink-0 items-center justify-center rounded-lg px-4 text-sm font-bold uppercase tracking-wide text-white transition-opacity group-hover:opacity-95 md:h-9 md:px-3 md:text-[11px]",
                            globalFeedPrimaryCtaClass(typeId),
                          )}
                        >
                          {landingActivityCtaLabel(item.kind, item.authorName, t)}
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
        )}

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
                const reviewText = review.review_text?.trim() || "";

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
                      {reviewText ? (
                        <p className="text-base italic leading-relaxed text-gray-700 dark:text-zinc-300 md:text-lg">
                          &ldquo;{reviewText}&rdquo;
                        </p>
                      ) : null}
                      <div className="mt-4 flex items-center gap-2">
                        <Avatar className="h-7 w-7 ring-1 ring-slate-200 dark:ring-zinc-700">
                          <AvatarImage
                            src={review.reviewer?.photo_url || undefined}
                            alt=""
                            className="object-cover"
                          />
                          <AvatarFallback className="bg-slate-100 text-[10px] font-bold text-slate-600 dark:bg-zinc-700 dark:text-zinc-200">
                            {helperInitials(reviewerName)}
                          </AvatarFallback>
                        </Avatar>
                        <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                          Reviewed by {reviewerName.split(" ")[0]}
                        </p>
                      </div>
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
          "fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.5rem,var(--app-safe-bottom,env(safe-area-inset-bottom,0px)))] transition-all duration-500 md:hidden",
          showMobileFixedButtons
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-full opacity-0",
        )}
      >
        <div className="flex overflow-hidden rounded-[1.35rem] bg-[linear-gradient(90deg,#10b981_0%,#22c55e_46%,#fb923c_54%,#ea580c_100%)] shadow-lg">
          <Button
            onClick={handleSearchingForJob}
            className="flex min-h-16 min-w-0 flex-1 items-center justify-start gap-2.5 rounded-none bg-transparent px-4 text-left text-sm font-black leading-tight tracking-tight text-white shadow-none hover:bg-black/10"
          >
            <HelpingHand className="h-7 w-7 shrink-0" strokeWidth={2.25} aria-hidden />
            <span className="min-w-0 whitespace-pre-line text-left">{t("landing.offerHelp")}</span>
          </Button>
          <Button
            onClick={handleHiringHelper}
            className="flex min-h-16 min-w-0 flex-1 items-center justify-start gap-2.5 rounded-none bg-transparent px-4 text-left text-sm font-black leading-tight tracking-tight text-white shadow-none hover:bg-black/10"
          >
            <HeartHandshake className="h-7 w-7 shrink-0" strokeWidth={2.25} aria-hidden />
            <span className="min-w-0 whitespace-pre-line text-left">{t("landing.needHelp")}</span>
          </Button>
        </div>
      </div>
      <ContactUsButton
        phoneNumber="972541234567"
        message="Hi Tebnu! I have a question about your services."
        className={cn(showFixedButtons && "md:hidden")}
      />
    </div>
  );
}
