import {
  Target,
  ShieldCheck,
  Star,
  Languages,
  Zap,
  Bookmark,
  MessageCircle,
  X,
  Home,
  Briefcase,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BRAND_LOGO_SRC } from "@/lib/brandLogo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

/** Local assets only — avoid `gradient-mesh` on this wrapper (global `.gradient-mesh` uses min-height: 100dvh and breaks the phone mock). */
const BENEFITS_FAKE_PROFILES = [
  {
    id: "1",
    name: "Maya K.",
    line: "3 km · Nanny",
    rating: "4.9",
    img: "/images/helper_profile_1.png",
  },
  {
    id: "2",
    name: "Dana L.",
    line: "1 km · Cleaning",
    rating: "5.0",
    img: "/images/helper_profile_2.png",
  },
  {
    id: "3",
    name: "Noam R.",
    line: "5 km · Chef",
    rating: "4.8",
    img: "/images/helper_profile_3.png",
  },
  {
    id: "4",
    name: "Yoni S.",
    line: "2 km · Errands",
    rating: "4.9",
    img: "/images/helper_profile_4.png",
  },
  {
    id: "5",
    name: "Tamar E.",
    line: "4 km · Sitter",
    rating: "5.0",
    img: "/pexels-dmitry-rodionov-30660800.jpg",
  },
] as const;

const benefits = [
  {
    title: "Ideal helper, faster",
    description:
      "AI matching shows you the best helpers first, ensuring a perfect fit.",
    icon: <Target className="w-8 h-8 text-blue-500" />,
    color: "bg-blue-50/80",
    angle: -90,
  },
  {
    title: "Trust powered by AI",
    description:
      "Every helper is ID‑verified with Teudat Zehut and selfie-match.",
    icon: <ShieldCheck className="w-8 h-8 text-emerald-500" />,
    color: "bg-emerald-50/80",
    angle: -18,
  },
  {
    title: "Real reviews",
    description:
      "Ratings come only from real families after a completed help together.",
    icon: <Star className="w-8 h-8 text-yellow-500" />,
    color: "bg-yellow-50/80",
    angle: 54,
  },
  {
    title: "No language barriers",
    description: "Hebrew, English, Russian – built for smooth communication.",
    icon: <Languages className="w-8 h-8 text-purple-500" />,
    color: "bg-purple-50/80",
    angle: 126,
  },
  {
    title: "Built for busy families",
    description: "AI handles the hard stuff, making finding help stress‑free.",
    icon: <Zap className="w-8 h-8 text-orange-500" />,
    color: "bg-orange-50/80",
    angle: 198,
  },
];

function BenefitsHubShowcase() {
  return (
    <div className="absolute top-1/2 left-1/2 z-20 w-[min(260px,28vw)] -translate-x-1/2 -translate-y-1/2">
      {/* Ambient glow */}
      <div
        className="benefits-hub-glow pointer-events-none absolute -inset-8 -z-10 rounded-[3.5rem] opacity-90"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -inset-12 -z-20 rounded-full bg-gradient-to-br from-orange-400/25 via-rose-400/20 to-amber-300/25 blur-3xl"
        aria-hidden
      />

      {/* Outer brand ring + iPhone device */}
      <div className="benefits-hub-frame relative rounded-[3rem] p-[3px] shadow-[0_32px_64px_-12px_rgba(249,115,22,0.35)]">
        <div className="rounded-[calc(3rem-3px)] bg-gradient-to-b from-white/40 via-white/5 to-transparent px-4 pb-5 pt-6">
          <div className="group/phone relative mx-auto w-full max-w-[220px] scale-[0.98] xl:max-w-[224px]">
            {/* Side buttons (hardware) */}
            <div
              className="absolute -left-[2px] top-[24%] z-0 h-9 w-[3px] rounded-l-sm bg-gradient-to-b from-zinc-500 to-zinc-700 shadow-sm"
              aria-hidden
            />
            <div
              className="absolute -left-[2px] top-[31%] z-0 h-14 w-[3px] rounded-l-sm bg-gradient-to-b from-zinc-500 to-zinc-700 shadow-sm"
              aria-hidden
            />
            <div
              className="absolute -left-[2px] top-[40%] z-0 h-14 w-[3px] rounded-l-sm bg-gradient-to-b from-zinc-500 to-zinc-700 shadow-sm"
              aria-hidden
            />
            <div
              className="absolute -right-[2px] top-[28%] z-0 h-16 w-[3px] rounded-r-sm bg-gradient-to-b from-zinc-500 to-zinc-700 shadow-sm"
              aria-hidden
            />

            {/* Chassis */}
            <div className="relative rounded-[2.85rem] border border-white/25 bg-gradient-to-b from-zinc-400 via-zinc-700 to-zinc-950 p-[11px] shadow-[0_36px_70px_-18px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.35)]">
              {/* Inner bezel */}
              <div className="rounded-[2.35rem] bg-zinc-950 p-[3px] ring-1 ring-black/60">
                <div className="relative flex aspect-[9/20] w-full flex-col overflow-hidden rounded-[2.05rem] bg-slate-100">
                  {/* Status bar */}
                  <div className="absolute left-0 right-0 top-0 z-30 flex items-center justify-between px-3 pt-1.5 text-[9px] font-semibold text-slate-900">
                    <span>9:41</span>
                    <div className="flex items-center gap-0.5 pr-0.5">
                      <svg
                        width="12"
                        height="8"
                        viewBox="0 0 14 10"
                        className="text-slate-900"
                        aria-hidden
                      >
                        <path
                          fill="currentColor"
                          d="M1 7h2v2H1V7zm3-1h2v3H4V6zm3-2h2v5H7V4zm3-2h2v7h-2V2z"
                          opacity="0.95"
                        />
                      </svg>
                      <svg
                        width="14"
                        height="8"
                        viewBox="0 0 16 10"
                        className="text-slate-900"
                        aria-hidden
                      >
                        <rect
                          x="0.5"
                          y="2"
                          width="11"
                          height="6"
                          rx="1"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1"
                        />
                        <rect
                          x="12"
                          y="3.5"
                          width="2.5"
                          height="3"
                          rx="0.5"
                          fill="currentColor"
                        />
                      </svg>
                    </div>
                  </div>

                  {/* Dynamic Island */}
                  <div
                    className="absolute left-1/2 top-2 z-40 h-[20px] w-[36%] max-w-[100px] -translate-x-1/2 rounded-full bg-black shadow-[inset_0_-1px_2px_rgba(255,255,255,0.08)] ring-1 ring-white/15"
                    aria-hidden
                  />

                  {/* Suggested helpers — carousel hugging bottom nav; tall portrait photos, no stretched empty cards */}
                  <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden pt-[38px]">
                    <div className="benefits-hub-main min-h-0 flex-1 overflow-x-hidden overflow-y-hidden px-2 pb-0">
                      <div className="flex h-full min-h-0 flex-col justify-end rounded-t-lg bg-gradient-to-b from-slate-50 to-slate-100 px-1 pb-1 pt-1">
                        <div className="flex shrink-0 flex-col gap-1.5">
                          <p className="shrink-0 px-0.5 text-[8px] font-black uppercase tracking-wide text-slate-500">
                            Suggested
                          </p>
                          <div
                            className="benefits-hub-scroll flex shrink-0 items-stretch gap-2 overflow-x-auto overflow-y-hidden pb-0.5 scroll-smooth snap-x snap-mandatory [scrollbar-width:thin]"
                            style={{ WebkitOverflowScrolling: "touch" }}
                          >
                            {BENEFITS_FAKE_PROFILES.map((p) => (
                              <div
                                key={p.id}
                                className="flex w-[132px] shrink-0 snap-center flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white p-1.5 shadow-sm dark:border-border/60"
                              >
                                <div className="relative mb-1.5 w-full shrink-0 overflow-hidden rounded-xl bg-slate-200 aspect-[3/4]">
                                  <img
                                    src={p.img}
                                    alt=""
                                    className="h-full w-full object-cover object-top"
                                    loading="eager"
                                  />
                                  <div className="absolute left-1 top-1 rounded-md bg-black/55 px-1 py-0.5 text-[8px] font-bold text-white shadow-sm">
                                    ★ {p.rating}
                                  </div>
                                </div>
                                <p className="truncate text-[10px] font-black leading-tight text-slate-900">
                                  {p.name}
                                </p>
                                <p className="mb-1 line-clamp-2 text-[8px] font-medium leading-snug text-slate-500">
                                  {p.line}
                                </p>
                                <div className="flex flex-col gap-1">
                                  <button
                                    type="button"
                                    className="flex h-7 w-full items-center justify-center gap-0.5 rounded-lg border border-slate-200 bg-white text-[8px] font-bold text-slate-800"
                                  >
                                    <Bookmark className="h-3 w-3 shrink-0" />
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    className="flex h-7 w-full items-center justify-center gap-0.5 rounded-lg bg-gradient-to-r from-orange-500 to-red-600 text-[8px] font-bold text-white"
                                  >
                                    <MessageCircle className="h-3 w-3 shrink-0" />
                                    Chat
                                  </button>
                                  <button
                                    type="button"
                                    className="flex h-7 w-full items-center justify-center gap-0.5 rounded-lg border border-red-200 bg-red-50 text-[8px] font-bold text-red-600"
                                  >
                                    <X className="h-3 w-3 shrink-0" />
                                    Decline
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom nav — mirrors BottomNav mobile shell + 5-tile layout */}
                  <nav
                    className="bottom-nav-mobile-shell relative z-20 mx-0 w-full max-w-none shrink-0 overflow-visible rounded-none px-0 pb-0"
                    aria-hidden
                  >
                    <div className="mx-0 flex w-full max-w-none items-center justify-evenly overflow-visible px-0.5 py-1 pb-[max(0.2rem,env(safe-area-inset-bottom,0px))]">
                      {[
                        { Icon: Home, active: true },
                        { Icon: Briefcase, active: false },
                      ].map((item, i) => {
                        const Icon = item.Icon;
                        return (
                          <div
                            key={i}
                            className={cn(
                              "flex flex-col items-center justify-center p-0.5",
                              item.active ? "text-slate-800" : "text-slate-500",
                            )}
                          >
                            <div
                              className={cn(
                                "relative flex h-[26px] w-[26px] items-center justify-center rounded-xl transition-all",
                                item.active
                                  ? "bg-white/70 text-slate-800 shadow-sm"
                                  : "",
                              )}
                            >
                              <Icon className="h-3.5 w-3.5" />
                            </div>
                          </div>
                        );
                      })}

                      <div className="relative z-10 mx-0 flex shrink-0 items-center justify-center">
                        <img
                          src={BRAND_LOGO_SRC}
                          alt=""
                          className="h-[26px] w-auto max-w-[30px] object-contain"
                        />
                      </div>

                      <div className="flex flex-col items-center justify-center p-0.5 text-slate-500">
                        <div className="relative flex h-[26px] w-[26px] items-center justify-center rounded-xl">
                          <MessageCircle className="h-3.5 w-3.5" />
                        </div>
                      </div>

                      <div className="flex flex-col items-center justify-center p-0.5 text-slate-500">
                        <div className="flex h-[26px] w-[26px] items-center justify-center rounded-xl bg-white/70 shadow-sm ring-1 ring-slate-300/50">
                          <Avatar className="h-5 w-5 border border-black/10">
                            <AvatarFallback className="bg-slate-100 text-[8px] font-bold">
                              SA
                            </AvatarFallback>
                          </Avatar>
                        </div>
                      </div>
                    </div>
                  </nav>

                  {/* Home indicator */}
                  <div
                    className="absolute bottom-0.5 left-1/2 z-30 h-0.5 w-[72px] -translate-x-1/2 rounded-full bg-slate-900/25"
                    aria-hidden
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Benefits() {
  return (
    <section className="overflow-hidden py-24 px-4">
      <div className="mx-auto flex max-w-7xl flex-col items-center">
        <h2 className="mb-24 text-center text-2xl font-bold text-black md:text-3xl">
          Your benefits with Mamalama
        </h2>

        {/* Desktop: orbital cards + new center hub */}
        <div className="relative mb-20 hidden h-[820px] w-[820px] xl:block">
          <BenefitsHubShowcase />

          {benefits.map((benefit, idx) => {
            const radius = 340;
            const x = radius * Math.cos((benefit.angle * Math.PI) / 180);
            const y = radius * Math.sin((benefit.angle * Math.PI) / 180);

            return (
              <div
                key={idx}
                className="group absolute w-[300px] transition-all duration-700"
                style={{
                  left: `calc(50% + ${x}px)`,
                  top: `calc(50% + ${y}px)`,
                  transform: "translate(-50%, -50%)",
                }}
              >
                <div className="flex flex-col items-center space-y-4 text-center">
                  <div
                    className={cn(
                      "flex h-20 w-20 items-center justify-center rounded-[2.5rem] border border-white/40 shadow-xl backdrop-blur-sm transition-all duration-500 group-hover:rotate-6 group-hover:scale-110",
                      benefit.color,
                    )}
                  >
                    {benefit.icon}
                  </div>
                  <div className="transition-transform duration-500 group-hover:-translate-y-2">
                    <h3 className="text-lg font-bold text-gray-900 transition-colors group-hover:text-primary">
                      {benefit.title}
                    </h3>
                    <p className="mx-auto mt-2 max-w-[240px] text-sm font-medium leading-relaxed text-gray-600 opacity-80 transition-opacity group-hover:opacity-100 md:text-base">
                      {benefit.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Mobile / tablet grid */}
        <div className="grid w-full max-w-4xl grid-cols-1 gap-16 px-8 md:grid-cols-2 xl:hidden">
          {benefits.map((benefit, idx) => (
            <div
              key={idx}
              className="group flex items-start gap-8 transition-all"
            >
              <div
                className={cn(
                  "flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-3xl border border-white/20 shadow-lg transition-transform group-hover:scale-110 md:rounded-[2rem]",
                  benefit.color,
                )}
              >
                <div className="scale-125">{benefit.icon}</div>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-gray-900 transition-colors group-hover:text-primary">
                  {benefit.title}
                </h3>
                <p className="text-base font-medium leading-relaxed text-gray-600">
                  {benefit.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes benefits-hub-shimmer {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .benefits-hub-frame {
          background: linear-gradient(135deg, #f97316, #ec4899, #f59e0b, #ef4444, #f97316);
          background-size: 300% 300%;
          animation: benefits-hub-shimmer 8s ease infinite;
        }
        .benefits-hub-glow {
          background: linear-gradient(135deg, rgba(249,115,22,0.55), rgba(244,63,94,0.4), rgba(251,191,36,0.45));
          background-size: 300% 300%;
          filter: blur(28px);
          animation: benefits-hub-shimmer 10s ease infinite;
        }
        .benefits-hub-scroll::-webkit-scrollbar {
          height: 4px;
        }
        .benefits-hub-scroll::-webkit-scrollbar-thumb {
          background: rgba(15, 23, 42, 0.22);
          border-radius: 99px;
        }
        .benefits-hub-main {
          scrollbar-width: none;
        }
        .benefits-hub-main::-webkit-scrollbar {
          display: none;
        }
      `,
        }}
      />
    </section>
  );
}
