import { useEffect, useState, type Ref } from "react";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, ChevronLeft, Heart, MoreHorizontal, Radar, Share2 } from "lucide-react";
import { BRAND_LOGO_SRC } from "@/lib/brandLogo";
import { cn } from "@/lib/utils";

export const LANDING_CREAM_BG = "bg-[#FAF6EF] dark:bg-[#09090b]";

const HELPERS = [
  { name: "Maya", photo: "/images/helper_profile_1.png" },
  { name: "Daniel", photo: "/images/helper_profile_3.png" },
  { name: "Noa", photo: "/images/helper_profile_4.png" },
] as const;

/** Phone artwork is drawn at this size, then scaled to the viewport on desktop. */
const PHONE_W = 280;
const PHONE_H = 572;

type Props = {
  onFindHelp: () => void;
  onOfferHelp: () => void;
  /** Observed by the page to show sticky CTAs once the hero buttons scroll away. */
  ctaRef?: Ref<HTMLDivElement>;
  className?: string;
};

const HERO_MEDIA = [
  "/images/landing-hero-babysitting.jpg",
  "/images/landing-phone-nanny.jpg",
  "/images/helper_profile_1.png",
  "/images/helper_profile_2.png",
  "/images/helper_profile_3.png",
  "/images/helper_profile_4.png",
  BRAND_LOGO_SRC,
];

/** Photo, phone, and store buttons appear together, after the headline has had a moment. */
function useHeroMediaReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      setReady(true);
    };
    const cap = window.setTimeout(finish, 4000);
    let pending = HERO_MEDIA.length;
    const tick = () => {
      pending -= 1;
      if (pending <= 0) finish();
    };
    for (const src of HERO_MEDIA) {
      const img = new Image();
      img.onload = tick;
      img.onerror = tick;
      img.src = src;
    }
    return () => {
      settled = true;
      window.clearTimeout(cap);
    };
  }, []);
  return ready;
}

/** Desktop phone scale, sized to the hero stage beside the signup panel. */
function usePhoneScale() {
  const compute = () => {
    if (typeof window === "undefined") return 1;
    const panel = window.innerWidth >= 768 ? Math.min(400, window.innerWidth * 0.34) : 0;
    const stage = Math.max(320, window.innerWidth - panel);
    const byHeight = (window.innerHeight * 0.56) / PHONE_H;
    const byWidth = (stage * 0.3) / PHONE_W;
    return Math.max(0.58, Math.min(1.2, byHeight, byWidth));
  };
  const [scale, setScale] = useState(compute);
  useEffect(() => {
    const onResize = () => setScale(compute());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return scale;
}

function HeroPhoto() {
  return (
    <img
      src="/images/landing-hero-babysitting.jpg"
      alt=""
      width={1152}
      height={864}
      className="h-full w-full object-cover object-center"
      loading="eager"
      decoding="async"
      {...{ fetchpriority: "high" }}
    />
  );
}

function RequestPushNotification({
  className,
  title,
  body,
  photo = "/images/helper_profile_2.png",
}: {
  className?: string;
  title?: string;
  body?: string;
  photo?: string;
}) {
  const { t } = useTranslation();
  return (
    <div
      className={cn(
        "absolute z-30 flex w-[19rem] items-start gap-3 rounded-[1.35rem] border border-white/80 bg-white/90 p-3 shadow-[0_20px_45px_-16px_rgba(15,23,42,0.3),0_2px_8px_rgba(15,23,42,0.08)] backdrop-blur-xl",
        className,
      )}
    >
      <span className="relative mt-0.5 shrink-0">
        <img
          src={photo}
          alt=""
          className="h-12 w-12 rounded-full object-cover ring-1 ring-black/5"
        />
        <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5">
          <img src={BRAND_LOGO_SRC} alt="" className="h-4 w-auto" />
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-zinc-500">
            tebnu
          </span>
          <span className="text-[11px] font-medium text-zinc-400">
            {t("landing.creamHero.pushNow")}
          </span>
        </div>
        <p className="mt-0.5 truncate text-[14px] font-bold leading-tight text-zinc-950">
          {title ?? t("landing.creamHero.pushTitle")}
        </p>
        <p className="mt-1 text-[12px] font-medium leading-snug text-zinc-600">
          {body ?? t("landing.creamHero.pushBody")}
        </p>
      </div>
    </div>
  );
}

function MapTile() {
  return (
    <div className="relative h-[9.5rem] overflow-hidden bg-[#EDF1EA]" aria-hidden>
      <svg viewBox="0 0 280 152" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
        <g stroke="#fff" strokeLinecap="round" fill="none">
          <path d="M-10 40 L290 18" strokeWidth="7" />
          <path d="M-10 112 L290 96" strokeWidth="7" />
          <path d="M62 -10 L48 170" strokeWidth="7" />
          <path d="M196 -10 L214 170" strokeWidth="7" />
          <path d="M-10 150 L150 -10" strokeWidth="4" />
          <path d="M120 170 L290 52" strokeWidth="4" />
          <path d="M-10 76 L290 62" strokeWidth="3" />
          <path d="M130 -10 L138 170" strokeWidth="3" />
        </g>
        <g fill="#E3E9DF">
          <rect x="72" y="46" width="44" height="30" rx="4" />
          <rect x="150" y="104" width="40" height="34" rx="4" />
          <rect x="222" y="28" width="46" height="26" rx="4" />
        </g>
      </svg>
      <div className="absolute left-1/2 top-[46%] h-[6.5rem] w-[6.5rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/[0.12]" />
      <div className="absolute left-1/2 top-[46%] h-[4.25rem] w-[4.25rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/20" />
      <div className="absolute left-1/2 top-[46%] flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-emerald-600 text-white shadow-[0_4px_10px_rgba(5,150,105,0.45)] ring-[3px] ring-white">
        <Radar className="h-5 w-5" strokeWidth={2.4} />
      </div>
      {[
        "left-[16%] top-[30%]",
        "left-[80%] top-[40%]",
        "left-[24%] top-[70%]",
      ].map((pos) => (
        <span key={pos} className={cn("absolute h-2.5 w-2.5 rounded-full bg-emerald-600 ring-2 ring-white", pos)} />
      ))}
    </div>
  );
}

function PhoneMockup() {
  const { t } = useTranslation();
  return (
    <div
      className="relative rounded-[3rem] bg-[linear-gradient(145deg,#f4f4f5_0%,#71717a_22%,#27272a_48%,#52525b_72%,#d4d4d8_100%)] p-[2px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.45)]"
      style={{ width: PHONE_W, height: PHONE_H }}
    >
      {/* side buttons */}
      <span className="absolute -left-[3px] top-[7.5rem] h-8 w-[3px] rounded-l bg-zinc-600" aria-hidden />
      <span className="absolute -left-[3px] top-[10.5rem] h-12 w-[3px] rounded-l bg-zinc-600" aria-hidden />
      <span className="absolute -right-[3px] top-[9rem] h-16 w-[3px] rounded-r bg-zinc-600" aria-hidden />

      <div className="h-full w-full rounded-[2.85rem] bg-[#0b0b0d] p-[5px]">
        <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[2.55rem] bg-white">
          <div className="relative flex h-11 shrink-0 items-center justify-between px-7 text-[12px] font-semibold text-zinc-900">
            <span>9:41</span>
            <span className="absolute left-1/2 top-2.5 h-[1.6rem] w-[5.75rem] -translate-x-1/2 rounded-full bg-black" aria-hidden />
            <span className="flex items-center gap-1" aria-hidden>
              <span className="flex items-end gap-[2px]">
                <span className="h-1.5 w-[3px] rounded-sm bg-zinc-900" />
                <span className="h-2 w-[3px] rounded-sm bg-zinc-900" />
                <span className="h-2.5 w-[3px] rounded-sm bg-zinc-900" />
              </span>
              <span className="ml-1 h-[11px] w-[22px] rounded-[3px] border border-zinc-900 p-[1.5px]">
                <span className="block h-full w-[75%] rounded-[1px] bg-zinc-900" />
              </span>
            </span>
          </div>

          <div className="flex h-10 shrink-0 items-center justify-between px-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-800 shadow-[0_3px_10px_rgba(24,24,27,0.12)]">
              <ChevronLeft className="h-5 w-5" strokeWidth={2.25} />
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-800 shadow-[0_3px_10px_rgba(24,24,27,0.12)]">
              <MoreHorizontal className="h-5 w-5" strokeWidth={2.25} />
            </span>
          </div>

          <div className="mt-1 text-center">
            <div className="mx-auto flex max-w-[14rem] items-center justify-center gap-2 px-2">
              <img
                src="/images/landing-phone-nanny.jpg"
                alt=""
                width={160}
                height={160}
                className="h-11 w-11 shrink-0 rounded-full object-cover"
                decoding="async"
              />
              <p className="text-left text-[1.25rem] font-black leading-[1.05] tracking-tight text-emerald-600">
                {t("landing.creamHero.phoneCategory")}
              </p>
            </div>
            <p className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-medium italic text-zinc-500">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {t("landing.creamHero.phoneLive")}
            </p>
          </div>

          <div className="mt-4">
            <MapTile />
          </div>

          <div className="relative z-10 mx-3 -mt-5 flex-1 rounded-[1.4rem] bg-white px-3 pb-[4.75rem] pt-3 shadow-[0_-6px_20px_-8px_rgba(15,23,42,0.18)]">
            <p className="text-center text-[13px] font-bold text-zinc-900">
              {t("landing.creamHero.phoneResponded", { count: HELPERS.length })}
            </p>
            <div className="mt-2 flex flex-col gap-1.5">
              {HELPERS.slice(0, 2).map((helper, index) => (
                <div key={helper.name} className="relative flex items-center gap-2 rounded-xl border border-zinc-100 bg-zinc-50/80 p-1.5 pr-9 shadow-sm">
                  <span className="relative shrink-0">
                    <img src={helper.photo} alt="" className="h-10 w-10 rounded-lg object-cover" />
                    <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <p className="truncate text-[11px] font-black text-zinc-900">{helper.name}</p>
                      <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-sky-500 text-[8px] font-black text-white">✓</span>
                    </div>
                    <p className="mt-0.5 truncate text-[9px] font-semibold text-zinc-500">
                      {t("landing.creamHero.phoneCategory")}
                    </p>
                    <p className="mt-0.5 text-[9px] font-bold text-amber-500">
                      ★ {index === 0 ? "4.9" : "4.8"}
                      <span className="font-medium text-zinc-400"> ({index === 0 ? "24" : "18"})</span>
                      <span className="ml-1 font-medium text-zinc-500">
                        · {index === 0 ? "0.8" : "1.2"} km {t("landing.creamHero.phoneFromYou")}
                      </span>
                    </p>
                  </div>
                  <span className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 shadow-sm">
                    <MoreHorizontal className="h-4 w-4" strokeWidth={2.2} />
                  </span>
                </div>
              ))}
            </div>
            <div className="absolute inset-x-3 bottom-3 flex items-center gap-2">
              <div className="flex-1 rounded-full bg-emerald-600 py-3 text-center text-[12px] font-bold text-white shadow-[0_6px_14px_-6px_rgba(5,150,105,0.7)]">
                {t("landing.creamHero.phoneChoose")}
              </div>
              <span className="whitespace-nowrap text-[9px] font-bold leading-tight text-zinc-500">
                {t("landing.creamHero.phoneMoreHelpers", { count: HELPERS.length - 2 })}
              </span>
            </div>
          </div>
          <span
            className="absolute bottom-1.5 left-1/2 z-40 h-1 w-24 -translate-x-1/2 rounded-full bg-zinc-900/75"
            aria-hidden
          />
          <span
            className="pointer-events-none absolute inset-0 z-30 rounded-[2.55rem] bg-[linear-gradient(118deg,rgba(255,255,255,0.2)_0%,transparent_24%,transparent_72%,rgba(255,255,255,0.08)_100%)]"
            aria-hidden
          />
        </div>
      </div>
    </div>
  );
}

/** Phone standing on its bottom edge on the tabletop: pivots on the bottom-right corner, leaning back. */
function StandingPhone({ scale }: { scale: number }) {
  return (
    <div className="relative" style={{ width: PHONE_W * scale, height: PHONE_H * scale }}>
      {/* overhead light: soft pool of shadow centered under the phone, fading toward the bottom */}
      <div
        className="pointer-events-none absolute -bottom-[8%] left-[54%] h-[13%] w-[108%] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(ellipse_at_center,rgba(59,47,36,0.38)_0%,rgba(59,47,36,0.16)_46%,transparent_74%)] blur-xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-[4%] left-[52%] h-[6%] w-[84%] -translate-x-1/2 rotate-[3deg] rounded-[50%] bg-black/30 blur-lg"
        aria-hidden
      />
      {/* contact shadow along the edge that touches the table */}
      <div
        className="pointer-events-none absolute -bottom-[1.2%] right-[-1%] h-[3%] w-[88%] origin-right rotate-[7deg] rounded-[50%] bg-black/45 blur-[6px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-[0.6%] right-[-0.5%] h-[1.6%] w-[18%] rounded-[50%] bg-black/55 blur-[3px]"
        aria-hidden
      />
      <div
        className="absolute bottom-0 right-0 origin-bottom-right"
        style={{ transform: `scale(${scale})` }}
      >
        <div
          className="relative origin-bottom-right drop-shadow-[8px_32px_30px_rgba(30,22,15,0.3)]"
          style={{
            transform:
              "perspective(1150px) rotateX(5deg) rotateY(-12deg) rotateZ(7deg)",
            transformStyle: "preserve-3d",
          }}
        >
          {/* Layered chassis gives the device visible physical depth. */}
          <div
            className="absolute inset-0 translate-x-[12px] translate-y-[8px] rounded-[3rem] bg-[#18181b] shadow-[8px_12px_22px_rgba(0,0,0,0.24)]"
            style={{ transform: "translate3d(12px, 8px, -18px)" }}
            aria-hidden
          />
          <div
            className="absolute inset-0 translate-x-[7px] translate-y-[5px] rounded-[3rem] bg-[linear-gradient(90deg,#27272a,#71717a_45%,#27272a)] ring-1 ring-black/50"
            style={{ transform: "translate3d(7px, 5px, -9px)" }}
            aria-hidden
          />
          <div
            className="relative rounded-[3rem] shadow-[0_3px_0_#18181b,0_5px_0_#71717a]"
            style={{ transform: "translateZ(5px)" }}
          >
            <PhoneMockup />
          </div>
        </div>
      </div>
    </div>
  );
}

export function LandingCreamHero({ onFindHelp, onOfferHelp, ctaRef, className }: Props) {
  const { t } = useTranslation();
  const phoneScale = usePhoneScale();
  const mediaReady = useHeroMediaReady();
  const [loaderOn, setLoaderOn] = useState(true);
  useEffect(() => {
    if (!mediaReady) return;
    const id = window.setTimeout(() => setLoaderOn(false), 560);
    return () => window.clearTimeout(id);
  }, [mediaReady]);
  const reveal = (delayMs: number) =>
    mediaReady
      ? { className: "landing-reveal", style: { animationDelay: `${delayMs}ms` } as const }
      : { className: "opacity-0", style: undefined };

  return (
    <div className={cn("relative overflow-hidden", LANDING_CREAM_BG, className)}>
      {/* Desktop artwork — measured against the reference layout */}
      <div className={cn("pointer-events-none absolute inset-y-0 start-0 hidden w-full md:block md:w-[calc(100%-min(400px,34vw))]", reveal(0).className)} style={reveal(0).style} aria-hidden>
        {/* tabletop */}
        <div className="absolute bottom-0 left-[22%] right-[44%] h-[19%] bg-[linear-gradient(180deg,rgba(253,251,247,0)_0%,rgba(253,251,247,0.92)_14%,#fdfbf7_100%)] [mask-image:linear-gradient(90deg,transparent_0%,#000_22%)] rtl:left-[44%] rtl:right-[22%] rtl:[mask-image:linear-gradient(270deg,transparent_0%,#000_22%)]" />

        <div className="absolute bottom-[18%] right-[4%] top-[18%] w-[36%] rtl:left-[4%] rtl:right-auto">
          <div className="absolute inset-0 overflow-hidden rounded-[1.75rem] bg-white shadow-[0_18px_40px_-24px_rgba(15,23,42,0.45)] ring-1 ring-black/5">
            <HeroPhoto />
            <div className="absolute inset-x-6 top-6 flex items-center justify-between" aria-hidden>
              <span className="h-4 w-[32%] rounded-full bg-white/90" />
              <span className="flex items-center gap-2 rounded-full bg-white/95 px-3.5 py-2.5">
                <span className="h-5 w-5 rounded-full bg-zinc-200" />
                <span className="h-3.5 w-12 rounded-full bg-zinc-200" />
              </span>
            </div>
            <div className="absolute inset-x-6 bottom-6 flex flex-col gap-3.5" aria-hidden>
              <span className="h-4 w-[40%] rounded-full bg-white/90" />
              <span className="flex items-center gap-3">
                <span className="h-5 w-[46%] rounded-full bg-white" />
                <span className="h-5 w-5 rounded-full bg-white" />
                <span className="h-5 w-5 rounded-full bg-white/75" />
                <span className="h-5 w-5 rounded-full bg-white/45" />
              </span>
            </div>
            <div className="absolute bottom-5 right-5 flex items-center gap-2 rtl:left-5 rtl:right-auto" aria-hidden>
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-[0_8px_18px_-8px_rgba(15,23,42,0.45)]">
                <Share2 className="h-5 w-5 text-zinc-700" strokeWidth={2.25} />
              </span>
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-[0_8px_18px_-8px_rgba(15,23,42,0.45)]">
                <Heart className="h-6 w-6 fill-red-500 text-red-500" strokeWidth={2.25} />
              </span>
            </div>
          </div>
        </div>
      </div>

      {loaderOn ? (
        <div
          className={cn(
            "pointer-events-none absolute bottom-[18%] right-[18vw] z-20 md:bottom-auto md:right-[26vw] md:top-1/2 md:-translate-y-1/2 rtl:left-[18vw] rtl:right-auto md:rtl:left-[26vw]",
            mediaReady && "landing-loader-out",
          )}
          aria-hidden
        >
          <span className="relative block h-[7.75rem] w-[11rem] overflow-hidden rounded-2xl bg-[rgba(226,236,220,0.62)] md:h-[12.5rem] md:w-[18rem] md:rounded-[1.75rem]">
            <svg className="absolute inset-0 h-full w-full opacity-80" viewBox="0 0 240 160" preserveAspectRatio="none">
              <g fill="none" stroke="#fff" strokeLinecap="round">
                <path d="M-8 40 H250" strokeWidth="8" />
                <path d="M-8 104 H250" strokeWidth="7" />
                <path d="M62 -8 V170" strokeWidth="7" />
                <path d="M168 -8 V170" strokeWidth="7" />
                <path d="M-8 74 H250" strokeWidth="3" />
                <path d="M116 -8 V170" strokeWidth="3" />
              </g>
              <g fill="#d7e3cf">
                <rect x="74" y="50" width="34" height="20" rx="3" />
                <rect x="182" y="24" width="38" height="20" rx="3" />
                <rect x="126" y="114" width="30" height="22" rx="3" />
              </g>
            </svg>
            <span className="absolute left-1/2 top-1/2 h-[4.5rem] w-[4.5rem] -translate-x-1/2 -translate-y-1/2 md:h-[8.5rem] md:w-[8.5rem]">
              <i className="absolute inset-0 rounded-full border border-emerald-600/30 shadow-[inset_0_0_0_10px_rgba(16,185,129,0.08),inset_0_0_0_20px_rgba(16,185,129,0.05)] md:shadow-[inset_0_0_0_18px_rgba(16,185,129,0.08),inset_0_0_0_36px_rgba(16,185,129,0.05)]" />
              <b className="absolute inset-0 animate-[boot-spin_2.6s_linear_infinite] rounded-full bg-[conic-gradient(from_0deg,transparent_0_62%,rgba(16,185,129,0.04)_76%,rgba(5,150,105,0.42)_100%)]" />
              <em className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-600 shadow-[0_0_0_4px_rgba(16,185,129,0.28)]" />
            </span>
          </span>
        </div>
      ) : null}

      <div className="relative z-10 flex min-h-[100svh] flex-col justify-start px-5 pb-0 pt-20 sm:px-10 md:w-[calc(100%-min(400px,34vw))] md:px-[3.2vw] md:pb-[6vh] md:pt-[6.5rem]">
        <div className="min-w-0 w-full max-w-xl md:max-w-[min(40rem,54%)]">
          <div className="mb-2 flex items-center md:hidden">
            <img
              src={BRAND_LOGO_SRC}
              alt=""
              className="h-9 w-auto"
              loading="eager"
              decoding="async"
            />
            <span className="-ml-1 text-lg font-black tracking-[-0.04em] text-zinc-950 dark:text-white">
              tebnu
            </span>
          </div>
          <h1 className="w-full max-w-full whitespace-normal break-words text-[2.6rem] font-black leading-[0.98] tracking-[-0.045em] text-zinc-950 min-[430px]:text-[3rem] sm:text-6xl md:text-[clamp(3.5rem,5vw,6.25rem)] md:leading-[0.94]">
            {t("landing.creamHero.title")}
          </h1>
          <p className="mt-4 max-w-md text-lg font-medium leading-snug text-zinc-600 sm:mt-6 sm:text-xl md:mt-5 md:text-[clamp(1.05rem,1.45vw,1.5rem)]">
            {t("landing.creamHero.subtitle")}
          </p>

          <div
            ref={ctaRef}
            className="pointer-events-auto mt-7 flex flex-wrap items-center gap-x-6 gap-y-4 sm:mt-9 sm:gap-x-8 md:mt-[3.4vw] md:gap-x-[2.8vw]"
          >
            <button
              type="button"
              onClick={onFindHelp}
              className="inline-flex h-14 items-center gap-2 rounded-full bg-[#F97316] px-8 text-lg font-semibold text-white shadow-[0_14px_30px_-14px_rgba(249,115,22,0.9)] transition hover:bg-orange-600 active:scale-[0.98] sm:h-16 sm:gap-2.5 sm:px-9 sm:text-xl md:h-16 md:px-9 md:text-xl"
            >
              {t("landing.creamHero.findHelp")}
              <ArrowUpRight className="h-5 w-5 sm:h-6 sm:w-6 rtl:-scale-x-100" strokeWidth={2.25} />
            </button>
            <button
              type="button"
              onClick={onOfferHelp}
              className="text-base font-medium text-zinc-900 underline decoration-zinc-900 decoration-[1.5px] underline-offset-[7px] transition hover:text-orange-600 hover:decoration-orange-600 sm:text-lg md:text-[clamp(1.05rem,1.6vw,1.5rem)]"
            >
              {t("landing.creamHero.offerHelp")}
            </button>
          </div>
        </div>

        {/* Mobile artwork */}
        <div className={cn("relative -mr-5 ml-auto mt-8 h-[25rem] w-[calc(100%+1.25rem)] max-w-[25rem] sm:-mr-10 sm:mt-12 sm:h-[34rem] sm:max-w-[28rem] md:hidden rtl:-ml-5 rtl:mr-auto sm:rtl:-ml-10", reveal(80).className)} style={reveal(80).style} aria-hidden>
          <div className="absolute bottom-0 left-[-10%] right-[-10%] h-[16%] bg-[linear-gradient(180deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.85)_35%,#fdfbf7_100%)]" />
          <div className="absolute bottom-[8%] right-0 top-[4%] w-[68%] rtl:left-0 rtl:right-auto">
            <div className="absolute inset-0 overflow-hidden rounded-[1.5rem] bg-white shadow-[0_18px_40px_-24px_rgba(15,23,42,0.45)] ring-1 ring-black/5">
              <HeroPhoto />
              <div className="absolute inset-x-4 top-4 flex items-center justify-between" aria-hidden>
                <span className="h-3 w-[32%] rounded-full bg-white/90" />
                <span className="flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1.5">
                  <span className="h-4 w-4 rounded-full bg-zinc-200" />
                  <span className="h-2.5 w-8 rounded-full bg-zinc-200" />
                </span>
              </div>
              <div className="absolute inset-x-4 bottom-4 flex flex-col gap-2.5" aria-hidden>
                <span className="h-3 w-[40%] rounded-full bg-white/90" />
                <span className="flex items-center gap-2">
                  <span className="h-3.5 w-[46%] rounded-full bg-white" />
                  <span className="h-3.5 w-3.5 rounded-full bg-white" />
                  <span className="h-3.5 w-3.5 rounded-full bg-white/75" />
                  <span className="h-3.5 w-3.5 rounded-full bg-white/45" />
                </span>
              </div>
              <div className="absolute bottom-3.5 right-3.5 flex items-center gap-1.5 rtl:left-3.5 rtl:right-auto" aria-hidden>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-[0_8px_18px_-8px_rgba(15,23,42,0.45)]">
                  <Share2 className="h-4 w-4 text-zinc-700" strokeWidth={2.25} />
                </span>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-[0_8px_18px_-8px_rgba(15,23,42,0.45)]">
                  <Heart className="h-5 w-5 fill-red-500 text-red-500" strokeWidth={2.25} />
                </span>
              </div>
            </div>
          </div>
          <div className="absolute bottom-[-8%] left-[-4%] sm:bottom-[4%] sm:left-[8%]">
            <span className="block sm:hidden"><StandingPhone scale={0.52} /></span>
            <span className="hidden sm:block"><StandingPhone scale={0.78} /></span>
          </div>
          <RequestPushNotification className="bottom-[3%] left-[34%] origin-left scale-[0.6] sm:bottom-[11%] sm:left-[-3%] sm:scale-[0.82]" />
        </div>
      </div>

      {/* Desktop phone + chip sit above the copy layer so the chip can overlap it like the reference */}
      <div className={cn("pointer-events-none absolute inset-y-0 start-0 z-20 hidden w-full md:block md:w-[calc(100%-min(400px,34vw))]", reveal(140).className)} style={reveal(140).style} aria-hidden>
        <div className="absolute bottom-[8%] left-[34%] rtl:left-auto rtl:right-[34%]">
          <StandingPhone scale={phoneScale} />
        </div>
        <RequestPushNotification className="left-[78%] top-[calc(82%+0.7rem)] -translate-x-1/2 rtl:left-[22%] rtl:right-auto" />
      </div>

      <div className={cn("pointer-events-auto absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-5 z-30 flex items-center gap-2 sm:left-10 md:bottom-8 md:left-[4.7vw]", reveal(240).className)} style={reveal(240).style}>
        <a
          href="https://testflight.apple.com/join/PesFrQ2m"
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-8 items-center gap-1.5 rounded-[0.5rem] bg-black px-2 text-left text-white transition hover:bg-zinc-900 active:scale-[0.98] sm:h-10 sm:gap-2 sm:px-2.5"
        >
          <img src="/app-store-apple.svg" alt="" className="h-5 w-5 shrink-0 object-contain sm:h-6 sm:w-6" />
          <span className="leading-none">
            <span className="block text-[7px] font-medium tracking-wide sm:text-[8px]">{t("landing.creamHero.appStoreOn")}</span>
            <span className="mt-0.5 block text-[12px] font-semibold tracking-[-0.02em] sm:text-[14px]">{t("landing.creamHero.appStoreName")}</span>
          </span>
        </a>
        <a
          href="https://groups.google.com/g/tebnu/c/hZGy5mYo9dk"
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-8 items-center gap-1.5 rounded-[0.5rem] border border-white bg-black px-2 text-left text-white shadow-sm transition hover:bg-zinc-900 active:scale-[0.98] sm:h-10 sm:gap-2 sm:border-2 sm:px-2.5"
        >
          <img src="/google-play-logo.svg" alt="" className="h-4 w-4 shrink-0 object-contain sm:h-5 sm:w-5" />
          <span className="leading-none">
            <span className="block text-[7px] font-medium uppercase tracking-[0.04em] sm:text-[8px]">{t("landing.creamHero.playOn")}</span>
            <span className="mt-0.5 block text-[12px] font-semibold tracking-[-0.02em] sm:text-[14px]">{t("landing.creamHero.playName")}</span>
          </span>
        </a>
      </div>

    </div>
  );
}
