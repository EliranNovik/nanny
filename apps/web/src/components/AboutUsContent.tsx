import {
  Sparkles,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Star,
  LayoutDashboard,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";

function Blob({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute rounded-full blur-3xl opacity-40",
        className,
      )}
      aria-hidden
    />
  );
}

const highlights = [
  {
    title: "Ask, helpers answer",
    description:
      "Share what you need around the home—kids, cleaning, cooking, errands, whatever’s weighing on you. Nearby helpers see what fits who they are and reach out in a friendly, human way.",
    icon: ClipboardList,
    accent: "from-amber-400 to-orange-600",
    bg: "bg-orange-500/10 dark:bg-orange-500/15",
  },
  {
    title: "Neighbors on the map",
    description:
      "Find helpers uses a live map and a simple radius so you’re meeting people who are actually around you—not random profiles from nowhere. It feels more like community, less like a catalog.",
    icon: MapPin,
    accent: "from-emerald-400 to-teal-600",
    bg: "bg-emerald-500/10 dark:bg-emerald-500/15",
  },
  {
    title: "Talk it through together",
    description:
      "Chat stays in one place so nobody’s hunting through screenshots. When it feels right, you choose your helper and you’re both on the same page about what “help” means for you.",
    icon: MessageCircle,
    accent: "from-violet-400 to-indigo-600",
    bg: "bg-violet-500/10 dark:bg-violet-500/15",
  },
  {
    title: "Your corner of MamaLama",
    description:
      "Families and helpers each get a home base in the app—see who’s reaching out, what’s coming up, and what you’ve shared before. Same village, two views that make sense for how you show up.",
    icon: LayoutDashboard,
    accent: "from-rose-400 to-red-600",
    bg: "bg-rose-500/10 dark:bg-rose-500/15",
  },
];

export function AboutUsContent() {
  return (
    <div className="w-full max-w-5xl mx-auto space-y-16 md:space-y-24 pb-8">
      {/* Hero + illustration cluster */}
      <section className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/60 p-8 md:p-12 shadow-xl backdrop-blur-sm dark:border-white/10 dark:bg-slate-950/40">
        <Blob className="-right-24 -top-24 h-72 w-72 bg-gradient-to-br from-orange-400 to-rose-500" />
        <Blob className="-bottom-20 -left-16 h-64 w-64 bg-gradient-to-tr from-primary/60 to-amber-300" />

        <div className="relative grid gap-10 lg:grid-cols-[1fr_minmax(260px,380px)] lg:items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-200/80 bg-orange-500/10 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/15 dark:text-orange-300">
              <Sparkles className="h-3.5 w-3.5" />
              About MamaLama
            </div>
            <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white md:text-5xl lg:text-[3.25rem] lg:leading-[1.1]">
              A softer way for families and{" "}
              <span className="bg-gradient-to-r from-orange-500 to-red-600 bg-clip-text text-transparent">
                helpers
              </span>{" "}
              to find each other
            </h1>
            <p className="text-lg font-medium leading-relaxed text-slate-600 dark:text-slate-300">
              MamaLama isn’t a stiff listings site—it’s a place to meet real
              people nearby. Helpers and families each get a simple path in,
              honest profiles, a spot to see who’s connecting with you, chat
              that feels like texting a neighbor, and map-first discovery when
              you care about who’s close.
            </p>
            <p className="text-base leading-relaxed text-slate-500 dark:text-slate-400">
              We wanted something kinder: clear asks, warm responses, and
              ratings that only show up after you’ve actually spent time helping
              each other—so trust grows from real life, not buzzwords.
            </p>
          </div>

          {/* Photo: hands helping — community, not “transactions” */}
          <div className="relative mx-auto w-full max-w-sm lg:mx-0 lg:max-w-none">
            <div className="absolute -inset-3 -z-10 rounded-[2.25rem] bg-gradient-to-br from-orange-400/30 via-rose-400/20 to-amber-300/30 blur-xl dark:from-orange-600/20 dark:via-rose-900/20 dark:to-amber-900/20" />
            <figure className="group relative overflow-hidden rounded-[2rem] border-2 border-white/70 shadow-2xl ring-1 ring-orange-200/40 dark:border-white/10 dark:ring-orange-500/20">
              <div className="aspect-[4/5] w-full overflow-hidden sm:aspect-[3/4]">
                <img
                  src="/pexels-dmitry-rodionov-30660800.jpg"
                  alt="Warm, human moment of care and connection"
                  className="h-full w-full object-cover object-center transition-transform duration-700 group-hover:scale-[1.03]"
                  loading="eager"
                  decoding="async"
                />
              </div>
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent"
                aria-hidden
              />
              <figcaption className="absolute inset-x-0 bottom-0 p-5 pt-16 text-white">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-white/85">
                  What we’re about
                </p>
                <p className="mt-1 text-lg font-black leading-snug drop-shadow-md">
                  Hands helping hands—
                  <span className="text-orange-200">real care</span> in your
                  community
                </p>
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* Story strip */}
      <section className="relative px-1">
        <div className="absolute left-8 top-0 hidden h-full w-px bg-gradient-to-b from-orange-400/50 via-slate-300/40 to-transparent md:block dark:via-white/20" />
        <div className="space-y-8 md:pl-20">
          <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white md:text-3xl">
            Why we’re building this
          </h2>
          <div className="space-y-5 text-base leading-relaxed text-slate-600 dark:text-slate-300">
            <p>
              Needing a hand shouldn’t mean five open tabs and a stressed group
              chat. MamaLama keeps the story in one place: you put your ask out
              there, helpers respond, you sort invites and confirmations
              together, and you can always see what’s happening from your own
              little home in the app—without losing the thread.
            </p>
            <p>
              When you open{" "}
              <strong className="font-semibold text-slate-800 dark:text-slate-100">
                Find helpers
              </strong>
              , you’re not scrolling endless strangers—you’re pairing a map with
              real faces and signals that help you pick someone who can
              genuinely show up. Local, clear, and a bit more like asking around
              the neighborhood than filling out a form for “the market.”
            </p>
            <p>
              Stars and notes only appear after you’ve been through something
              together, alongside trust cues we surface when we can—so a
              helper’s reputation is built from actual kindness shown, not
              mystery reviews.
            </p>
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section>
        <div className="mb-10 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white md:text-3xl">
              What it feels like to use
            </h2>
            <p className="mt-2 max-w-xl text-slate-600 dark:text-slate-400">
              Plain-language bits of the app—no corporate deck required.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm font-bold text-orange-600 dark:text-orange-400">
            <Star className="h-4 w-4 fill-current" />
            Real life, messy schedules
          </div>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          {highlights.map(({ title, description, icon: Icon, accent, bg }) => (
            <article
              key={title}
              className="group relative overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white/70 p-6 shadow-md transition-all hover:-translate-y-0.5 hover:shadow-xl dark:border-white/10 dark:bg-slate-950/50"
            >
              <div
                className={cn(
                  "mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg",
                  accent,
                )}
              >
                <Icon className="h-7 w-7" strokeWidth={2} />
              </div>
              <div
                className={cn(
                  "absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-30 blur-2xl",
                  bg,
                )}
              />
              <h3 className="relative text-lg font-black text-slate-900 dark:text-white">
                {title}
              </h3>
              <p className="relative mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {description}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* Trust band */}
      <section className="relative overflow-hidden rounded-[2rem] border border-emerald-200/60 bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/80 p-8 md:p-10 dark:border-emerald-500/20 dark:from-emerald-950/40 dark:via-slate-950 dark:to-teal-950/30">
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex max-w-xl items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">
                Trust, without the cold stuff
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                We care about who people say they are, profiles you can actually
                read, and messages that keep everyone comfy before anyone
                commits time or money. We’re still growing—always nudging the
                experience from “nice to meet you” to “I’m glad you’re here.”
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 md:justify-end">
            {[
              "Families & helpers",
              "Chat that stays human",
              "Ratings from real helps",
            ].map((label) => (
              <span
                key={label}
                className="rounded-full border border-emerald-200/80 bg-white/80 px-4 py-2 text-xs font-bold text-emerald-900 shadow-sm dark:border-emerald-500/30 dark:bg-emerald-950/50 dark:text-emerald-100"
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
