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
    <div className="grid w-full overflow-hidden rounded-[1.75rem] bg-white shadow-[0_20px_50px_-24px_rgba(15,23,42,0.35)] dark:bg-zinc-800 dark:shadow-black/50 md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
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
    <section className="relative w-full">
      <div className="bg-emerald-600 px-5 pb-24 pt-16 sm:px-8 md:pb-32 md:pt-20 lg:px-12 lg:pb-36">
        <h2 className="text-center text-3xl font-bold tracking-tight text-white md:text-4xl lg:text-5xl">
          {t("landing.benefitsTitle")}
        </h2>
      </div>

      <div className="relative z-10 -mt-16 flex w-full snap-y snap-mandatory flex-col gap-5 overflow-y-auto pb-4 md:hidden">
        {benefits.map((benefit) => (
          <div key={benefit.id} className="w-full snap-start">
            <BenefitMainCard benefit={benefit} copy={benefitCopy(benefit.id)} />
          </div>
        ))}
      </div>

      <div className="relative z-10 mx-auto hidden -mt-24 max-w-7xl px-4 sm:px-6 md:block lg:-mt-28 lg:px-8">
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
                  "flex flex-col items-start gap-3 rounded-2xl bg-white px-6 py-7 text-left shadow-[0_16px_40px_-12px_rgba(15,23,42,0.16)] transition-all duration-300 dark:bg-zinc-800 dark:shadow-black/40",
                  selected && "shadow-lg shadow-orange-500/10",
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
                <span className="text-[15px] font-medium leading-relaxed text-slate-500 dark:text-zinc-400">
                  {copy.description}
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
    </section>
  );
}
