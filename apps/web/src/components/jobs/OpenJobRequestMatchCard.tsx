import { useCallback, useMemo, useRef, useState } from "react";
import { Check, ChevronRight, Clock, MapPin, MessageCircle, Loader2, X } from "lucide-react";
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

const glassCta = cn(
  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-[18px]",
  "bg-black/30 text-white shadow-lg backdrop-blur-2xl transition-colors",
  "hover:bg-black/40 active:scale-[0.98]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
  "disabled:pointer-events-none disabled:opacity-55",
);

const glassDeclineCta = cn(
  glassCta,
  "bg-red-500/15 text-white hover:bg-red-500/20",
);

const glassRoundBtn = cn(
  "flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
  "bg-black/30 text-white shadow-lg backdrop-blur-2xl transition-colors",
  "hover:bg-black/40",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400",
  "disabled:pointer-events-none disabled:opacity-55",
);

function getWhatsAppLink(number: string) {
  const cleaned = number.replace(/[^\d]/g, "");
  return `https://wa.me/${cleaned}`;
}

function getTelegramLink(username: string) {
  return `https://t.me/${username.replace(/^@/, "")}`;
}

export function OpenJobRequestMatchCard({
  row,
  gallery,
  formatTitle,
  onAccept,
  onDecline,
  onOpenProfile,
}: {
  row: OpenJobRequestMatchRow;
  gallery: PublicProfileGalleryRow[];
  formatTitle: (serviceType: string | null | undefined) => string;
  onAccept: (jobId: string) => Promise<void> | void;
  onDecline: (jobId: string) => Promise<void> | void;
  onOpenProfile: (userId: string) => void;
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
    const td = (row.time_duration || "").trim();
    if (sh) parts.push(sh);
    if (td) parts.push(td);
    return parts.length ? parts.join(" · ") : null;
  }, [row.start_at, row.shift_hours, row.time_duration]);

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
        "group relative cursor-pointer overflow-hidden rounded-[22px]",
        "bg-zinc-950 shadow-2xl shadow-black/40",
        "transition-all duration-500 ease-out",
        "hover:-translate-y-1 hover:shadow-emerald-500/15 hover:shadow-2xl",
      )}
      role="article"
      aria-label="Open request"
      onClick={() => onOpenProfile(row.client_id)}
    >
      <div className="relative aspect-[4/5] min-h-[17.5rem] w-full bg-black sm:min-h-[19rem]">
        {slides.length === 0 ? (
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 via-zinc-900 to-black" />
        ) : showStrip ? (
          <div
            ref={scrollRef}
            onScroll={() => window.requestAnimationFrame(syncIndex)}
            className={cn(
              "absolute inset-0 z-0 flex h-full w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden",
              "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
            )}
          >
            {slides.map((s) => (
              <div key={s.key} className="relative h-full min-w-full shrink-0 snap-start">
                {s.kind === "video" ? (
                  <video
                    src={s.src}
                    className="h-full w-full object-cover object-[50%_30%]"
                    muted
                    playsInline
                    preload="metadata"
                    controls
                    controlsList="nodownload"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                  />
                ) : (
                  <img
                    src={s.src}
                    alt=""
                    className="h-full w-full object-cover object-[50%_30%]"
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
            className="absolute inset-0 h-full w-full object-cover object-[50%_30%]"
            draggable={false}
          />
        )}

        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[48%] bg-gradient-to-t from-black via-black/75 to-transparent"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[38%] bg-gradient-to-tr from-emerald-500/12 to-transparent opacity-90 mix-blend-soft-light"
          aria-hidden
        />

        <div className="absolute left-3 top-3 z-[10]">
          <span className="rounded-full bg-black/25 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white shadow-lg backdrop-blur-xl ring-1 ring-inset ring-white/15">
            {formatTitle(row.service_type)}
          </span>
        </div>

        <div className="absolute right-3 top-3 z-[10] flex items-center gap-2">
          {dist ? (
            <span className="rounded-full bg-black/25 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white shadow-lg backdrop-blur-xl ring-1 ring-inset ring-white/15">
              {dist}
            </span>
          ) : null}
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/25 text-white shadow-lg backdrop-blur-xl ring-1 ring-inset ring-white/15">
            <ChevronRight className="h-5 w-5" strokeWidth={2.25} aria-hidden />
          </span>
        </div>

        {viewerId ? (
          <div
            className="absolute right-2.5 top-14 z-[16] flex flex-col items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className={glassRoundBtn}
              aria-label="Open chat"
              disabled={chatOpening}
              onClick={(e) => void openDirectChat(e)}
            >
              {chatOpening ? (
                <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
              ) : (
                <MessageCircle className="h-6 w-6" strokeWidth={2} aria-hidden />
              )}
            </button>

            <button
              type="button"
              className={glassRoundBtn}
              aria-label="Open WhatsApp"
              disabled={socialBusy === "wa"}
              onClick={(e) => void openWhatsApp(e)}
            >
              {socialBusy === "wa" ? (
                <Loader2 className="h-6 w-6 animate-spin text-white" aria-hidden />
              ) : (
                <WhatsAppIcon size={24} className="text-white" />
              )}
            </button>

            <button
              type="button"
              className={glassRoundBtn}
              aria-label="Open Telegram"
              disabled={socialBusy === "tg"}
              onClick={(e) => void openTelegram(e)}
            >
              {socialBusy === "tg" ? (
                <Loader2 className="h-6 w-6 animate-spin text-white" aria-hidden />
              ) : (
                <TelegramIcon size={24} className="text-white" />
              )}
            </button>
          </div>
        ) : null}

        {showStrip ? (
          <div className="pointer-events-none absolute left-1/2 top-3 z-[11] -translate-x-1/2">
            <div className="rounded-full bg-black/15 px-3 py-2 shadow-lg backdrop-blur-xl">
              <div className="flex items-center justify-center gap-1.5">
                {slides.map((_, idx) => (
                  <span
                    // eslint-disable-next-line react/no-array-index-key
                    key={idx}
                    className={cn(
                      "h-1.5 w-7 rounded-full",
                      idx === activeIndex
                        ? "bg-white/85 shadow-[0_0_10px_rgba(255,255,255,0.25)]"
                        : "bg-white/20",
                    )}
                    aria-hidden
                  />
                ))}
              </div>
            </div>
          </div>
        ) : null}

        <div className="absolute inset-x-0 bottom-0 z-[6] p-4">
          <p className="truncate text-[16px] font-black leading-tight tracking-tight text-white">
            {(row.client_display_name || "").trim() || "Member"}
          </p>

          <div className="mt-1 flex items-center gap-2 text-white/85">
            <MapPin className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
            <span className="truncate text-[12px] font-semibold">
              {(row.location_city || "").trim() || "—"}
            </span>
          </div>

          {scheduleLine ? (
            <p className="mt-2 text-[12px] font-semibold text-white/85">
              {scheduleLine}
            </p>
          ) : null}

          {budgetLine ? (
            <p className="mt-1 text-[12px] font-semibold text-white/80">
              {budgetLine}
            </p>
          ) : null}

          {notesLine ? (
            <p className="mt-2 text-[12px] leading-snug text-white/80">
              {notesLine}
            </p>
          ) : null}

          {row.created_at ? (
            <div className="mt-2 flex items-center gap-2 text-white/85">
              <Clock className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
              <span className="text-[12px] font-semibold uppercase tracking-[0.12em] text-white/70">
                Posted
              </span>
              <LiveTimer
                createdAt={row.created_at}
                render={({ time }) => (
                  <span className="text-[12px] font-semibold tabular-nums text-white/85">
                    {time}
                  </span>
                )}
              />
            </div>
          ) : null}

          {accepted ? (
            <div className="mt-4 rounded-[18px] bg-black/25 px-4 py-3 text-center text-[12px] font-bold uppercase tracking-[0.18em] text-white/80 shadow-lg backdrop-blur-xl ring-1 ring-inset ring-white/15">
              Accepted · waiting
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                className={glassDeclineCta}
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
                className={cn(glassCta, "bg-emerald-600/85 hover:bg-emerald-600")}
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
    </div>
  );
}

