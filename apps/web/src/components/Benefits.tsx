import { useState } from "react";
import {
  Target,
  ShieldCheck,
  Star,
  Languages,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const benefits = [
  {
    title: "Ideal helper, faster",
    description:
      "AI matching shows you the best helpers first, ensuring a perfect fit.",
    explanation:
      "Tell us what you need once. Tebnu ranks local helpers by skills, reviews, and availability so you spend minutes choosing — not hours searching through lists.",
    icon: Target,
    color: "text-blue-500",
    tint: "bg-blue-50",
    image: "/pexels-rdne-6646861.jpg",
    imageAlt: "Local helpers ready to match with families",
  },
  {
    title: "Trust powered by AI",
    description:
      "Every helper is ID‑verified with Teudat Zehut and selfie-match.",
    explanation:
      "Before anyone can hire or start helping, they complete a Didit ID check and a live selfie match. You always know who you are meeting, and fake profiles never make it onto the platform.",
    icon: ShieldCheck,
    color: "text-emerald-500",
    tint: "bg-emerald-50",
    image: "/images/id-card-scan.png",
    imageAlt: "ID card scan for verified signup",
  },
  {
    title: "Real reviews",
    description:
      "Ratings come only from real people after they helped together.",
    explanation:
      "Stars are not bought and not left by strangers. Only people who actually helped together can rate — so the score you see is earned from real time spent helping.",
    icon: Star,
    color: "text-yellow-500",
    tint: "bg-yellow-50",
    image: "/pexels-dmitry-rodionov-30660800.jpg",
    imageAlt: "People who leave reviews after real help",
  },
  {
    title: "No language barriers",
    description: "Hebrew, English, French, Russian – built for smooth communication.",
    explanation:
      "Post, chat, and read profiles in Hebrew, English, French, or Russian. The app is built for mixed-language homes in Israel, so details stay clear from the first message to the last.",
    icon: Languages,
    color: "text-purple-500",
    tint: "bg-purple-50",
    image: "/pexels-silverkblack-36715260.jpg",
    imageAlt: "Everyday help that works in any language",
  },
  {
    title: "Built for busy days",
    description: "AI handles the hard stuff, making finding help stress‑free.",
    explanation:
      "From posting a request to confirming a helper, the flow is short taps — not long forms. Get cleaning, childcare, cooking, or errands covered without pausing the rest of your day.",
    icon: Zap,
    color: "text-orange-500",
    tint: "bg-orange-50",
    image: "/nanny-mar22.png",
    imageAlt: "Everyday help when you need it",
  },
] as const;

export default function Benefits() {
  const [active, setActive] = useState(0);
  const current = benefits[active];
  const ActiveIcon = current.icon;

  return (
    <section className="px-4 py-20 md:py-24">
      <div className="mx-auto w-full max-w-6xl">
        <h2 className="mb-10 text-center text-2xl font-bold text-black md:mb-14 md:text-3xl">
          Your benefits with Tebnu
        </h2>

        <div
          className="flex gap-2 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] md:grid md:grid-cols-5 md:gap-3 md:overflow-visible [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="Tebnu benefits"
        >
          {benefits.map((benefit, idx) => {
            const Icon = benefit.icon;
            const selected = idx === active;
            return (
              <button
                key={benefit.title}
                type="button"
                role="tab"
                aria-selected={selected}
                onMouseEnter={() => setActive(idx)}
                onFocus={() => setActive(idx)}
                onClick={() => setActive(idx)}
                className={cn(
                  "flex min-w-[11.5rem] flex-1 flex-col items-start gap-2 rounded-2xl border px-4 py-4 text-left transition-all duration-300 md:min-w-0",
                  selected
                    ? "border-orange-200 bg-white shadow-lg shadow-orange-500/10"
                    : "border-transparent bg-slate-50/80 hover:border-slate-200 hover:bg-white",
                )}
              >
                <span
                  className={cn(
                    "flex h-14 w-14 items-center justify-center rounded-2xl",
                    benefit.tint,
                    benefit.color,
                  )}
                >
                  <Icon className="h-8 w-8" strokeWidth={2.1} aria-hidden />
                </span>
                <span className="text-sm font-bold leading-snug text-slate-900 md:text-[15px]">
                  {benefit.title}
                </span>
                <span className="hidden text-xs font-medium leading-relaxed text-slate-500 sm:block">
                  {benefit.description}
                </span>
              </button>
            );
          })}
        </div>

        <div
          key={current.title}
          className="mt-6 grid items-stretch overflow-hidden rounded-[1.75rem] border border-slate-100 bg-white shadow-[0_20px_50px_-24px_rgba(15,23,42,0.35)] animate-in fade-in duration-300 md:mt-8 md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]"
        >
          <div className="relative min-h-[220px] overflow-hidden bg-slate-100 md:min-h-[320px]">
            <img
              src={current.image}
              alt={current.imageAlt}
              className="absolute inset-0 h-full w-full object-cover object-center"
            />
          </div>
          <div className="flex flex-col justify-center gap-4 px-6 py-7 md:px-10 md:py-10">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "flex h-14 w-14 items-center justify-center rounded-2xl",
                  current.tint,
                  current.color,
                )}
              >
                <ActiveIcon className="h-8 w-8" strokeWidth={2.1} aria-hidden />
              </span>
              <h3 className="text-xl font-black tracking-tight text-slate-900 md:text-2xl">
                {current.title}
              </h3>
            </div>
            <p className="text-base font-semibold leading-relaxed text-slate-700 md:text-lg">
              {current.description}
            </p>
            <p className="text-sm font-medium leading-relaxed text-slate-500 md:text-base">
              {current.explanation}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
