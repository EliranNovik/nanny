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
    icon: <Target className="h-8 w-8 text-blue-500" />,
    color: "bg-blue-50/80",
    angle: -90,
  },
  {
    title: "Trust powered by AI",
    description:
      "Every helper is ID‑verified with Teudat Zehut and selfie-match.",
    icon: <ShieldCheck className="h-8 w-8 text-emerald-500" />,
    color: "bg-emerald-50/80",
    angle: -18,
  },
  {
    title: "Real reviews",
    description:
      "Ratings come only from real families after a completed help together.",
    icon: <Star className="h-8 w-8 text-yellow-500" />,
    color: "bg-yellow-50/80",
    angle: 54,
  },
  {
    title: "No language barriers",
    description: "Hebrew, English, Russian – built for smooth communication.",
    icon: <Languages className="h-8 w-8 text-purple-500" />,
    color: "bg-purple-50/80",
    angle: 126,
  },
  {
    title: "Built for busy families",
    description: "AI handles the hard stuff, making finding help stress‑free.",
    icon: <Zap className="h-8 w-8 text-orange-500" />,
    color: "bg-orange-50/80",
    angle: 198,
  },
];

function BenefitsHubShowcase() {
  return (
    <div className="absolute top-1/2 left-1/2 z-20 w-[min(440px,42vw)] -translate-x-1/2 -translate-y-1/2 xl:w-[min(520px,38vw)]">
      <div
        className="benefits-hub-glow pointer-events-none absolute -inset-8 -z-10 rounded-[3rem] opacity-90"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -inset-12 -z-20 rounded-full bg-gradient-to-br from-orange-400/25 via-rose-400/20 to-amber-300/25 blur-3xl"
        aria-hidden
      />

      <div className="benefits-hub-frame relative overflow-hidden rounded-[2.5rem] p-[3px] shadow-[0_32px_64px_-12px_rgba(249,115,22,0.35)]">
        <img
          src="/pexels-rdne-6646861.jpg"
          alt="Helpers and families connecting on Tebnu"
          className="aspect-[4/3] w-full rounded-[calc(2.5rem-3px)] object-cover object-center"
          loading="lazy"
          decoding="async"
        />
      </div>
    </div>
  );
}

export default function Benefits() {
  return (
    <section className="overflow-hidden px-4 py-24">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col items-center xl:max-w-none xl:px-8">
        <h2 className="mb-24 text-center text-2xl font-bold text-black md:text-3xl">
          Your benefits with Tebnu
        </h2>

        {/* Desktop: orbital cards + center image */}
        <div className="relative mb-20 hidden h-[820px] w-full max-w-[1100px] xl:block xl:max-w-[1280px]">
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

        {/* Mobile / tablet: image + grid */}
        <div className="mb-12 w-full max-w-lg xl:hidden">
          <div className="benefits-hub-frame overflow-hidden rounded-[2rem] p-[3px] shadow-[0_24px_48px_-12px_rgba(249,115,22,0.3)]">
            <img
              src="/pexels-rdne-6646861.jpg"
              alt="Helpers and families connecting on Tebnu"
              className="aspect-[3/2] w-full rounded-[calc(2rem-3px)] object-cover object-center"
              loading="lazy"
              decoding="async"
            />
          </div>
        </div>

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
      `,
        }}
      />
    </section>
  );
}
