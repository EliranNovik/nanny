import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Briefcase, Users, LogIn, Baby, Sparkles, Star, Flag, Menu, X, Home, ClipboardList, UserCheck, MessageCircle, CheckCircle2, Soup, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import JobCategories from "@/components/JobCategories";
import Benefits from "@/components/Benefits";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { cn } from "@/lib/utils";

export default function LandingPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showFixedButtons, setShowFixedButtons] = useState(false);
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

  useEffect(() => {
    const el = buttonsRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowFixedButtons(!entry.isIntersecting),
      { threshold: 0, rootMargin: "0px 0px -10px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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

      {/* Main Content - extra top padding on mobile for taller header */}
      <main className="flex-1 p-4 py-12 pt-[100px] md:pt-24">
        <div className="max-w-7xl mx-auto space-y-12">
          {/* Hero Section */}
          <div className="text-center space-y-6">
            <h1 className="text-4xl md:text-5xl font-bold">
              Find Help in Minutes
            </h1>
            <p className="text-lg text-gray-600 max-w-xl mx-auto">
              Connect with trusted helpers or find families who need your services
            </p>

            {/* Hero Image with Buttons and Service Boxes */}
            <div className="mt-8 md:mt-12 flex justify-center">
              <div className="relative w-full max-w-7xl min-h-[500px] md:min-h-[800px] overflow-visible">
                {/* Background Image Container */}
                <div className="relative w-full h-full min-h-[500px] md:min-h-[800px] rounded-2xl md:rounded-3xl overflow-visible">
                  {/* Background Image with rounded corners */}
                  <img
                    src="/background image new.png"
                    alt="Happy mother and child"
                    className="absolute inset-0 w-full h-full object-cover z-0 rounded-2xl md:rounded-3xl"
                  />

                  {/* Dark overlay only on top portion for better button visibility */}
                  <div className="absolute top-0 left-0 right-0 h-[200px] md:h-[250px] bg-gradient-to-b from-black/40 via-black/15 to-transparent rounded-t-2xl md:rounded-t-3xl z-[1]"></div>

                  {/* Content overlay */}
                  <div className="relative z-10 p-4 md:p-6">
                    {/* Buttons - Desktop: Left side of image */}
                    <div className="hidden md:flex flex-row gap-4 absolute left-6 top-6 z-20">
                      <Button
                        onClick={handleSearchingForJob}
                        size="lg"
                        className="h-32 flex flex-col items-center justify-center gap-3 text-base bg-white hover:bg-gray-50 text-orange-500 shadow-lg rounded-lg min-w-[250px]"
                      >
                        <Briefcase className="w-8 h-8" />
                        <span className="text-base font-medium">Searching for a Job</span>
                      </Button>

                      <Button
                        onClick={handleHiringHelper}
                        size="lg"
                        className="h-32 flex flex-col items-center justify-center gap-3 text-base bg-orange-500 hover:bg-orange-600 text-white shadow-lg rounded-lg min-w-[250px]"
                      >
                        <Users className="w-8 h-8" />
                        <span className="text-base font-medium">Hiring a Helper</span>
                      </Button>
                    </div>

                    {/* Logo - Desktop: Right side of image, same line as buttons */}
                    <div className="hidden md:block absolute right-6 top-6 z-20">
                      <img
                        src="/ChatGPT Image Jan 19, 2026, 08_14_59 PM.png"
                        alt="MamaLama Logo"
                        className="h-32 w-auto rounded-xl"
                      />
                    </div>

                  </div>

                  {/* Oval (pill) buttons - Mobile Only: on image, centered, top (ref for scroll) */}
                  <div ref={buttonsRef} className="absolute left-1/2 -translate-x-1/2 top-6 flex flex-row gap-3 md:hidden z-20 w-full px-4 justify-center">
                    <Button
                      onClick={handleSearchingForJob}
                      className="h-11 rounded-full px-8 bg-white hover:bg-gray-50 text-orange-500 shadow-lg flex-1 min-w-[140px] gap-2 text-sm font-medium whitespace-nowrap"
                    >
                      <Briefcase className="w-5 h-5 flex-shrink-0" />
                      Find a Job
                    </Button>
                    <Button
                      onClick={handleHiringHelper}
                      className="h-11 rounded-full px-8 bg-orange-500 hover:bg-orange-600 text-white shadow-lg flex-1 min-w-[140px] gap-2 text-sm font-medium whitespace-nowrap"
                    >
                      <Users className="w-5 h-5 flex-shrink-0" />
                      Hire a Helper
                    </Button>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* How finding a helper works */}
          <div className="max-w-6xl mx-auto pt-12 px-4 scroll-reveal opacity-0 translate-y-10 transition-all duration-1000 delay-200">
            <h2 className="text-2xl md:text-3xl font-semibold text-center mb-8 md:mb-10 text-black">
              How finding a helper works
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              <div className="flex items-start gap-4 md:flex-col md:items-center md:text-center">
                <div className="h-12 w-12 md:h-14 md:w-14 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <ClipboardList className="w-6 h-6 md:w-7 md:h-7 text-primary" />
                </div>
                <div className="md:flex-1">
                  <p className="text-base md:text-lg font-medium text-black">1. Post your request</p>
                  <p className="text-sm text-gray-600 mt-1">
                    Answer a few short filter questions with simple taps. We match you with helpers who meet your criteria.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 md:flex-col md:items-center md:text-center">
                <div className="h-12 w-12 md:h-14 md:w-14 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Users className="w-6 h-6 md:w-7 md:h-7 text-primary" />
                </div>
                <div className="md:flex-1">
                  <p className="text-base md:text-lg font-medium text-black">2. Get matched</p>
                  <p className="text-sm text-gray-600 mt-1">
                    Helpers in your area see your request and respond. You’ll see who’s available and interested.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 md:flex-col md:items-center md:text-center">
                <div className="h-12 w-12 md:h-14 md:w-14 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <UserCheck className="w-6 h-6 md:w-7 md:h-7 text-primary" />
                </div>
                <div className="md:flex-1">
                  <p className="text-base md:text-lg font-medium text-black">3. Choose your helper</p>
                  <p className="text-sm text-gray-600 mt-1">
                    Look at profiles and pick the person who fits you best. No pressure—you’re in control.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 md:flex-col md:items-center md:text-center">
                <div className="h-12 w-12 md:h-14 md:w-14 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <MessageCircle className="w-6 h-6 md:w-7 md:h-7 text-primary" />
                </div>
                <div className="md:flex-1">
                  <p className="text-base md:text-lg font-medium text-black">4. Chat and confirm</p>
                  <p className="text-sm text-gray-600 mt-1">
                    Message your helper to sort out details, schedule, and anything else. Confirm when you’re both ready.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 md:flex-col md:items-center md:text-center">
                <div className="h-12 w-12 md:h-14 md:w-14 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-6 h-6 md:w-7 md:h-7 text-primary" />
                </div>
                <div className="md:flex-1">
                  <p className="text-base md:text-lg font-medium text-black">5. You’re all set</p>
                  <p className="text-sm text-gray-600 mt-1">
                    Your helper comes at the agreed time. Relax—you’ve found the right person.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Job Categories */}
          <div className="space-y-6 pt-32 mt-12 scroll-reveal opacity-0 translate-y-10 transition-all duration-1000">
            <h2 className="text-2xl font-semibold text-center text-black">
              Services
            </h2>
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
                    gradient: "from-blue-400 to-purple-500",
                    rating: 4.5,
                    text: "Sarah was absolutely amazing with our two kids! She was punctual, caring, and our children loved spending time with her. Highly recommend her services!"
                  },
                  {
                    name: "Maria R.",
                    initials: "MR",
                    gradient: "from-green-400 to-teal-500",
                    rating: 5,
                    text: "The cleaning service was exceptional! Our home has never looked better. The team was professional, thorough, and left everything sparkling clean. Will definitely use again!"
                  },
                  {
                    name: "Sophie T.",
                    initials: "ST",
                    gradient: "from-orange-400 to-pink-500",
                    rating: 4.8,
                    text: "I hired help for move-out cleaning and it was perfect. Saved me so much time and stress. Highly recommended!"
                  },
                  {
                    name: "Michael B.",
                    initials: "MB",
                    gradient: "from-red-400 to-indigo-500",
                    rating: 5,
                    text: "Found an excellent cook for our family dinner. The food was delicious and the kitchen was left spotless. Truly professional service."
                  }
                ].map((review, idx) => (
                  <div
                    key={idx}
                    className="min-w-[320px] md:min-w-[400px] snap-center bg-white rounded-3xl border border-gray-100 shadow-xl p-8 hover:bg-gray-50 transition-all duration-300 group"
                  >
                    <div className="flex items-start gap-5">
                      <div className={cn(
                        "h-14 w-14 rounded-full bg-gradient-to-br flex items-center justify-center text-white font-bold text-lg shadow-inner flex-shrink-0",
                        review.gradient
                      )}>
                        {review.initials}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-4 mb-2">
                          <h4 className="text-lg font-bold text-gray-900 group-hover:text-primary transition-colors">
                            {review.name}
                          </h4>
                          <div className="flex items-center gap-1 bg-yellow-400/10 px-2 py-1 rounded-full">
                            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                            <span className="text-xs font-black text-yellow-700">{review.rating}</span>
                          </div>
                        </div>
                        <p className="text-gray-700 leading-relaxed italic text-sm md:text-base">
                          "{review.text}"
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Fixed bottom bar - Mobile only, when buttons scroll out of view */}
      {showFixedButtons && (
        <div className="fixed bottom-0 left-0 right-0 p-4 pb-6 pt-3 bg-background/95 backdrop-blur-md border-t shadow-lg z-40 md:hidden">
          <div className="max-w-lg mx-auto flex flex-row gap-3 justify-center px-2">
            <Button
              onClick={handleSearchingForJob}
              className="h-11 rounded-full px-8 bg-white hover:bg-gray-50 text-orange-500 shadow-lg flex-1 min-w-[140px] gap-2 text-sm font-medium whitespace-nowrap"
            >
              <Briefcase className="w-5 h-5 flex-shrink-0" />
              Find a Job
            </Button>
            <Button
              onClick={handleHiringHelper}
              className="h-11 rounded-full px-8 bg-orange-500 hover:bg-orange-600 text-white shadow-lg flex-1 min-w-[140px] gap-2 text-sm font-medium whitespace-nowrap"
            >
              <Users className="w-5 h-5 flex-shrink-0" />
              Hire a Helper
            </Button>
          </div>
        </div>
      )}
      {/* WhatsApp Floating Contact Button */}
      <WhatsAppButton phoneNumber="972541234567" />
    </div>
  );
}
