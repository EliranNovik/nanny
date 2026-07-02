import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Briefcase,
  Users,
  Baby,
  Sparkles,
  Star,
  ClipboardList,
  UserCheck,
  MessageCircle,
  CheckCircle2,
  Soup,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Truck,
  BadgeCheck,
  Loader2,
  Radio,
} from "lucide-react";
import Benefits from "@/components/Benefits";
import React, { useState, useRef, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LandingSiteHeader } from "@/components/LandingSiteHeader";
import { WhatIsTebnuDialog } from "@/components/WhatIsTebnuDialog";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { Footer } from "@/components/Footer";
import { cn } from "@/lib/utils";
import { GLOBAL_POSTS_PATH } from "@/lib/profilePostShare";
import {
  communityFeedRequestScrollState,
  communityFeedScrollState,
} from "@/lib/communityFeedNav";
import {
  globalFeedCardSurfaceClass,
  globalFeedPostTypeAccentClass,
  globalFeedPrimaryCtaClass,
} from "@/lib/globalFeedPostUi";
import { useTheme } from "@/context/ThemeContext";
import { useLandingPagePreview } from "@/hooks/data/useLandingPagePreview";
import { LandingHeroCollage } from "@/components/landing/LandingHeroCollage";
import type { LandingActivityKind } from "@/lib/fetchLandingRecentActivity";
import {
  requestPostAccentTextClass,
  requestPostBadgeClass,
} from "@/lib/requestPostTheme";

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

function landingActivityBadgeLabel(kind: LandingActivityKind): string {
  return kind === "request" ? "Request" : "Offer";
}

function landingActivityBadgeClass(typeId: "request_help" | "offer_service"): string {
  return cn(
    "inline-flex shrink-0 items-center rounded-md px-2.5 py-0.5 text-[11px] font-black uppercase tracking-[0.06em]",
    typeId === "request_help" && requestPostBadgeClass,
    typeId === "offer_service" && "bg-emerald-100 text-emerald-700",
  );
}

function landingActivityCtaLabel(kind: LandingActivityKind, authorName: string): string {
  if (kind === "request") return "Offer help";
  const first = authorName.trim().split(/\s+/)[0] || "user";
  return `Message ${first}`;
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
  const navigate = useNavigate();
  const { theme } = useTheme();
  const buttonsRef = useRef<HTMLDivElement>(null);
  const mobileHeroButtonsRef = useRef<HTMLDivElement>(null);
  const recentActivityRef = useRef<HTMLDivElement>(null);
  const reviewsRef = useRef<HTMLDivElement>(null);
  const [activeCategoryIndex, setActiveCategoryIndex] = useState(0);
  const [showFixedButtons, setShowFixedButtons] = useState(false);
  const [showMobileFixedButtons, setShowMobileFixedButtons] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [tebnuApartOpen, setTebnuApartOpen] = useState(false);
  const { activityLoading, activityItems, heroPosts, heroPostsLoading, reviewsLoading, reviews } =
    useLandingPagePreview();

  const showcaseCategories = [
    {
      id: "special_video",
      title: "Experience Tebnu",
      icon: <Sparkles />,
      image: "/videos/promo-video.mp4",
      phrase: "See How We Make Life Simpler",
      details:
        "Watch how easy it is to connect with trusted helpers in your neighborhood. Fast, secure, and seamless.",
      bullets: [
        "Instant Matching",
        "Secure Direct Chat",
        "Verified Profiles",
        "Easy Management",
      ],
      cta: "Get Started Now",
    },
    {
      id: "childcare",
      title: "Childcare",
      icon: <Baby />,
      image: "/nanny-mar22.png",
      phrase: "Trusted Care for Your Little Ones",
      details:
        "Meet verified nannies and babysitters who feel right for your family. From nannies to emergency sitters.",
      bullets: [
        "Vetted & Background Checked",
        "CPR Certified Options",
        "Flexible Scheduling",
        "Real-time Availability",
      ],
      cta: "Hire a Nanny",
    },
    {
      id: "cleaning",
      title: "Cleaning",
      icon: <Sparkles />,
      image: "/pexels-silverkblack-36715260.jpg",
      phrase: "A pristine retreat, every single time.",
      bullets: [
        "Vetted housekeepers",
        "Environmentally friendly options",
        "Same-day availability available",
      ],
      details:
        "Our cleaning professionals are dedicated to making your home shine. From deep cleans to regular upkeep, we handle the dust so you can handle the rest.",
      cta: "Find a Housekeeper",
    },
    {
      id: "cooking",
      title: "Cooking",
      icon: <Soup />,
      image: "/images/private-chef.jpg",
      phrase: "Gourmet Meals at Your Table",
      details:
        "Find talented home cooks and chefs for daily meal prep or special dinner parties. Customizable to your tastes.",
      bullets: [
        "Dietary Specialists",
        "Grocery Shopping Included",
        "Kitchen Cleanup",
        "Fresh Ingredients",
      ],
      cta: "Hire a Chef",
    },
    {
      id: "pickup",
      title: "Delivery",
      icon: <Truck />,
      image: "/other-mar22.png",
      phrase: "Your Errands, Handled",
      details:
        "From groceries to dry cleaning, our reliable couriers pick up and deliver essentials right to your door.",
      bullets: [
        "Fast Point-to-Point",
        "Real-time Tracking",
        "Careful Handling",
        "Available 24/7",
      ],
      cta: "Hire a Courier",
    },
    {
      id: "handyman",
      title: "Handyman",
      icon: <Briefcase />,
      image: "/images/handyman.jpg",
      phrase: "Expert Home Maintenance",
      details:
        "Need help organizing, assembling, or fixing? Our versatile helpers tackle any home task with precision.",
      bullets: [
        "Versatile Skillsets",
        "On-Demand Tasks",
        "Creative Problem Solvers",
        "Project-Based Rates",
      ],
      cta: "Find a Helper",
    },
  ];

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

  /** Marketing page always renders in light mode, even when the app theme is dark. */
  useEffect(() => {
    const root = document.documentElement;
    const applyLight = () => {
      root.classList.remove("dark");
      root.style.colorScheme = "light";
    };
    applyLight();

    const observer = new MutationObserver(applyLight);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });

    return () => {
      observer.disconnect();
      root.style.colorScheme = "";
      if (theme === "dark") root.classList.add("dark");
    };
  }, [theme]);

  const handleSearchingForJob = () => {
    // Navigate directly to onboarding with role param
    navigate("/onboarding?role=freelancer");
  };

  const handleHiringHelper = () => {
    // Navigate directly to onboarding with role param
    navigate("/onboarding?role=client");
  };

  const handleCommunityLive = () => {
    navigate(GLOBAL_POSTS_PATH);
  };

  return (
    <div
      className="flex min-h-[100dvh] min-h-[-webkit-fill-available] flex-col bg-slate-50/50 text-slate-900 max-md:pb-[calc(4.75rem+var(--app-safe-bottom,env(safe-area-inset-bottom,0px)))]"
      style={{ colorScheme: "light" }}
    >
      <LandingSiteHeader
        hideBackButton
        hideBackButtonMobile
        variant="landingGlass"
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
        <div className="flex flex-wrap items-center justify-center gap-2.5 rounded-2xl border border-slate-200/80 bg-white/95 p-2 shadow-2xl backdrop-blur-xl">
          <Button
            onClick={handleSearchingForJob}
            className="h-12 gap-2 rounded-xl bg-white px-5 text-sm font-bold text-slate-900 shadow-sm hover:bg-slate-50"
          >
            <Briefcase className="h-4 w-4 text-orange-600" strokeWidth={2.25} />
            Offer Help
          </Button>
          <Button
            type="button"
            onClick={handleCommunityLive}
            className="h-12 gap-2 rounded-xl bg-white px-5 text-sm font-bold text-slate-900 shadow-sm hover:bg-slate-50"
          >
            <Radio className="h-4 w-4 text-orange-600" strokeWidth={2.25} aria-hidden />
            Community Live
          </Button>
          <Button
            onClick={handleHiringHelper}
            className="h-12 gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-600 px-5 text-sm font-bold text-white shadow-md hover:from-orange-600 hover:to-red-700"
          >
            <Users className="h-4 w-4" strokeWidth={2.25} />
            Need Help
          </Button>
        </div>
      </div>

      <main className="flex-1">
        {/* Full-Screen Hero Section */}
        <section className="relative w-full min-h-[90vh] overflow-visible group/hero md:min-h-screen md:bg-slate-50">
          {/* Mobile — white hero with same post collage as desktop */}
          <div className="relative bg-white md:hidden">
            <div className="relative flex flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(5.75rem,calc(env(safe-area-inset-top,0px)+4.5rem))]">
              <div className="relative z-10 space-y-4 pb-1 animate-in fade-in slide-in-from-bottom-3 duration-700">
                <h1 className="max-w-[19rem] text-[2.5rem] font-black leading-[1.05] tracking-tight text-slate-900 sm:text-[2.65rem]">
                  One{" "}
                  <span className="inline-block rotate-[-1deg] rounded-xl border border-orange-200 bg-orange-50 px-2.5 py-0.5 text-orange-600 shadow-[0_8px_24px_-12px_rgba(249,115,22,0.25)]">
                    community
                  </span>
                  . Many helpers.
                </h1>
                <p className="max-w-[20rem] text-[1.05rem] font-medium leading-relaxed text-slate-600">
                  Find support, share skills, and connect within minutes.
                </p>
              </div>

              <LandingHeroCollage
                embedded
                posts={heroPosts}
                loading={heroPostsLoading}
                className="relative left-1/2 z-0 mt-1 w-screen max-w-[100vw] -translate-x-1/2"
              />

              <div ref={mobileHeroButtonsRef} className="mt-2 space-y-3">
                <Button
                  type="button"
                  onClick={handleCommunityLive}
                  className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl border-0 bg-gradient-to-r from-orange-500 to-red-600 text-base font-black text-white shadow-lg shadow-orange-500/25 transition-all hover:from-orange-600 hover:to-red-700 active:scale-[0.98]"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
                    <Radio className="h-5 w-5" strokeWidth={2.5} aria-hidden />
                  </span>
                  Community Live
                </Button>
                <div className="grid grid-cols-2 gap-2.5">
                  <Button
                    type="button"
                    onClick={handleHiringHelper}
                    className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-900 text-sm font-black text-white shadow-md transition-all hover:bg-slate-800 active:scale-[0.98]"
                  >
                    <Users className="h-4 w-4 shrink-0 text-orange-300" strokeWidth={2.25} aria-hidden />
                    Need Help
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSearchingForJob}
                    className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 text-sm font-black text-slate-900 transition-all hover:bg-slate-100 active:scale-[0.98]"
                  >
                    <Briefcase className="h-4 w-4 shrink-0 text-orange-600" strokeWidth={2.25} aria-hidden />
                    Offer Help
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Desktop — Facebook-style post collage + copy column */}
          <div className="hidden md:grid md:min-h-screen md:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
            <LandingHeroCollage posts={heroPosts} loading={heroPostsLoading} />

            <div className="relative flex flex-col justify-center bg-slate-50 px-10 py-28 lg:px-14 xl:px-16">
              <div className="max-w-xl space-y-6 animate-in fade-in slide-in-from-right-10 duration-1000">
                <h1 className="text-5xl font-black leading-[1.05] tracking-tight text-slate-900 lg:text-6xl xl:text-7xl">
                  One{" "}
                  <span className="inline-block rotate-[-1deg] rounded-xl border border-orange-200 bg-orange-50 px-3 py-1 text-orange-600">
                    community
                  </span>
                  . Many helpers.
                </h1>
                <p className="max-w-lg text-lg font-medium text-slate-600 lg:text-xl">
                  Find support, share skills, and connect within minutes.
                </p>
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold text-slate-500 lg:text-base">
                  <span>Verified users</span>
                  <span className="text-slate-300" aria-hidden>
                    ·
                  </span>
                  <span>Local helpers</span>
                  <span className="text-slate-300" aria-hidden>
                    ·
                  </span>
                  <span>Fast response</span>
                </p>
              </div>

              <div
                className="mt-10 max-w-md"
                aria-label="Secure registration powered by Didit"
              >
                <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_16px_40px_-12px_rgba(0,0,0,0.12)]">
                  <button
                    type="button"
                    onClick={() => setTebnuApartOpen((open) => !open)}
                    aria-expanded={tebnuApartOpen}
                    className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-slate-50/80 lg:px-6 lg:py-5"
                  >
                    <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 shadow-[0_6px_18px_-4px_rgba(16,185,129,0.55)] ring-1 ring-emerald-400/30 md:h-14 md:w-14">
                      <div
                        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.28),transparent_55%)]"
                        aria-hidden
                      />
                      <BadgeCheck
                        className="relative h-6 w-6 fill-white text-emerald-600 lg:h-7 lg:w-7"
                        strokeWidth={2}
                        aria-hidden
                      />
                    </div>
                    <span className="min-w-0 flex-1 text-xs font-black uppercase tracking-[0.12em] text-slate-500 md:text-[13px]">
                      What sets Tebnu apart
                    </span>
                    <ChevronDown
                      className={cn(
                        "h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200",
                        tebnuApartOpen && "rotate-180",
                      )}
                      aria-hidden
                    />
                  </button>
                  {tebnuApartOpen ? (
                    <div className="border-t border-slate-100 px-5 pb-4 pt-3 lg:px-6 lg:pb-5">
                        <p className="text-base font-bold leading-snug text-slate-900 md:text-lg lg:text-xl">
                          Every member verified with{" "}
                          <span className="text-emerald-600">Didit</span>
                        </p>
                        <p className="mt-2 text-sm font-medium leading-snug text-slate-600 md:text-[15px] lg:text-base">
                          Real ID and a live selfie before anyone can hire or work.
                        </p>
                        <ul className="mt-2.5 space-y-1.5 md:space-y-2">
                          {[
                            "Encrypted ID checks at signup",
                            "Verified before posting, hiring, or going live",
                          ].map((line) => (
                            <li
                              key={line}
                              className="flex items-center gap-2.5 text-sm font-semibold text-slate-700 md:text-[15px]"
                            >
                              <CheckCircle2
                                className="h-4 w-4 shrink-0 text-emerald-600"
                                strokeWidth={2.5}
                                aria-hidden
                              />
                              <span>{line}</span>
                            </li>
                          ))}
                        </ul>
                    </div>
                  ) : null}
                </div>
              </div>

              <div
                ref={buttonsRef}
                className="mt-8 flex max-w-xl flex-col gap-3 sm:flex-row sm:flex-wrap"
              >
                <Button
                  onClick={handleSearchingForJob}
                  className="group/btn flex h-14 flex-1 items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 text-base font-bold text-slate-900 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98] sm:min-w-[10.5rem] sm:flex-none"
                >
                  <Briefcase className="h-5 w-5 shrink-0 text-orange-600" strokeWidth={2.25} />
                  Offer Help
                </Button>
                <Button
                  type="button"
                  onClick={handleCommunityLive}
                  className="group/btn flex h-14 flex-1 items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 text-base font-bold text-slate-900 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98] sm:min-w-[10.5rem] sm:flex-none"
                >
                  <Radio className="h-5 w-5 shrink-0 text-orange-600" strokeWidth={2.25} aria-hidden />
                  Community Live
                </Button>
                <Button
                  onClick={handleHiringHelper}
                  className="group/btn flex h-14 flex-1 items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-orange-500 to-red-600 px-6 text-base font-bold text-white shadow-md transition-all hover:from-orange-600 hover:to-red-700 active:scale-[0.98] sm:min-w-[10.5rem] sm:flex-none"
                >
                  <Users className="h-5 w-5 shrink-0" strokeWidth={2.25} />
                  Need Help
                </Button>
              </div>
            </div>
          </div>
        </section>

        <div className="max-w-7xl mx-auto px-4 md:px-0 space-y-24 py-24">
          {/* How finding a helper works - Premium Step-by-Step */}
          <section className="max-w-7xl mx-auto px-4 scroll-reveal opacity-0 translate-y-10 transition-all duration-1000 delay-200">
            <div className="text-center space-y-4 mb-16">
              <h2 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight">
                How it <span className="text-primary italic">works</span>
              </h2>
              <p className="text-slate-500 font-medium text-lg max-w-2xl mx-auto">
                Simple steps to find the perfect helper or start earning today.
              </p>
            </div>

            <div className="relative grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
              {[
                {
                  icon: <ClipboardList />,
                  title: "1. Post request",
                  desc: "Answer a few short taps to match with local helpers.",
                },
                {
                  icon: <Users />,
                  title: "2. Get matched",
                  desc: "Helpers in your area see and respond to your request.",
                },
                {
                  icon: <UserCheck />,
                  title: "3. Choose helper",
                  desc: "Pick the person who fits you best from their profiles.",
                },
                {
                  icon: <MessageCircle />,
                  title: "4. Chat & confirm",
                  desc: "Sort out details and schedule through direct chat.",
                },
                {
                  icon: <CheckCircle2 />,
                  title: "5. You're set!",
                  desc: "Your helper arrives as agreed. Relax and enjoy.",
                },
              ].map((step, idx) => (
                <div
                  key={idx}
                  className="group relative flex flex-col items-center text-center p-8 bg-white/40 backdrop-blur-sm border border-slate-100 rounded-[2.5rem] shadow-sm hover:shadow-xl hover:bg-white transition-all duration-500 hover:-translate-y-2"
                >
                  <div className="h-20 w-20 rounded-3xl bg-primary/10 text-primary flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-inner">
                    {React.cloneElement(step.icon as React.ReactElement, {
                      className: "w-10 h-10",
                    })}
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3 leading-tight">
                    {step.title}
                  </h3>
                  <p className="text-sm text-slate-600 font-medium leading-relaxed">
                    {step.desc}
                  </p>

                  {/* Subtle connecting line for desktop */}
                  {idx < 4 && (
                    <div className="hidden lg:block absolute top-1/3 -right-6 w-12 h-[2px] bg-gradient-to-r from-primary/20 to-transparent z-0"></div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Interactive Job Category Showcase — full width on large screens */}
        <section className="w-full scroll-reveal overflow-hidden py-24 opacity-0 transition-all delay-300 duration-1000 translate-y-10">
          <div className="mb-16 space-y-4 px-5 text-center sm:px-8 lg:px-12 xl:px-16">
            <h2 className="text-4xl font-black leading-tight tracking-tight text-slate-900 md:text-6xl">
              Experience the{" "}
              <span className="text-primary italic">Tebnu</span> Ease
            </h2>
            <p className="mx-auto max-w-2xl text-lg font-medium text-slate-500">
              Find the perfect helper for any task, with all the details at your
              fingertips.
            </p>
          </div>

          <div className="relative flex w-full flex-col items-center">
            <div className="relative flex w-full items-center justify-center px-5 sm:px-8 lg:px-12 xl:px-16">
              {/* Left Arrow */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-3 z-30 h-9 w-9 rounded-full border border-slate-100 bg-white/90 text-slate-900 shadow-lg backdrop-blur-md transition-all group hover:bg-white active:scale-95 sm:left-6 sm:h-10 sm:w-10 md:left-10 md:h-12 md:w-12 lg:left-14 xl:left-16"
                onClick={() => {
                  const prevIndex =
                    (activeCategoryIndex - 1 + showcaseCategories.length) %
                    showcaseCategories.length;
                  setActiveCategoryIndex(prevIndex);
                }}
              >
                <ChevronLeft className="h-5 w-5 transition-transform group-hover:-translate-x-0.5 md:h-6 md:w-6" />
              </Button>

              {/* Showcase Grid - Dynamic Scaling */}
              <div className="flex w-full items-end justify-center gap-2 px-10 sm:gap-4 md:gap-8 md:px-14 lg:gap-10 xl:px-20">
                    {showcaseCategories.map((cat, idx) => {
                      const isActive = idx === activeCategoryIndex;
                      const isPrev =
                        idx ===
                        (activeCategoryIndex - 1 + showcaseCategories.length) %
                          showcaseCategories.length;
                      const isNext =
                        idx ===
                        (activeCategoryIndex + 1) % showcaseCategories.length;

                      // Only show 3 at a time on desktop, 1 on mobile
                      const isVisible = isActive || isPrev || isNext;

                      if (!isVisible) return null;

                      return (
                        <div
                          key={cat.id}
                          onClick={() => setActiveCategoryIndex(idx)}
                          className={cn(
                            "relative transition-all duration-700 cursor-pointer flex-shrink-0 group",
                            isActive
                              ? "w-full md:w-[48%] lg:w-[44%] xl:w-[40%] z-20"
                              : "hidden md:block w-[16%] lg:w-[15%] xl:w-[14%] z-10 opacity-60 grayscale hover:opacity-100 hover:grayscale-0",
                            isActive
                              ? "scale-100"
                              : "scale-90 translate-y-4",
                          )}
                        >
                          <div
                            className={cn(
                              "relative overflow-hidden shadow-[0_30px_60px_-15px_rgba(0,0,0,0.3)] transition-all duration-700 bg-slate-100",
                              isActive
                                ? "rounded-2xl sm:rounded-[2rem] md:rounded-[2.5rem] aspect-[16/9] w-full"
                                : "rounded-2xl sm:rounded-[2rem] aspect-[4/5] w-full",
                            )}
                          >
                            <div className="relative w-full h-full">
                              {cat.id === "special_video" ? (
                                <video
                                  autoPlay
                                  loop
                                  muted
                                  playsInline
                                  className="w-full h-full object-cover object-center"
                                >
                                  <source
                                    src="/videos/promo-video.mp4"
                                    type="video/mp4"
                                  />
                                </video>
                              ) : (
                                <img
                                  src={cat.image}
                                  alt={cat.title}
                                  className="w-full h-full object-cover object-center transform transition-transform duration-1000 group-hover:scale-110"
                                />
                              )}

                              {/* Modern Gradient Overlay */}
                              <div
                                className={cn(
                                  "absolute inset-0 bg-gradient-to-t transition-opacity duration-700",
                                  isActive
                                    ? "from-black/90 via-black/20 to-transparent"
                                    : "from-black/60 to-transparent",
                                )}
                              ></div>

                              {/* Top Badges for Active Card - Hidden on Mobile */}
                              {isActive && (
                                <div className="absolute top-3 md:top-6 left-4 md:left-8 right-4 md:right-8 hidden md:flex justify-between items-center z-20 animate-in fade-in duration-700">
                                  <div className="px-3 py-1.5 rounded-full backdrop-blur-md bg-white/10 border border-white/20 text-white text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></div>
                                    Live Near You
                                  </div>
                                  <div className="px-3 py-1.5 rounded-full backdrop-blur-md bg-primary/20 border border-primary/30 text-primary-foreground text-[10px] font-bold uppercase tracking-widest">
                                    4.9 ★ (1.2k)
                                  </div>
                                </div>
                              )}

                              {/* Category Icon & Title Overlay */}
                              <div
                                className={cn(
                                  "absolute left-4 md:left-8 right-4 md:right-8 transition-all duration-700 z-20",
                                  isActive
                                    ? "bottom-4 md:bottom-10"
                                    : "bottom-3 md:bottom-6",
                                )}
                              >
                                <div className="flex items-center gap-2 md:gap-3 mb-1 md:mb-2">
                                  <div
                                    className={cn(
                                      "p-1.5 md:p-2 rounded-lg md:rounded-xl backdrop-blur-md bg-white/20 border border-white/30 text-white",
                                      isActive
                                        ? "h-7 w-7 md:h-10 md:w-10"
                                        : "h-5 w-5 md:h-8 md:w-8",
                                    )}
                                  >
                                    {React.cloneElement(
                                      cat.icon as React.ReactElement,
                                      { className: "w-full h-full text-white" },
                                    )}
                                  </div>
                                  <h3
                                    className={cn(
                                      "font-black !text-white uppercase tracking-tighter leading-none drop-shadow-md",
                                      isActive
                                        ? "text-xl md:text-5xl"
                                        : "text-sm",
                                    )}
                                  >
                                    {cat.title}
                                  </h3>
                                </div>
                                {isActive && (
                                  <p className="hidden md:block !text-white/95 text-sm md:text-lg font-medium max-w-lg mb-2 animate-in fade-in slide-in-from-bottom-2 duration-700 delay-100 drop-shadow-sm">
                                    {cat.phrase}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

              {/* Right Arrow */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-3 z-30 h-9 w-9 rounded-full border border-slate-100 bg-white/90 text-slate-900 shadow-lg backdrop-blur-md transition-all group hover:bg-white active:scale-95 sm:right-6 sm:h-10 sm:w-10 md:right-10 md:h-12 md:w-12 lg:right-14 xl:right-16"
                onClick={() => {
                  const nextIndex =
                    (activeCategoryIndex + 1) % showcaseCategories.length;
                  setActiveCategoryIndex(nextIndex);
                }}
              >
                <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5 md:h-6 md:w-6" />
              </Button>
            </div>

            {/* Details Revealed Below Active Card */}
            <div className="mt-8 w-full animate-in fade-in slide-in-from-top-4 duration-700 px-5 sm:px-8 lg:px-12 xl:px-16">
              <div className="max-h-[700px] w-full space-y-12 overflow-y-auto py-8 scrollbar-hide">
                <div className="grid grid-cols-1 items-start gap-8 md:grid-cols-2">
                  <div className="space-y-4">
                    <div className="hidden h-1 w-12 rounded-full bg-primary sm:block" />
                    <h4 className="text-2xl font-black leading-tight text-slate-900 md:text-3xl">
                      {showcaseCategories[activeCategoryIndex].phrase}
                    </h4>
                    <p className="text-lg font-medium leading-relaxed text-slate-600">
                      {showcaseCategories[activeCategoryIndex].details}
                    </p>
                  </div>

                  <div className="space-y-4">
                    <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Why Choose Us?
                    </h5>
                    <ul className="space-y-3">
                      {showcaseCategories[activeCategoryIndex].bullets.map(
                        (bullet, i) => (
                          <li
                            key={i}
                            className="flex items-center justify-center gap-3 font-bold text-slate-700 sm:justify-start"
                          >
                            <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
                            <span className="text-[15px]">{bullet}</span>
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                </div>

                <div className="flex flex-col items-center justify-between gap-6 border-t border-slate-200/50 pt-8 sm:flex-row">
                  <div className="hidden sm:block">
                    <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Status
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                      <span className="text-sm font-bold tracking-tight text-slate-700">
                        Active matches in your area
                      </span>
                    </div>
                  </div>
                  <div className="flex w-full flex-col items-center gap-4 sm:w-auto sm:flex-row">
                    <Button
                      onClick={handleHiringHelper}
                      size="lg"
                      className="h-14 w-full rounded-2xl bg-primary px-10 text-lg font-bold text-white shadow-xl shadow-primary/20 transition-all hover:scale-105 hover:bg-primary/90 active:scale-95 sm:w-auto"
                    >
                      {showcaseCategories[activeCategoryIndex].cta}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <div className="scroll-reveal opacity-0 translate-y-10 transition-all duration-1000">
          <Benefits />
        </div>

        {/* Recent Activity — full-width horizontal scroll on large screens */}
        <div className="w-full pt-12 scroll-reveal opacity-0 translate-y-10 transition-all duration-1000">
          <div className="mb-10 flex items-center justify-between gap-4 px-5 sm:px-8 lg:px-12 xl:px-16">
            <h2 className="text-2xl font-bold text-black md:text-3xl">
              Recent Activity
            </h2>
            <div className="hidden shrink-0 gap-2 md:flex">
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-full border-gray-200 bg-white/50 shadow-sm backdrop-blur-sm"
                onClick={() => scrollLeft(recentActivityRef)}
              >
                <ChevronLeft className="h-5 w-5 text-gray-700" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-full border-gray-200 bg-white/50 shadow-sm backdrop-blur-sm"
                onClick={() => scrollRight(recentActivityRef)}
              >
                <ChevronRight className="h-5 w-5 text-gray-700" />
              </Button>
            </div>
          </div>

          <div
            ref={recentActivityRef}
            className="flex w-full snap-x snap-mandatory items-stretch gap-5 overflow-x-auto scroll-smooth pb-8 scrollbar-hide px-5 sm:gap-6 sm:px-8 lg:gap-7 lg:px-12 xl:px-16"
          >
            {activityLoading ? (
              <div className="flex min-h-[220px] w-full items-center justify-center text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : activityItems.length === 0 ? (
              <div className="px-2 py-10 text-sm font-medium text-slate-500">
                No open requests or offers yet — be the first to post on Tebnu.
              </div>
            ) : (
              activityItems.map((item) => {
                const typeId = landingActivityTypeId(item.kind);
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
                      "group flex min-h-[320px] w-[min(88vw,320px)] shrink-0 snap-start flex-col overflow-hidden rounded-2xl transition-shadow duration-300 hover:shadow-md sm:w-[340px] md:w-[360px] lg:w-[380px] xl:w-[400px]",
                      globalFeedCardSurfaceClass,
                    )}
                  >
                    <div className="flex items-start gap-3 px-4 pt-3.5 pb-2">
                      {item.authorPhotoUrl ? (
                        <Avatar className="h-12 w-12 shrink-0 ring-2 ring-white">
                          <AvatarImage src={item.authorPhotoUrl} alt="" />
                          <AvatarFallback>{item.authorInitials}</AvatarFallback>
                        </Avatar>
                      ) : (
                        <div
                          className={cn(
                            "flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-sm font-bold text-white ring-2 ring-white",
                            landingCategoryGradient(item.categoryId),
                          )}
                        >
                          {item.authorInitials}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-start justify-between gap-2">
                          <h3 className="truncate text-base font-bold leading-tight text-slate-900 transition-colors group-hover:text-primary lg:text-[17px]">
                            {item.authorName}
                          </h3>
                          <span className={landingActivityBadgeClass(typeId)}>
                            {landingActivityBadgeLabel(item.kind)}
                          </span>
                        </div>
                        <p
                          className={cn(
                            "mt-1.5 text-[11px] font-bold uppercase tracking-wide",
                            globalFeedPostTypeAccentClass(typeId),
                          )}
                        >
                          {item.roleLabel}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-1 flex-col px-4 pb-3">
                      <p className="line-clamp-5 flex-1 text-sm leading-relaxed text-slate-800 lg:text-[15px]">
                        {item.description}
                      </p>
                    </div>

                    <div className="mt-auto border-t border-slate-100 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          {item.rateLabel ? (
                            <>
                              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                Pricing
                              </span>
                              <p className="truncate text-base font-bold text-slate-900 lg:text-lg">
                                {item.rateLabel}
                              </p>
                            </>
                          ) : (
                            <p className="text-sm font-medium text-slate-500">Open request</p>
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
        </div>

        {/* About our helpers — full-width horizontal scroll on large screens */}
        <div className="w-full pt-24 scroll-reveal opacity-0 translate-y-10 transition-all duration-1000">
          <div className="mb-10 flex items-center justify-between gap-4 px-5 sm:px-8 lg:px-12 xl:px-16">
            <h2 className="text-2xl font-bold text-black md:text-3xl">
              About our helpers
            </h2>
            <div className="hidden shrink-0 gap-2 md:flex">
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-full border-gray-200 bg-white/50 shadow-sm backdrop-blur-sm"
                onClick={() => scrollLeft(reviewsRef)}
              >
                <ChevronLeft className="h-5 w-5 text-gray-700" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-full border-gray-200 bg-white/50 shadow-sm backdrop-blur-sm"
                onClick={() => scrollRight(reviewsRef)}
              >
                <ChevronRight className="h-5 w-5 text-gray-700" />
              </Button>
            </div>
          </div>

          <div
            ref={reviewsRef}
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
                    className="group relative mt-10 w-[min(88vw,320px)] shrink-0 snap-start rounded-3xl border border-gray-100 bg-white p-8 pt-14 shadow-xl transition-all duration-500 hover:shadow-2xl sm:w-[360px] md:w-[400px] lg:w-[420px] xl:w-[440px]"
                  >
                    <Link
                      to={`/profile/${helper.id}`}
                      className="absolute -top-10 left-8 block h-20 w-20 rounded-full bg-gradient-to-br from-orange-400 to-red-500 p-1.5 shadow-xl transition-transform duration-500 group-hover:scale-110"
                      aria-label={`View ${helperName}'s profile`}
                    >
                      <Avatar className="h-full w-full border-4 border-white">
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
                          className="text-xl font-bold text-gray-900 transition-colors group-hover:text-primary"
                        >
                          {helperName}
                        </Link>
                        <div className="flex items-center gap-1.5 rounded-full border border-yellow-400/20 bg-yellow-400/10 px-3 py-1">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          <span className="text-[13px] font-black text-yellow-700">
                            {Number(review.rating).toFixed(1)}
                          </span>
                        </div>
                      </div>
                      <p className="text-base italic leading-relaxed text-gray-700 md:text-lg">
                        &ldquo;{reviewText}&rdquo;
                      </p>
                      <p className="mt-4 text-xs font-semibold text-slate-500">
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
          "fixed inset-x-0 bottom-[var(--app-safe-bottom,env(safe-area-inset-bottom,0px))] z-40 border-t border-slate-100 bg-white/95 p-4 pt-3 pb-3 shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.1)] backdrop-blur-md md:hidden transition-all duration-500 transform",
          showMobileFixedButtons
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-10 pointer-events-none",
        )}
      >
        <div className="mx-auto flex flex-row items-center justify-center gap-2.5 px-1">
          <Button
            onClick={handleSearchingForJob}
            className="flex h-12 w-auto gap-2 rounded-[1.25rem] bg-orange-50 px-4 text-sm font-black tracking-tight text-orange-600 shadow-sm hover:bg-orange-100"
          >
            <Briefcase className="h-4 w-4" />
            Offer Help
          </Button>
          <Button
            onClick={handleHiringHelper}
            className="flex h-12 w-auto gap-2 rounded-[1.25rem] bg-gradient-to-r from-orange-500 to-orange-600 px-4 text-sm font-black tracking-tight text-white shadow-md shadow-orange-500/20 hover:from-orange-600 hover:to-orange-700"
          >
            <Users className="h-4 w-4" />
            Need Help
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
