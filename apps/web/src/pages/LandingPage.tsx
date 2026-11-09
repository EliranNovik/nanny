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
  MessageCircle,
} from "lucide-react";
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
import { useForceLightTheme } from "@/context/ThemeContext";
import { useLandingPagePreview } from "@/hooks/data/useLandingPagePreview";
import { LandingCreamHero } from "@/components/landing/LandingCreamHero";
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
    image: "/images/how-it-works/screen-categories.webp",
    tone: "orange",
  },
  {
    step: 2,
    image: "/images/how-it-works/screen-offer-help.webp",
    tone: "mint",
  },
  {
    step: 3,
    image: "/images/how-it-works/screen-profiles.webp",
    tone: "orange",
  },
] as const;

const SUPPORTING_FEATURES = [
  { id: "browse", image: "/images/how-it-works/screen-find-help.webp", icon: Users },
  { id: "community", image: "/images/how-it-works/screen-community.webp", icon: CalendarDays },
  { id: "messages", image: "/images/how-it-works/screen-messages-v3.webp", icon: MessageCircle },
] as const;

function SupportingFeatureScreen({
  feature,
  className,
}: {
  feature: (typeof SUPPORTING_FEATURES)[number];
  className?: string;
}) {
  return (
    <div className={cn("relative mx-auto h-[31rem] w-[15rem] rounded-[3rem] border-[3px] border-zinc-500 bg-gradient-to-r from-zinc-950 via-zinc-700 to-black p-[7px] shadow-[0_32px_45px_-20px_rgba(24,24,27,0.48)]", className)}>
      <span className="absolute -left-[6px] top-24 h-12 w-[4px] rounded-l bg-zinc-700" aria-hidden />
      <span className="absolute -right-[6px] top-32 h-20 w-[4px] rounded-r bg-zinc-700" aria-hidden />
      <div className="h-full overflow-hidden rounded-[2.45rem] bg-white">
        <img src={feature.image} alt="" className="h-full w-full object-cover" loading="lazy" />
      </div>
    </div>
  );
}

function SupportingConnectionsSection() {
  const { t } = useTranslation();
  const [activeFeature, setActiveFeature] = useState<(typeof SUPPORTING_FEATURES)[number]["id"]>("browse");
  const active = SUPPORTING_FEATURES.find((feature) => feature.id === activeFeature) ?? SUPPORTING_FEATURES[0];

  return (
    <section className="scroll-reveal px-5 py-20 opacity-0 translate-y-10 transition-all duration-1000 sm:px-8 md:py-28 lg:px-12">
      <div className="relative mx-auto max-w-[82rem] px-0 py-6 sm:px-2 lg:py-10">
        <div className="pointer-events-none absolute -right-24 -top-32 h-96 w-96 rounded-full bg-orange-300/42 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute bottom-[-12rem] right-[18%] h-96 w-96 rounded-full bg-emerald-300/38 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute right-[8%] top-[28%] h-[30rem] w-[30rem] rounded-full bg-violet-500/28 blur-2xl" aria-hidden />

        <div className="relative max-w-4xl">
          <div className="flex items-center gap-3">
            <span className="h-px w-10 bg-orange-500" aria-hidden />
            <p className="text-xs font-black uppercase tracking-[0.3em] text-orange-600">{t("landing.supporting.eyebrow")}</p>
          </div>
          <h2 className="mt-5 text-4xl font-black leading-[0.96] tracking-[-0.05em] text-zinc-950 md:text-6xl">{t("landing.supporting.title")}</h2>
          <p className="mt-5 max-w-2xl text-lg font-medium leading-relaxed text-zinc-600">{t("landing.supporting.subtitle")}</p>
        </div>

        <div className="relative mt-14 hidden items-stretch gap-10 md:grid md:grid-cols-[minmax(0,0.95fr)_minmax(25rem,1.05fr)] lg:gap-16">
          <div className="flex flex-col justify-center space-y-3">
            {SUPPORTING_FEATURES.map((feature) => {
              const Icon = feature.icon;
              const selected = feature.id === activeFeature;
              const index = SUPPORTING_FEATURES.findIndex((item) => item.id === feature.id) + 1;
              return (
                <button
                  key={feature.id}
                  type="button"
                  onClick={() => setActiveFeature(feature.id)}
                  className={cn(
                    "group relative flex w-full items-center gap-4 border-0 bg-transparent py-5 pl-5 pr-3 text-left transition-all duration-300",
                    selected
                      ? "translate-x-2"
                      : "opacity-70 hover:translate-x-1 hover:opacity-100",
                  )}
                >
                  <span className={cn("absolute inset-y-3 left-0 w-1 rounded-r-full bg-orange-500 transition-opacity", selected ? "opacity-100" : "opacity-0")} aria-hidden />
                  <span
                    className={cn(
                      "flex h-16 w-16 shrink-0 items-center justify-center transition-all duration-300 lg:h-20 lg:w-20",
                      selected
                        ? "scale-110 text-orange-600"
                        : feature.id === "browse"
                          ? "text-emerald-600"
                          : feature.id === "community"
                            ? "text-amber-600"
                            : "text-orange-600",
                    )}
                  >
                    <Icon className="h-9 w-9 lg:h-10 lg:w-10" strokeWidth={1.7} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="mb-1 block text-sm font-black uppercase tracking-[0.18em] text-zinc-400">0{index}</span>
                    <span className="block text-lg font-black tracking-[-0.025em] text-zinc-950 lg:text-xl">{t(`landing.supporting.${feature.id}.title`)}</span>
                    <span className="mt-1.5 block max-w-xl text-sm font-medium leading-relaxed text-zinc-600">{t(`landing.supporting.${feature.id}.description`)}</span>
                  </span>
                  <ChevronRight className={cn("h-5 w-5 shrink-0 transition-all", selected ? "translate-x-0 text-orange-500 opacity-100" : "-translate-x-2 text-zinc-300 opacity-0 group-hover:translate-x-0 group-hover:opacity-100")} />
                </button>
              );
            })}
          </div>
          <div className="relative flex min-h-[41rem] items-center justify-center overflow-visible p-8">
            <div className="absolute left-8 top-8 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              {t(`landing.supporting.${active.id}.title`)}
            </div>
            <div className="absolute left-1/2 top-1/2 h-[32rem] w-[32rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(253,186,116,0.18),rgba(167,243,208,0.1)_45%,transparent_70%)]" aria-hidden />
            <div className="absolute bottom-12 left-1/2 h-16 w-64 -translate-x-1/2 rounded-full bg-zinc-900/15 blur-2xl" aria-hidden />
            <div key={active.id} className="animate-in fade-in zoom-in-95 slide-in-from-right-4 duration-500">
              <SupportingFeatureScreen feature={active} className="h-[37rem] w-[17.75rem]" />
            </div>
          </div>
        </div>

        <div className="mt-10 space-y-12 md:hidden">
          {SUPPORTING_FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <article key={feature.id} className="rounded-[2rem] border border-zinc-200/80 bg-white/70 p-5 shadow-[0_20px_50px_-38px_rgba(24,24,27,0.35)]">
                <div className="mb-6 flex items-start gap-3">
                  <span
                    className={cn(
                      "flex h-14 w-14 shrink-0 items-center justify-center",
                      feature.id === "browse"
                        ? "text-emerald-600"
                        : feature.id === "community"
                          ? "text-amber-600"
                          : "text-orange-600",
                    )}
                  >
                    <Icon className="h-8 w-8" strokeWidth={1.7} />
                  </span>
                  <div>
                    <h3 className="text-xl font-black text-zinc-950">{t(`landing.supporting.${feature.id}.title`)}</h3>
                    <p className="mt-1 text-sm font-medium leading-relaxed text-zinc-600">{t(`landing.supporting.${feature.id}.description`)}</p>
                  </div>
                </div>
                <SupportingFeatureScreen feature={feature} />
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

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
  // Dark mode is intentionally disabled on the landing page for now.
  useForceLightTheme();
  const buttonsRef = useRef<HTMLDivElement | null>(null);
  const mobileHeroButtonsRef = useRef<HTMLDivElement | null>(null);
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
  const { activityLoading, activityItems, reviewsLoading, reviews } =
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
    const updateHeaderSurface = () => {
      setHeroScrolledPast(window.scrollY > 24);
    };
    updateHeaderSurface();
    window.addEventListener("scroll", updateHeaderSurface, { passive: true });
    return () => window.removeEventListener("scroll", updateHeaderSurface);
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
    <div className="landing-page flex min-h-[100dvh] min-h-[-webkit-fill-available] flex-col bg-[#FAF6EF] text-slate-900 dark:bg-[#09090b] dark:text-zinc-100 max-md:pb-[calc(4.75rem+var(--app-safe-bottom,env(safe-area-inset-bottom,0px)))]">
      <LandingSiteHeader
        hideLeftLogo
        hideBackButton
        hideBackButtonMobile
        heroOverlay
        heroOverlayScrolled={heroScrolledPast}
        heroOverlayLightSurface
        hideBrandMobile
        hideThemeToggle
        hideContactAndLegal
        onBrandClick={() => setAboutOpen(true)}
      />

      <WhatIsTebnuDialog open={aboutOpen} onOpenChange={setAboutOpen} />
      <ContactUsButton />

      {/* Sticky hero CTAs when scrolled past — desktop only */}
      <div
        className={cn(
          "fixed bottom-8 left-6 z-[60] hidden transition-all duration-500 md:flex lg:left-10",
          showFixedButtons
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-10 pointer-events-none",
        )}
      >
        <div className="flex items-center justify-center gap-1.5 rounded-[1.4rem] border border-white/90 bg-white/80 p-1.5 shadow-[0_18px_55px_-14px_rgba(24,24,27,0.3),0_2px_8px_rgba(24,24,27,0.08)] ring-1 ring-zinc-950/5 backdrop-blur-2xl transition-transform duration-300 hover:-translate-y-1">
          <Button
            onClick={handleHiringHelper}
            className="h-11 gap-2 rounded-full bg-[#F97316] px-5 text-sm font-semibold text-white shadow-[0_12px_24px_-12px_rgba(249,115,22,0.9)] transition-all hover:-translate-y-0.5 hover:bg-orange-600"
          >
            <span>{t("landing.creamHero.findHelp")}</span>
            <ArrowUpRight className="h-4.5 w-4.5 shrink-0 rtl:-scale-x-100" strokeWidth={2.25} />
          </Button>
          <button
            type="button"
            onClick={handleSearchingForJob}
            className="mx-3 text-sm font-semibold text-zinc-900 underline decoration-zinc-900 decoration-[1.5px] underline-offset-[6px] transition hover:text-orange-600 hover:decoration-orange-600"
          >
            {t("landing.creamHero.offerHelp")}
          </button>
        </div>
      </div>

      <main className="flex-1 overflow-hidden">
        <section ref={heroRef} className="relative w-full">
          <LandingCreamHero
            onFindHelp={handleHiringHelper}
            onOfferHelp={handleSearchingForJob}
            ctaRef={(el) => {
              buttonsRef.current = el;
              mobileHeroButtonsRef.current = el;
            }}
          />
        </section>

        <section
          className="relative w-full scroll-reveal overflow-hidden px-0 py-20 opacity-0 translate-y-10 transition-all duration-1000 delay-200 md:py-28"
          aria-labelledby="how-it-works-heading"
        >
          <div className="pointer-events-none absolute left-[-12rem] top-12 h-96 w-96 rounded-full bg-orange-400/[0.34] blur-3xl" aria-hidden />
          <div className="pointer-events-none absolute right-[-10rem] top-1/3 h-96 w-96 rounded-full bg-emerald-400/[0.32] blur-3xl" aria-hidden />
          <div className="pointer-events-none absolute left-1/2 top-[58%] h-[28rem] w-[44rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-300/[0.18] blur-3xl" aria-hidden />

          <div className="relative mx-auto max-w-[90rem] px-5 sm:px-8 lg:px-12">
            <div className="max-w-5xl">
              <span className="text-xs font-black uppercase tracking-[0.34em] text-orange-600">
                {t("landing.howItWorksEyebrow")}
              </span>
              <h2
                id="how-it-works-heading"
                className="mt-4 text-5xl font-black leading-[0.94] tracking-[-0.055em] text-zinc-950 md:text-7xl"
              >
                {t("landing.howItWorksTitle")}
              </h2>
              <p className="mt-4 max-w-2xl text-lg font-medium leading-relaxed text-zinc-600 md:text-xl">
                {t("landing.howItWorksSubtitle")}
              </p>
            </div>

            <div className="relative mt-14 grid gap-14 md:grid-cols-3 md:gap-8 lg:mt-10 lg:gap-16">
              <svg
                className="pointer-events-none absolute left-[17%] right-[17%] top-[42%] hidden h-24 w-[66%] md:block"
                viewBox="0 0 1000 100"
                fill="none"
                preserveAspectRatio="none"
                aria-hidden
              >
                <path d="M0 52 C150 98 350 3 500 52 C650 98 850 3 1000 52" stroke="#FB923C" strokeOpacity=".45" strokeWidth="2" strokeDasharray="8 10" />
                <circle cx="500" cy="52" r="7" fill="#F97316" />
              </svg>
              {HOW_IT_WORKS_STEPS.map((step) => (
                <article
                  key={step.step}
                  className="group relative z-10 flex flex-col items-center transition duration-500 hover:-translate-y-2"
                >
                  <div
                    className={cn(
                      "relative flex w-full max-w-[22rem] justify-center rounded-full px-8 py-2",
                      step.tone === "mint"
                        ? "bg-[radial-gradient(circle,rgba(110,231,183,0.32),rgba(167,243,208,0.12)_55%,transparent_72%)]"
                        : "bg-[radial-gradient(circle,rgba(253,186,116,0.34),rgba(254,215,170,0.12)_55%,transparent_72%)]",
                    )}
                  >
                    <div className="relative h-[27rem] w-[13rem] rounded-[3rem] border-[3px] border-zinc-500 bg-gradient-to-r from-zinc-950 via-zinc-700 to-black p-[7px] shadow-[0_30px_35px_-18px_rgba(24,24,27,0.55),inset_0_0_0_1px_rgba(255,255,255,0.3)] transition-transform duration-700 group-hover:scale-[1.02] lg:h-[31rem] lg:w-[15rem]">
                      <span className="absolute -left-[6px] top-24 h-12 w-[4px] rounded-l bg-zinc-700 shadow-sm" aria-hidden />
                      <span className="absolute -left-[6px] top-40 h-16 w-[4px] rounded-l bg-zinc-700 shadow-sm" aria-hidden />
                      <span className="absolute -right-[6px] top-32 h-20 w-[4px] rounded-r bg-zinc-700 shadow-sm" aria-hidden />
                      <div className="h-full overflow-hidden rounded-[2.45rem] bg-white">
                        <img
                          src={step.image}
                          alt={t(`landing.steps.${step.step}.imageAlt`)}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      </div>
                      {step.step === 2 && (
                        <div className="absolute left-3 right-3 top-10 z-20 rounded-[1.15rem] border border-white/70 bg-white/95 p-2.5 shadow-[0_12px_30px_rgba(24,24,27,0.28)] backdrop-blur-xl">
                          <div className="flex items-start gap-2.5">
                            <div className="relative h-10 w-10 shrink-0">
                              <img
                                src="/images/how-it-works/helper-notification-avatar-2.webp"
                                alt=""
                                className="h-full w-full rounded-full object-cover ring-1 ring-black/10"
                              />
                              <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-white bg-white shadow-sm">
                                <img
                                  src="/Tebnu mobile logo.png"
                                  alt=""
                                  className="h-3 w-3 object-contain"
                                />
                              </span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <p className="truncate text-[11px] font-black leading-tight text-zinc-950">
                                  {t("landing.helperResponseNotification.title")}
                                </p>
                                <span className="text-[8px] font-semibold text-zinc-400">
                                  {t("landing.helperResponseNotification.time")}
                                </span>
                              </div>
                              <p className="mt-0.5 line-clamp-2 text-[9px] font-medium leading-tight text-zinc-600">
                                {t("landing.helperResponseNotification.body")}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-6 flex w-full max-w-[22rem] items-center justify-center gap-4">
                    <span
                      className={cn(
                        "flex h-11 min-w-11 items-center justify-center rounded-full text-sm font-black",
                        step.tone === "mint"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-orange-100 text-orange-700",
                      )}
                    >
                      {String(step.step).padStart(2, "0")}
                    </span>
                    <h3 className="text-xl font-black leading-tight tracking-[-0.035em] text-zinc-950 lg:text-2xl">
                      {t(`landing.steps.${step.step}.title`)}
                    </h3>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 py-20 sm:px-8 md:py-28 lg:px-12">
          <div className="relative mx-auto grid max-w-[82rem] overflow-hidden rounded-[2.75rem] bg-[#113D36] text-white shadow-[0_35px_90px_-60px_rgba(6,78,59,0.8)] md:grid-cols-[1.05fr_0.95fr]">
            <div className="relative z-10 flex flex-col justify-center px-7 py-12 sm:px-10 md:px-14 md:py-16 lg:px-16">
              <p className="text-xs font-black uppercase tracking-[0.28em] text-emerald-300">
                {t("landing.helperJourney.eyebrow")}
              </p>
              <h2 className="mt-5 max-w-2xl text-4xl font-black leading-[0.95] tracking-[-0.05em] sm:text-5xl lg:text-6xl">
                {t("landing.helperJourney.title")}
              </h2>
              <p className="mt-6 max-w-xl text-lg font-medium leading-relaxed text-emerald-50/80">
                {t("landing.helperJourney.description")}
              </p>

              <div className="mt-8 space-y-4">
                {(["categories", "notifications", "respond"] as const).map((item, index) => (
                  <div key={item} className="flex items-start gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-300 text-xs font-black text-emerald-950">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-black text-white">{t(`landing.helperJourney.steps.${item}.title`)}</p>
                      <p className="mt-1 text-sm font-medium leading-relaxed text-emerald-50/65">
                        {t(`landing.helperJourney.steps.${item}.description`)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleSearchingForJob}
                className="mt-9 inline-flex h-[3.25rem] w-fit items-center gap-2 rounded-full bg-emerald-300 px-7 text-base font-black text-emerald-950 shadow-[0_14px_30px_-16px_rgba(110,231,183,0.7)] transition hover:-translate-y-0.5 hover:bg-emerald-200"
              >
                {t("landing.helperJourney.cta")}
                <ArrowUpRight className="h-5 w-5 rtl:-scale-x-100" />
              </button>
            </div>

            <div className="relative flex min-h-[38rem] items-end justify-center overflow-hidden bg-[radial-gradient(circle_at_55%_45%,rgba(110,231,183,0.22),transparent_55%)] px-8 pt-14">
              <div className="absolute right-[-5rem] top-[-5rem] h-72 w-72 rounded-full border border-emerald-300/20" aria-hidden />
              <div className="absolute right-[-1rem] top-[-1rem] h-52 w-52 rounded-full border border-emerald-300/15" aria-hidden />
              <div className="relative h-[34rem] w-[16.4rem] translate-y-8 rounded-[3.15rem] border-[3px] border-zinc-500 bg-gradient-to-r from-zinc-950 via-zinc-700 to-black p-[7px] shadow-[0_35px_50px_-20px_rgba(0,0,0,0.65)]">
                <span className="absolute -left-[6px] top-28 h-14 w-[4px] rounded-l bg-zinc-700" aria-hidden />
                <span className="absolute -right-[6px] top-36 h-20 w-[4px] rounded-r bg-zinc-700" aria-hidden />
                <div className="h-full overflow-hidden rounded-[2.55rem] bg-white">
                  <img
                    src="/images/how-it-works/screen-offer-help.webp"
                    alt={t("landing.helperJourney.imageAlt")}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
              </div>

              <div className="absolute left-4 top-24 w-[min(21rem,88%)] rounded-[1.35rem] border border-white/70 bg-white/95 p-3.5 text-zinc-950 shadow-[0_18px_45px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:left-8">
                <div className="flex items-center gap-3">
                  <div className="relative h-11 w-11 shrink-0">
                    <img src="/images/how-it-works/helper-notification-avatar.webp" alt="" className="h-full w-full rounded-full object-cover" />
                    <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-white shadow-sm">
                      <img src="/Tebnu mobile logo.png" alt="" className="h-5 w-5 object-contain" />
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black">{t("landing.helperJourney.notificationTitle")}</p>
                    <p className="mt-1 text-[11px] font-medium leading-snug text-zinc-600">{t("landing.helperJourney.notificationBody")}</p>
                  </div>
                  <span className="ml-auto self-start text-[9px] font-semibold text-zinc-400">{t("landing.helperResponseNotification.time")}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <SupportingConnectionsSection />

        {/* Interactive Job Category Showcase — centered 3-up carousel */}
        {false && (
        <section className="w-full scroll-reveal py-20 opacity-0 transition-all delay-300 duration-1000 translate-y-10 md:py-28">
          <div className="mb-10 space-y-4 px-5 text-center sm:px-8 lg:px-12 xl:px-16">
            <h2 className="text-4xl font-black leading-tight tracking-[-0.035em] text-zinc-950 md:text-6xl">
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
                            "group relative overflow-hidden rounded-[1.5rem] border border-black/[0.06] bg-slate-100 text-left shadow-[0_22px_55px_-30px_rgba(24,24,27,0.42)] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
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
            <div className="mt-10 w-full animate-in fade-in slide-in-from-top-4 duration-700 px-5 sm:px-8 lg:px-12 xl:px-16">
              <div className="mx-auto max-h-[700px] max-w-6xl space-y-12 overflow-y-auto rounded-[1.5rem] border border-black/[0.06] bg-white/70 px-6 py-8 shadow-[0_20px_60px_-44px_rgba(24,24,27,0.3)] backdrop-blur-sm scrollbar-hide md:px-9">
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
        )}

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
        <div className="w-full py-20 scroll-reveal opacity-0 translate-y-10 transition-all duration-1000 md:py-28">
          <div className="mb-10 flex w-full items-end justify-between gap-4 px-5 sm:px-8 lg:px-12 xl:px-16">
            <div>
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">
                {t("landing.verifiedUsers")}
              </span>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] text-zinc-950 md:text-5xl">
              About our helpers
              </h2>
            </div>
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
            className="flex w-full snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth px-5 pb-12 scrollbar-hide sm:gap-6 sm:px-8 lg:gap-7 lg:px-12 xl:px-16"
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
                    className="group relative mt-10 w-[min(88vw,320px)] shrink-0 snap-start rounded-[1.5rem] border border-black/[0.06] bg-white p-7 pt-14 shadow-[0_18px_50px_-34px_rgba(24,24,27,0.38)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_-34px_rgba(24,24,27,0.38)] sm:w-[360px] md:w-[400px] lg:w-[420px]"
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

        <section className="px-5 py-20 sm:px-8 md:py-28 lg:px-12">
          <div className="mx-auto grid max-w-[82rem] gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:gap-20">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-emerald-700">
                {t("landing.faq.eyebrow")}
              </p>
              <h2 className="mt-4 text-4xl font-black leading-[0.98] tracking-[-0.045em] text-zinc-950 md:text-5xl">
                {t("landing.faq.title")}
              </h2>
              <p className="mt-4 max-w-md text-base font-medium leading-relaxed text-zinc-600">
                {t("landing.faq.subtitle")}
              </p>
            </div>
            <div className="divide-y divide-zinc-200 border-y border-zinc-200">
              {(["free", "charge", "commitment", "verification", "payments"] as const).map((item) => (
                <details key={item} className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-5 py-5 text-left">
                    <span className="text-lg font-black tracking-[-0.02em] text-zinc-950">
                      {t(`landing.faq.items.${item}.question`)}
                    </span>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-300 text-xl font-medium text-zinc-600 transition group-open:rotate-45 group-open:border-orange-300 group-open:text-orange-600">
                      +
                    </span>
                  </summary>
                  <p className="max-w-3xl pb-6 pr-12 text-base font-medium leading-relaxed text-zinc-600">
                    {t(`landing.faq.items.${item}.answer`)}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 pb-20 pt-10 sm:px-8 md:pb-28 lg:px-12">
          <div className="relative mx-auto grid max-w-[82rem] overflow-hidden rounded-[2.5rem] bg-[#F26822] shadow-[0_30px_80px_-45px_rgba(194,65,12,0.7)] md:min-h-[25rem] md:grid-cols-[1.05fr_0.95fr]">
            <div className="relative z-10 flex flex-col justify-center px-7 py-12 text-white sm:px-10 md:px-14 md:py-16">
              <p className="text-xs font-black uppercase tracking-[0.28em] text-orange-100">
                {t("landing.communityCta.eyebrow")}
              </p>
              <h2 className="mt-4 max-w-xl text-4xl font-black leading-[0.95] tracking-[-0.05em] sm:text-5xl lg:text-6xl">
                {t("landing.communityCta.title")}
              </h2>
              <p className="mt-5 max-w-lg text-lg font-medium leading-relaxed text-orange-50/90">
                {t("landing.communityCta.description")}
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={handleHiringHelper}
                  className="inline-flex h-[3.25rem] items-center gap-2 rounded-full bg-white px-7 text-base font-bold text-orange-600 shadow-[0_14px_30px_-18px_rgba(0,0,0,0.45)] transition hover:-translate-y-0.5 hover:bg-orange-50"
                >
                  {t("landing.communityCta.getHelp")}
                  <ArrowUpRight className="h-5 w-5 rtl:-scale-x-100" />
                </button>
                <button
                  type="button"
                  onClick={handleSearchingForJob}
                  className="h-[3.25rem] rounded-full border border-white/55 px-7 text-base font-bold text-white transition hover:-translate-y-0.5 hover:bg-white/10"
                >
                  {t("landing.communityCta.helpOthers")}
                </button>
              </div>
            </div>
            <div className="relative min-h-[20rem] overflow-hidden md:min-h-full">
              <img
                src="/images/landing-delivery-helper.webp"
                alt=""
                className="absolute inset-0 h-full w-full object-cover object-center"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-[#F26822]/35 via-transparent to-[#F26822]/10 md:bg-gradient-to-r md:from-[#F26822] md:via-[#F26822]/20 md:to-transparent" />
            </div>
          </div>
        </section>
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
        <div className="flex items-center gap-2 rounded-[1.35rem] border border-white/90 bg-white/90 p-1.5 shadow-[0_14px_40px_-14px_rgba(24,24,27,0.35)] ring-1 ring-zinc-950/5 backdrop-blur-xl">
          <Button
            onClick={handleHiringHelper}
            className="h-12 min-w-0 flex-1 gap-2 rounded-full bg-[#F97316] px-5 text-sm font-semibold text-white shadow-[0_10px_22px_-12px_rgba(249,115,22,0.9)] hover:bg-orange-600"
          >
            <span>{t("landing.creamHero.findHelp")}</span>
            <ArrowUpRight className="h-4 w-4 shrink-0 rtl:-scale-x-100" strokeWidth={2.25} aria-hidden />
          </Button>
          <button
            type="button"
            onClick={handleSearchingForJob}
            className="min-w-0 flex-1 px-3 py-3 text-sm font-semibold text-zinc-900 underline decoration-zinc-900 decoration-[1.5px] underline-offset-[6px] transition hover:text-orange-600 hover:decoration-orange-600"
          >
            {t("landing.creamHero.offerHelp")}
          </button>
        </div>
      </div>
    </div>
  );
}
