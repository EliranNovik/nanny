import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Briefcase, Users, LogIn, Baby, Sparkles, Star, Flag, Menu, X, Home, ClipboardList, UserCheck, MessageCircle, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import JobCategories from "@/components/JobCategories";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function LandingPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showFixedButtons, setShowFixedButtons] = useState(false);
  const buttonsRef = useRef<HTMLDivElement>(null);
  const dashboardPath = profile?.role === "freelancer" ? "/freelancer/dashboard" : "/dashboard";
  const jobsPath = profile?.role === "freelancer" ? "/freelancer/active-jobs" : "/client/active-jobs";
  const profilePath = profile?.role === "freelancer" ? "/freelancer/profile" : "/client/profile";

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
      <header className="fixed top-0 left-0 right-0 w-full z-50 border-b bg-white/90 backdrop-blur-lg md:bg-background/80 md:backdrop-blur-sm min-h-[72px] md:min-h-0 flex items-center">
        <div className="max-w-7xl mx-auto px-4 w-full py-4 md:py-4">
          <div className="flex items-center justify-between">
            {/* Hamburger Menu - Mobile Only: icon only, no box */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 text-foreground hover:text-foreground/80 transition-colors"
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
                <span className="text-sm font-medium text-foreground truncate">
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
              <div className="md:hidden fixed top-[72px] left-0 right-0 bg-white/95 backdrop-blur-md border-b shadow-lg z-50">
                <nav className="flex flex-col p-4 space-y-4">
                  <Link
                    to="/about"
                    onClick={() => setIsMenuOpen(false)}
                    className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    About Us
                  </Link>
                  <Link
                    to="/contact"
                    onClick={() => setIsMenuOpen(false)}
                    className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Contact
                  </Link>
                  {user ? (
                    <>
                      <Link
                        to={dashboardPath}
                        onClick={() => setIsMenuOpen(false)}
                        className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Dashboard
                      </Link>
                      <Link
                        to={jobsPath}
                        onClick={() => setIsMenuOpen(false)}
                        className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Jobs
                      </Link>
                      <Link
                        to="/messages"
                        onClick={() => setIsMenuOpen(false)}
                        className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Messages
                      </Link>
                      <Link
                        to={profilePath}
                        onClick={() => setIsMenuOpen(false)}
                        className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
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
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                About Us
              </Link>
              <Link
                to="/contact"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
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
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
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
                        className="h-32 flex flex-col items-center justify-center gap-3 text-base bg-orange-500 hover:bg-orange-600 text-white shadow-lg rounded-lg min-w-[250px]"
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
                  <div ref={buttonsRef} className="absolute left-1/2 -translate-x-1/2 top-6 flex flex-row gap-2 md:hidden z-20">
                    <Button
                      onClick={handleSearchingForJob}
                      className="h-11 rounded-full px-5 bg-orange-500 hover:bg-orange-600 text-white shadow-lg flex-shrink-0 gap-2 text-sm font-medium"
                    >
                      <Briefcase className="w-5 h-5 flex-shrink-0" />
                      Find a Job
                    </Button>
                    <Button
                      onClick={handleHiringHelper}
                      className="h-11 rounded-full px-5 bg-orange-500 hover:bg-orange-600 text-white shadow-lg flex-shrink-0 gap-2 text-sm font-medium"
                    >
                      <Users className="w-5 h-5 flex-shrink-0" />
                      Hire a Helper
                    </Button>
                  </div>
                </div>

                {/* Left Service Boxes - Desktop Only - Inside image, extending slightly on larger screens */}
                <div className="hidden md:block absolute left-6 xl:left-0 top-[320px] xl:-translate-x-12 w-[350px] z-20">
                  {/* Review Box */}
                  <div className="bg-orange-500/20 backdrop-blur-md rounded-2xl p-6 border border-orange-400/30 shadow-lg">
                    <div className="flex items-start gap-4 mb-3">
                      <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center flex-shrink-0 text-white font-bold text-base">
                        JD
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="text-base font-semibold text-white">John D.</h4>
                          <div className="flex items-center gap-1">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`w-4 h-4 ${i < 4
                                  ? "fill-yellow-400 text-yellow-400"
                                  : i === 4
                                    ? "fill-yellow-200 text-yellow-200"
                                    : "fill-gray-300 text-gray-300"
                                  }`}
                              />
                            ))}
                            <span className="text-sm text-white/70 ml-1">4.5</span>
                          </div>
                        </div>
                        <p className="text-sm text-white/90 leading-relaxed">
                          "Sarah was absolutely amazing with our two kids! She was punctual, caring, and our children loved spending time with her. Highly recommend her services!"
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Service Boxes - Desktop Only - Inside image, extending slightly on larger screens */}
                <div className="hidden md:block absolute right-6 xl:right-0 bottom-6 xl:translate-x-12 w-[350px] z-20">
                  {/* Review Box */}
                  <div className="bg-orange-500/20 backdrop-blur-md rounded-2xl p-6 border border-orange-400/30 shadow-lg">
                    <div className="flex items-start gap-4 mb-3">
                      <div className="h-12 w-12 rounded-full bg-gradient-to-br from-green-400 to-teal-500 flex items-center justify-center flex-shrink-0 text-white font-bold text-base">
                        MR
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="text-base font-semibold text-white">Maria R.</h4>
                          <div className="flex items-center gap-1">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`w-4 h-4 ${i < 4
                                  ? "fill-yellow-400 text-yellow-400"
                                  : i === 4
                                    ? "fill-yellow-200 text-yellow-200"
                                    : "fill-gray-300 text-gray-300"
                                  }`}
                              />
                            ))}
                            <span className="text-sm text-white/70 ml-1">4.5</span>
                          </div>
                        </div>
                        <p className="text-sm text-white/90 leading-relaxed">
                          "The cleaning service was exceptional! Our home has never looked better. The team was professional, thorough, and left everything sparkling clean. Will definitely use again!"
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile Glassy Boxes - Below Image */}
            <div className="md:hidden space-y-4 mt-6">
              {/* Childcare Service Box */}
              <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-lg">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                    <Baby className="w-5 h-5 text-purple-600" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">
                    Childcare
                  </h3>
                </div>
                <p className="text-xs text-gray-700 leading-relaxed">
                  Find trusted nannies and babysitters for your children. Professional childcare services tailored to your family's needs.
                </p>
              </div>

              {/* House Cleaning Service Box */}
              <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-lg">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-5 h-5 text-orange-600" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">
                    House Cleaning
                  </h3>
                </div>
                <p className="text-xs text-gray-700 leading-relaxed">
                  Professional cleaning services to keep your home spotless. Regular or one-time deep cleaning available.
                </p>
              </div>

              {/* John D. Review Box */}
              <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-lg">
                <div className="flex items-start gap-3 mb-2">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center flex-shrink-0 text-white font-bold text-sm">
                    JD
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-semibold text-gray-900">John D.</h4>
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-3 h-3 ${i < 4
                              ? "fill-yellow-400 text-yellow-400"
                              : i === 4
                                ? "fill-yellow-200 text-yellow-200"
                                : "fill-gray-300 text-gray-300"
                              }`}
                          />
                        ))}
                        <span className="text-xs text-gray-600 ml-1">4.5</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-700 leading-relaxed">
                      "Sarah was absolutely amazing with our two kids! She was punctual, caring, and our children loved spending time with her. Highly recommend her services!"
                    </p>
                  </div>
                </div>
              </div>

              {/* Maria R. Review Box */}
              <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-lg">
                <div className="flex items-start gap-3 mb-2">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-green-400 to-teal-500 flex items-center justify-center flex-shrink-0 text-white font-bold text-sm">
                    MR
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-semibold text-gray-900">Maria R.</h4>
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-3 h-3 ${i < 4
                              ? "fill-yellow-400 text-yellow-400"
                              : i === 4
                                ? "fill-yellow-200 text-yellow-200"
                                : "fill-gray-300 text-gray-300"
                              }`}
                          />
                        ))}
                        <span className="text-xs text-gray-600 ml-1">4.5</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-700 leading-relaxed">
                      "The cleaning service was exceptional! Our home has never looked better. The team was professional, thorough, and left everything sparkling clean. Will definitely use again!"
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* How finding a helper works */}
          <div className="max-w-6xl mx-auto pt-12 px-4">
            <h2 className="text-2xl md:text-3xl font-semibold text-center mb-8 md:mb-10">
              How finding a helper works
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              <div className="flex items-start gap-4 md:flex-col md:items-center md:text-center">
                <div className="h-12 w-12 md:h-14 md:w-14 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <ClipboardList className="w-6 h-6 md:w-7 md:h-7 text-primary" />
                </div>
                <div className="md:flex-1">
                  <p className="text-base md:text-lg font-medium text-foreground">1. Post your request</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Answer a few short filter questions with simple taps. We match you with helpers who meet your criteria.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 md:flex-col md:items-center md:text-center">
                <div className="h-12 w-12 md:h-14 md:w-14 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Users className="w-6 h-6 md:w-7 md:h-7 text-primary" />
                </div>
                <div className="md:flex-1">
                  <p className="text-base md:text-lg font-medium text-foreground">2. Get matched</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Helpers in your area see your request and respond. You’ll see who’s available and interested.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 md:flex-col md:items-center md:text-center">
                <div className="h-12 w-12 md:h-14 md:w-14 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <UserCheck className="w-6 h-6 md:w-7 md:h-7 text-primary" />
                </div>
                <div className="md:flex-1">
                  <p className="text-base md:text-lg font-medium text-foreground">3. Choose your helper</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Look at profiles and pick the person who fits you best. No pressure—you’re in control.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 md:flex-col md:items-center md:text-center">
                <div className="h-12 w-12 md:h-14 md:w-14 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <MessageCircle className="w-6 h-6 md:w-7 md:h-7 text-primary" />
                </div>
                <div className="md:flex-1">
                  <p className="text-base md:text-lg font-medium text-foreground">4. Chat and confirm</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Message your helper to sort out details, schedule, and anything else. Confirm when you’re both ready.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 md:flex-col md:items-center md:text-center">
                <div className="h-12 w-12 md:h-14 md:w-14 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-6 h-6 md:w-7 md:h-7 text-primary" />
                </div>
                <div className="md:flex-1">
                  <p className="text-base md:text-lg font-medium text-foreground">5. You’re all set</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your helper comes at the agreed time. Relax—you’ve found the right person.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Job Categories */}
          <div className="space-y-6 pt-12">
            <h2 className="text-2xl font-semibold text-center">
              Services
            </h2>
            <JobCategories />
          </div>

          {/* Recent Orders Section */}
          <div className="pt-12">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl font-semibold text-center mb-6">
                Recent Orders
              </h2>
              <div className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
                {/* Order 1 */}
                <div className="border-b border-gray-200 pb-4 last:border-b-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-semibold text-sm">
                          AS
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">Anna S.</h3>
                          <p className="text-sm text-muted-foreground">Childcare Service</p>
                        </div>
                      </div>
                      <p className="text-sm text-foreground/80 mb-2">
                        Looking for a reliable nanny for my 3-year-old daughter, 3 days a week from 9 AM to 2 PM. Must have experience with toddlers.
                      </p>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-muted-foreground">Rate:</span>
                        <span className="font-semibold text-foreground">₪80/hour</span>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="flex-shrink-0 gap-2">
                      <Flag className="w-4 h-4" />
                      Report
                    </Button>
                  </div>
                </div>

                {/* Order 2 */}
                <div className="border-b border-gray-200 pb-4 last:border-b-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white font-semibold text-sm">
                          DL
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">David L.</h3>
                          <p className="text-sm text-muted-foreground">House Cleaning</p>
                        </div>
                      </div>
                      <p className="text-sm text-foreground/80 mb-2">
                        Need deep cleaning for a 4-bedroom apartment. Includes kitchen, bathrooms, and all common areas. One-time service needed this weekend.
                      </p>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-muted-foreground">Rate:</span>
                        <span className="font-semibold text-foreground">₪120/hour</span>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="flex-shrink-0 gap-2">
                      <Flag className="w-4 h-4" />
                      Report
                    </Button>
                  </div>
                </div>

                {/* Order 3 */}
                <div className="border-b border-gray-200 pb-4 last:border-b-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center text-white font-semibold text-sm">
                          RS
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">Rachel M.</h3>
                          <p className="text-sm text-muted-foreground">Childcare Service</p>
                        </div>
                      </div>
                      <p className="text-sm text-foreground/80 mb-2">
                        Seeking an experienced babysitter for evening care, 2-3 times per week. Two children ages 5 and 7. Must be available from 6 PM to 10 PM.
                      </p>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-muted-foreground">Rate:</span>
                        <span className="font-semibold text-foreground">₪90/hour</span>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="flex-shrink-0 gap-2">
                      <Flag className="w-4 h-4" />
                      Report
                    </Button>
                  </div>
                </div>

                {/* Order 4 */}
                <div className="pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center text-white font-semibold text-sm">
                          TM
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">Tom K.</h3>
                          <p className="text-sm text-muted-foreground">House Cleaning</p>
                        </div>
                      </div>
                      <p className="text-sm text-foreground/80 mb-2">
                        Regular weekly cleaning service for a 3-bedroom house. Prefer someone who can come every Thursday morning. Long-term arrangement preferred.
                      </p>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-muted-foreground">Rate:</span>
                        <span className="font-semibold text-foreground">₪100/hour</span>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="flex-shrink-0 gap-2">
                      <Flag className="w-4 h-4" />
                      Report
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Fixed bottom bar - Mobile only, when buttons scroll out of view */}
      {showFixedButtons && (
        <div className="fixed bottom-0 left-0 right-0 p-4 pb-6 pt-3 bg-background/95 backdrop-blur-md border-t shadow-lg z-40 md:hidden">
          <div className="max-w-lg mx-auto flex flex-row gap-2 justify-center">
            <Button
              onClick={handleSearchingForJob}
              className="h-11 rounded-full px-5 bg-orange-500 hover:bg-orange-600 text-white shadow-lg flex-1 gap-2 text-sm font-medium"
            >
              <Briefcase className="w-5 h-5 flex-shrink-0" />
              Find a Job
            </Button>
            <Button
              onClick={handleHiringHelper}
              className="h-11 rounded-full px-5 bg-orange-500 hover:bg-orange-600 text-white shadow-lg flex-1 gap-2 text-sm font-medium"
            >
              <Users className="w-5 h-5 flex-shrink-0" />
              Hire a Helper
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
