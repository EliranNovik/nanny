import { useEffect, useId, useMemo, useState } from "react";
import {
  Banknote,
  ChevronDown,
  Clock3,
  HeartHandshake,
  HelpingHand,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { avatarUrl } from "@/lib/imageTransform";

export type PublicAvailabilityDay = {
  day: string;
  on: boolean;
  start: string;
  end: string;
};

export type PublicAvailability = {
  timezone?: string;
  weeklySchedule?: PublicAvailabilityDay[];
  flexible?: boolean;
  minimumNoticeHours?: number;
};

export type PublicRate = {
  hourly_rate_min: number | null;
  hourly_rate_max: number | null;
  show_rates: boolean | null;
};

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function useDarkMode() {
  const [dark, setDark] = useState(() =>
    typeof document !== "undefined"
      ? document.documentElement.classList.contains("dark")
      : false,
  );
  useEffect(() => {
    const observer = new MutationObserver(() =>
      setDark(document.documentElement.classList.contains("dark")),
    );
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);
  return dark;
}

export function AnimatedProfileRing({
  photoUrl,
  name,
  helper,
  className,
}: {
  photoUrl: string | null;
  name: string;
  helper: boolean;
  className?: string;
}) {
  const gradientId = useId().replace(/:/g, "");
  const dark = useDarkMode();
  const [frame, setFrame] = useState({ progress: 0, ripple: 0, rotation: -90 });

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setFrame({ progress: 1, ripple: 1, rotation: -90 });
      return;
    }
    const startedAt = performance.now() + 120;
    let raf = 0;
    const tick = (now: number) => {
      const intro = Math.max(0, Math.min(1, (now - startedAt) / 2600));
      const eased = intro < 0.5
        ? 2 * intro * intro
        : 1 - Math.pow(-2 * intro + 2, 2) / 2;
      const ripple = Math.max(0, Math.min(1, (now - startedAt - 2600) / 1000));
      const slowRotation =
        ripple >= 1 ? ((now - startedAt - 3600) / 18000) * 360 : 0;
      setFrame({
        progress: eased,
        ripple,
        rotation: -90 + 360 * eased + slowRotation,
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const path = useMemo(() => {
    const count = 224;
    const sweep = 0.3 + 0.7 * frame.progress * frame.progress;
    const visible = Math.max(2, Math.floor(count * sweep));
    const q = frame.ripple > 0 && frame.ripple < 1 ? frame.ripple : 0;
    const amp = q ? 10 * Math.sin(Math.PI * q) : 0;
    const phase = 6 * Math.PI * q;
    const center = 72.5;
    const points: string[] = [];
    for (let i = 0; i < visible; i += 1) {
      const theta = (i / (count - 1)) * Math.PI * 2;
      const wave =
        amp *
        (0.55 + 0.45 * Math.sin(3 * theta - 0.6 * phase)) *
        (0.5 + 0.5 * Math.sin(28 * theta + phase));
      const radius = 58 + Math.max(0, wave);
      const angle = theta + (frame.rotation * Math.PI) / 180;
      points.push(
        `${i === 0 ? "M" : "L"} ${(center + radius * Math.cos(angle)).toFixed(2)} ${(center + radius * Math.sin(angle)).toFixed(2)}`,
      );
    }
    if (sweep >= 0.999) points.push("Z");
    return points.join(" ");
  }, [frame]);

  const colors = helper
    ? dark
      ? ["#34D399", "#10B981", "#059669", "#047857", "#065F46"]
      : ["#6EE7B7", "#34D399", "#10B981", "#059669", "#047857"]
    : dark
      ? ["#FB923C", "#F97316", "#EA580C", "#C2410C", "#9A3412"]
      : ["#FDBA74", "#FB923C", "#F97316", "#EA580C", "#C2410C"];

  return (
    <div className={cn("relative h-[119px] w-[119px] shrink-0", className)}>
      <svg
        viewBox="0 0 145 145"
        className="pointer-events-none absolute -inset-[13px] h-[145px] w-[145px] overflow-visible"
        aria-hidden
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            {colors.map((color, index) => (
              <stop
                key={color}
                offset={`${index * 25}%`}
                stopColor={color}
              />
            ))}
          </linearGradient>
        </defs>
        <path
          d={path}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={3 * (0.7 + 0.3 * frame.progress)}
          opacity={Math.min(1, 6 * frame.progress)}
        />
      </svg>
      <div className="absolute left-[7.5px] top-[7.5px] h-[104px] w-[104px] overflow-hidden rounded-full bg-muted">
        {photoUrl ? (
          <img
            src={avatarUrl.md(photoUrl)}
            alt={name}
            className="h-full w-full object-cover"
            decoding="async"
            fetchPriority="high"
          />
        ) : (
          <span className="flex h-full items-center justify-center text-3xl font-black text-primary/40">
            {name.charAt(0).toUpperCase()}
          </span>
        )}
      </div>
    </div>
  );
}

export function MemberSinceBadge({
  createdAt,
  helper,
}: {
  createdAt: string | null;
  helper: boolean;
}) {
  const { t, i18n } = useTranslation();
  if (!createdAt) return null;
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return null;
  const formatted = new Intl.DateTimeFormat(i18n.language, {
    month: "short",
    year: "numeric",
  }).format(date);
  const Icon = helper ? HelpingHand : HeartHandshake;
  return (
    <span
      className={cn(
        "relative inline-flex h-5 items-center rounded-[10px] px-2 ps-8 text-[10.5px] font-semibold",
        helper
          ? "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
          : "bg-orange-500/15 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300",
      )}
    >
      <Icon
        className="absolute -start-1 h-8 w-8 fill-current"
        strokeWidth={1.8}
        aria-hidden
      />
      {t("publicProfileFeatures.since", { date: formatted })}
    </span>
  );
}

function dayTimeInZone(timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    day: value("weekday"),
    minutes: Number(value("hour")) * 60 + Number(value("minute")),
  };
}

function timeMinutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

export function AvailabilityCard({
  value,
}: {
  value: PublicAvailability | null;
}) {
  const { t, i18n } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [, setMinuteTick] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setMinuteTick((n) => n + 1), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const schedule = DAYS.map(
    (day) =>
      value?.weeklySchedule?.find((entry) => entry.day === day) ?? {
        day,
        on: false,
        start: "09:00",
        end: "17:00",
      },
  );
  if (!value || (!value.flexible && !schedule.some((day) => day.on))) return null;
  const timezone = value.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  let zoned: { day: string; minutes: number };
  try {
    zoned = dayTimeInZone(timezone);
  } catch {
    zoned = dayTimeInZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }
  const todayIndex = DAYS.indexOf(zoned.day);
  const today = schedule[todayIndex];
  const open =
    today?.on &&
    zoned.minutes >= timeMinutes(today.start) &&
    zoned.minutes < timeMinutes(today.end);
  let status = "";
  let statusTone = "bg-gray-400";
  if (open) {
    status = t("publicProfileFeatures.availableNowUntil", { time: today.end });
    statusTone = "bg-emerald-500";
  } else {
    let next: { offset: number; row: PublicAvailabilityDay } | null = null;
    for (let offset = 0; offset < 7; offset += 1) {
      const row = schedule[(todayIndex + offset) % 7];
      if (!row.on) continue;
      if (offset === 0 && timeMinutes(row.start) <= zoned.minutes) continue;
      next = { offset, row };
      break;
    }
    if (next) {
      const when =
        next.offset === 0
          ? t("publicProfileFeatures.today")
          : next.offset === 1
            ? t("publicProfileFeatures.tomorrow")
            : new Intl.DateTimeFormat(i18n.language, { weekday: "short" }).format(
                new Date(2023, 0, 1 + DAYS.indexOf(next.row.day)),
              );
      status = t("publicProfileFeatures.availableAt", {
        when,
        time: next.row.start,
      });
      statusTone = "bg-amber-500";
    } else {
      status = value.flexible
        ? t("publicProfileFeatures.byArrangement")
        : t("publicProfileFeatures.noHours");
    }
  }

  const groups: string[] = [];
  let start = 0;
  while (start < schedule.length) {
    if (!schedule[start].on) {
      start += 1;
      continue;
    }
    let end = start;
    while (
      end + 1 < schedule.length &&
      schedule[end + 1].on &&
      schedule[end + 1].start === schedule[start].start &&
      schedule[end + 1].end === schedule[start].end
    ) {
      end += 1;
    }
    const dayLabel = (index: number) =>
      new Intl.DateTimeFormat(i18n.language, { weekday: "short" }).format(
        new Date(2023, 0, 1 + index),
      );
    groups.push(
      `${dayLabel(start)}${end > start ? ` – ${dayLabel(end)}` : ""} ${schedule[start].start}–${schedule[start].end}`,
    );
    start = end + 1;
  }

  const visitorTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return (
    <section className="rounded-[20px] bg-white p-4 shadow-[0_4px_12px_rgba(15,23,42,0.07)] dark:bg-[#1C1C1E] dark:shadow-none">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="flex w-full items-center gap-3 text-start"
        aria-expanded={expanded}
      >
        <Clock3 className="h-5 w-5 shrink-0 text-orange-500" aria-hidden />
        <span className="min-w-0 flex-1 font-bold">
          {t("publicProfileFeatures.availability")}
        </span>
        <ChevronDown
          className={cn("h-5 w-5 transition-transform", expanded && "rotate-180")}
          aria-hidden
        />
      </button>
      <div className="mt-3 flex items-center gap-2 text-sm font-semibold">
        <span className={cn("h-[9px] w-[9px] rounded-full", statusTone)} />
        {status}
      </div>
      {groups.length ? (
        <p className="mt-2 truncate text-sm text-muted-foreground">
          {groups.join(" · ")}
        </p>
      ) : null}
      {expanded ? (
        <div className="mt-4 space-y-2 border-t border-border/60 pt-3">
          {schedule.map((row, index) => (
            <div
              key={row.day}
              className={cn(
                "flex items-center justify-between gap-4 text-sm",
                index === todayIndex && "font-bold",
              )}
            >
              <span>
                {new Intl.DateTimeFormat(i18n.language, {
                  weekday: "long",
                }).format(new Date(2023, 0, 1 + index))}
              </span>
              <span className="text-muted-foreground">
                {row.on
                  ? `${row.start}–${row.end}`
                  : t("publicProfileFeatures.unavailable")}
              </span>
            </div>
          ))}
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {value.flexible ? (
          <span className="inline-flex h-[26px] items-center rounded-full bg-muted px-3 text-xs font-semibold">
            {t("publicProfileFeatures.flexible")}
          </span>
        ) : null}
        {(value.minimumNoticeHours ?? 0) > 0 ? (
          <span className="inline-flex h-[26px] items-center rounded-full bg-muted px-3 text-xs font-semibold">
            {t("publicProfileFeatures.bookAhead", {
              count: value.minimumNoticeHours,
            })}
          </span>
        ) : null}
        {expanded && timezone !== visitorTimezone ? (
          <span className="inline-flex h-[26px] items-center rounded-full bg-muted px-3 text-xs font-semibold">
            {timezone}
          </span>
        ) : null}
      </div>
    </section>
  );
}

export function HourlyRateCard({ rate }: { rate: PublicRate | null }) {
  const { t } = useTranslation();
  if (!rate?.show_rates) return null;
  const min = rate.hourly_rate_min;
  const max = rate.hourly_rate_max;
  if (min == null && max == null) return null;
  const single = min == null || max == null || min === max;
  const value = single
    ? t("publicProfileFeatures.rateSingle", { rate: min ?? max })
    : t("publicProfileFeatures.rateRange", { min, max });
  return (
    <section className="flex items-center gap-3 rounded-[20px] bg-white p-4 shadow-[0_4px_12px_rgba(15,23,42,0.07)] dark:bg-[#1C1C1E] dark:shadow-none">
      <Banknote className="h-6 w-6 shrink-0 text-orange-500" aria-hidden />
      <span className="min-w-0 flex-1 font-bold">
        {t("publicProfileFeatures.hourlyRate")}
      </span>
      <span className="text-[17px] font-extrabold tabular-nums text-orange-500">
        {value}
      </span>
    </section>
  );
}
