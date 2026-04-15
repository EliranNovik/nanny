import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Briefcase,
  Users,
  Baby,
  Sparkles,
  Star,
  Flag,
  ClipboardList,
  UserCheck,
  MessageCircle,
  CheckCircle2,
  Soup,
  ChevronLeft,
  ChevronRight,
  Truck,
} from "lucide-react";
import Benefits from "@/components/Benefits";
import React, { useState, useRef, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LandingSiteHeader } from "@/components/LandingSiteHeader";
import { LandingDownloadAppPromo } from "@/components/LandingDownloadAppPromo";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { Footer } from "@/components/Footer";
import { cn } from "@/lib/utils";

export default function LandingPage() {
  const navigate = useNavigate();
  const buttonsRef = useRef<HTMLDivElement>(null);
  const recentActivityRef = useRef<HTMLDivElement>(null);
  const reviewsRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const [activeCategoryIndex, setActiveCategoryIndex] = useState(0);
  const [showFixedButtons, setShowFixedButtons] = useState(false);

  const showcaseCategories = [
    {
      id: "special_video",
      title: "Experience MamaLama",
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

  const handleSearchingForJob = () => {
    // Navigate directly to onboarding with role param
    navigate("/onboarding?role=freelancer");
  };

  const handleHiringHelper = () => {
    // Navigate directly to onboarding with role param
    navigate("/onboarding?role=client");
  };

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-background flex flex-col">
      <LandingSiteHeader />

      {/* Bottom-Left Fixed CTAs when scrolled past - Desktop Only */}
      <div
        className={cn(
          "fixed bottom-8 left-8 z-[60] hidden md:flex items-center gap-4 transition-all duration-500 transform",
          showFixedButtons
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-10 pointer-events-none",
        )}
      >
        <Button
          onClick={handleSearchingForJob}
          className="h-14 px-8 rounded-2xl bg-white/90 hover:bg-white backdrop-blur-xl border border-white/40 shadow-2xl flex items-center gap-3 text-slate-900 font-bold transition-all hover:scale-105 active:scale-95 group/fixed-btn"
        >
          <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center transition-transform group-hover/fixed-btn:scale-110">
            <Briefcase className="w-4 h-4" />
          </div>
          <span>Be a Helper</span>
        </Button>
        <Button
          onClick={handleHiringHelper}
          className="h-14 px-8 rounded-2xl bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white shadow-xl flex items-center gap-3 font-bold transition-all hover:scale-105 active:scale-95 group/fixed-btn"
        >
          <div className="h-8 w-8 rounded-lg bg-white/20 text-white flex items-center justify-center transition-transform group-hover/fixed-btn:scale-110">
            <Users className="w-4 h-4" />
          </div>
          <span>Hire a Helper</span>
        </Button>
      </div>

      {/* Main Content - No top padding to allow Hero to flow behind header */}
      <main className="flex-1 pt-0">
        {/* Full-Screen Hero Section */}
        <section
          ref={heroRef}
          className="relative w-full min-h-[90vh] overflow-hidden group/hero"
        >
          <video
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 z-0 min-h-full w-full object-cover transition-transform duration-1000 group-hover/hero:scale-105"
          >
            <source src="/videos/hero-bg.mp4" type="video/mp4" />
          </video>

          {/* Sophisticated Gradients for depth and readability */}
          <div className="absolute inset-0 bg-black/10 z-[1]"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-transparent z-[2]"></div>

          {/* Left column: hero copy (constrained); download strip is full-bleed below so QR can sit at viewport edge on desktop */}
          <div className="relative z-10 flex w-full max-w-7xl flex-col items-start px-6 pb-6 pt-32 md:mx-0 md:px-8 md:pb-8 md:pt-40 md:pl-8 lg:pl-12 md:pr-[min(28rem,22vw)] lg:pr-[30rem]">
            <div className="w-[85%] max-w-xl md:w-full md:bg-white/5 md:backdrop-blur-sm md:border md:border-white/5 p-5 md:p-8 rounded-[2rem] text-left space-y-4 md:space-y-6 animate-in fade-in slide-in-from-left-10 duration-1000 md:shadow-sm">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight leading-tight text-white drop-shadow-lg">
                Bringing{" "}
                <span className="bg-primary/40 text-orange-200 px-3 py-1 rounded-xl border border-orange-400/20 inline-block rotate-[-1deg]">
                  families
                </span>{" "}
                and helpers together
              </h1>
              <p className="text-lg md:text-xl text-white/90 max-w-md font-medium drop-shadow-md">
                Find support, share skills, and connect within minutes.
              </p>
            </div>
          </div>
          <div className="relative z-10 w-full px-6 pb-10 pt-12 md:px-0 md:pb-16 md:pt-20 md:pl-8 lg:pl-12 md:pr-[min(28rem,22vw)] lg:pr-[30rem]">
            <LandingDownloadAppPromo />
          </div>

          {/* Right-Aligned Stacked CTAs - Desktop Only */}
          <div
            ref={buttonsRef}
            className="hidden md:flex absolute right-12 lg:right-32 top-1/2 -translate-y-1/2 flex-col items-center gap-8 z-20"
          >
            <Button
              onClick={handleSearchingForJob}
              className="group/btn h-44 w-80 flex flex-col items-center justify-center gap-4 bg-white/90 hover:bg-white backdrop-blur-xl border border-white/40 shadow-2xl rounded-[3rem] transition-all duration-500 hover:scale-105"
            >
              <div className="h-16 w-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center group-hover/btn:scale-110 transition-all duration-500 flex-shrink-0">
                <Briefcase className="w-8 h-8" />
              </div>
              <div className="text-center">
                <span className="block text-xl font-black text-slate-900 uppercase tracking-tight leading-tight">
                  Be the helper
                </span>
                <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest opacity-80 mt-1">
                  Join our network
                </span>
              </div>
            </Button>

            <Button
              onClick={handleHiringHelper}
              className="group/btn h-44 w-80 flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white shadow-[0_20px_40px_-12px_rgba(249,115,22,0.5)] border-t border-white/20 rounded-[3rem] transition-all duration-500 hover:scale-105"
            >
              <div className="h-16 w-16 rounded-2xl bg-white/20 text-white flex items-center justify-center group-hover/btn:scale-110 transition-all duration-500 flex-shrink-0">
                <Users className="w-8 h-8" />
              </div>
              <div className="text-center">
                <span className="block text-xl font-black uppercase tracking-tight leading-tight">
                  Hire a Helper
                </span>
                <span className="block text-[11px] font-bold text-orange-50/70 uppercase tracking-widest mt-1">
                  Post a request
                </span>
              </div>
            </Button>
          </div>
        </section>

        <div className="max-w-7xl mx-auto px-4 md:px-0 space-y-24 py-24">
          {/* How finding a helper works - Premium Step-by-Step */}
          <section className="max-w-7xl mx-auto pt-24 px-4 scroll-reveal opacity-0 translate-y-10 transition-all duration-1000 delay-200">
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

          {/* Interactive Job Category Showcase - Carousel Version */}
          <section className="scroll-reveal opacity-0 translate-y-10 transition-all duration-1000 delay-300 py-24 overflow-hidden">
            <div className="max-w-7xl mx-auto px-3 sm:px-4">
              <div className="text-center mb-16 space-y-4 px-1 sm:px-0">
                <h2 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tight leading-tight">
                  Experience the{" "}
                  <span className="text-primary italic">MamaLama</span> Ease
                </h2>
                <p className="text-slate-500 font-medium text-lg max-w-2xl mx-auto">
                  Find the perfect helper for any task, with all the details at
                  your fingertips.
                </p>
              </div>

              {/* Carousel Container */}
              <div className="relative flex flex-col items-center w-full">
                <div className="relative w-full md:w-[92%] max-w-[1400px] mx-auto flex items-center justify-center">
                  {/* Left Arrow */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-1 sm:left-0 md:-left-12 z-30 h-9 w-9 sm:h-10 sm:w-10 md:h-12 md:w-12 rounded-full bg-white/90 backdrop-blur-md shadow-lg border border-slate-100 hover:bg-white text-slate-900 group transition-all active:scale-95"
                    onClick={() => {
                      const prevIndex =
                        (activeCategoryIndex - 1 + showcaseCategories.length) %
                        showcaseCategories.length;
                      setActiveCategoryIndex(prevIndex);
                    }}
                  >
                    <ChevronLeft className="w-5 h-5 md:w-6 md:h-6 group-hover:-translate-x-0.5 transition-transform" />
                  </Button>

                  {/* Showcase Grid - Dynamic Scaling */}
                  <div className="flex items-end justify-center w-full gap-1 sm:gap-3 md:gap-8 px-0">
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
                              ? "w-full md:w-[50%] z-20"
                              : "hidden md:block w-[18%] z-10 opacity-40 grayscale hover:opacity-100 hover:grayscale-0",
                            isActive
                              ? "md:scale-105 scale-100"
                              : "scale-90 translate-y-4",
                          )}
                        >
                          <div
                            className={cn(
                              "relative overflow-hidden shadow-[0_30px_60px_-15px_rgba(0,0,0,0.3)] transition-all duration-700",
                              isActive
                                ? "rounded-2xl sm:rounded-[2.5rem] md:rounded-[3rem] aspect-[4/3] min-h-[260px] sm:min-h-[300px] md:min-h-[420px] lg:min-h-[500px]"
                                : "rounded-[2.5rem] aspect-[4/5]",
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
                    className="absolute right-1 sm:right-0 md:-right-12 z-30 h-9 w-9 sm:h-10 sm:w-10 md:h-12 md:w-12 rounded-full bg-white/90 backdrop-blur-md shadow-lg border border-slate-100 hover:bg-white text-slate-900 group transition-all active:scale-95"
                    onClick={() => {
                      const nextIndex =
                        (activeCategoryIndex + 1) % showcaseCategories.length;
                      setActiveCategoryIndex(nextIndex);
                    }}
                  >
                    <ChevronRight className="w-5 h-5 md:w-6 md:h-6 group-hover:translate-x-0.5 transition-transform" />
                  </Button>
                </div>

                {/* Details Revealed Below Active Card */}
                <div className="mt-8 w-full max-w-5xl animate-in fade-in slide-in-from-top-4 duration-700">
                  <div className="space-y-12 text-center sm:text-left py-8 px-4 md:px-0 max-h-[700px] overflow-y-auto scrollbar-hide">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                      <div className="space-y-4">
                        <div className="w-12 h-1 bg-primary rounded-full hidden sm:block"></div>
                        <h4 className="text-2xl md:text-3xl font-black text-slate-900 leading-tight">
                          {showcaseCategories[activeCategoryIndex].phrase}
                        </h4>
                        <p className="text-slate-600 font-medium text-lg leading-relaxed">
                          {showcaseCategories[activeCategoryIndex].details}
                        </p>
                      </div>

                      <div className="space-y-4">
                        <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Why Choose Us?
                        </h5>
                        <ul className="space-y-3">
                          {showcaseCategories[activeCategoryIndex].bullets.map(
                            (bullet, i) => (
                              <li
                                key={i}
                                className="flex items-center gap-3 text-slate-700 font-bold justify-center sm:justify-start"
                              >
                                <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                                <span className="text-[15px]">{bullet}</span>
                              </li>
                            ),
                          )}
                        </ul>
                      </div>
                    </div>

                    <div className="pt-8 border-t border-slate-200/50 flex flex-col sm:flex-row items-center justify-between gap-6">
                      <div className="hidden sm:block">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                          Status
                        </p>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                          <span className="text-sm font-bold text-slate-700 tracking-tight">
                            Active matches in your area
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
                        <Button
                          onClick={handleHiringHelper}
                          size="lg"
                          className="h-14 px-10 rounded-2xl font-bold bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/20 text-lg transition-all hover:scale-105 active:scale-95 w-full sm:w-auto"
                        >
                          {showcaseCategories[activeCategoryIndex].cta}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Job Categories - Commented out by user request */}
          {/* <div className="space-y-6 pt-32 mt-12 scroll-reveal opacity-0 translate-y-10 transition-all duration-1000">
            <h2 className="text-2xl font-semibold text-center text-black">
              Home and family needs in one place            </h2>
            <JobCategories />
          </div> */}

          {/* Benefits Section */}
          <div className="scroll-reveal opacity-0 translate-y-10 transition-all duration-1000">
            <Benefits />
          </div>

          {/* Recent Orders Section */}
          <div className="pt-12 scroll-reveal opacity-0 translate-y-10 transition-all duration-1000">
            <div className="max-w-7xl mx-auto px-4">
              <div className="relative mb-10">
                <h2 className="text-2xl md:text-3xl font-bold text-center text-black">
                  Recent Activity
                </h2>
                <div className="hidden md:flex gap-2 absolute right-0 top-1/2 -translate-y-1/2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-full shadow-sm w-10 h-10 border-gray-200 bg-white/50 backdrop-blur-sm"
                    onClick={() => scrollLeft(recentActivityRef)}
                  >
                    <ChevronLeft className="w-5 h-5 text-gray-700" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-full shadow-sm w-10 h-10 border-gray-200 bg-white/50 backdrop-blur-sm"
                    onClick={() => scrollRight(recentActivityRef)}
                  >
                    <ChevronRight className="w-5 h-5 text-gray-700" />
                  </Button>
                </div>
              </div>

              <div
                ref={recentActivityRef}
                className="flex overflow-x-auto snap-x snap-mandatory gap-6 pb-8 scrollbar-hide -mx-4 px-4 scroll-smooth"
              >
                {[
                  {
                    name: "Anna S.",
                    initials: "AS",
                    role: "Childcare Service",
                    icon: <Baby className="w-5 h-5 text-purple-500" />,
                    gradient: "from-blue-400 to-indigo-500",
                    description:
                      "Looking for a reliable nanny for my 3-year-old daughter, 3 days a week from 9 AM to 2 PM. Must have experience with toddlers.",
                    rate: "₪80/hour",
                  },
                  {
                    name: "David L.",
                    initials: "DL",
                    role: "House Cleaning",
                    icon: <Sparkles className="w-5 h-5 text-orange-500" />,
                    gradient: "from-orange-400 to-red-500",
                    description:
                      "Need deep cleaning for a 4-bedroom apartment. Includes kitchen, bathrooms, and all common areas. One-time service needed this weekend.",
                    rate: "₪120/hour",
                  },
                  {
                    name: "Rachel M.",
                    initials: "RS",
                    role: "Childcare Service",
                    icon: <Baby className="w-5 h-5 text-purple-500" />,
                    gradient: "from-purple-400 to-pink-500",
                    description:
                      "Seeking an experienced babysitter for evening care, 2-3 times per week. Two children ages 5 and 7. Must be available from 6 PM to 10 PM.",
                    rate: "₪90/hour",
                  },
                  {
                    name: "Tom K.",
                    initials: "TM",
                    role: "House Cleaning",
                    icon: <Sparkles className="w-5 h-5 text-orange-500" />,
                    gradient: "from-green-400 to-emerald-500",
                    description:
                      "Regular weekly cleaning service for a 3-bedroom house. Prefer someone who can come every Thursday morning. Long-term arrangement preferred.",
                    rate: "₪100/hour",
                  },
                  {
                    name: "Yael B.",
                    initials: "YB",
                    role: "Private Chef",
                    icon: <Soup className="w-5 h-5 text-red-500" />,
                    gradient: "from-red-400 to-orange-500",
                    description:
                      "Looking for someone to help with weekly meal prep and cooking for a family of 5. Healthy, balanced meals preferred.",
                    rate: "₪150/hour",
                  },
                ].map((order, idx) => (
                  <div
                    key={idx}
                    className="min-w-[320px] md:min-w-[380px] snap-center bg-white rounded-3xl border border-gray-100 shadow-xl p-6 transition-all duration-500 hover:scale-[1.02] hover:bg-gray-50 group"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "h-12 w-12 rounded-full bg-gradient-to-br flex items-center justify-center text-white font-bold text-base shadow-inner",
                            order.gradient,
                          )}
                        >
                          {order.initials}
                        </div>
                        <div>
                          <h3 className="font-bold text-lg text-gray-900 leading-tight group-hover:text-primary transition-colors">
                            {order.name}
                          </h3>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {order.icon}
                            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                              {order.role}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full"
                      >
                        <Flag className="w-4 h-4" />
                      </Button>
                    </div>

                    <p className="text-sm text-gray-700 leading-relaxed min-h-[4.5rem] mb-6">
                      {order.description}
                    </p>

                    <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                          Pricing
                        </span>
                        <span className="font-black text-xl text-primary">
                          {order.rate}
                        </span>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="rounded-full bg-gray-50 hover:bg-gray-100 border-gray-100 shadow-sm font-bold text-xs uppercase tracking-tight"
                      >
                        View Details
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Reviews Section */}
          <div className="pt-24 scroll-reveal opacity-0 translate-y-10 transition-all duration-1000">
            <div className="max-w-7xl mx-auto px-4 pb-12">
              <div className="relative mb-10">
                <h2 className="text-2xl md:text-3xl font-bold text-center text-black">
                  About our helpers
                </h2>
                <div className="hidden md:flex gap-2 absolute right-0 top-1/2 -translate-y-1/2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-full shadow-sm w-10 h-10 border-gray-200 bg-white/50 backdrop-blur-sm"
                    onClick={() => scrollLeft(reviewsRef)}
                  >
                    <ChevronLeft className="w-5 h-5 text-gray-700" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-full shadow-sm w-10 h-10 border-gray-200 bg-white/50 backdrop-blur-sm"
                    onClick={() => scrollRight(reviewsRef)}
                  >
                    <ChevronRight className="w-5 h-5 text-gray-700" />
                  </Button>
                </div>
              </div>
              <div
                ref={reviewsRef}
                className="flex overflow-x-auto snap-x snap-mandatory gap-6 pb-8 scrollbar-hide -mx-4 px-4 scroll-smooth"
              >
                {[
                  {
                    name: "John D.",
                    initials: "JD",
                    image: "/images/helper_profile_2.png",
                    gradient: "from-blue-400 to-purple-500",
                    rating: 4.5,
                    text: "Sarah was absolutely amazing with our two kids! She was punctual, caring, and our children loved spending time with her. Highly recommend her services!",
                  },
                  {
                    name: "Maria R.",
                    initials: "MR",
                    image: "/images/helper_profile_1.png",
                    gradient: "from-green-400 to-teal-500",
                    rating: 5,
                    text: "The cleaning service was exceptional! Our home has never looked better. The team was professional, thorough, and left everything sparkling clean. Will definitely use again!",
                  },
                  {
                    name: "Sophie T.",
                    initials: "ST",
                    image: "/images/helper_profile_4.png",
                    gradient: "from-orange-400 to-pink-500",
                    rating: 4.8,
                    text: "I hired help for move-out cleaning and it was perfect. Saved me so much time and stress. Highly recommended!",
                  },
                  {
                    name: "Michael B.",
                    initials: "MB",
                    image: "/images/helper_profile_3.png",
                    gradient: "from-red-400 to-indigo-500",
                    rating: 5,
                    text: "Found an excellent cook for our family dinner. The food was delicious and the kitchen was left spotless. Truly professional service.",
                  },
                ].map((review, idx) => (
                  <div
                    key={idx}
                    className="relative min-w-[320px] md:min-w-[400px] snap-center bg-white rounded-3xl border border-gray-100 shadow-xl p-8 pt-14 mt-10 hover:shadow-2xl transition-all duration-500 group"
                  >
                    {/* Floating Avatar */}
                    <div
                      className={cn(
                        "absolute -top-10 left-8 h-20 w-20 rounded-full bg-gradient-to-br p-1.5 shadow-xl group-hover:scale-110 transition-transform duration-500",
                        review.gradient,
                      )}
                    >
                      <Avatar className="h-full w-full border-4 border-white">
                        <AvatarImage
                          src={review.image}
                          className="object-cover"
                        />
                        <AvatarFallback className="bg-transparent text-white font-bold text-2xl">
                          {review.initials}
                        </AvatarFallback>
                      </Avatar>
                    </div>

                    <div className="flex flex-col">
                      <div className="flex items-center justify-between gap-4 mb-4">
                        <h4 className="text-xl font-bold text-gray-900 group-hover:text-primary transition-colors">
                          {review.name}
                        </h4>
                        <div className="flex items-center gap-1.5 bg-yellow-400/10 px-3 py-1 rounded-full border border-yellow-400/20">
                          <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                          <span className="text-[13px] font-black text-yellow-700">
                            {review.rating}
                          </span>
                        </div>
                      </div>
                      <p className="text-gray-700 leading-relaxed italic text-base md:text-lg">
                        "{review.text}"
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />

      {/* Fixed bottom bar - Mobile only, always on */}
      <div className="fixed bottom-0 left-0 right-0 p-4 pb-6 pt-3 bg-white/95 backdrop-blur-md border-t border-slate-100 shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.1)] z-40 md:hidden">
        <div className="max-w-lg mx-auto flex flex-row gap-3 justify-center px-1">
          <Button
            onClick={handleSearchingForJob}
            className="h-12 rounded-[1.25rem] px-4 bg-orange-50 hover:bg-orange-100 text-orange-600 shadow-sm flex-1 gap-2 text-[13px] font-black tracking-tight"
          >
            <Briefcase className="w-4 h-4" />
            BE A HELPER
          </Button>
          <Button
            onClick={handleHiringHelper}
            className="h-12 rounded-[1.25rem] px-4 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-md shadow-orange-500/20 flex-1 gap-2 text-[13px] font-black tracking-tight"
          >
            <Users className="w-4 h-4" />
            HIRE A HELPER
          </Button>
        </div>
      </div>
      {/* WhatsApp Floating Contact Button */}
      <WhatsAppButton phoneNumber="972541234567" />
    </div>
  );
}
