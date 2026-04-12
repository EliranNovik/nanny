import { Briefcase, HeartHandshake } from "lucide-react";
import { cn } from "@/lib/utils";
import type { JobsPerspective } from "./jobsPerspective";

export function JobsRolePicker({
  onSelect,
  className,
}: {
  onSelect: (mode: JobsPerspective) => void;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-lg px-4 py-2", className)}>
      <div className="rounded-[2rem] border border-slate-200/80 bg-card/90 p-6 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.12)] backdrop-blur-sm dark:border-white/10 dark:bg-card/80 dark:shadow-black/40 md:p-8">
        <p className="text-center text-[11px] font-bold uppercase tracking-[0.2em] text-orange-600/90 dark:text-orange-400/90">
          Jobs
        </p>
        <h2 className="mt-2 text-center text-[22px] font-black tracking-tight text-slate-900 dark:text-white md:text-[26px]">
          How are you using Jobs?
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-center text-sm font-medium leading-relaxed text-muted-foreground">
          Pick whether you&apos;re helping others as a helper or managing work you&apos;ve posted as a
          client. You can switch any time.
        </p>

        <div className="mt-8 flex flex-col gap-4">
          <button
            type="button"
            onClick={() => onSelect("freelancer")}
            className={cn(
              "group flex w-full items-start gap-4 rounded-2xl border border-orange-200/70 bg-gradient-to-br from-orange-50/95 via-white to-white p-5 text-left shadow-sm transition-all",
              "hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-md",
              "dark:border-orange-900/50 dark:from-orange-950/40 dark:via-zinc-950/80 dark:to-zinc-950 dark:hover:border-orange-700/60"
            )}
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-500 text-white shadow-md shadow-orange-500/25 dark:bg-orange-600">
              <HeartHandshake className="h-6 w-6" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-black text-slate-900 dark:text-white">Helping others</span>
              <span className="mt-1 block text-sm font-medium leading-snug text-muted-foreground">
                Community requests, pending responses, Helping now, and your history of help as a helper.
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => onSelect("client")}
            className={cn(
              "group flex w-full items-start gap-4 rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-50/95 via-white to-white p-5 text-left shadow-sm transition-all",
              "hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md",
              "dark:border-white/10 dark:from-zinc-900/80 dark:via-zinc-950 dark:to-zinc-950 dark:hover:border-white/20"
            )}
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-800 text-white shadow-md dark:bg-slate-700">
              <Briefcase className="h-6 w-6" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-black text-slate-900 dark:text-white">My Helpers</span>
              <span className="mt-1 block text-sm font-medium leading-snug text-muted-foreground">
                Your posted requests, Helping me now, and your history of help.
              </span>
            </span>
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Same account can do both — this only changes what you see first.
        </p>
      </div>
    </div>
  );
}
