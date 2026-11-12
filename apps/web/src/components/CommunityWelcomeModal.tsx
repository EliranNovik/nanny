import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MessageCircle, Radio, Send, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DISCOVER_PRIMARY_HERO_IMAGES } from "@/components/discover/discoverHomeHeroImages";
import {
  closeCommunityWelcome,
  isCommunityWelcomePending,
} from "@/lib/featureAnnouncements";

const HIDDEN_ON = ["/onboarding", "/login", "/signup", "/register", "/auth", "/admin", "/reset-password"];

function pointsFor(role: string | undefined, t: (key: string, options?: { returnObjects: true }) => unknown): string[] {
  const key = role === "freelancer" ? "communityWelcome.freelancerPoints" : "communityWelcome.clientPoints";
  const value = t(key, { returnObjects: true });
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function CommunityWelcomeModal() {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  const eligible =
    !!user?.id &&
    !!profile?.role &&
    !HIDDEN_ON.some((path) => pathname.startsWith(path));

  useEffect(() => {
    if (!eligible || !user?.id || !isCommunityWelcomePending(user.id)) {
      setOpen(false);
      return;
    }
    const id = window.setTimeout(() => setOpen(true), 350);
    return () => window.clearTimeout(id);
  }, [eligible, user?.id]);

  const finish = () => {
    if (user?.id) closeCommunityWelcome(user.id);
    setOpen(false);
  };

  const isFreelancer = profile?.role === "freelancer";
  const points = pointsFor(profile?.role, t);
  const heroSrc = isFreelancer ? DISCOVER_PRIMARY_HERO_IMAGES.work : DISCOVER_PRIMARY_HERO_IMAGES.hire;

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : finish())}>
      <DialogContent
        overlayClassName="z-[320] bg-black/55 backdrop-blur-[3px]"
        className="z-[320] w-[calc(100vw-2rem)] max-w-[460px] gap-0 overflow-hidden rounded-[1.75rem] border-0 p-0 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.55)]"
      >
        <div className="relative h-64 overflow-hidden">
          <img src={heroSrc} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/15" />
          <button
            type="button"
            onClick={finish}
            aria-label={t("common.close")}
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-zinc-800 shadow-sm transition hover:bg-white"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="absolute inset-x-0 bottom-0 px-6 pb-6 text-white">
            <span className="text-[15px] font-black uppercase tracking-[0.22em] text-orange-200 [text-shadow:0_2px_12px_rgba(0,0,0,0.45)]">
              {t("communityWelcome.eyebrow")}
            </span>
            <DialogTitle className="mt-2 text-[2.15rem] font-black leading-[1.05] tracking-tight text-white [text-shadow:0_2px_16px_rgba(0,0,0,0.45)]">
              {t("communityWelcome.title")}
            </DialogTitle>
          </div>
        </div>
        <div className="bg-background px-5 pb-5 pt-4">
          <DialogDescription className="text-[15px] font-medium leading-snug text-muted-foreground">
            {t(isFreelancer ? "communityWelcome.freelancerIntro" : "communityWelcome.clientIntro")}
          </DialogDescription>
          <ul className="mt-4 space-y-2">
            {points.map((point, index) => {
              const Icon = index === 0 ? (isFreelancer ? Radio : Send) : index === 1 ? Send : MessageCircle;
              return (
                <li key={point} className="flex items-center gap-3 rounded-2xl bg-muted/45 px-3 py-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-500/15 text-orange-600 dark:text-orange-400">
                    <Icon className="h-4 w-4" strokeWidth={2.25} />
                  </span>
                  <span className="text-[14px] font-semibold leading-snug text-foreground">{point}</span>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={finish}
            className="mt-4 h-12 w-full rounded-full bg-orange-600 text-[15px] font-bold text-white shadow-[0_12px_24px_-12px_rgba(249,115,22,0.9)] transition hover:bg-orange-700"
          >
            {t("communityWelcome.continue")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
