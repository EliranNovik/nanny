import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LandingSiteHeader } from "@/components/LandingSiteHeader";
import { Footer } from "@/components/Footer";
import { legalContent } from "@/data/legalContent";
import { useAuth } from "@/context/AuthContext";
import { FileText, Shield, Cookie, Scale, Globe, ChevronRight } from "lucide-react";

type DocType = "terms" | "disclaimer" | "privacy" | "cookies";

const DOCS_CONFIG: { id: DocType; path: string; icon: React.ComponentType<any>; labelKey: string }[] = [
  { id: "terms", path: "/terms", icon: FileText, labelKey: "Rules of Service" },
  { id: "disclaimer", path: "/disclaimer", icon: Scale, labelKey: "Disclaimer" },
  { id: "privacy", path: "/privacy", icon: Shield, labelKey: "Privacy Policy" },
  { id: "cookies", path: "/cookies", icon: Cookie, labelKey: "Cookie Policy" },
];

const LANG_LABELS: Record<string, string> = {
  en: "English",
  ru: "Русский",
  he: "עברית",
  fr: "Français",
};

export default function LegalPage() {
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  // Determine active document from path
  const currentPath = location.pathname;
  let defaultDoc: DocType = "terms";
  if (currentPath.includes("privacy")) defaultDoc = "privacy";
  else if (currentPath.includes("cookies")) defaultDoc = "cookies";
  else if (currentPath.includes("disclaimer")) defaultDoc = "disclaimer";

  const [activeTab, setActiveTab] = useState<DocType>(defaultDoc);
  
  // Local language override to view terms in other languages
  const [docLang, setDocLang] = useState<string>("en");

  // Sync activeTab when URL path changes
  useEffect(() => {
    if (currentPath.includes("privacy")) setActiveTab("privacy");
    else if (currentPath.includes("cookies")) setActiveTab("cookies");
    else if (currentPath.includes("disclaimer")) setActiveTab("disclaimer");
    else setActiveTab("terms");
  }, [currentPath]);

  // Sync docLang with app language on load/change, unless overridden
  useEffect(() => {
    const appLang = i18n.language?.split("-")[0] || "en";
    if (["en", "ru", "he", "fr"].includes(appLang)) {
      setDocLang(appLang);
    } else {
      setDocLang("en");
    }
  }, [i18n.language]);

  const handleTabChange = (tab: DocType) => {
    setActiveTab(tab);
    const config = DOCS_CONFIG.find((c) => c.id === tab);
    if (config) {
      navigate(config.path);
    }
  };

  // Get active document content based on chosen language
  const translations = legalContent[docLang] || legalContent["en"];
  const doc = translations[activeTab];
  
  const isRtl = docLang === "he";

  // Page level titles/ui in current UI language
  const uiLang = i18n.language?.split("-")[0] || "en";
  const uiTexts = {
    title: {
      en: "Legal Hub",
      ru: "Правовой центр",
      he: "מרכז מידע משפטי",
      fr: "Espace Légal",
    }[uiLang] || "Legal Hub",
    subtitle: {
      en: "Terms, conditions, and disclaimers governing the use of the Tebnu platform.",
      ru: "Правила, условия и дисклеймеры, регулирующие использование платформы Tebnu.",
      he: "תנאי שימוש, תקנון וכתבי ויתור המסדירים את השימוש בפלטפורמת Tebnu.",
      fr: "Termes, conditions et avis de non-responsabilité régissant l'utilisation de la plateforme Tebnu.",
    }[uiLang] || "Terms, conditions, and disclaimers governing the use of the Tebnu platform.",
    langSelectorLabel: {
      en: "Document Language:",
      ru: "Язык документа:",
      he: "שפת המסמך:",
      fr: "Langue du document :",
    }[uiLang] || "Document Language:",
  };

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-background flex flex-col">
      {!user && (
        <LandingSiteHeader
          hideLeftLogo
          mobileMatchLanding
          fixedOnMobile
          hideBackButtonMobile
          className="max-w-5xl"
        />
      )}

      <main className="flex-1 pt-[4.25rem] md:pt-32 px-4 md:px-6 pb-20 max-w-7xl mx-auto w-full">
        {/* Page Header */}
        <div className="mb-10 text-center md:text-left relative overflow-hidden p-8 md:p-12 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950 text-white shadow-lg border border-slate-800">
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-[100px] pointer-events-none"></div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight mb-4 bg-gradient-to-r from-emerald-400 via-emerald-300 to-lime-300 bg-clip-text text-transparent">
            {uiTexts.title}
          </h1>
          <p className="text-slate-300 max-w-2xl text-lg font-medium leading-relaxed">
            {uiTexts.subtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1 space-y-4">
            {/* Desktop Navigation */}
            <nav className="hidden lg:flex flex-col gap-2 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-zinc-200/60 dark:border-slate-800 shadow-sm">
              {DOCS_CONFIG.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleTabChange(item.id)}
                    className={`flex items-center justify-between p-3.5 rounded-xl font-bold transition-all ${
                      isActive
                        ? "bg-primary/10 text-primary dark:bg-primary/25 dark:text-emerald-400"
                        : "text-zinc-600 dark:text-slate-400 hover:bg-zinc-100 dark:hover:bg-slate-800/50 hover:text-zinc-950 dark:hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5" />
                      <span>{item.labelKey}</span>
                    </div>
                    <ChevronRight className={`w-4 h-4 transition-transform ${isActive ? "translate-x-1" : "opacity-30"}`} />
                  </button>
                );
              })}
            </nav>

            {/* Mobile / Tablet Horizontal Scrollable Tabs */}
            <div className="lg:hidden flex overflow-x-auto gap-2 pb-2 scrollbar-none">
              {DOCS_CONFIG.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleTabChange(item.id)}
                    className={`flex items-center gap-2 px-5 py-3 rounded-full font-bold whitespace-nowrap text-sm transition-all border ${
                      isActive
                        ? "bg-slate-950 text-white border-slate-950 dark:bg-white dark:text-slate-950 dark:border-white shadow-sm"
                        : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.labelKey}</span>
                  </button>
                );
              })}
            </div>

            {/* Document Language Override Selector */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-zinc-200/60 dark:border-slate-800 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-zinc-800 dark:text-slate-200 font-bold text-sm">
                <Globe className="w-4 h-4 text-primary" />
                <span>{uiTexts.langSelectorLabel}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {Object.keys(LANG_LABELS).map((langCode) => {
                  const isCurrent = docLang === langCode;
                  return (
                    <button
                      key={langCode}
                      onClick={() => setDocLang(langCode)}
                      className={`py-2 px-3 text-xs font-bold rounded-lg border transition-all ${
                        isCurrent
                          ? "bg-primary text-white border-primary shadow-sm"
                          : "bg-zinc-50 hover:bg-zinc-100 border-zinc-200 text-zinc-700 dark:bg-slate-800/30 dark:hover:bg-slate-800/80 dark:border-slate-800 dark:text-slate-300"
                      }`}
                    >
                      {LANG_LABELS[langCode]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Document Content View */}
          <div className="lg:col-span-3">
            <div
              dir={isRtl ? "rtl" : "ltr"}
              className={`bg-white dark:bg-slate-900 shadow-sm rounded-3xl p-6 md:p-12 border border-zinc-200/60 dark:border-slate-800 relative transition-all ${
                isRtl ? "text-right" : "text-left"
              }`}
            >
              {/* Header inside Card */}
              <div className="border-b border-zinc-100 dark:border-slate-800 pb-6 mb-8">
                <h2 className="text-2xl md:text-3xl font-black text-zinc-900 dark:text-white mb-2">
                  {doc.title}
                </h2>
                <div className="text-sm font-bold text-zinc-400 dark:text-slate-500 uppercase tracking-widest">
                  {doc.effectiveDate}
                </div>
              </div>


              {/* Intro text */}
              {doc.intro && (
                <p className="text-zinc-600 dark:text-slate-300 text-base md:text-lg leading-relaxed font-medium mb-8">
                  {doc.intro}
                </p>
              )}

              {/* Sections / Clauses */}
              <div className="space-y-10">
                {doc.sections.map((section, idx) => (
                  <div key={idx} className="group">
                    <h3 className="text-lg md:text-xl font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2 bg-zinc-50 dark:bg-slate-800/40 p-3 rounded-lg border-l-4 border-primary dark:border-emerald-500">
                      {section.title}
                    </h3>
                    <ul className="space-y-4">
                      {section.items.map((item, itemIdx) => (
                        <li
                          key={itemIdx}
                          className="text-zinc-600 dark:text-slate-400 text-sm md:text-base leading-relaxed font-normal whitespace-pre-line"
                        >
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
