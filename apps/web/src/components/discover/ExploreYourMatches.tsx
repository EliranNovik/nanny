import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { INTERACTIVE_CARD_HOVER } from "@/components/jobs/jobCardSharedClasses";
import { buildJobsUrl } from "@/components/jobs/jobsPerspective";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  isServiceCategoryId,
  serviceCategoryLabel,
} from "@/lib/serviceCategories";
import { ChevronRight } from "lucide-react";

const HELPING_NOW = ["locked", "active"] as const;

const JOB_FLAT =
  "id, created_at, service_type, location_city, client_id, selected_freelancer_id, status, community_post_id";

type LiveMatch = {
  jobId: string;
  createdAtIso: string;
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

/** Top-right card label */
type MatchKind = "helper_availability" | "client_request" | "client_availability";

type ExploreRow = {
  match: LiveMatch;
  kind: MatchKind;
};

type ProfileMini = {
  id: string;
  full_name: string | null;
  photo_url: string | null;
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

async function fetchProfileMap(
  rows: { client_id?: string | null; selected_freelancer_id?: string | null }[],
): Promise<Map<string, ProfileMini>> {
  const ids = new Set<string>();
  for (const r of rows) {
    if (r.client_id) ids.add(String(r.client_id));
    if (r.selected_freelancer_id)
      ids.add(String(r.selected_freelancer_id));
  }
  if (ids.size === 0) return new Map();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, photo_url")
    .in("id", [...ids]);
  if (error) {
    console.warn("[ExploreYourMatches] profiles", error);
    return new Map();
  }
  const m = new Map<string, ProfileMini>();
  for (const p of (data ?? []) as ProfileMini[]) {
    if (p?.id) m.set(p.id, p);
  }
  return m;
}

function rowToMatch(
  r: {
    id?: string;
    created_at?: string;
    service_type?: string | null;
    location_city?: string | null;
    client_id?: string | null;
    selected_freelancer_id?: string | null;
  },
  profMap: Map<string, ProfileMini>,
): LiveMatch {
  const cid = String(r.client_id ?? "");
  const hid = String(r.selected_freelancer_id ?? "");
  const c = profMap.get(cid);
  const h = profMap.get(hid);
  const createdAtIso = String(r.created_at ?? "");
  return {
    jobId: String(r.id ?? ""),
    createdAtIso,
    helperId: hid,
    clientId: cid,
    helper: String(h?.full_name ?? "Helper").trim() || "Helper",
    client: String(c?.full_name ?? "Client").trim() || "Client",
    helperPhoto: h?.photo_url ?? null,
    clientPhoto: c?.photo_url ?? null,
    workType: serviceLabel(r.service_type),
    when: timeAgoShort(createdAtIso),
    city: String(r.location_city ?? "").trim() || "—",
  };
}

const helpingNowFreelancerUrl = buildJobsUrl("freelancer", "jobs");
const helpingNowClientUrl = buildJobsUrl("client", "jobs");

export type ExploreMatchPerspective = "all" | "client" | "helper";

type Props = {
  embeddedInExplore?: boolean;
  /** Limit which paired jobs appear: client = “helping me now”, helper = from your availability / helping now as helper */
  matchPerspective?: ExploreMatchPerspective;
};

function cardLabelText(kind: MatchKind): string {
  if (kind === "client_request") return "Your request";
  return "Your availability post";
}

/**
 * Explore → Your matches: one list; top-right label per card (request vs availability post).
 */
export function ExploreYourMatches({
  embeddedInExplore = false,
  matchPerspective = "all",
}: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ExploreRow[]>([]);

  const load = useCallback(async () => {
    if (!user?.id) {
      setRows([]);
      setLoading(false);
      return;
    }

    const uid = user.id;
    setLoading(true);

    try {
      const merged: ExploreRow[] = [];

      // Helper · availability post
      const { data: hPrimary, error: hErr } = await supabase
        .from("job_requests")
        .select(JOB_FLAT)
        .eq("selected_freelancer_id", uid)
        .in("status", [...HELPING_NOW])
        .not("community_post_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(24);

      let hRows = !hErr ? ((hPrimary ?? []) as Parameters<typeof rowToMatch>[0][]) : [];
      if (hErr) {
        console.warn("[ExploreYourMatches] helper availability", hErr);
      } else {
        const hIds = new Set(hRows.map((r) => String(r.id ?? "")));

        const { data: myPosts } = await supabase
          .from("community_posts")
          .select("id")
          .eq("author_id", uid);
        const postIds = (myPosts ?? [])
          .map((p: { id: string }) => p.id)
          .filter(Boolean);

        if (postIds.length > 0) {
          const { data: interests, error: intErr } = await supabase
            .from("community_post_hire_interests")
            .select("job_request_id")
            .in("community_post_id", postIds)
            .eq("status", "confirmed")
            .not("job_request_id", "is", null);

          if (!intErr && interests?.length) {
            const extraIds = [
              ...new Set(
                interests
                  .map((i: { job_request_id?: string | null }) =>
                    String(i.job_request_id ?? "").trim(),
                  )
                  .filter(Boolean)
                  .filter((id) => !hIds.has(id)),
              ),
            ];
            if (extraIds.length > 0) {
              const { data: extraData, error: exErr } = await supabase
                .from("job_requests")
                .select(JOB_FLAT)
                .in("id", extraIds)
                .in("status", [...HELPING_NOW])
                .not("community_post_id", "is", null)
                .eq("selected_freelancer_id", uid);

              if (!exErr && extraData?.length) {
                hRows = [...hRows, ...(extraData as typeof hRows)];
              }
            }
          }
        }

        const byId = new Map<string, (typeof hRows)[0]>();
        for (const r of hRows) {
          const id = String(r?.id ?? "");
          if (id && !byId.has(id)) byId.set(id, r);
        }
        const sortedH = [...byId.values()].sort(
          (a, b) =>
            new Date(String(b.created_at ?? 0)).getTime() -
            new Date(String(a.created_at ?? 0)).getTime(),
        );
        const profH = await fetchProfileMap(sortedH);
        for (const r of sortedH) {
          merged.push({
            match: rowToMatch(r, profH),
            kind: "helper_availability",
          });
        }
      }

      // Client · posted request
      const { data: cReq, error: cReqErr } = await supabase
        .from("job_requests")
        .select(JOB_FLAT)
        .eq("client_id", uid)
        .in("status", [...HELPING_NOW])
        .not("selected_freelancer_id", "is", null)
        .is("community_post_id", null)
        .order("created_at", { ascending: false })
        .limit(24);

      if (!cReqErr && cReq?.length) {
        const list = (cReq ?? []) as Parameters<typeof rowToMatch>[0][];
        const prof = await fetchProfileMap(list);
        for (const r of list) {
          merged.push({
            match: rowToMatch(r, prof),
            kind: "client_request",
          });
        }
      } else if (cReqErr) {
        console.warn("[ExploreYourMatches] client requests", cReqErr);
      }

      // Client · hired via availability
      const { data: cAv, error: cAvErr } = await supabase
        .from("job_requests")
        .select(JOB_FLAT)
        .eq("client_id", uid)
        .in("status", [...HELPING_NOW])
        .not("selected_freelancer_id", "is", null)
        .not("community_post_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(24);

      if (!cAvErr && cAv?.length) {
        const list = (cAv ?? []) as Parameters<typeof rowToMatch>[0][];
        const prof = await fetchProfileMap(list);
        for (const r of list) {
          merged.push({
            match: rowToMatch(r, prof),
            kind: "client_availability",
          });
        }
      } else if (cAvErr) {
        console.warn("[ExploreYourMatches] client availability", cAvErr);
      }

      // Dedupe by job id (same job shouldn’t appear twice; keep newest kind if any)
      const byJob = new Map<string, ExploreRow>();
      for (const item of merged) {
        byJob.set(item.match.jobId, item);
      }
      const deduped = [...byJob.values()].sort(
        (a, b) =>
          new Date(b.match.createdAtIso).getTime() -
          new Date(a.match.createdAtIso).getTime(),
      );

      const filtered =
        matchPerspective === "client"
          ? deduped.filter(
              (r) =>
                r.kind === "client_request" || r.kind === "client_availability",
            )
          : matchPerspective === "helper"
            ? deduped.filter((r) => r.kind === "helper_availability")
            : deduped;

      setRows(filtered);
    } finally {
      setLoading(false);
    }
  }, [user?.id, matchPerspective]);

  useEffect(() => {
    void load();
  }, [load]);

  const gridClass =
    "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3";

  const MatchCard = ({ item }: { item: ExploreRow }) => {
    const { match: row, kind } = item;
    const isHelper = kind === "helper_availability";
    const open = () =>
      navigate(isHelper ? helpingNowFreelancerUrl : helpingNowClientUrl);

    return (
      <button
        type="button"
        onClick={open}
        className={cn(
          "group relative w-full rounded-2xl p-4 text-left bg-white dark:bg-zinc-900",
          "border border-slate-200/80 dark:border-white/5 shadow-[0_1px_3px_rgba(0,0,0,0.02)]",
          INTERACTIVE_CARD_HOVER,
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/50",
        )}
        aria-label={isHelper ? "Open Helping now" : "Open Helping me now"}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 flex-1 truncate text-base font-semibold text-foreground pr-1">
            {isHelper ? (
              <>
                <span className="text-muted-foreground">With </span>
                {row.client}
              </>
            ) : (
              <>
                <span className="text-muted-foreground">With </span>
                {row.helper}
              </>
            )}
          </p>
          <span
            className="max-w-[11rem] shrink-0 text-right text-[11px] font-semibold leading-snug text-muted-foreground"
          >
            {cardLabelText(kind)}
          </span>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <div className="relative flex shrink-0 -space-x-2" aria-hidden>
            <Avatar className="h-11 w-11 border-2 border-background">
              <AvatarImage src={row.helperPhoto || undefined} />
              <AvatarFallback className="text-[10px] font-black">
                {initials(row.helper)}
              </AvatarFallback>
            </Avatar>
            <Avatar className="h-11 w-11 border-2 border-background">
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
                isHelper
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
  };

  if (!user?.id) return null;

  return (
    <div className={cn(embeddedInExplore ? "mt-0 px-0" : "")}>
      {loading ? (
        <div className="rounded-xl border border-border/60 bg-card/30 px-3 py-4 text-sm text-muted-foreground">
          Loading your matches…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl bg-muted/20 px-4 py-5 text-center text-sm text-muted-foreground dark:bg-muted/30">
          {matchPerspective === "client"
            ? "No active “helping me now” jobs yet. When a helper is confirmed on your request, it will show here."
            : matchPerspective === "helper"
              ? "No active jobs from your availability yet. When a client confirms a hire on your post, it will show here."
              : "No active matches yet. When a job is paired, it will show here."}
        </div>
      ) : (
        <div className={gridClass}>
          {rows.map((item) => (
            <MatchCard key={item.match.jobId} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
