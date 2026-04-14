import { cn } from "@/lib/utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ChevronDown, ChevronRight, ChevronUp, Loader2, Plus, Radio, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { isServiceCategoryId, serviceCategoryLabel } from "@/lib/serviceCategories";
import { useNavigate } from "react-router-dom";

type LiveMatch = {
  jobId: string;
  helperId: string;
  clientId: string;
  helper: string;
  client: string;
  helperPhoto: string;
  clientPhoto: string;
  workType: string;
  when: string;
};

function timeAgoShort(iso: string): string {
  const d = new Date(iso);
  const t = d.getTime();
  if (Number.isNaN(t)) return "";
  const sec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (sec < 45) return "Just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}

function serviceLabel(serviceType: string | null | undefined): string {
  const st = String(serviceType ?? "").trim();
  if (!st) return "Help request";
  return isServiceCategoryId(st) ? serviceCategoryLabel(st) : st.replace(/_/g, " ");
}

type JobPreview = Record<string, unknown> & { id?: string };

function asString(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

function fmtDateShort(iso: unknown): string {
  const s = asString(iso);
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString();
}

export function DiscoverHomeLiveTrackerBoard() {
  const navigate = useNavigate();
  const [isAllMatchesOpen, setIsAllMatchesOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState<LiveMatch[]>([]);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [jobDetailsById, setJobDetailsById] = useState<Record<string, JobPreview | null>>({});
  const [jobDetailsLoadingById, setJobDetailsLoadingById] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const { data, error } = await supabase
        .from("job_requests")
        .select(
          `
            id,
            created_at,
            service_type,
            client:profiles!client_id (
              full_name,
              photo_url
            ),
            helper:profiles!selected_freelancer_id (
              full_name,
              photo_url
            )
          `
        )
        .not("selected_freelancer_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(6);

      if (cancelled) return;
      if (error) {
        console.warn("[DiscoverHomeLiveTrackerBoard] latest matches:", error);
        setMatches([]);
        setLoading(false);
        return;
      }

      const rows = (data ?? []) as any[];
      const next: LiveMatch[] = rows.map((r) => {
        const helperName = String(r?.helper?.full_name ?? "Helper").trim() || "Helper";
        const clientName = String(r?.client?.full_name ?? "Client").trim() || "Client";
        return {
          jobId: String(r?.id ?? ""),
          helperId: String(r?.helper?.id ?? ""),
          clientId: String(r?.client?.id ?? ""),
          helper: helperName,
          client: clientName,
          helperPhoto: String(r?.helper?.photo_url ?? ""),
          clientPhoto: String(r?.client?.photo_url ?? ""),
          workType: serviceLabel(r?.service_type),
          when: timeAgoShort(String(r?.created_at ?? "")),
        };
      });

      setMatches(next);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const hasMatches = matches.length > 0;
  const previewMatches = useMemo(() => matches, [matches]);

  async function ensureJobDetails(jobId: string) {
    if (!jobId) return;
    if (jobDetailsById[jobId] !== undefined) return;
    setJobDetailsLoadingById((prev) => ({ ...prev, [jobId]: true }));
    try {
      const { data, error } = await supabase.rpc("get_public_job_request_preview", {
        p_job_id: jobId,
      });
      if (error) throw error;
      const job = (data ?? null) as JobPreview | null;
      setJobDetailsById((prev) => ({ ...prev, [jobId]: job }));
    } catch (e) {
      console.warn("[DiscoverHomeLiveTrackerBoard] get_public_job_request_preview:", e);
      setJobDetailsById((prev) => ({ ...prev, [jobId]: null }));
    } finally {
      setJobDetailsLoadingById((prev) => ({ ...prev, [jobId]: false }));
    }
  }

  return (
    <section className="w-full" aria-label="Latest matches preview">
      <div className="flex items-center justify-between gap-3 pb-4 pt-1">
        <button
          type="button"
          onClick={() => setIsAllMatchesOpen(true)}
          className="group flex min-w-0 flex-1 items-center justify-between gap-3 rounded-2xl px-1.5 py-1 text-left transition-colors hover:bg-orange-500/5 active:bg-orange-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label="Open all latest matches"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400">
              <Radio className="h-6 w-6 motion-safe:animate-pulse" strokeWidth={2.25} aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-black tracking-tight text-stone-900 sm:text-xl dark:text-white">Latest matches</h2>
              <p className="text-sm font-medium text-orange-800 dark:text-orange-200/95">Live</p>
            </div>
          </div>
        </button>
      </div>

      <div
        className={cn(
          "flex gap-4 overflow-hidden pb-1",
          "sm:overflow-x-auto sm:overscroll-x-contain sm:[-webkit-overflow-scrolling:touch]",
          "sm:[scrollbar-width:none] sm:[&::-webkit-scrollbar]:hidden",
          "sm:snap-x sm:snap-mandatory sm:touch-pan-x"
        )}
      >
        {!hasMatches && !loading ? (
          <div className="w-full rounded-2xl bg-background/70 px-4 py-5 text-center text-sm font-semibold text-muted-foreground dark:bg-background/50">
            No recent matches yet.
          </div>
        ) : null}

        {previewMatches.map((row, idx) => (
          <button
            key={`${row.helper}-${idx}`}
            type="button"
            onClick={() => setIsAllMatchesOpen(true)}
            className={cn(
              idx > 0 && "hidden sm:block",
              idx > 2 && "md:hidden",
              "w-full sm:w-[min(92vw,21rem)] sm:shrink-0 sm:snap-start",
              "rounded-2xl bg-background/80 px-4 py-4 text-left",
              "shadow-sm backdrop-blur-[2px] dark:bg-background/60",
              "transition-transform active:scale-[0.99]"
            )}
            aria-label="Open all latest matches"
          >
            <div className="flex items-center gap-3">
              <div className="relative flex shrink-0 -space-x-2.5">
                <img
                  src={row.helperPhoto}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="relative z-[2] h-14 w-14 rounded-full border-[3px] border-background object-cover ring-2 ring-orange-400/45 dark:ring-orange-400/50"
                />
                <img
                  src={row.clientPhoto}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="relative z-[1] h-14 w-14 rounded-full border-[3px] border-background object-cover ring-2 ring-teal-400/50 dark:ring-teal-400/45"
                />
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="truncate text-base font-bold leading-snug text-stone-900 dark:text-white">
                  <span className="text-orange-600 dark:text-orange-400">{row.helper}</span>
                  <span className="font-normal text-orange-800/85 dark:text-orange-200/85"> & </span>
                  <span>{row.client}</span>
                </p>
                <p className="mt-1 truncate text-sm font-semibold text-teal-800 dark:text-teal-300">{row.workType}</p>
                <p className="mt-1 text-xs font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{row.when}</p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
            </div>
          </button>
        ))}

        {/* Desktop: trailing “see more” tile after the 3rd card */}
        {hasMatches ? (
          <button
            type="button"
            onClick={() => setIsAllMatchesOpen(true)}
            className={cn(
              "hidden md:flex",
              "w-[min(92vw,21rem)] shrink-0 items-center justify-center",
              "rounded-2xl border border-dashed border-orange-400/35 bg-background/70 px-4 py-4",
              "text-orange-700 shadow-sm backdrop-blur-[2px] transition-colors hover:bg-orange-500/10 active:scale-[0.99]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              "dark:border-orange-400/30 dark:text-orange-200"
            )}
            aria-label="See more matches"
          >
            <Plus className="h-7 w-7" aria-hidden />
          </button>
        ) : null}
      </div>

      <Dialog open={isAllMatchesOpen} onOpenChange={setIsAllMatchesOpen}>
        <DialogContent className="max-w-[100vw] w-full h-[100dvh] p-0 border-none bg-background gap-0 overflow-hidden flex flex-col sm:rounded-none">
          <div className="relative flex h-full w-full flex-col">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-black/5 bg-background/90 px-5 py-4 backdrop-blur-md dark:border-white/5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-600/90 dark:text-orange-400/90">
                    Live
                  </p>
                  <span className="text-xs font-bold text-muted-foreground">· Latest hour</span>
                </div>
                <h3 className="truncate text-lg font-black tracking-tight text-stone-900 dark:text-white">
                  Latest matches
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAllMatchesOpen(false)}
                className="group rounded-full border border-black/5 bg-card/90 p-3 shadow-2xl backdrop-blur-sm transition-all hover:bg-card active:scale-[0.98] dark:border-white/5 dark:bg-zinc-800/90 dark:hover:bg-zinc-800"
                aria-label="Close"
              >
                <X className="h-5 w-5 text-slate-900 transition-transform group-hover:scale-110 dark:text-white" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-8 pt-5">
              <div className="flex flex-col gap-4">
                {previewMatches.map((row, idx) => (
                  <div
                    key={`all-${row.jobId || row.helper}-${idx}`}
                    className={cn(
                      "w-full rounded-2xl border border-border/60 bg-background/80",
                      "shadow-sm backdrop-blur-[2px] dark:border-border/50 dark:bg-background/60"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        const next = expandedJobId === row.jobId ? null : row.jobId;
                        setExpandedJobId(next);
                        if (next) void ensureJobDetails(next);
                      }}
                      className="flex w-full items-start gap-3 px-4 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-2xl"
                      aria-expanded={expandedJobId === row.jobId}
                      aria-label="Toggle match details"
                    >
                      <div className="relative flex shrink-0 -space-x-2.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (!row.helperId) return;
                            setIsAllMatchesOpen(false);
                            navigate(`/profile/${encodeURIComponent(row.helperId)}`);
                          }}
                          disabled={!row.helperId}
                          className={cn(
                            "relative z-[2] rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                            !row.helperId && "pointer-events-none"
                          )}
                          aria-label={row.helperId ? `Open ${row.helper} profile` : "Helper profile unavailable"}
                        >
                          <img
                            src={row.helperPhoto}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="h-16 w-16 rounded-full border-[3px] border-background object-cover ring-2 ring-orange-400/45 dark:ring-orange-400/50"
                          />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (!row.clientId) return;
                            setIsAllMatchesOpen(false);
                            navigate(`/profile/${encodeURIComponent(row.clientId)}`);
                          }}
                          disabled={!row.clientId}
                          className={cn(
                            "relative z-[1] rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                            !row.clientId && "pointer-events-none"
                          )}
                          aria-label={row.clientId ? `Open ${row.client} profile` : "Client profile unavailable"}
                        >
                          <img
                            src={row.clientPhoto}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="h-16 w-16 rounded-full border-[3px] border-background object-cover ring-2 ring-teal-400/50 dark:ring-teal-400/45"
                          />
                        </button>
                      </div>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <p className="truncate text-base font-bold leading-snug text-stone-900 dark:text-white">
                          <span className="text-orange-600 dark:text-orange-400">{row.helper}</span>
                          <span className="font-normal text-orange-800/85 dark:text-orange-200/85"> & </span>
                          <span>{row.client}</span>
                        </p>
                        <p className="mt-1.5 truncate text-sm font-semibold text-teal-800 dark:text-teal-300">{row.workType}</p>
                        <p className="mt-2 text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{row.when}</p>
                      </div>
                      <span className="mt-1 shrink-0 text-muted-foreground">
                        {expandedJobId === row.jobId ? (
                          <ChevronUp className="h-5 w-5" aria-hidden />
                        ) : (
                          <ChevronDown className="h-5 w-5" aria-hidden />
                        )}
                      </span>
                    </button>

                    {expandedJobId === row.jobId ? (
                      <div className="border-t border-black/5 px-4 pb-4 pt-4 dark:border-white/5">
                        {jobDetailsLoadingById[row.jobId] ? (
                          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                            Loading details…
                          </div>
                        ) : (
                          (() => {
                            const job = jobDetailsById[row.jobId] ?? null;
                            if (!job) {
                              return (
                                <p className="text-sm font-semibold text-muted-foreground">
                                  Couldn’t load full job details.
                                </p>
                              );
                            }

                            const serviceType = asString(job.service_type) || asString(job.care_type) || "";
                            const city = asString(job.location_city) || asString(job.city) || "";
                            const status = asString(job.status) || "";
                            const createdAt = fmtDateShort(job.created_at);
                            const budgetMin = asString(job.budget_min);
                            const budgetMax = asString(job.budget_max);
                            const notes =
                              asString((job as any)?.service_details?.custom) ||
                              asString((job as any)?.service_details?.notes) ||
                              asString(job.requirements_note) ||
                              "";

                            const imagesRaw = (job as any)?.service_details?.images;
                            const images: string[] = Array.isArray(imagesRaw)
                              ? imagesRaw.filter((u: unknown) => typeof u === "string" && u.trim()).map((u: string) => u.trim())
                              : [];

                            return (
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="rounded-2xl bg-slate-50 p-3 dark:bg-zinc-900/40">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Service</p>
                                    <p className="mt-1 text-sm font-bold text-foreground">
                                      {serviceLabel(serviceType || row.workType)}
                                    </p>
                                  </div>
                                  <div className="rounded-2xl bg-slate-50 p-3 dark:bg-zinc-900/40">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">City</p>
                                    <p className="mt-1 text-sm font-bold text-foreground">{city || "—"}</p>
                                  </div>
                                  <div className="rounded-2xl bg-slate-50 p-3 dark:bg-zinc-900/40">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Created</p>
                                    <p className="mt-1 text-sm font-bold text-foreground">{createdAt || "—"}</p>
                                  </div>
                                  <div className="rounded-2xl bg-slate-50 p-3 dark:bg-zinc-900/40">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status</p>
                                    <p className="mt-1 text-sm font-bold text-foreground">{status || "—"}</p>
                                  </div>
                                  <div className="col-span-2 rounded-2xl bg-slate-50 p-3 dark:bg-zinc-900/40">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Budget</p>
                                    <p className="mt-1 text-sm font-bold text-foreground">
                                      {budgetMin || budgetMax ? `${budgetMin || "?"} – ${budgetMax || "?"}` : "—"}
                                    </p>
                                  </div>
                                </div>

                                {notes ? (
                                  <div className="rounded-2xl bg-slate-50 p-4 dark:bg-zinc-900/40">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Notes</p>
                                    <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-relaxed text-slate-700 dark:text-slate-200">
                                      {notes}
                                    </p>
                                  </div>
                                ) : null}

                                {images.length > 0 ? (
                                  <div className="space-y-2">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Images</p>
                                    <div className="grid grid-cols-2 gap-2">
                                      {images.map((u) => (
                                        <img
                                          key={u}
                                          src={u}
                                          alt=""
                                          loading="lazy"
                                          decoding="async"
                                          className="aspect-video w-full rounded-2xl border border-black/5 object-cover shadow-sm dark:border-white/5"
                                        />
                                      ))}
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            );
                          })()
                        )}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
