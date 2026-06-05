import { useCallback, useEffect, useRef, useState, type ElementType } from "react";
import {
  Baby,
  Check,
  CookingPot,
  Sparkles,
  Truck,
  Wrench,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/context/AuthContext";
import { apiPost } from "@/lib/api";
import { isJobOpenForDiscoverListing } from "@/lib/discoverOpenJobStatuses";
import { avatarUrl } from "@/lib/imageTransform";
import { queryKeys } from "@/hooks/data/keys";
import type { DiscoverOpenHelpRequestRow } from "@/hooks/data/useDiscoverOpenHelpRequests";
import { useIsReceivingRequests } from "@/hooks/useIsReceivingRequests";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import {
  isServiceCategoryId,
  serviceCategoryLabel,
} from "@/lib/serviceCategories";
import type { ServiceCategoryId } from "@/lib/serviceCategories";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const POLL_INTERVAL_MS = 6000;
const DISCOVER_POLL_LIMIT = 24;

type IncomingRequestToast = {
  id: string;
  jobId: string;
  inboundNotifId: string | null;
  clientName: string;
  clientPhoto: string | null;
  categoryLabel: string;
  categoryId: string | null;
  about: string;
};

const CATEGORY_ICONS: Record<string, ElementType> = {
  cleaning: Sparkles,
  cooking: CookingPot,
  pickup_delivery: Truck,
  nanny: Baby,
  other_help: Wrench,
};

function declinedStorageKey(userId: string) {
  return `incoming-request-toast-declined:${userId}`;
}

function readDeclinedJobIds(userId: string): Set<string> {
  try {
    const raw = sessionStorage.getItem(declinedStorageKey(userId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    return new Set(Array.isArray(parsed) ? (parsed as string[]) : []);
  } catch {
    return new Set();
  }
}

function rememberDeclinedJob(userId: string, jobId: string) {
  const set = readDeclinedJobIds(userId);
  set.add(jobId);
  sessionStorage.setItem(
    declinedStorageKey(userId),
    JSON.stringify([...set]),
  );
}

function categoryIcon(serviceType: string | null | undefined) {
  const Icon = CATEGORY_ICONS[(serviceType ?? "").toLowerCase()] ?? Sparkles;
  return Icon;
}

function buildAboutLine(job: {
  location_city?: string | null;
  notes?: string | null;
  care_type?: string | null;
}): string {
  const notes = (job.notes ?? "").trim();
  if (notes) return notes.length > 72 ? `${notes.slice(0, 72)}…` : notes;
  const city = (job.location_city ?? "").trim();
  const care = (job.care_type ?? "").trim();
  if (city && care) return `${care} · ${city}`;
  if (city) return city;
  if (care) return care;
  return "New help request near you";
}

function categoryLabelFor(serviceType: string | null | undefined): string {
  const t = (serviceType ?? "").trim();
  if (t && isServiceCategoryId(t)) {
    return serviceCategoryLabel(t as ServiceCategoryId);
  }
  return t ? t.replace(/_/g, " ") : "Help request";
}

function IncomingRequestToastCard({
  toast,
  onAccept,
  onDecline,
  onIgnore,
  busy,
}: {
  toast: IncomingRequestToast;
  onAccept: () => void;
  onDecline: () => void;
  onIgnore: () => void;
  busy: boolean;
}) {
  const Icon = categoryIcon(toast.categoryId);

  return (
    <div
      role="alert"
      className={cn(
        "pointer-events-auto relative w-full max-w-[22rem] overflow-hidden rounded-2xl",
        "border border-white/20 bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800",
        "text-white shadow-2xl shadow-black/40 ring-1 ring-white/10",
        "animate-in slide-in-from-right-4 fade-in duration-300",
        "dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950",
      )}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-br from-emerald-500/25 via-sky-500/10 to-transparent"
        aria-hidden
      />
      <div className="relative p-4 pb-3">
        <div className="flex gap-3">
          <div className="relative shrink-0">
            <Avatar className="h-12 w-12 border-2 border-white/15 shadow-lg">
              <AvatarImage
                src={
                  toast.clientPhoto
                    ? avatarUrl.sm(toast.clientPhoto)
                    : undefined
                }
                alt=""
                className="object-cover"
              />
              <AvatarFallback className="bg-zinc-700 text-sm font-bold text-white">
                {toast.clientName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800 ring-2 ring-zinc-900">
              <Icon className="h-3.5 w-3.5 text-emerald-300" strokeWidth={2.25} />
            </span>
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-300/90">
              New request
            </p>
            <p className="mt-0.5 truncate text-[15px] font-bold leading-tight">
              {toast.clientName}
            </p>
            <p className="mt-1 inline-flex max-w-full items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white/90">
              <Icon className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
              <span className="truncate">{toast.categoryLabel}</span>
            </p>
            <p className="mt-2 line-clamp-2 text-[12px] leading-snug text-zinc-300">
              {toast.about}
            </p>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onDecline}
            disabled={busy}
            className={cn(
              "flex-1 rounded-xl border border-white/15 bg-white/5 px-2 py-2.5 text-center",
              "text-[13px] font-bold text-white/90 transition",
              "hover:bg-white/10 active:scale-[0.98] disabled:opacity-50",
            )}
          >
            Decline
          </button>
          <button
            type="button"
            onClick={onIgnore}
            disabled={busy}
            className={cn(
              "flex-1 rounded-xl border border-white/15 bg-white/5 px-2 py-2.5 text-center",
              "text-[13px] font-bold text-white/90 transition",
              "hover:bg-white/10 active:scale-[0.98] disabled:opacity-50",
            )}
          >
            Ignore
          </button>
          <button
            type="button"
            onClick={onAccept}
            disabled={busy}
            className={cn(
              "flex flex-[1.2] items-center justify-center gap-1 rounded-xl px-2 py-2.5",
              "bg-gradient-to-r from-emerald-500 to-emerald-600 text-[13px] font-bold text-white shadow-lg shadow-emerald-900/40",
              "transition hover:from-emerald-400 hover:to-emerald-500 active:scale-[0.98] disabled:opacity-50",
            )}
          >
            <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
            Accept
          </button>
        </div>
      </div>
      <div
        className="h-1 w-full bg-gradient-to-r from-emerald-400/80 to-sky-400/80"
        aria-hidden
      />
    </div>
  );
}

export function IncomingRequestToastListener() {
  const { user } = useAuth();
  const receiving = useIsReceivingRequests();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [toast, setToast] = useState<IncomingRequestToast | null>(null);
  const [busy, setBusy] = useState(false);

  const knownJobIds = useRef<Set<string>>(new Set());
  const pollSeeded = useRef(false);
  const inFlight = useRef<Set<string>>(new Set());
  const toastVisible = useRef(false);

  const dismiss = useCallback(() => {
    setToast(null);
    setBusy(false);
    toastVisible.current = false;
  }, []);

  const showToast = useCallback(
    (
      row: DiscoverOpenHelpRequestRow,
      inboundNotifId: string | null = null,
    ) => {
      if (toastVisible.current) return;
      const serviceType = (row.service_type ?? "").trim() || null;
      toastVisible.current = true;
      setToast({
        id: `${row.id}-${Date.now()}`,
        jobId: row.id,
        inboundNotifId,
        clientName:
          String(row.client_display_name ?? "").trim() || "Someone nearby",
        clientPhoto: row.client_photo_url ?? null,
        categoryLabel: categoryLabelFor(serviceType),
        categoryId: serviceType,
        about: buildAboutLine(row),
      });
    },
    [],
  );

  const shouldSkipJob = useCallback(
    async (jobId: string, userId: string): Promise<boolean> => {
      if (knownJobIds.current.has(jobId) || inFlight.current.has(jobId)) {
        return true;
      }
      if (readDeclinedJobIds(userId).has(jobId)) return true;

      inFlight.current.add(jobId);
      try {
        const { data: existingConf } = await supabase
          .from("job_confirmations")
          .select("id")
          .eq("job_id", jobId)
          .eq("freelancer_id", userId)
          .maybeSingle();
        return Boolean(existingConf);
      } finally {
        inFlight.current.delete(jobId);
      }
    },
    [],
  );

  const considerDiscoverRow = useCallback(
    async (row: DiscoverOpenHelpRequestRow, inboundNotifId: string | null) => {
      const userId = user?.id;
      if (!userId || !receiving) return;
      if (!row.id || row.client_id === userId) return;
      if (row.status && !isJobOpenForDiscoverListing(row.status)) return;

      if (await shouldSkipJob(row.id, userId)) {
        knownJobIds.current.add(row.id);
        return;
      }

      knownJobIds.current.add(row.id);
      showToast(row, inboundNotifId);
    },
    [receiving, user?.id, shouldSkipJob, showToast],
  );

  const pollOpenRequests = useCallback(async () => {
    const userId = user?.id;
    if (!userId || !receiving) return;

    const { data, error } = await supabase.rpc("get_discover_open_help_requests", {
      p_limit: DISCOVER_POLL_LIMIT,
    });
    if (error) return;

    let rows = (data || []) as DiscoverOpenHelpRequestRow[];
    rows = rows.filter((r) => {
      if (!r.id || r.client_id === userId) return false;
      if (r.status == null || r.status === "") return true;
      return isJobOpenForDiscoverListing(String(r.status));
    });

    if (!pollSeeded.current) {
      for (const r of rows) knownJobIds.current.add(r.id);
      pollSeeded.current = true;
      return;
    }

    for (const row of rows) {
      if (!knownJobIds.current.has(row.id)) {
        await considerDiscoverRow(row, null);
        if (toastVisible.current) break;
      }
    }
  }, [receiving, user?.id, considerDiscoverRow]);

  useEffect(() => {
    if (!receiving) {
      pollSeeded.current = false;
      knownJobIds.current.clear();
      return;
    }
    pollSeeded.current = false;
    knownJobIds.current.clear();
    void pollOpenRequests();
    const id = window.setInterval(() => void pollOpenRequests(), POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [receiving, user?.id, pollOpenRequests]);

  const handleNotificationInsert = useCallback(
    async (payload: { new?: Record<string, unknown> }) => {
      const notif = payload.new;
      if (!notif?.job_id || !notif?.id) return;
      const jobId = String(notif.job_id);
      const notifId = String(notif.id);

      const { data: summary } = await supabase.rpc(
        "get_job_request_public_summary_for_match",
        { p_job_id: jobId },
      );
      const job = Array.isArray(summary) ? summary[0] : summary;
      if (!job?.id) return;

      const { data: clientProfile } = await supabase
        .from("profiles")
        .select("full_name, photo_url")
        .eq("id", job.client_id)
        .maybeSingle();

      const row: DiscoverOpenHelpRequestRow = {
        id: job.id,
        service_type: job.service_type,
        location_city: job.location_city,
        start_at: job.start_at ?? null,
        created_at: job.created_at ?? null,
        shift_hours: job.shift_hours ?? null,
        time_duration: job.time_duration ?? null,
        care_type: null,
        care_frequency: job.care_frequency ?? null,
        notes: job.notes,
        client_id: job.client_id,
        client_display_name: clientProfile?.full_name ?? null,
        client_photo_url: clientProfile?.photo_url ?? null,
        status: "ready",
      };

      await considerDiscoverRow(row, notifId);
    },
    [considerDiscoverRow],
  );

  useRealtimeSubscription(
    {
      table: "job_candidate_notifications",
      event: "INSERT",
      filter: user?.id ? `freelancer_id=eq.${user.id}` : undefined,
      enabled: receiving && Boolean(user?.id),
    },
    handleNotificationInsert,
  );

  const handleAccept = useCallback(async () => {
    if (!toast || !user?.id) return;
    setBusy(true);
    const { jobId, inboundNotifId } = toast;
    try {
      if (inboundNotifId) {
        await apiPost(
          `/api/jobs/${jobId}/notifications/${inboundNotifId}/open`,
          {},
        );
        await apiPost(`/api/jobs/${jobId}/confirm`, {});
      } else {
        await apiPost(`/api/jobs/${jobId}/freelancer-confirm-open`, {});
      }
      void queryClient.invalidateQueries({
        queryKey: queryKeys.discoverOpenHelpRequests(user.id),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.freelancerRequests(user.id),
      });
      addToast({
        title: "Request accepted",
        description: "Waiting for the client to confirm.",
        variant: "success",
        duration: 4000,
      });
      dismiss();
    } catch (err: unknown) {
      addToast({
        title: "Could not accept",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "error",
      });
      setBusy(false);
    }
  }, [toast, user?.id, queryClient, addToast, dismiss]);

  const handleDecline = useCallback(async () => {
    if (!toast || !user?.id) return;
    setBusy(true);
    const { jobId, inboundNotifId } = toast;
    try {
      if (inboundNotifId) {
        await apiPost(`/api/jobs/${jobId}/freelancer-decline`, {
          notifId: inboundNotifId,
        });
      } else {
        await apiPost(`/api/jobs/${jobId}/freelancer-decline-open`, {});
      }
      rememberDeclinedJob(user.id, jobId);
      knownJobIds.current.add(jobId);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.discoverOpenHelpRequests(user.id),
      });
      dismiss();
    } catch (err: unknown) {
      addToast({
        title: "Could not decline",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "error",
      });
      setBusy(false);
    }
  }, [toast, user?.id, queryClient, addToast, dismiss]);

  if (!receiving || !toast) return null;

  return (
    <div
      className="pointer-events-none fixed top-4 right-4 z-[110] flex w-[calc(100%-2rem)] max-w-[22rem] flex-col gap-2 sm:right-5"
      aria-live="polite"
    >
      <IncomingRequestToastCard
        toast={toast}
        onAccept={() => void handleAccept()}
        onDecline={() => void handleDecline()}
        onIgnore={() => dismiss()}
        busy={busy}
      />
    </div>
  );
}
