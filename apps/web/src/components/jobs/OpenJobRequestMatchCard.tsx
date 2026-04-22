import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Clock, MapPin, MessageCircle, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { LiveTimer } from "@/components/LiveTimer";
import type { PublicProfileGalleryRow } from "@/components/helpers/HelperResultProfileCard";
import { publicProfileMediaPublicUrl } from "@/lib/publicProfileMedia";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/toast";
import { supabase } from "@/lib/supabase";
import { WhatsAppIcon, TelegramIcon } from "@/components/BrandIcons";

export type OpenJobRequestMatchRow = {
  id: string;
  client_id: string;
  service_type: string | null;
  location_city: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  start_at: string | null;
  created_at: string | null;
  shift_hours: string | null;
  time_duration: string | null;
  care_frequency?: string | null;
  /** job_requests.service_details (JSON) */
  service_details?: Record<string, unknown> | null;
  notes: string | null;
  requirements?: string[] | null;
  languages_pref?: string[] | null;
  budget_min: number | null;
  budget_max: number | null;
  client_display_name: string | null;
  client_photo_url: string | null;
  distance_km: number | null;
  /** UI-only flag set by the match page after confirming availability */
  __accepted?: boolean;
};

type Slide = { key: string; kind: "image" | "video"; src: string };

function buildSlides(photoUrl: string | null, gallery: PublicProfileGalleryRow[]): Slide[] {
  const slides: Slide[] = [];
  const trimmed = photoUrl?.trim();
  if (trimmed) slides.push({ key: "profile-photo", kind: "image", src: trimmed });
  const sorted = [...gallery].sort(
    (a, b) =>
      a.sort_order - b.sort_order ||
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  for (const row of sorted) {
    slides.push({
      key: row.id,
      kind: row.media_type === "video" ? "video" : "image",
      src: publicProfileMediaPublicUrl(row.storage_path),
    });
  }
  return slides;
}

/** Glass icon row overlaid on the hero image */
const heroOverlayRoundBtn = cn(
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
  "bg-black/35 text-white shadow-lg backdrop-blur-md ring-1 ring-white/20 transition-colors",
  "hover:bg-black/45 active:scale-[0.97]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50",
  "disabled:pointer-events-none disabled:opacity-55",
);

const panelDeclineBtn = cn(
  "inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-red-100 bg-red-50/95",
  "text-[14px] font-bold text-red-800 shadow-sm transition-colors",
  "hover:bg-red-100 active:scale-[0.99]",
  "dark:border-red-900/50 dark:bg-red-950/35 dark:text-red-100 dark:hover:bg-red-950/55",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/40 focus-visible:ring-offset-2",
  "disabled:pointer-events-none disabled:opacity-55",
);

const panelAcceptBtn = cn(
  "inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl",
  "bg-emerald-600 text-[14px] font-bold text-white shadow-sm transition-colors",
  "hover:bg-emerald-700 active:scale-[0.99]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2",
  "disabled:pointer-events-none disabled:opacity-55",
);

function getWhatsAppLink(number: string) {
  const cleaned = number.replace(/[^\d]/g, "");
  return `https://wa.me/${cleaned}`;
}

function getTelegramLink(username: string) {
  return `https://t.me/${username.replace(/^@/, "")}`;
}

function humanizeSnakeLabel(s: string): string {
  return s.trim().replace(/_/g, " ");
}

/** Flatten service_details JSON into short readable lines for the match card. */
function linesFromServiceDetails(raw: unknown): string[] {
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return [];
    try {
      return linesFromServiceDetails(JSON.parse(t) as unknown);
    } catch {
      return [];
    }
  }
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return [];
  const o = raw as Record<string, unknown>;
  const skipKeys = new Set([
    "from_lat",
    "from_lng",
    "to_lat",
    "to_lng",
    "pickup_lat",
    "pickup_lng",
    "dropoff_lat",
    "dropoff_lng",
  ]);
  const lines: string[] = [];
  for (const [k, v] of Object.entries(o)) {
    if (skipKeys.has(k)) continue;
    if (v == null || v === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    const label = humanizeSnakeLabel(k);
    if (typeof v === "string" || typeof v === "number") {
      lines.push(`${label}: ${humanizeSnakeLabel(String(v))}`);
    } else if (typeof v === "boolean") {
      lines.push(`${label}: ${v ? "Yes" : "No"}`);
    }
  }
  return lines.slice(0, 8);
}

export function OpenJobRequestMatchCard({
  row,
  gallery,
  formatTitle,
  onAccept,
  onDecline,
  onOpenProfile,
  variant = "grid",
}: {
  row: OpenJobRequestMatchRow;
  gallery: PublicProfileGalleryRow[];
  formatTitle: (serviceType: string | null | undefined) => string;
  onAccept: (jobId: string) => Promise<void> | void;
  onDecline: (jobId: string) => Promise<void> | void;
  onOpenProfile: (userId: string) => void;
  variant?: "grid" | "fullscreen";
}) {
  const { user: currentUser } = useAuth();
  const viewerId = currentUser?.id;
  const { addToast } = useToast();
  const [busy, setBusy] = useState<null | "accept" | "decline">(null);
  const [chatOpening, setChatOpening] = useState(false);
  const [socialBusy, setSocialBusy] = useState<"wa" | "tg" | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const slides = useMemo(
    () => buildSlides(row.client_photo_url, gallery),
    [row.client_photo_url, gallery],
  );
  const showStrip = slides.length > 1;
  const [activeIndex, setActiveIndex] = useState(0);

  const syncIndex = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const next = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
    setActiveIndex(Math.max(0, Math.min(slides.length - 1, next)));
  }, [slides.length]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: 0, behavior: "auto" });
    setActiveIndex(0);
  }, [row.id, row.client_photo_url, slides.map((s) => s.key).join("|")]);

  const accept = useCallback(async () => {
    if (busy) return;
    setBusy("accept");
    try {
      await onAccept(row.id);
    } finally {
      setBusy(null);
    }
  }, [busy, onAccept, row.id]);

  const decline = useCallback(async () => {
    if (busy) return;
    setBusy("decline");
    try {
      await onDecline(row.id);
    } finally {
      setBusy(null);
    }
  }, [busy, onDecline, row.id]);

  const dist =
    typeof row.distance_km === "number" && Number.isFinite(row.distance_km)
      ? `${row.distance_km.toFixed(1)} km`
      : null;

  const scheduleLine = useMemo(() => {
    const parts: string[] = [];
    if (row.start_at) {
      const d = new Date(row.start_at);
      if (!Number.isNaN(d.getTime())) {
        parts.push(
          d.toLocaleString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
        );
      }
    }
    const sh = (row.shift_hours || "").trim();
    if (sh) parts.push(sh);
    return parts.length ? parts.join(" · ") : null;
  }, [row.start_at, row.shift_hours]);

  const careFrequencyLine = useMemo(() => {
    const t = (row.care_frequency || "").trim();
    return t ? humanizeSnakeLabel(t) : null;
  }, [row.care_frequency]);

  const timeDurationLine = useMemo(() => {
    const t = (row.time_duration || "").trim();
    return t ? humanizeSnakeLabel(t) : null;
  }, [row.time_duration]);

  const serviceDetailLines = useMemo(
    () => linesFromServiceDetails(row.service_details ?? null),
    [row.service_details],
  );

  const serviceDetailsColumns = useMemo(() => {
    if (serviceDetailLines.length === 0) return { left: [] as string[], right: [] as string[] };
    const mid = Math.ceil(serviceDetailLines.length / 2);
    return {
      left: serviceDetailLines.slice(0, mid),
      right: serviceDetailLines.slice(mid),
    };
  }, [serviceDetailLines]);

  const budgetLine = useMemo(() => {
    if (row.budget_min != null && row.budget_max != null) {
      if (row.budget_min <= row.budget_max) return `₪${row.budget_min}–₪${row.budget_max}`;
    }
    if (row.budget_min != null) return `From ₪${row.budget_min}`;
    if (row.budget_max != null) return `Up to ₪${row.budget_max}`;
    return null;
  }, [row.budget_min, row.budget_max]);

  const notesLine = useMemo(() => {
    const t = (row.notes || "").trim();
    if (!t) return null;
    return t.length > 88 ? `${t.slice(0, 88).trim()}…` : t;
  }, [row.notes]);

  const accepted = row.__accepted === true;

  const openDirectChat = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!viewerId) {
        addToast({
          title: "Sign in required",
          description: "Log in to message clients.",
          variant: "default",
        });
        return;
      }
      if (!row.client_id) return;
      // Conversations are client↔freelancer. When a client can act as helper, we still use their user id as freelancer_id.
      const clientId = row.client_id;
      const freelancerId = viewerId;

      setChatOpening(true);
      try {
        const { data: existing, error: findErr } = await supabase
          .from("conversations")
          .select("id")
          .eq("client_id", clientId)
          .eq("freelancer_id", freelancerId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (findErr) throw findErr;

        if (existing?.id) {
          window.location.assign(`/messages?conversation=${existing.id}`);
          return;
        }

        const { data: created, error: insErr } = await supabase
          .from("conversations")
          .insert({
            job_id: null,
            client_id: clientId,
            freelancer_id: freelancerId,
          })
          .select("id")
          .single();
        if (insErr) throw insErr;

        window.location.assign(`/messages?conversation=${created.id}`);
      } catch (err: unknown) {
        console.error(err);
        const msg =
          err && typeof err === "object" && "message" in err
            ? String((err as { message: string }).message)
            : "Please try again.";
        addToast({
          title: "Could not open chat",
          description: msg,
          variant: "error",
        });
      } finally {
        setChatOpening(false);
      }
    },
    [addToast, row.client_id, viewerId],
  );

  const openWhatsApp = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!row.client_id) return;
      setSocialBusy("wa");
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("whatsapp_number_e164, share_whatsapp")
          .eq("id", row.client_id)
          .maybeSingle();
        if (error) throw error;
        if (!data?.share_whatsapp || !data?.whatsapp_number_e164) {
          addToast({
            title: "WhatsApp not shared",
            description: "This client has not enabled WhatsApp on their profile.",
            variant: "default",
          });
          return;
        }
        window.open(
          getWhatsAppLink(String(data.whatsapp_number_e164)),
          "_blank",
          "noopener,noreferrer",
        );
      } catch (err) {
        console.error(err);
        addToast({ title: "Could not open WhatsApp", variant: "error" });
      } finally {
        setSocialBusy(null);
      }
    },
    [addToast, row.client_id],
  );

  const openTelegram = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!row.client_id) return;
      setSocialBusy("tg");
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("telegram_username, share_telegram")
          .eq("id", row.client_id)
          .maybeSingle();
        if (error) throw error;
        const uname = String(data?.telegram_username ?? "").trim();
        if (!data?.share_telegram || !uname) {
          addToast({
            title: "Telegram not shared",
            description: "This client has not enabled Telegram on their profile.",
            variant: "default",
          });
          return;
        }
        window.open(getTelegramLink(uname), "_blank", "noopener,noreferrer");
      } catch (err) {
        console.error(err);
        addToast({ title: "Could not open Telegram", variant: "error" });
      } finally {
        setSocialBusy(null);
      }
    },
    [addToast, row.client_id],
  );

  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden",
        "bg-white shadow-2xl shadow-black/12 ring-1 ring-black/[0.06]",
        "transition-all duration-500 ease-out dark:bg-zinc-900 dark:ring-white/10",
        variant === "fullscreen"
          ? "h-full rounded-none shadow-none ring-0"
          : "rounded-[22px] hover:-translate-y-1 hover:shadow-xl",
      )}
      role="article"
      aria-label="Open request"
    >
      {/* Media only — tap opens client profile */}
      <div
        className={cn(
          "relative w-full shrink-0 cursor-pointer overflow-hidden bg-black",
          variant === "fullscreen"
            ? "min-h-[38vh] flex-1"
            : "aspect-[3/4] min-h-[16rem] max-h-[min(50vh,28rem)] sm:min-h-[18rem]",
        )}
        role="button"
        tabIndex={0}
        aria-label="View client profile"
        onClick={() => onOpenProfile(row.client_id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpenProfile(row.client_id);
          }
        }}
      >
        {slides.length === 0 ? (
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 via-zinc-900 to-black" />
        ) : showStrip ? (
          <div
            ref={scrollRef}
            onScroll={() => {
              window.requestAnimationFrame(syncIndex);
            }}
            className={cn(
              "absolute inset-0 z-0 flex h-full w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden",
              "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
              "overscroll-x-contain [-webkit-overflow-scrolling:touch]",
            )}
          >
            {slides.map((s) => (
              <div
                key={s.key}
                className="relative h-full w-full min-w-full max-w-full shrink-0 snap-start snap-always overflow-hidden"
              >
                {s.kind === "video" ? (
                  <div
                    className="relative h-full w-full overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <video
                      src={s.src}
                      className="absolute inset-0 h-full w-full bg-black object-cover object-center"
                      muted
                      playsInline
                      preload="metadata"
                      controls
                      controlsList="nodownload"
                    />
                  </div>
                ) : (
                  <img
                    src={s.src}
                    alt=""
                    className="pointer-events-none absolute inset-0 h-full w-full bg-black object-cover object-center select-none"
                    draggable={false}
                  />
                )}
              </div>
            ))}
          </div>
        ) : (
          <img
            src={slides[0]!.src}
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full bg-black object-cover object-center select-none"
            draggable={false}
          />
        )}

        {showStrip ? (
          <div className="pointer-events-none absolute top-3 left-1/2 z-[11] -translate-x-1/2">
            <div className="rounded-full bg-black/35 px-3 py-2 shadow-lg backdrop-blur-md ring-1 ring-white/15">
              <div className="flex items-center justify-center gap-1.5">
                {slides.map((_, idx) => (
                  <span
                    // eslint-disable-next-line react/no-array-index-key
                    key={idx}
                    className={cn(
                      "h-1.5 w-7 rounded-full",
                      idx === activeIndex
                        ? "bg-white shadow-[0_0_10px_rgba(255,255,255,0.35)]"
                        : "bg-white/35",
                    )}
                    aria-hidden
                  />
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {/* Category — top left */}
        <div className="pointer-events-none absolute left-0 top-0 z-[12] max-w-[min(100%,calc(100%-3.5rem))] pt-2.5 pl-2.5">
          <span className="inline-flex items-center rounded-full bg-emerald-50/95 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-900 ring-1 ring-emerald-200/90 shadow-sm backdrop-blur-sm dark:bg-emerald-950/80 dark:text-emerald-100 dark:ring-emerald-800/60">
            {formatTitle(row.service_type)}
          </span>
        </div>

        {/* Quick actions — vertical column on the right */}
        <div className="pointer-events-auto absolute right-2 top-1/2 z-[13] flex -translate-y-1/2 flex-col gap-2">
          {viewerId ? (
            <>
              <button
                type="button"
                className={heroOverlayRoundBtn}
                aria-label="Open chat"
                disabled={chatOpening}
                onClick={(e) => void openDirectChat(e)}
              >
                {chatOpening ? (
                  <Loader2 className="h-5 w-5 animate-spin text-white/90" aria-hidden />
                ) : (
                  <MessageCircle className="h-5 w-5 text-emerald-300" strokeWidth={2} aria-hidden />
                )}
              </button>
              <button
                type="button"
                className={heroOverlayRoundBtn}
                aria-label="Open WhatsApp"
                disabled={socialBusy === "wa"}
                onClick={(e) => void openWhatsApp(e)}
              >
                {socialBusy === "wa" ? (
                  <Loader2 className="h-5 w-5 animate-spin text-white/90" aria-hidden />
                ) : (
                  <WhatsAppIcon size={22} className="text-emerald-300" />
                )}
              </button>
              <button
                type="button"
                className={heroOverlayRoundBtn}
                aria-label="Open Telegram"
                disabled={socialBusy === "tg"}
                onClick={(e) => void openTelegram(e)}
              >
                {socialBusy === "tg" ? (
                  <Loader2 className="h-5 w-5 animate-spin text-white/90" aria-hidden />
                ) : (
                  <TelegramIcon size={22} className="text-sky-300" />
                )}
              </button>
            </>
          ) : null}
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[12] bg-gradient-to-t from-black/75 via-black/45 to-transparent px-3 pb-3 pt-12 flex justify-between items-end">
          <div className="drop-shadow-[0_1px_6px_rgba(0,0,0,0.75)] min-w-0 pr-2">
            <p className="truncate text-[17px] font-bold leading-tight tracking-tight text-white">
              {(row.client_display_name || "").trim() || "Member"}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <div className="flex min-w-0 items-center gap-1.5 text-[14px] font-semibold text-white">
                <MapPin className="h-4 w-4 shrink-0 text-emerald-300" strokeWidth={2.25} aria-hidden />
                <span className="truncate">{(row.location_city || "").trim() || "—"}</span>
              </div>
              {dist ? (
                <span className="text-[12px] font-bold tabular-nums text-white">{dist}</span>
              ) : null}
            </div>
          </div>
          {row.created_at ? (
            <div className="flex shrink-0 items-center gap-1 text-white/90 drop-shadow-[0_1px_6px_rgba(0,0,0,0.75)] mb-0.5">
              <Clock className="h-3.5 w-3.5 shrink-0 text-white/90" strokeWidth={2.5} aria-hidden />
              <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/90">
                Posted
              </span>
              <LiveTimer
                createdAt={row.created_at}
                render={({ time }) => (
                  <span className="text-[11px] font-semibold tabular-nums text-white">
                    {time}
                  </span>
                )}
              />
            </div>
          ) : null}
        </div>
      </div>

      {/* Details + actions */}
      <div
        className={cn(
          "relative z-[6] flex min-h-0 flex-1 flex-col border-t border-slate-200/90 bg-white px-4 pb-4 pt-3",
          "dark:border-zinc-700 dark:bg-zinc-50",
          variant === "fullscreen" && "max-h-[min(52vh,24rem)] overflow-y-auto",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {careFrequencyLine || timeDurationLine || serviceDetailLines.length > 0 ? (
          <div className="mt-1 space-y-3">
            {careFrequencyLine || timeDurationLine ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-600 dark:text-emerald-500">
                    Frequency
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-[15px] font-semibold leading-snug text-slate-900 dark:text-zinc-900">
                    {careFrequencyLine ?? "—"}
                  </p>
                </div>
                <div className="min-w-0 border-l border-slate-200/70 pl-4 dark:border-zinc-300">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-600 dark:text-emerald-500">
                    Duration
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-[15px] font-semibold leading-snug text-slate-900 dark:text-zinc-900">
                    {timeDurationLine ?? "—"}
                  </p>
                </div>
              </div>
            ) : null}

            {serviceDetailLines.length > 0 ? (
              <div
                className={cn(
                  "text-[14px] leading-snug text-slate-800 dark:text-zinc-800",
                  careFrequencyLine || timeDurationLine ? "border-t border-slate-200/80 pt-3 dark:border-zinc-300" : "",
                )}
              >
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-600 dark:text-emerald-500">
                  Details
                </p>
                <div className="mt-1.5 grid max-h-[6rem] grid-cols-2 gap-x-3 gap-y-1 overflow-hidden">
                  <ul className="min-w-0 list-none space-y-1.5 pl-0">
                    {serviceDetailsColumns.left.map((line, idx) => (
                      <li
                        key={`dl-${idx}-${line.slice(0, 40)}`}
                        className="flex gap-1.5 text-[14px] font-medium leading-snug text-slate-700 dark:text-zinc-700"
                      >
                        <span
                          className="mt-[0.4rem] h-1 w-1 shrink-0 rounded-full bg-emerald-500"
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1 line-clamp-3">{line}</span>
                      </li>
                    ))}
                  </ul>
                  <ul className="min-w-0 list-none space-y-1.5 border-l border-slate-200/70 pl-3 dark:border-zinc-300">
                    {serviceDetailsColumns.right.map((line, idx) => (
                      <li
                        key={`dr-${idx}-${line.slice(0, 40)}`}
                        className="flex gap-1.5 text-[14px] font-medium leading-snug text-slate-700 dark:text-zinc-700"
                      >
                        <span
                          className="mt-[0.4rem] h-1 w-1 shrink-0 rounded-full bg-emerald-500"
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1 line-clamp-3">{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {scheduleLine ? (
          <p className="mt-2.5 text-[15px] font-semibold text-slate-800 dark:text-zinc-800">
            {scheduleLine}
          </p>
        ) : null}

        {budgetLine ? (
          <p className="mt-1 text-[15px] font-semibold text-slate-700 dark:text-zinc-700">
            {budgetLine}
          </p>
        ) : null}

        {notesLine ? (
          <p className="mt-2 text-[15px] leading-snug text-slate-600 dark:text-zinc-600">
            {notesLine}
          </p>
        ) : null}

        {accepted ? (
          <div className="mt-auto pt-4 rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            Accepted · waiting
          </div>
        ) : (
          <div className="mt-auto grid grid-cols-2 gap-3 pt-4">
            <button
              type="button"
              className={panelDeclineBtn}
              onClick={(e) => {
                e.stopPropagation();
                void decline();
              }}
              disabled={busy != null}
            >
              <X className="h-4 w-4" aria-hidden />
              Decline
            </button>
            <button
              type="button"
              className={panelAcceptBtn}
              onClick={(e) => {
                e.stopPropagation();
                void accept();
              }}
              disabled={busy != null}
            >
              <Check className="h-4 w-4" aria-hidden />
              Accept
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

