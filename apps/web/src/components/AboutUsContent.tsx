import {
  MapPin,
  MessageCircle,
  ShieldCheck,
  Star,
  ClipboardList,
  UsersRound,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

const highlights = [
  {
    key: "post",
    icon: ClipboardList,
    image: "/images/about-post-help.jpg",
    imagePosition: "object-right",
    iconColor: "text-orange-500",
    bg: "bg-orange-500/10 dark:bg-orange-500/15",
    lightSurface: "bg-orange-50",
    lightFade: "from-orange-50 via-orange-50/90",
    darkSurface: "dark:bg-[#21130d]",
    darkFade: "dark:from-[#21130d] dark:via-[#21130d]/90",
  },
  {
    key: "find",
    icon: MapPin,
    image: "/images/about-find-helper.jpg",
    imagePosition: "object-center",
    iconColor: "text-emerald-500",
    bg: "bg-emerald-500/10 dark:bg-emerald-500/15",
    lightSurface: "bg-emerald-50",
    lightFade: "from-emerald-50 via-emerald-50/90",
    darkSurface: "dark:bg-[#0d1d19]",
    darkFade: "dark:from-[#0d1d19] dark:via-[#0d1d19]/90",
  },
  {
    key: "connect",
    icon: MessageCircle,
    image: "/images/about-connect.jpg",
    imagePosition: "object-center",
    iconColor: "text-violet-500",
    bg: "bg-violet-500/10 dark:bg-violet-500/15",
    lightSurface: "bg-violet-50",
    lightFade: "from-violet-50 via-violet-50/90",
    darkSurface: "dark:bg-[#171329]",
    darkFade: "dark:from-[#171329] dark:via-[#171329]/90",
  },
  {
    key: "community",
    icon: UsersRound,
    image: "/images/about-community.jpg",
    imagePosition: "object-center",
    iconColor: "text-rose-500",
    bg: "bg-rose-500/10 dark:bg-rose-500/15",
    lightSurface: "bg-rose-50",
    lightFade: "from-rose-50 via-rose-50/90",
    darkSurface: "dark:bg-[#271117]",
    darkFade: "dark:from-[#271117] dark:via-[#271117]/90",
  },
];

export function AboutUsContent() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto w-full max-w-6xl space-y-16 pb-8 md:space-y-24">
      {/* Hero + illustration cluster */}
      <section className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[#FFE8C9] via-[#FFF3DE] to-[#FFDDE2] p-8 shadow-sm md:p-14 dark:from-[#32150d] dark:via-[#1d1111] dark:to-[#251021]">
        <div className="relative grid gap-10 lg:grid-cols-[1fr_minmax(260px,380px)] lg:items-center">
          <div className="space-y-6">
            <h1 className="text-5xl font-black tracking-[-0.05em] text-slate-900 dark:text-white md:text-7xl lg:leading-[0.98]">
              {t("about.heroTitle")}{" "}
              <span className="bg-gradient-to-r from-orange-500 to-red-600 bg-clip-text text-transparent">
                {t("about.heroAccent")}
              </span>{" "}
            </h1>
            <p className="text-lg font-medium leading-relaxed text-slate-600 dark:text-slate-300">
              {t("about.heroDescription")}
            </p>
            <p className="text-base leading-relaxed text-slate-500 dark:text-slate-400">
              {t("about.heroSecondary")}
            </p>
          </div>

          <div className="relative mx-auto w-full max-w-sm lg:mx-0 lg:max-w-none">
            <figure className="group relative mx-auto w-fit">
              <div className="flex h-[430px] w-[230px] items-end justify-center sm:h-[520px] sm:w-[280px]">
                <img
                  src="/images/how-it-works/phone-find-help.webp"
                  alt={t("about.heroImageAlt")}
                  className="h-full w-full object-contain object-center drop-shadow-[0_24px_35px_rgba(15,23,42,0.24)] transition-transform duration-500 group-hover:-translate-y-1"
                  loading="eager"
                  decoding="async"
                />
              </div>
            </figure>
          </div>
        </div>
      </section>

      {/* Story strip */}
      <section className="relative px-1">
        <div className="absolute left-8 top-0 hidden h-full w-px bg-gradient-to-b from-orange-400/50 via-slate-300/40 to-transparent md:block dark:via-white/20" />
        <div className="space-y-8 md:pl-20">
          <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white md:text-3xl">
            {t("about.why.title")}
          </h2>
          <div className="space-y-5 text-base leading-relaxed text-slate-600 dark:text-slate-300">
            <p>
              {t("about.why.first")}
            </p>
            <p>
              {t("about.why.openPrefix")}{" "}
              <strong className="font-semibold text-slate-800 dark:text-slate-100">
                {t("about.why.findHelpers")}
              </strong>
              {" "}{t("about.why.openSuffix")}
            </p>
            <p>
              {t("about.why.third")}
            </p>
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section>
        <div className="mb-10 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white md:text-3xl">
              {t("about.everything.title")}
            </h2>
            <p className="mt-2 max-w-xl text-lg text-slate-600 dark:text-slate-400">
              {t("about.everything.subtitle")}
            </p>
          </div>
          <div className="flex items-center gap-2.5 text-base font-bold text-orange-600 dark:text-orange-400">
            <Star className="h-5 w-5 fill-current" />
            {t("about.everything.built")}
          </div>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          {highlights.map(({ key, icon: Icon, iconColor, bg, image, imagePosition, lightSurface, lightFade, darkSurface, darkFade }) => (
            <article
              key={key}
              className={cn(
                "group relative min-h-[260px] overflow-hidden rounded-[2rem] border border-slate-200/80 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl dark:border-white/10",
                lightSurface,
                darkSurface,
              )}
            >
              <img
                src={image}
                alt=""
                className={cn(
                  "absolute inset-y-0 right-0 h-full w-[55%] object-cover object-top transition-transform duration-700 group-hover:scale-[1.04]",
                  imagePosition,
                )}
                loading="lazy"
              />
              <div
                className={cn(
                  "absolute inset-0 bg-gradient-to-r from-[42%] via-[50%] to-transparent to-[68%]",
                  lightFade,
                  darkFade,
                )}
              />
              <div className="relative z-10 flex min-h-[260px] w-[62%] flex-col justify-center p-7">
              <Icon className={cn("mb-5 h-12 w-12", iconColor)} strokeWidth={2.25} />
              <div
                className={cn(
                  "absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-30 blur-2xl",
                  bg,
                )}
              />
              <h3 className="relative text-xl font-black text-slate-900 dark:text-white md:text-2xl">
                {t(`about.highlights.${key}.title`)}
              </h3>
              <p className="relative mt-2 text-base leading-relaxed text-slate-600 dark:text-slate-400">
                {t(`about.highlights.${key}.description`)}
              </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Trust band */}
      <section className="relative px-1 py-4">
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex max-w-xl items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">
                {t("about.trust.title")}
              </h3>
              <p className="mt-2 text-base leading-relaxed text-slate-700 dark:text-slate-300">
                {t("about.trust.description")}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 md:justify-end">
            {[
              t("about.trust.nearby"),
              t("about.trust.chat"),
              t("about.trust.community"),
            ].map((label) => (
              <span
                key={label}
                className="rounded-full border border-emerald-200/80 bg-white/80 px-5 py-2.5 text-sm font-bold text-emerald-900 shadow-sm dark:border-emerald-500/30 dark:bg-emerald-950/50 dark:text-emerald-100"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
