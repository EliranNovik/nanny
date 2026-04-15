import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  isServiceCategoryId,
  serviceCategoryLabel,
} from "@/lib/serviceCategories";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { buildJobsUrl } from "@/components/jobs/jobsPerspective";

type LiveMatch = {
  jobId: string;
  helperId: string;
  clientId: string;
  helper: string;
  client: string;
  helperPhoto: string | null;
  clientPhoto: string | null;
  workType: string;
  when: string;
  city: string;
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
  return isServiceCategoryId(st)
    ? serviceCategoryLabel(st)
    : st.replace(/_/g, " ");
}

function initials(name: string): string {
  const t = name.trim();
  if (!t) return "?";
  const parts = t.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "";
  const b =
    parts.length > 1
      ? (parts[parts.length - 1]?.[0] ?? "")
      : (parts[0]?.[1] ?? "");
  return (a + b).toUpperCase() || "?";
}

export type DiscoverHomeLiveTrackerVariant = "hire" | "work";

type Props = { variant?: DiscoverHomeLiveTrackerVariant };

/** Same rule as `PublicProfilePage` / Jobs “freelancer” mode: clients who receive requests can be selected as helper. */
function canActAsHelper(
  profile: { role?: string; is_available_for_jobs?: boolean } | null,
): boolean {
  if (!profile?.role) return false;
  if (profile.role === "freelancer") return true;
  if (profile.role === "client" && profile.is_available_for_jobs === true)
    return true;
  return false;
}

/** Matches the “Helping now” list in `JobsTabContent` (active jobs only). */
const HELPING_NOW_STATUSES = ["locked", "active"] as const;

const JOB_MATCH_FLAT_SELECT =
  "id, created_at, service_type, location_city, client_id, selected_freelancer_id, status";

type ProfileMini = {
  id: string;
  full_name: string | null;
  photo_url: string | null;
};

async function fetchProfileMapForJobRows(
  rows: { client_id?: string | null; selected_freelancer_id?: string | null }[],
): Promise<Map<string, ProfileMini>> {
  const ids = new Set<string>();
  for (const r of rows) {
    const c = r.client_id != null ? String(r.client_id) : "";
    const h =
      r.selected_freelancer_id != null ? String(r.selected_freelancer_id) : "";
    if (c) ids.add(c);
    if (h) ids.add(h);
  }
  if (ids.size === 0) return new Map();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, photo_url")
    .in("id", [...ids]);
  if (error) {
    console.warn("[DiscoverHomeLiveTrackerBoard] profiles for matches:", error);
    return new Map();
  }
  const m = new Map<string, ProfileMini>();
  for (const p of (data ?? []) as ProfileMini[]) {
    if (p?.id) m.set(p.id, p);
  }
  return m;
}

function flatJobRowsToLiveMatches(
  rows: {
    id?: string;
    created_at?: string;
    service_type?: string | null;
    location_city?: string | null;
    client_id?: string | null;
    selected_freelancer_id?: string | null;
  }[],
  profMap: Map<string, ProfileMini>,
): LiveMatch[] {
  return rows.map((r) => {
    const cid = String(r.client_id ?? "");
    const hid = String(r.selected_freelancer_id ?? "");
    const c = profMap.get(cid);
    const h = profMap.get(hid);
    return {
      jobId: String(r.id ?? ""),
      helperId: hid,
      clientId: cid,
      helper: String(h?.full_name ?? "Helper").trim() || "Helper",
      client: String(c?.full_name ?? "Client").trim() || "Client",
      helperPhoto: (h?.photo_url as string | null) ?? null,
      clientPhoto: (c?.photo_url as string | null) ?? null,
      workType: serviceLabel(r.service_type),
      when: timeAgoShort(String(r.created_at ?? "")),
      city: String(r.location_city ?? "").trim() || "—",
    };
  });
}

function jobRowToLiveMatch(r: any): LiveMatch {
  const helperName =
    String(r?.helper?.full_name ?? "Helper").trim() || "Helper";
  const clientName =
    String(r?.client?.full_name ?? "Client").trim() || "Client";
  return {
    jobId: String(r?.id ?? ""),
    helperId: String(r?.helper?.id ?? ""),
    clientId: String(r?.client?.id ?? ""),
    helper: helperName,
    client: clientName,
    helperPhoto: (r?.helper?.photo_url as string | null) ?? null,
    clientPhoto: (r?.client?.photo_url as string | null) ?? null,
    workType: serviceLabel(r?.service_type),
    when: timeAgoShort(String(r?.created_at ?? "")),
    city: String(r?.location_city ?? "").trim() || "—",
  };
}

const JOB_MATCH_SELECT = `
  id,
  created_at,
  service_type,
  location_city,
  client:profiles!job_requests_client_id_fkey ( id, full_name, photo_url ),
  helper:profiles!job_requests_selected_freelancer_id_fkey ( id, full_name, photo_url )
`;

/**
 * “I need help”: clients only — paired jobs that started from Connect now on a helper’s post
 * (`community_post_id` set). “Help others”: anyone who can act as helper (freelancer or client with
 * receive-requests on) — same rows as Jobs → Helping now: `status` in locked/active and you are
 * `selected_freelancer_id`, plus confirmed Connect jobs from your posts if not already in that set.
 */
export function DiscoverHomeLiveTrackerBoard({ variant = "hire" }: Props) {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const isWork = variant === "work";

  /** Hire tab = client “Helping me now”; work tab = helper “Helping now” (freelancer mode on /jobs). */
  const helpingNowJobsUrl = useMemo(() => {
    if (variant === "work") return buildJobsUrl("freelancer", "jobs");
    return buildJobsUrl("client", "jobs");
  }, [variant]);

  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState<LiveMatch[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (!user?.id) {
      setMatches([]);
      setLoading(false);
      return;
    }

    const role = profile?.role;
    const hireTabClient = variant === "hire" && role === "client";
    const workTabHelper = variant === "work" && canActAsHelper(profile);
    if (!hireTabClient && !workTabHelper) {
      setMatches([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    void (async () => {
      if (hireTabClient) {
        const { data, error } = await supabase
          .from("job_requests")
          .select(JOB_MATCH_SELECT)
          .eq("client_id", user.id)
          .not("selected_freelancer_id", "is", null)
          .not("community_post_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(8);

        if (cancelled) return;
        if (error) {
          console.warn(
            "[DiscoverHomeLiveTrackerBoard] client community matches:",
            error,
          );
          setMatches([]);
          setLoading(false);
          return;
        }

        const rows = (data ?? []) as Record<string, unknown>[];
        setMatches(rows.map(jobRowToLiveMatch));
        setLoading(false);
        return;
      }

      // workTabHelper: same jobs as Jobs → Helping now (`locked` / `active`, you are selected helper).
      // Flat job row + batch profiles avoids nested-select / RLS edge cases.
      const { data: primaryData, error: primaryErr } = await supabase
        .from("job_requests")
        .select(JOB_MATCH_FLAT_SELECT)
        .eq("selected_freelancer_id", user.id)
        .in("status", [...HELPING_NOW_STATUSES])
        .order("created_at", { ascending: false })
        .limit(24);

      if (cancelled) return;
      if (primaryErr) {
        console.warn(
          "[DiscoverHomeLiveTrackerBoard] helper matches:",
          primaryErr,
        );
        setMatches([]);
        setLoading(false);
        return;
      }

      const primaryRows = (primaryData ?? []) as {
        id?: string;
        created_at?: string;
        service_type?: string | null;
        location_city?: string | null;
        client_id?: string | null;
        selected_freelancer_id?: string | null;
      }[];
      const primaryIds = new Set(primaryRows.map((r) => String(r.id ?? "")));

      const { data: myPosts } = await supabase
        .from("community_posts")
        .select("id")
        .eq("author_id", user.id);
      if (cancelled) return;

      const postIds = (myPosts ?? [])
        .map((p: { id: string }) => p.id)
        .filter(Boolean);
      let extraRows: typeof primaryRows = [];
      if (postIds.length > 0) {
        const { data: interests, error: intErr } = await supabase
          .from("community_post_hire_interests")
          .select("job_request_id")
          .in("community_post_id", postIds)
          .eq("status", "confirmed")
          .not("job_request_id", "is", null);

        if (cancelled) return;
        if (intErr) {
          console.warn(
            "[DiscoverHomeLiveTrackerBoard] hire interests:",
            intErr,
          );
        } else {
          const hiredJobIds = [
            ...new Set(
              (interests ?? [])
                .map((i: { job_request_id?: string | null }) =>
                  String(i.job_request_id ?? "").trim(),
                )
                .filter(Boolean),
            ),
          ];
          const missing = hiredJobIds.filter((jid) => !primaryIds.has(jid));
          if (missing.length > 0) {
            const { data: extraData, error: extraErr } = await supabase
              .from("job_requests")
              .select(JOB_MATCH_FLAT_SELECT)
              .in("id", missing)
              .in("status", [...HELPING_NOW_STATUSES]);
            if (cancelled) return;
            if (extraErr) {
              console.warn(
                "[DiscoverHomeLiveTrackerBoard] extra jobs from hire interests:",
                extraErr,
              );
            } else {
              extraRows = (extraData ?? []) as typeof primaryRows;
            }
          }
        }
      }

      const byId = new Map<string, (typeof primaryRows)[0]>();
      for (const r of [...primaryRows, ...extraRows]) {
        const id = String(r?.id ?? "");
        if (id && !byId.has(id)) byId.set(id, r);
      }
      const sorted = [...byId.values()].sort(
        (a, b) =>
          new Date(String(b.created_at ?? 0)).getTime() -
          new Date(String(a.created_at ?? 0)).getTime(),
      );
      const top = sorted.slice(0, 8);
      const profMap = await fetchProfileMapForJobRows(top);
      if (cancelled) return;
      setMatches(flatJobRowsToLiveMatches(top, profMap));
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, profile?.role, profile?.is_available_for_jobs, variant]);

  if (!user?.id) return null;
  if (variant === "hire" && profile?.role !== "client") return null;
  if (variant === "work" && !canActAsHelper(profile)) return null;

  const hasMatches = matches.length > 0;
  const previewDesktop = matches.slice(0, 4);

  const MatchCard = ({
    row,
    className,
    compact,
  }: {
    row: LiveMatch;
    className?: string;
    compact?: boolean;
  }) => (
    <button
      type="button"
      onClick={() => navigate(helpingNowJobsUrl)}
      className={cn(
        "relative w-full rounded-2xl bg-muted/20 p-4 text-left transition-colors dark:bg-muted/30",
        "hover:bg-muted/30 active:bg-muted/45 dark:hover:bg-muted/45 dark:active:bg-muted/60",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
      aria-label={isWork ? "Open Helping now" : "Open Helping me now"}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 flex-1 truncate text-base font-semibold text-foreground">
          {!isWork ? (
            <>
              <span className="text-muted-foreground">With </span>
              {row.helper}
            </>
          ) : (
            <>
              <span className="text-muted-foreground">With </span>
              {row.client}
            </>
          )}
        </p>
        {!compact && isWork ? (
          <div className="relative flex shrink-0 -space-x-2">
            <Avatar className="h-10 w-10 border-2 border-background shadow-sm">
              <AvatarImage
                src={row.helperPhoto || undefined}
                className="object-cover"
              />
              <AvatarFallback className="bg-card text-[11px] font-black">
                {initials(row.helper)}
              </AvatarFallback>
            </Avatar>
            <Avatar className="h-10 w-10 border-2 border-background shadow-sm">
              <AvatarImage
                src={row.clientPhoto || undefined}
                className="object-cover"
              />
              <AvatarFallback className="bg-card text-[11px] font-black">
                {initials(row.client)}
              </AvatarFallback>
            </Avatar>
          </div>
        ) : null}
      </div>

      <div className={cn("mt-3 flex items-center gap-3", compact && "mt-2.5")}>
        <div className="relative flex shrink-0 -space-x-2" aria-hidden>
          <Avatar
            className={cn(
              "h-11 w-11 border-2 border-background",
              compact && "h-10 w-10",
            )}
          >
            <AvatarImage src={row.helperPhoto || undefined} />
            <AvatarFallback className="text-[10px] font-black">
              {initials(row.helper)}
            </AvatarFallback>
          </Avatar>
          <Avatar
            className={cn(
              "h-11 w-11 border-2 border-background",
              compact && "h-10 w-10",
            )}
          >
            <AvatarImage src={row.clientPhoto || undefined} />
            <AvatarFallback className="text-[10px] font-black">
              {initials(row.client)}
            </AvatarFallback>
          </Avatar>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-muted-foreground">
            {row.workType}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">{row.city}</p>
          <p
            className={cn(
              "mt-1 text-xs font-semibold tabular-nums",
              isWork
                ? "text-emerald-700 dark:text-emerald-400"
                : "text-orange-700 dark:text-orange-400",
            )}
          >
            Matched {row.when}
          </p>
        </div>
        <ChevronRight
          className="h-5 w-5 shrink-0 text-muted-foreground"
          aria-hidden
          strokeWidth={2}
        />
      </div>
    </button>
  );

  return (
    <section className="mt-4 px-1 md:mt-5" aria-label="Your matches">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
            Your matches
          </p>
          <p className="mt-0.5 text-sm font-semibold text-foreground">
            {isWork
              ? "Jobs you’re on and Connect matches from your posts"
              : "Helpers you matched via Connect on live posts"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate(helpingNowJobsUrl)}
          className={cn(
            "shrink-0 rounded-full px-3 py-1 text-xs font-bold text-muted-foreground transition-colors",
            "hover:bg-muted/60 hover:text-foreground active:bg-muted/80",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          )}
        >
          Show more
        </button>
      </div>

      {loading ? (
        <div className="rounded-xl border border-border/60 bg-card/30 px-3 py-4 text-sm text-muted-foreground">
          Loading your matches…
        </div>
      ) : !hasMatches ? (
        <div className="rounded-2xl bg-muted/20 px-4 py-5 text-center text-sm font-medium text-muted-foreground dark:bg-muted/30">
          No matches yet. When a job is paired, it will show here.
        </div>
      ) : (
        <>
          <div className="sm:hidden">
            {matches.slice(0, 1).map((row) => (
              <MatchCard key={row.jobId} row={row} compact />
            ))}
          </div>
          <div className="hidden sm:grid sm:grid-cols-1 sm:gap-2 md:grid-cols-2 md:gap-3 lg:grid-cols-4 lg:gap-3">
            {previewDesktop.map((row) => (
              <MatchCard key={row.jobId} row={row} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
