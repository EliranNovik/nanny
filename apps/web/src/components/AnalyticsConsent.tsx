import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

const CONSENT_KEY = "tebnu:analytics-consent";
const GTM_ID = "GTM-W9PHLD7Q";
export const OPEN_COOKIE_SETTINGS_EVENT = "tebnu:open-cookie-settings";

type Consent = "accepted" | "rejected" | null;

declare global {
  interface Window {
    dataLayer?: unknown[];
    __tebnuGtmLoaded?: boolean;
  }
}

function loadGtm(): void {
  if (window.__tebnuGtmLoaded) return;
  window.__tebnuGtmLoaded = true;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`;
  document.head.appendChild(script);
}

export function AnalyticsConsent() {
  const { t } = useTranslation();
  const [consent, setConsent] = useState<Consent>(() => {
    const stored = localStorage.getItem(CONSENT_KEY);
    return stored === "accepted" || stored === "rejected" ? stored : null;
  });
  const [open, setOpen] = useState(consent == null);

  useEffect(() => {
    if (consent === "accepted") loadGtm();
  }, [consent]);

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, show);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, show);
  }, []);

  function choose(next: Exclude<Consent, null>) {
    const withdrawing = consent === "accepted" && next === "rejected";
    localStorage.setItem(CONSENT_KEY, next);
    setConsent(next);
    setOpen(false);
    if (withdrawing) window.location.reload();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-x-3 bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] z-[260] mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
      <h2 className="text-lg font-black">{t("analyticsConsent.title")}</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        {t("analyticsConsent.body")}{" "}
        <Link to="/cookies" className="font-bold text-primary underline">
          {t("analyticsConsent.learnMore")}
        </Link>
      </p>
      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={() => choose("rejected")}>
          {t("analyticsConsent.reject")}
        </Button>
        <Button onClick={() => choose("accepted")}>
          {t("analyticsConsent.accept")}
        </Button>
      </div>
    </div>
  );
}
