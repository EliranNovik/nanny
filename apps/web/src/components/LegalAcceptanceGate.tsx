import { useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import {
  profileHasCurrentLegalAcceptance,
  recordLegalAcceptance,
} from "@/lib/legalAcceptance";

export function LegalAcceptanceGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const location = useLocation();
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [confirmAge, setConfirmAge] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [saving, setSaving] = useState(false);

  const isAccountSettings = location.pathname.endsWith("/profile/account");

  if (!user || !profile || profileHasCurrentLegalAcceptance(profile) || isAccountSettings) {
    return <>{children}</>;
  }

  async function accept() {
    if (!confirmAge || !acceptTerms || !user) return;
    setSaving(true);
    const ok = await recordLegalAcceptance(user.id);
    if (ok) await refreshProfile();
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl dark:bg-zinc-900 md:p-8">
        <h1 className="text-2xl font-black text-zinc-950 dark:text-white">
          {t("legalAcceptance.title")}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {t("legalAcceptance.description")}
        </p>
        <label className="mt-6 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 h-5 w-5 accent-orange-600"
            checked={confirmAge}
            onChange={(event) => setConfirmAge(event.target.checked)}
          />
          <span className="text-sm font-medium">{t("legalAcceptance.age")}</span>
        </label>
        <label className="mt-4 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 h-5 w-5 accent-orange-600"
            checked={acceptTerms}
            onChange={(event) => setAcceptTerms(event.target.checked)}
          />
          <span className="text-sm font-medium">
            {t("legalAcceptance.agreeBefore")}{" "}
            <Link className="font-bold text-primary underline" to="/terms" target="_blank">
              {t("legalHub.documents.terms")}
            </Link>{" "}
            {t("legalAcceptance.and")}{" "}
            <Link className="font-bold text-primary underline" to="/privacy" target="_blank">
              {t("legalHub.documents.privacy")}
            </Link>
            .
          </span>
        </label>
        <Button
          className="mt-7 h-12 w-full rounded-xl font-bold"
          disabled={!confirmAge || !acceptTerms || saving}
          onClick={() => void accept()}
        >
          {saving ? t("common.loading") : t("legalAcceptance.continue")}
        </Button>
        <div className="mt-4 flex justify-center gap-4 text-xs font-semibold">
          <Link to="/contact" className="text-muted-foreground hover:text-foreground">
            {t("siteNav.contact")}
          </Link>
          <Link
            to={profile.role === "client" ? "/client/profile/account" : "/freelancer/profile/account"}
            className="text-muted-foreground hover:text-foreground"
          >
            {t("legalAcceptance.accountSettings")}
          </Link>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => void signOut()}
          >
            {t("common.logOut")}
          </button>
        </div>
      </div>
    </div>
  );
}
