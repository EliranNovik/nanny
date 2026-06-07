import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ClipboardList } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/toast";
import { acceptOpenHelpRequest } from "@/lib/acceptOpenHelpRequest";
import { toggleJobRequestFavorite } from "@/lib/jobRequestFavorites";
import { supabase } from "@/lib/supabase";
import { queryKeys } from "@/hooks/data/keys";
import type { DiscoverOpenHelpRequestRow } from "@/hooks/data/useDiscoverOpenHelpRequests";
import { DiscoverOpenHelpRequestCard } from "@/components/discover/DiscoverOpenHelpRequestCard";

function canActAsHelper(
  profile: { role?: string; is_available_for_jobs?: boolean } | null | undefined,
): boolean {
  if (!profile?.role) return false;
  if (profile.role === "freelancer") return true;
  if (profile.role === "client" && profile.is_available_for_jobs === true) return true;
  return false;
}

type Props = {
  requests: DiscoverOpenHelpRequestRow[];
  onUnsaved: (jobId: string) => void;
};

export function SavedOpenHelpRequestsList({ requests, onUnsaved }: Props) {
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  const { addToast } = useToast();
  const [acceptingJobId, setAcceptingJobId] = useState<string | null>(null);
  const [acceptedJobIds, setAcceptedJobIds] = useState<Set<string>>(() => new Set());
  const [savingJobId, setSavingJobId] = useState<string | null>(null);

  const jobIdsKey = useMemo(() => requests.map((row) => row.id).join(","), [requests]);

  useEffect(() => {
    if (!user?.id || requests.length === 0) {
      setAcceptedJobIds(new Set());
      return;
    }

    let cancelled = false;
    const jobIds = requests.map((row) => row.id);

    void supabase
      .from("job_confirmations")
      .select("job_id")
      .eq("freelancer_id", user.id)
      .eq("status", "available")
      .in("job_id", jobIds)
      .then(({ data, error }) => {
        if (cancelled || error) return;
        setAcceptedJobIds(new Set((data ?? []).map((row) => row.job_id as string)));
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id, jobIdsKey, requests]);

  const handleAccept = useCallback(
    async (jobId: string, clientName: string | null | undefined) => {
      if (!user?.id) return;

      if (!canActAsHelper(profile)) {
        addToast({
          title: "Enable helper profile",
          description: "Turn on help mode to accept requests.",
          variant: "warning",
        });
        return;
      }

      setAcceptingJobId(jobId);
      try {
        await acceptOpenHelpRequest(jobId);
        setAcceptedJobIds((prev) => new Set(prev).add(jobId));
        void queryClient.invalidateQueries({
          queryKey: queryKeys.discoverOpenHelpRequests(user.id),
        });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.freelancerRequests(user.id),
        });
        addToast({
          title: "Accepted",
          description: `Waiting for ${(clientName || "the client").trim()}.`,
          variant: "success",
        });
      } catch (err: unknown) {
        addToast({
          title: "Failed to accept",
          description: err instanceof Error ? err.message : "Try again.",
          variant: "error",
        });
      } finally {
        setAcceptingJobId(null);
      }
    },
    [user?.id, profile, queryClient, addToast],
  );

  const handleToggleSave = useCallback(
    async (jobId: string) => {
      if (!user?.id) return;
      setSavingJobId(jobId);
      try {
        await toggleJobRequestFavorite(user.id, jobId, true);
        onUnsaved(jobId);
        void queryClient.invalidateQueries({
          queryKey: queryKeys.jobRequestFavorites(user.id),
        });
        addToast({ title: "Removed from saved requests", variant: "success" });
      } catch (err: unknown) {
        addToast({
          title: "Could not update",
          description: err instanceof Error ? err.message : "Try again.",
          variant: "error",
        });
      } finally {
        setSavingJobId(null);
      }
    },
    [user?.id, onUnsaved, queryClient, addToast],
  );

  if (requests.length === 0) {
    return (
      <Card className="rounded-2xl border border-dashed border-border/60 bg-transparent">
        <CardContent className="py-12 text-center">
          <ClipboardList className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm font-semibold text-foreground">No saved requests</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Bookmark open requests on Discover to find them here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {requests.map((row) => (
        <DiscoverOpenHelpRequestCard
          key={row.id}
          row={row}
          saved
          saveBusy={savingJobId === row.id}
          onToggleSave={() => void handleToggleSave(row.id)}
          accepted={acceptedJobIds.has(row.id)}
          accepting={acceptingJobId === row.id}
          onAccept={() => void handleAccept(row.id, row.client_display_name)}
        />
      ))}
    </div>
  );
}
