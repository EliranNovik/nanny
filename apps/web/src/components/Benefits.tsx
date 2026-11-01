import { useState } from "react";
import {
  Target,
  ShieldCheck,
  Star,
  Languages,
  Zap,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

const benefits = [
  {
    id: "match",
    icon: Target,
    color: "text-blue-500",
    tint: "bg-blue-50 dark:bg-blue-500/15",
    image: "/pexels-rdne-6646861.jpg",
  },
  {
    id: "trust",
    icon: ShieldCheck,
    color: "text-emerald-500",
    tint: "bg-emerald-50 dark:bg-emerald-500/15",
    image: "/images/id-card-scan.png",
  },
  {
    id: "reviews",
    icon: Star,
    color: "text-yellow-500",
    tint: "bg-yellow-50 dark:bg-yellow-500/15",
    image: "/pexels-dmitry-rodionov-30660800.jpg",
  },
  {
    id: "language",
    icon: Languages,
    color: "text-purple-500",
    tint: "bg-purple-50 dark:bg-purple-500/15",
    image: "/pexels-silverkblack-36715260.jpg",
  },
  {
    id: "busy",
    icon: Zap,
    color: "text-orange-500",
    tint: "bg-orange-50 dark:bg-orange-500/15",
    image: "/nanny-mar22.png",
  },
] as const;

type BenefitId = (typeof benefits)[number]["id"];
type BenefitItem = (typeof benefits)[number];
type BenefitCopy = {
  title: string;
  description: string;
  explanation: string;
  imageAlt: string;
};

function BenefitMainCard({
  benefit,
  copy,
}: {
  benefit: BenefitItem;
  copy: BenefitCopy;
}) {
  const Icon = benefit.icon;
  return (
    <div className="grid w-full overflow-hidden rounded-[2rem] bg-white shadow-[0_28px_70px_-42px_rgba(124,45,18,0.5)] md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <div className="relative min-h-[200px] overflow-hidden bg-slate-100 dark:bg-zinc-800 md:min-h-[360px]">
        <img
          src={benefit.image}
          alt={copy.imageAlt}
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
      </div>
      <div className="flex flex-col justify-center gap-4 px-6 py-7 md:px-12 md:py-12">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex h-16 w-16 items-center justify-center rounded-2xl",
              benefit.tint,
              benefit.color,
            )}
          >
            <Icon className="h-9 w-9" strokeWidth={2.1} aria-hidden />
          </span>
          <h3 className="text-2xl font-black tracking-tight text-slate-900 dark:text-zinc-50 md:text-3xl">
            {copy.title}
          </h3>
        </div>
        <p className="text-lg font-semibold leading-relaxed text-slate-700 dark:text-zinc-300 md:text-xl">
          {copy.description}
        </p>
        <p className="text-base font-medium leading-relaxed text-slate-500 dark:text-zinc-400 md:text-lg">
          {copy.explanation}
        </p>
      </div>
    </div>
  );
}

export default function Benefits() {
  const { t } = useTranslation();
  const [active, setActive] = useState(0);
  const current = benefits[active];
  const benefitCopy = (id: BenefitId): BenefitCopy => ({
    title: t(`landing.benefits.${id}.title`),
    description: t(`landing.benefits.${id}.description`),
    explanation: t(`landing.benefits.${id}.explanation`),
    imageAlt: t(`landing.benefits.${id}.imageAlt`),
  });
  const currentCopy = benefitCopy(current.id);

  return (
    <section className="relative w-full px-5 sm:px-8 lg:px-12">
      <div className="relative mx-auto max-w-[82rem] overflow-hidden rounded-[3rem] bg-[linear-gradient(135deg,#F97316_0%,#F15A24_55%,#EA580C_100%)] px-5 py-12 shadow-[0_40px_100px_-58px_rgba(194,65,12,0.85)] sm:px-8 md:py-16 lg:px-12">
      <div className="pointer-events-none absolute -right-20 -top-32 h-96 w-96 rounded-full bg-white/10 blur-2xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-40 -left-28 h-96 w-96 rounded-full bg-amber-300/20 blur-3xl" aria-hidden />
      <ShieldCheck className="pointer-events-none absolute -right-10 top-12 h-52 w-52 rotate-12 text-white/[0.07]" strokeWidth={1.1} aria-hidden />
      <Star className="pointer-events-none absolute bottom-10 left-[7%] h-28 w-28 -rotate-12 text-white/[0.06]" strokeWidth={1.1} aria-hidden />
      <Target className="pointer-events-none absolute right-[32%] top-[42%] h-36 w-36 rotate-6 text-white/[0.05]" strokeWidth={1} aria-hidden />
      <div className="mx-auto max-w-3xl text-center">
        <span className="inline-flex rounded-full bg-white/15 px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
          {t("landing.whyChooseUs")}
        </span>
        <h2 className="mt-5 text-center text-3xl font-black tracking-[-0.035em] text-white md:text-5xl">
          {t("landing.benefitsTitle")}
        </h2>
      </div>

      <div className="mt-12 flex w-full snap-y snap-mandatory flex-col gap-5 overflow-y-auto pb-4 md:hidden">
        {benefits.map((benefit) => (
          <div key={benefit.id} className="w-full snap-start">
            <BenefitMainCard benefit={benefit} copy={benefitCopy(benefit.id)} />
          </div>
        ))}
      </div>

      <div className="mt-12 hidden md:block">
        <div
          className="grid grid-cols-5 gap-5"
          role="tablist"
          aria-label={t("landing.benefitsAria")}
        >
          {benefits.map((benefit, idx) => {
            const Icon = benefit.icon;
            const selected = idx === active;
            const copy = benefitCopy(benefit.id);
            return (
              <button
                key={benefit.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onMouseEnter={() => setActive(idx)}
                onFocus={() => setActive(idx)}
                onClick={() => setActive(idx)}
                className={cn(
                  "flex flex-col items-start gap-3 rounded-[1.5rem] bg-white/85 px-5 py-5 text-left shadow-[0_14px_36px_-28px_rgba(124,45,18,0.45)] backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:bg-white",
                  selected && "-translate-y-1.5 bg-white shadow-[0_24px_50px_-24px_rgba(124,45,18,0.7)]",
                )}
              >
                <span
                  className={cn(
                    "flex h-16 w-16 items-center justify-center rounded-2xl",
                    benefit.tint,
                    benefit.color,
                  )}
                >
                  <Icon className="h-9 w-9" strokeWidth={2.1} aria-hidden />
                </span>
                <span className="text-lg font-bold leading-snug text-slate-900 dark:text-zinc-100">
                  {copy.title}
                </span>
              </button>
            );
          })}
        </div>

        <div
          key={current.id}
          className="mt-8 animate-in fade-in duration-300"
        >
          <BenefitMainCard benefit={current} copy={currentCopy} />
        </div>
      </div>
      </div>
    </section>
  );
}
