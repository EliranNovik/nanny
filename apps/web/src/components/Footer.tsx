import { Link } from "react-router-dom";
import { ShieldCheck, Instagram, Facebook, Twitter } from "lucide-react";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-slate-950 text-white py-16 px-6 relative overflow-hidden">
      {/* Decorative Gradient Blur */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px] -translate-y-1/2"></div>

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
          {/* Brand Section */}
          <div className="space-y-6">
            <Link to="/" className="flex items-center gap-3 group/footer-logo">
              <img
                src="/ChatGPT Image Jan 19, 2026, 08_14_59 PM.png"
                alt="MamaLama Logo"
                className="h-14 w-auto rounded-xl brightness-110 shadow-2xl transition-transform duration-500 group-hover/footer-logo:scale-105"
              />
              <span className="text-2xl font-black tracking-tighter bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                MamaLama
              </span>
            </Link>
            <p className="text-slate-400 font-medium leading-relaxed max-w-xs">
              Bringing families and trusted helpers together. The premium
              marketplace for home services.
            </p>
            <div className="flex gap-4">
              <button className="h-10 w-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-primary/20 hover:border-primary/50 transition-all">
                <Instagram className="w-5 h-5 text-slate-300" />
              </button>
              <button className="h-10 w-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-primary/20 hover:border-primary/50 transition-all">
                <Facebook className="w-5 h-5 text-slate-300" />
              </button>
              <button className="h-10 w-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-primary/20 hover:border-primary/50 transition-all">
                <Twitter className="w-5 h-5 text-slate-300" />
              </button>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-sm font-black uppercase tracking-widest text-primary mb-6">
              Product
            </h4>
            <ul className="space-y-4">
              <li>
                <Link
                  to="/onboarding?role=client"
                  className="text-slate-400 hover:text-white font-bold transition-colors"
                >
                  Hire a Helper
                </Link>
              </li>
              <li>
                <Link
                  to="/onboarding?role=freelancer"
                  className="text-slate-400 hover:text-white font-bold transition-colors"
                >
                  Be a Helper
                </Link>
              </li>
              <li>
                <Link
                  to="/services"
                  className="text-slate-400 hover:text-white font-bold transition-colors"
                >
                  Our Services
                </Link>
              </li>
              <li>
                <Link
                  to="/safety"
                  className="text-slate-400 hover:text-white font-bold transition-colors flex items-center gap-2"
                >
                  Safety First{" "}
                  <ShieldCheck className="w-4 h-4 text-green-500" />
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-sm font-black uppercase tracking-widest text-primary mb-6">
              Company
            </h4>
            <ul className="space-y-4">
              <li>
                <Link
                  to="/about"
                  className="text-slate-400 hover:text-white font-bold transition-colors"
                >
                  About Us
                </Link>
              </li>
              <li>
                <Link
                  to="/contact"
                  className="text-slate-400 hover:text-white font-bold transition-colors"
                >
                  Contact
                </Link>
              </li>
              <li>
                <Link
                  to="/faq"
                  className="text-slate-400 hover:text-white font-bold transition-colors"
                >
                  FAQ
                </Link>
              </li>
              <li>
                <Link
                  to="/careers"
                  className="text-slate-400 hover:text-white font-bold transition-colors"
                >
                  Careers
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal & App */}
          <div>
            <h4 className="text-sm font-black uppercase tracking-widest text-primary mb-6">
              Official
            </h4>
            <ul className="space-y-4">
              <li>
                <Link
                  to="/terms"
                  className="text-slate-400 hover:text-white font-bold transition-colors"
                >
                  Terms of Use
                </Link>
              </li>
              <li>
                <Link
                  to="/privacy"
                  className="text-slate-400 hover:text-white font-bold transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  to="/cookies"
                  className="text-slate-400 hover:text-white font-bold transition-colors"
                >
                  Cookie Policy
                </Link>
              </li>
            </ul>
            <div className="mt-8 pt-8 border-t border-white/5">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">
                Supported by
              </p>
              <div className="flex items-center gap-2 grayscale opacity-50">
                <img
                  src="/ChatGPT Image Jan 19, 2026, 08_14_59 PM.png"
                  alt=""
                  className="h-6 w-auto"
                />
                <span className="font-bold text-xs">Security Verified</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
          <p className="text-slate-500 text-sm font-medium">
            &copy; {currentYear} MamaLama Inc. All rights reserved.
          </p>
          <div className="flex items-center gap-8 text-slate-500 text-xs font-bold uppercase tracking-widest">
            <Link to="/terms" className="hover:text-white transition-colors">
              Legal
            </Link>
            <Link to="/privacy" className="hover:text-white transition-colors">
              Privacy
            </Link>
            <Link to="/contact" className="hover:text-white transition-colors">
              Support
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
