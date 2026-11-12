import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import {
  closeCommunitySpotlight,
  COMMUNITY_WELCOME_CLOSED_EVENT,
  isCommunitySpotlightPending,
  isCommunityWelcomePending,
} from "@/lib/featureAnnouncements";
import { profileHasCurrentLegalAcceptance } from "@/lib/legalAcceptance";

const HIDDEN_ON = ["/onboarding", "/login", "/signup", "/register", "/auth", "/admin", "/reset-password"];

type GuideStep = {
  target: string;
  title: string;
  body: string;
};

function findGuideTarget(name: string): HTMLElement | null {
  const nodes = [...document.querySelectorAll<HTMLElement>(`[data-guide="${name}"]`)];
  const sized = nodes.filter((el) => {
    const box = el.getBoundingClientRect();
    return box.width > 8 && box.height > 8;
  });
  return sized.find((el) => el.dataset.guideRank === "primary") ?? sized[0] ?? null;
}

export function CommunitySpotlightGuide() {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [revision, setRevision] = useState(0);
  const [session, setSession] = useState(0);
  const [step, setStep] = useState<number | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const bump = () => setRevision((value) => value + 1);
    window.addEventListener(COMMUNITY_WELCOME_CLOSED_EVENT, bump);
    return () => window.removeEventListener(COMMUNITY_WELCOME_CLOSED_EVENT, bump);
  }, []);

  const isFreelancer = profile?.role === "freelancer";
  const isClient = profile?.role === "client";
  const hidden = HIDDEN_ON.some((path) => pathname.startsWith(path));
  const pending = !!user?.id && isCommunitySpotlightPending(user.id);
  const welcomeDone = !!user?.id && !isCommunityWelcomePending(user.id);
  const legalOk = !!profile && profileHasCurrentLegalAcceptance(profile);
  const ready = (isClient || isFreelancer) && pending && welcomeDone && legalOk && !hidden && revision >= 0;
  const home = isFreelancer ? "/freelancer/home" : "/client/home";

  const steps = useMemo<GuideStep[]>(
    () =>
      isFreelancer
        ? [
            {
              target: "post-offer",
              title: t("communityGuide.helperOfferTitle"),
              body: t("communityGuide.helperOfferBody"),
            },
            {
              target: "find-requests",
              title: t("communityGuide.helperRequestsTitle"),
              body: t("communityGuide.helperRequestsBody"),
            },
          ]
        : [
            {
              target: "post-request",
              title: t("communityGuide.clientPostTitle"),
              body: t("communityGuide.clientPostBody"),
            },
            {
              target: "find-helpers",
              title: t("communityGuide.clientFindTitle"),
              body: t("communityGuide.clientFindBody"),
            },
            {
              target: "search",
              title: t("communityGuide.clientSearchTitle"),
              body: t("communityGuide.clientSearchBody"),
            },
            {
              target: "",
              title: t("communityGuide.closing"),
              body: "",
            },
          ],
    [isFreelancer, t],
  );

  const finish = () => {
    if (user?.id) closeCommunitySpotlight(user.id);
    setStep(null);
    setRect(null);
    setSession((value) => value + 1);
  };

  useEffect(() => {
    if (!ready) return;
    if (pathname !== home) {
      navigate(home, { replace: true });
      return;
    }
    let cancelled = false;
    let tries = 0;
    let timer = 0;
    const look = () => {
      if (cancelled) return;
      if (findGuideTarget(steps[0]?.target ?? "")) {
        setStep(0);
        return;
      }
      tries += 1;
      if (tries > 24) {
        if (user?.id) closeCommunitySpotlight(user.id);
        setSession((value) => value + 1);
        return;
      }
      timer = window.setTimeout(look, 150);
    };
    timer = window.setTimeout(look, 450);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [home, pathname, ready, session, steps, user?.id, navigate]);

  useEffect(() => {
    if (step == null) return;
    const target = steps[step]?.target;
    if (!target) {
      setRect(null);
      return;
    }
    let frame = 0;
    const measure = () => {
      const el = findGuideTarget(target);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    findGuideTarget(target)?.scrollIntoView({ block: "center", inline: "nearest" });
    frame = window.requestAnimationFrame(() => {
      measure();
      frame = window.requestAnimationFrame(measure);
    });
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [step, steps]);

  useEffect(() => {
    if (step == null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") finish();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, user?.id]);

  if (step == null) return null;

  const current = steps[step];
  if (!current) return null;
  const finale = !current.target;
  const accent = isFreelancer ? "bg-emerald-600 hover:bg-emerald-700" : "bg-orange-600 hover:bg-orange-700";
  const last = step >= steps.length - 1;

  const goNext = () => {
    if (last) {
      finish();
      return;
    }
    const upcoming = steps[step + 1];
    if (!upcoming) {
      finish();
      return;
    }
    if (upcoming.target && !findGuideTarget(upcoming.target)) {
      finish();
      return;
    }
    setStep(step + 1);
  };

  if (finale) {
    return createPortal(
      <div className="fixed inset-0 z-[340] flex items-center justify-center bg-black/55 p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="community-guide-title"
          className="w-full max-w-[380px] rounded-3xl bg-white px-6 py-8 text-center shadow-2xl dark:bg-zinc-900"
        >
          <h2 id="community-guide-title" className="text-[28px] font-black leading-tight tracking-tight text-foreground">
            {current.title}
          </h2>
          <button
            type="button"
            onClick={finish}
            className={`mt-6 h-12 w-full rounded-full text-[15px] font-bold text-white ${accent}`}
          >
            {t("communityGuide.done")}
          </button>
        </div>
      </div>,
      document.body,
    );
  }

  if (!rect) return null;

  const pad = 8;
  const hole = {
    top: Math.max(8, rect.top - pad),
    left: Math.max(8, rect.left - pad),
    width: Math.min(rect.width + pad * 2, window.innerWidth - 16),
    height: rect.height + pad * 2,
  };
  const cardWidth = Math.min(320, window.innerWidth - 24);
  const cardHeight = 168;
  let cardTop = hole.top + hole.height + 14;
  if (cardTop + cardHeight > window.innerHeight - 12) cardTop = Math.max(12, hole.top - cardHeight - 14);
  let cardLeft = hole.left;
  cardLeft = Math.min(Math.max(12, cardLeft), window.innerWidth - cardWidth - 12);

  return createPortal(
    <div className="fixed inset-0 z-[340]">
      <div className="absolute inset-x-0 top-0 bg-black/55" style={{ height: hole.top }} />
      <div
        className="absolute bg-black/55"
        style={{ top: hole.top, left: 0, width: hole.left, height: hole.height }}
      />
      <div
        className="absolute bg-black/55"
        style={{ top: hole.top, left: hole.left + hole.width, right: 0, height: hole.height }}
      />
      <div
        className="absolute inset-x-0 bg-black/55"
        style={{ top: hole.top + hole.height, bottom: 0 }}
      />
      <div
        className="pointer-events-none absolute rounded-2xl"
        style={{
          top: hole.top,
          left: hole.left,
          width: hole.width,
          height: hole.height,
          outline: "2px solid white",
          boxShadow: isFreelancer
            ? "0 0 0 6px rgba(16,185,129,0.9)"
            : "0 0 0 6px rgba(249,115,22,0.9)",
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="community-guide-title"
        className="absolute rounded-3xl bg-white p-4 shadow-2xl dark:bg-zinc-900"
        style={{ top: cardTop, left: cardLeft, width: cardWidth }}
      >
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">
          {step + 1} / {steps.filter((item) => item.target).length}
        </p>
        <h2 id="community-guide-title" className="mt-1 text-[18px] font-black tracking-tight text-foreground">
          {current.title}
        </h2>
        <p className="mt-1 text-[14px] leading-snug text-muted-foreground">{current.body}</p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={finish}
            className="text-[13px] font-semibold text-muted-foreground hover:text-foreground"
          >
            {t("communityGuide.skip")}
          </button>
          <button
            type="button"
            onClick={goNext}
            className={`h-10 rounded-full px-5 text-[14px] font-bold text-white ${accent}`}
          >
            {last ? t("communityGuide.done") : t("communityGuide.next")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
