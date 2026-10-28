import { Link } from "react-router-dom";
import { BRAND_LOGO_SRC } from "@/lib/brandLogo";
import { ShieldCheck, Instagram, Facebook, Twitter } from "lucide-react";
import { useTranslation } from "react-i18next";
import { OPEN_COOKIE_SETTINGS_EVENT } from "@/components/AnalyticsConsent";

export function Footer() {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative w-full overflow-hidden bg-slate-950 text-white py-16 px-6 sm:px-8 lg:px-12">
      {/* Decorative Gradient Blur */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px] -translate-y-1/2"></div>

      <div className="relative z-10 w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
          {/* Brand Section */}
          <div className="space-y-6">
            <Link to="/" className="flex items-center gap-3 group/footer-logo">
              <img
                src={BRAND_LOGO_SRC}
                alt="Tebnu"
                className="h-14 w-auto transition-transform duration-500 group-hover/footer-logo:scale-105"
              />
              <span className="text-2xl font-black tracking-tighter bg-gradient-to-r from-emerald-600 via-emerald-500 to-lime-500 bg-clip-text text-transparent drop-shadow-[0_1px_0_rgba(0,0,0,0.06)] dark:drop-shadow-none">
                Tebnu
              </span>
            </Link>
            <p className="text-slate-400 font-medium leading-relaxed max-w-xs">
              {t("footer.description")}
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
              {t("footer.product")}
            </h4>
            <ul className="space-y-4">
              <li>
                <Link
                  to="/onboarding?role=client"
                  className="text-slate-400 hover:text-white font-bold transition-colors"
                >
                  {t("footer.hireHelper")}
                </Link>
              </li>
              <li>
                <Link
                  to="/onboarding?role=freelancer"
                  className="text-slate-400 hover:text-white font-bold transition-colors"
                >
                  {t("footer.beHelper")}
                </Link>
              </li>
              <li>
                <Link to="/disclaimer" className="text-slate-400 hover:text-white font-bold transition-colors flex items-center gap-2">
                  {t("footer.safety")} <ShieldCheck className="w-4 h-4 text-green-500" />
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-sm font-black uppercase tracking-widest text-primary mb-6">
              {t("footer.company")}
            </h4>
            <ul className="space-y-4">
              <li>
                <Link
                  to="/about"
                  className="text-slate-400 hover:text-white font-bold transition-colors"
                >
                  {t("siteNav.aboutUs")}
                </Link>
              </li>
              <li>
                <Link
                  to="/contact"
                  className="text-slate-400 hover:text-white font-bold transition-colors"
                >
                  {t("siteNav.contact")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal & App */}
          <div>
            <h4 className="text-sm font-black uppercase tracking-widest text-primary mb-6">
              {t("footer.official")}
            </h4>
            <ul className="space-y-4">
              <li>
                <Link
                  to="/terms"
                  className="text-slate-400 hover:text-white font-bold transition-colors"
                >
                  {t("legalHub.documents.terms")}
                </Link>
              </li>
              <li>
                <Link
                  to="/privacy"
                  className="text-slate-400 hover:text-white font-bold transition-colors"
                >
                  {t("legalHub.documents.privacy")}
                </Link>
              </li>
              <li>
                <Link
                  to="/cookies"
                  className="text-slate-400 hover:text-white font-bold transition-colors"
                >
                  {t("legalHub.documents.cookies")}
                </Link>
              </li>
              <li>
                <Link to="/disclaimer" className="text-slate-400 hover:text-white font-bold transition-colors">
                  {t("legalHub.documents.disclaimer")}
                </Link>
              </li>
              <li>
                <button
                  type="button"
                  className="text-left text-slate-400 hover:text-white font-bold transition-colors"
                  onClick={() => window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT))}
                >
                  {t("analyticsConsent.settings")}
                </button>
              </li>
            </ul>
            <div className="mt-8 pt-8 border-t border-white/5">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">
                Supported by
              </p>
              <div className="flex items-center gap-2 grayscale opacity-50">
                <img
                  src={BRAND_LOGO_SRC}
                  alt=""
                  className="h-6 w-auto"
                />
                <span className="font-bold text-xs text-slate-200">
                  {t("footer.optionalVerification")}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
          <p className="text-slate-500 text-sm font-medium">
            &copy; {currentYear} Tebnu. {t("footer.rights")}
          </p>
          <div className="flex items-center gap-8 text-slate-500 text-xs font-bold uppercase tracking-widest">
            <Link
              to="/terms"
              className="hover:text-white transition-colors"
            >
              Legal
            </Link>
            <Link
              to="/privacy"
              className="hover:text-white transition-colors"
            >
              Privacy
            </Link>
            <Link
              to="/contact"
              className="hover:text-white transition-colors"
            >
              Support
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
