import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Briefcase, Users, LogIn, Baby, Sparkles, Star, Flag, Menu, X } from "lucide-react";
import { Link } from "react-router-dom";
import JobCategories from "@/components/JobCategories";
import { useState } from "react";

export default function LandingPage() {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 w-full border-b bg-background/80 backdrop-blur-sm z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo - Desktop Only */}
            <Link to="/" className="hidden md:flex items-center gap-2">
              <img
                src="/ChatGPT Image Jan 19, 2026, 08_14_59 PM.png"
                alt="MamaLama Logo"
                className="h-10 w-auto rounded-xl"
              />
            </Link>

            {/* Mobile Menu */}
            {isMenuOpen && (
              <div className="md:hidden fixed top-[73px] left-0 right-0 bg-background border-b shadow-lg z-50">
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
                  <Link to="/login" onClick={() => setIsMenuOpen(false)}>
                    <Button variant="outline" size="sm" className="gap-2 w-full">
                      <LogIn className="w-4 h-4" />
                      Log In
                    </Button>
                  </Link>
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
              <Link to="/login">
                <Button variant="outline" size="sm" className="gap-2">
                  <LogIn className="w-4 h-4" />
                  Log In
                </Button>
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 py-12 pt-24">
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

                    {/* Buttons Overlay - Mobile Only */}
                    <div className="absolute top-0 left-0 right-0 p-3 md:hidden z-20">
                      <div className="flex flex-col items-center gap-2 w-full max-w-xl">
                        <Button
                          onClick={handleSearchingForJob}
                          size="lg"
                          className="h-20 flex flex-col items-center justify-center gap-1.5 text-sm bg-orange-500 hover:bg-orange-600 text-white shadow-lg rounded-lg w-full"
                        >
                          <Briefcase className="w-5 h-5" />
                          <span className="text-xs font-medium">Searching for a Job</span>
                        </Button>

                        <Button
                          onClick={handleHiringHelper}
                          size="lg"
                          className="h-20 flex flex-col items-center justify-center gap-1.5 text-sm bg-orange-500 hover:bg-orange-600 text-white shadow-lg rounded-lg w-full"
                        >
                          <Users className="w-5 h-5" />
                          <span className="text-xs font-medium">Hiring a Helper</span>
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Hamburger Menu - Mobile Only: Right corner of image */}
                  <button
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="absolute top-4 right-4 md:hidden z-[100] p-4 bg-orange-500 rounded-xl shadow-2xl hover:bg-orange-600 transition-colors"
                    style={{ display: 'block' }}
                    aria-label="Toggle menu"
                  >
                    {isMenuOpen ? (
                      <X className="w-6 h-6 text-white" />
                    ) : (
                      <Menu className="w-6 h-6 text-white" />
                    )}
                  </button>
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
    </div>
  );
}
