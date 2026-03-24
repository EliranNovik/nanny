import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Briefcase, Users, LogIn, Baby, Sparkles, Star, Flag, Menu, X, Home, ClipboardList, UserCheck, MessageCircle, CheckCircle2, Soup, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import JobCategories from "@/components/JobCategories";
import Benefits from "@/components/Benefits";
import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { cn } from "@/lib/utils";

export default function LandingPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const buttonsRef = useRef<HTMLDivElement>(null);
  const dashboardPath = profile?.role === "freelancer" ? "/freelancer/dashboard" : "/dashboard";
  const jobsPath = profile?.role === "freelancer" ? "/freelancer/active-jobs" : "/client/active-jobs";
  const profilePath = profile?.role === "freelancer" ? "/freelancer/profile" : "/client/profile";

  const recentActivityRef = useRef<HTMLDivElement>(null);
  const reviewsRef = useRef<HTMLDivElement>(null);

  const scrollLeft = (ref: React.RefObject<HTMLDivElement>) => {
    if (ref.current) {
      ref.current.scrollBy({ left: -400, behavior: 'smooth' });
    }
  };

  const scrollRight = (ref: React.RefObject<HTMLDivElement>) => {
    if (ref.current) {
      ref.current.scrollBy({ left: 400, behavior: 'smooth' });
    }
  };


  // Scroll Reveal Animation Effect
  useEffect(() => {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: "0px 0px -50px 0px"
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('opacity-100', 'translate-y-0');
          entry.target.classList.remove('opacity-0', 'translate-y-10');
        }
      });
    }, observerOptions);

    const revealElements = document.querySelectorAll('.scroll-reveal');
    revealElements.forEach(el => observer.observe(el));

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
    <div className="min-h-screen gradient-mesh flex flex-col">
      {/* Header - taller on mobile, glassy */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/30 backdrop-blur-xl border-none min-h-[72px] md:min-h-0 flex items-center">
        <div className="max-w-7xl mx-auto px-4 w-full py-4 md:py-4">
          <div className="flex items-center justify-between">
            {/* Hamburger Menu - Mobile Only: icon only, no box */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 text-black hover:text-gray-600 transition-colors"
              aria-label="Toggle menu"
            >
              {isMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>

            {/* Logo - Desktop Only */}
            <Link to="/" className="hidden md:flex items-center gap-2">
              <img
                src="/ChatGPT Image Jan 19, 2026, 08_14_59 PM.png"
                alt="MamaLama Logo"
                className="h-10 w-auto rounded-xl"
              />
            </Link>

            {/* Welcome - when logged in: Hi, (username) + profile image */}
            {user && (
              <div className="flex items-center gap-2 min-w-0 flex-1 justify-center md:justify-center">
                <Avatar className="h-10 w-10 md:h-11 md:w-11 border border-primary/20 flex-shrink-0">
                  <AvatarImage src={profile?.photo_url || undefined} alt="" />
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                    {profile?.full_name
                      ?.split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2) || "?"}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium text-black truncate">
                  Hi, {profile?.full_name?.split(" ")[0] || "there"}
                </span>
              </div>
            )}

            {/* Log In / Home - Mobile Only (right side of header) */}
            {user ? (
              <Link to={dashboardPath} className="md:hidden">
                <Button variant="outline" size="sm" className="gap-2">
                  <Home className="w-4 h-4" />
                  Home
                </Button>
              </Link>
            ) : (
              <Link to="/login" className="md:hidden">
                <Button variant="outline" size="sm" className="gap-2">
                  <LogIn className="w-4 h-4" />
                  Log In
                </Button>
              </Link>
            )}

            {/* Mobile Menu */}
            {isMenuOpen && (
              <div className="md:hidden fixed top-[72px] left-0 right-0 bg-background/95 backdrop-blur-md z-50">
                <nav className="flex flex-col p-4 space-y-4">
                  <Link
                    to="/about"
                    onClick={() => setIsMenuOpen(false)}
                    className="text-sm font-medium text-gray-600 hover:text-white transition-colors"
                  >
                    About Us
                  </Link>
                  <Link
                    to="/contact"
                    onClick={() => setIsMenuOpen(false)}
                    className="text-sm font-medium text-gray-600 hover:text-white transition-colors"
                  >
                    Contact
                  </Link>
                  {user ? (
                    <>
                      <Link
                        to={dashboardPath}
                        onClick={() => setIsMenuOpen(false)}
                        className="text-sm font-medium text-gray-600 hover:text-white transition-colors"
                      >
                        Dashboard
                      </Link>
                      <Link
                        to={jobsPath}
                        onClick={() => setIsMenuOpen(false)}
                        className="text-sm font-medium text-gray-600 hover:text-white transition-colors"
                      >
                        Jobs
                      </Link>
                      <Link
                        to="/messages"
                        onClick={() => setIsMenuOpen(false)}
                        className="text-sm font-medium text-gray-600 hover:text-white transition-colors"
                      >
                        Messages
                      </Link>
                      <Link
                        to={profilePath}
                        onClick={() => setIsMenuOpen(false)}
                        className="text-sm font-medium text-gray-600 hover:text-white transition-colors"
                      >
                        Profile
                      </Link>
                    </>
                  ) : (
                    <Link to="/login" onClick={() => setIsMenuOpen(false)}>
                      <Button variant="outline" size="sm" className="w-full">
                        Log In
                      </Button>
                    </Link>
                  )}
                </nav>
              </div>
            )}

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-6">
              <Link
                to="/about"
                className="text-sm font-medium text-gray-600 hover:text-white transition-colors"
              >
                About Us
              </Link>
              <Link
                to="/contact"
                className="text-sm font-medium text-gray-600 hover:text-white transition-colors"
              >
                Contact
              </Link>
              {user ? (
                <Link to={dashboardPath}>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Home className="w-4 h-4" />
                    Home
                  </Button>
                </Link>
              ) : (
                <Link to="/login">
                  <Button variant="outline" size="sm" className="gap-2">
                    <LogIn className="w-4 h-4" />
                    Log In
                  </Button>
                </Link>
              )}
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content - No top padding to allow Hero to flow behind header */}
      <main className="flex-1 pt-0">
        {/* Full-Screen Hero Section */}
        <section className="relative w-full h-[90vh] md:h-[110vh] overflow-hidden group/hero">
          {/* Background Image - Full Bleed */}
          <img
            src="/background image new.png"
            alt="Happy mother and child"
            className="absolute inset-0 w-full h-full object-cover z-0 transition-transform duration-1000 group-hover/hero:scale-105"
          />

          {/* Sophisticated Gradients for depth and readability */}
          <div className="absolute inset-0 bg-black/10 z-[1]"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-transparent z-[2]"></div>

          {/* Left-Aligned Text - Subtler Glass Effect */}
          <div className="absolute left-6 right-8 md:left-0 md:right-0 md:inset-x-0 top-16 md:top-32 flex flex-col items-start md:pl-32 z-10 w-[85%] md:w-auto">
            <div className="max-w-xl w-full bg-white/5 backdrop-blur-sm border border-white/5 p-5 md:p-8 rounded-[2rem] text-left space-y-4 md:space-y-6 animate-in fade-in slide-in-from-left-10 duration-1000 shadow-sm">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight leading-tight text-white drop-shadow-lg">
                Bringing <span className="bg-primary/40 text-orange-200 px-3 py-1 rounded-xl border border-orange-400/20 inline-block rotate-[-1deg]">families</span> and helpers together
              </h1>
              <p className="text-lg md:text-xl text-white/90 max-w-md font-medium drop-shadow-md">
                Find support, share skills, and connect within minutes.
              </p>
            </div>
          </div>

          {/* Right-Aligned Stacked CTAs - Desktop Only */}
          <div ref={buttonsRef} className="hidden md:flex absolute inset-x-0 bottom-8 md:bottom-48 md:right-32 flex-col items-end gap-8 z-20 px-0">
            <Button
              onClick={handleSearchingForJob}
              className="group/btn h-40 w-80 flex flex-col items-center justify-center gap-4 bg-white/90 hover:bg-white backdrop-blur-xl border border-white/40 shadow-2xl rounded-[3rem] transition-all duration-500 hover:-translate-x-2"
            >
              <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center group-hover/btn:scale-110 transition-all duration-500 flex-shrink-0">
                <Briefcase className="w-7 h-7" />
              </div>
              <div className="text-center">
                <span className="block text-lg font-black text-slate-900 uppercase tracking-tight leading-tight">Be the helper</span>
                <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest opacity-80 mt-1">Join our network</span>
              </div>
            </Button>

            <Button
              onClick={handleHiringHelper}
              className="group/btn h-40 w-80 flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white shadow-[0_20px_40px_-12px_rgba(249,115,22,0.5)] border-t border-white/20 rounded-[3rem] transition-all duration-500 hover:-translate-x-2"
            >
              <div className="h-14 w-14 rounded-2xl bg-white/20 text-white flex items-center justify-center group-hover/btn:scale-110 transition-all duration-500 flex-shrink-0">
                <Users className="w-7 h-7" />
              </div>
              <div className="text-center">
                <span className="block text-lg font-black uppercase tracking-tight leading-tight">Hire a Helper</span>
                <span className="block text-[10px] font-bold text-orange-50/70 uppercase tracking-widest mt-1">Post a request</span>
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
                { icon: <ClipboardList />, title: "1. Post request", desc: "Answer a few short taps to match with local helpers." },
                { icon: <Users />, title: "2. Get matched", desc: "Helpers in your area see and respond to your request." },
                { icon: <UserCheck />, title: "3. Choose helper", desc: "Pick the person who fits you best from their profiles." },
                { icon: <MessageCircle />, title: "4. Chat & confirm", desc: "Sort out details and schedule through direct chat." },
                { icon: <CheckCircle2 />, title: "5. You're set!", desc: "Your helper arrives as agreed. Relax and enjoy." }
              ].map((step, idx) => (
                <div key={idx} className="group relative flex flex-col items-center text-center p-8 bg-white/40 backdrop-blur-sm border border-slate-100 rounded-[2.5rem] shadow-sm hover:shadow-xl hover:bg-white transition-all duration-500 hover:-translate-y-2">
                  <div className="h-20 w-20 rounded-3xl bg-primary/10 text-primary flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-inner">
                    {React.cloneElement(step.icon as React.ReactElement, { className: "w-10 h-10" })}
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3 leading-tight">{step.title}</h3>
                  <p className="text-sm text-slate-600 font-medium leading-relaxed">{step.desc}</p>

                  {/* Subtle connecting line for desktop */}
                  {idx < 4 && (
                    <div className="hidden lg:block absolute top-1/3 -right-6 w-12 h-[2px] bg-gradient-to-r from-primary/20 to-transparent z-0"></div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Job Categories */}
          <div className="space-y-6 pt-32 mt-12 scroll-reveal opacity-0 translate-y-10 transition-all duration-1000">
            <h2 className="text-2xl font-semibold text-center text-black">
              Home and family needs in one place            </h2>
            <JobCategories />
          </div>

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
                  <Button variant="outline" size="icon" className="rounded-full shadow-sm w-10 h-10 border-gray-200 bg-white/50 backdrop-blur-sm" onClick={() => scrollLeft(recentActivityRef)}>
                    <ChevronLeft className="w-5 h-5 text-gray-700" />
                  </Button>
                  <Button variant="outline" size="icon" className="rounded-full shadow-sm w-10 h-10 border-gray-200 bg-white/50 backdrop-blur-sm" onClick={() => scrollRight(recentActivityRef)}>
                    <ChevronRight className="w-5 h-5 text-gray-700" />
                  </Button>
                </div>
              </div>

              <div ref={recentActivityRef} className="flex overflow-x-auto snap-x snap-mandatory gap-6 pb-8 scrollbar-hide -mx-4 px-4 scroll-smooth">
                {[
                  {
                    name: "Anna S.",
                    initials: "AS",
                    role: "Childcare Service",
                    icon: <Baby className="w-5 h-5 text-purple-500" />,
                    gradient: "from-blue-400 to-indigo-500",
                    description: "Looking for a reliable nanny for my 3-year-old daughter, 3 days a week from 9 AM to 2 PM. Must have experience with toddlers.",
                    rate: "₪80/hour"
                  },
                  {
                    name: "David L.",
                    initials: "DL",
                    role: "House Cleaning",
                    icon: <Sparkles className="w-5 h-5 text-orange-500" />,
                    gradient: "from-orange-400 to-red-500",
                    description: "Need deep cleaning for a 4-bedroom apartment. Includes kitchen, bathrooms, and all common areas. One-time service needed this weekend.",
                    rate: "₪120/hour"
                  },
                  {
                    name: "Rachel M.",
                    initials: "RS",
                    role: "Childcare Service",
                    icon: <Baby className="w-5 h-5 text-purple-500" />,
                    gradient: "from-purple-400 to-pink-500",
                    description: "Seeking an experienced babysitter for evening care, 2-3 times per week. Two children ages 5 and 7. Must be available from 6 PM to 10 PM.",
                    rate: "₪90/hour"
                  },
                  {
                    name: "Tom K.",
                    initials: "TM",
                    role: "House Cleaning",
                    icon: <Sparkles className="w-5 h-5 text-orange-500" />,
                    gradient: "from-green-400 to-emerald-500",
                    description: "Regular weekly cleaning service for a 3-bedroom house. Prefer someone who can come every Thursday morning. Long-term arrangement preferred.",
                    rate: "₪100/hour"
                  },
                  {
                    name: "Yael B.",
                    initials: "YB",
                    role: "Private Chef",
                    icon: <Soup className="w-5 h-5 text-red-500" />,
                    gradient: "from-red-400 to-orange-500",
                    description: "Looking for someone to help with weekly meal prep and cooking for a family of 5. Healthy, balanced meals preferred.",
                    rate: "₪150/hour"
                  }
                ].map((order, idx) => (
                  <div
                    key={idx}
                    className="min-w-[320px] md:min-w-[380px] snap-center bg-white rounded-3xl border border-gray-100 shadow-xl p-6 transition-all duration-500 hover:scale-[1.02] hover:bg-gray-50 group"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "h-12 w-12 rounded-full bg-gradient-to-br flex items-center justify-center text-white font-bold text-base shadow-inner",
                          order.gradient
                        )}>
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
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full">
                        <Flag className="w-4 h-4" />
                      </Button>
                    </div>

                    <p className="text-sm text-gray-700 leading-relaxed min-h-[4.5rem] mb-6">
                      {order.description}
                    </p>

                    <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Pricing</span>
                        <span className="font-black text-xl text-primary">{order.rate}</span>
                      </div>
                      <Button variant="secondary" size="sm" className="rounded-full bg-gray-50 hover:bg-gray-100 border-gray-100 shadow-sm font-bold text-xs uppercase tracking-tight">
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
                  <Button variant="outline" size="icon" className="rounded-full shadow-sm w-10 h-10 border-gray-200 bg-white/50 backdrop-blur-sm" onClick={() => scrollLeft(reviewsRef)}>
                    <ChevronLeft className="w-5 h-5 text-gray-700" />
                  </Button>
                  <Button variant="outline" size="icon" className="rounded-full shadow-sm w-10 h-10 border-gray-200 bg-white/50 backdrop-blur-sm" onClick={() => scrollRight(reviewsRef)}>
                    <ChevronRight className="w-5 h-5 text-gray-700" />
                  </Button>
                </div>
              </div>
              <div ref={reviewsRef} className="flex overflow-x-auto snap-x snap-mandatory gap-6 pb-8 scrollbar-hide -mx-4 px-4 scroll-smooth">
                {[
                  {
                    name: "John D.",
                    initials: "JD",
                    image: "/images/helper_profile_2.png",
                    gradient: "from-blue-400 to-purple-500",
                    rating: 4.5,
                    text: "Sarah was absolutely amazing with our two kids! She was punctual, caring, and our children loved spending time with her. Highly recommend her services!"
                  },
                  {
                    name: "Maria R.",
                    initials: "MR",
                    image: "/images/helper_profile_1.png",
                    gradient: "from-green-400 to-teal-500",
                    rating: 5,
                    text: "The cleaning service was exceptional! Our home has never looked better. The team was professional, thorough, and left everything sparkling clean. Will definitely use again!"
                  },
                  {
                    name: "Sophie T.",
                    initials: "ST",
                    image: "/images/helper_profile_4.png",
                    gradient: "from-orange-400 to-pink-500",
                    rating: 4.8,
                    text: "I hired help for move-out cleaning and it was perfect. Saved me so much time and stress. Highly recommended!"
                  },
                  {
                    name: "Michael B.",
                    initials: "MB",
                    image: "/images/helper_profile_3.png",
                    gradient: "from-red-400 to-indigo-500",
                    rating: 5,
                    text: "Found an excellent cook for our family dinner. The food was delicious and the kitchen was left spotless. Truly professional service."
                  }
                ].map((review, idx) => (
                  <div
                    key={idx}
                    className="relative min-w-[320px] md:min-w-[400px] snap-center bg-white rounded-3xl border border-gray-100 shadow-xl p-8 pt-14 mt-10 hover:shadow-2xl transition-all duration-500 group"
                  >
                    {/* Floating Avatar */}
                    <div className={cn(
                      "absolute -top-10 left-8 h-20 w-20 rounded-full bg-gradient-to-br p-1.5 shadow-xl group-hover:scale-110 transition-transform duration-500",
                      review.gradient
                    )}>
                      <Avatar className="h-full w-full border-4 border-white">
                        <AvatarImage src={review.image} className="object-cover" />
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
                          <span className="text-[13px] font-black text-yellow-700">{review.rating}</span>
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
