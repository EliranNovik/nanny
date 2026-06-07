import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { useGuestAuthPrompt } from "@/context/GuestAuthPromptContext";
import { useToast } from "@/components/ui/toast";
import { acceptOpenHelpRequest } from "@/lib/acceptOpenHelpRequest";
import { toggleJobRequestFavorite } from "@/lib/jobRequestFavorites";
import { supabase } from "@/lib/supabase";
import { queryKeys } from "@/hooks/data/keys";
import type { DiscoverOpenHelpRequestRow } from "@/hooks/data/useDiscoverOpenHelpRequests";
import { useJobRequestFavoriteIds } from "@/hooks/data/useJobRequestFavoriteIds";
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
  row: DiscoverOpenHelpRequestRow;
  className?: string;
};

export function OpenHelpRequestFeedCard({ row, className }: Props) {
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  const { openGuestAuthPrompt } = useGuestAuthPrompt();
  const { addToast } = useToast();
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: savedJobIds = new Set<string>() } = useJobRequestFavoriteIds(user?.id);
  const saved = savedJobIds.has(row.id);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    void supabase
      .from("job_confirmations")
      .select("job_id")
      .eq("freelancer_id", user.id)
      .eq("status", "available")
      .eq("job_id", row.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setAccepted(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, row.id]);

  const handleAccept = useCallback(async () => {
    if (!user?.id) {
      openGuestAuthPrompt({ variant: "engage" });
      return;
    }
    if (!canActAsHelper(profile)) {
      addToast({
        title: "Enable helper profile",
        description: "Turn on help mode to accept requests.",
        variant: "warning",
      });
      return;
    }
    setAccepting(true);
    try {
      await acceptOpenHelpRequest(row.id);
      setAccepted(true);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.discoverOpenHelpRequests(user.id),
      });
      addToast({
        title: "Accepted",
        description: `Waiting for ${(row.client_display_name || "the client").trim()}.`,
        variant: "success",
      });
    } catch (err: unknown) {
      addToast({
        title: "Failed to accept",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "error",
      });
    } finally {
      setAccepting(false);
    }
  }, [user?.id, profile, row, queryClient, addToast, openGuestAuthPrompt]);

  const handleToggleSave = useCallback(async () => {
    if (!user?.id) {
      openGuestAuthPrompt({ variant: "engage" });
      return;
    }
    setSaving(true);
    try {
      await toggleJobRequestFavorite(user.id, row.id, saved);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.jobRequestFavorites(user.id),
      });
      addToast({
        title: saved ? "Removed from saved" : "Request saved",
        variant: "success",
      });
    } catch (err: unknown) {
      addToast({
        title: "Could not save",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }, [user?.id, row.id, saved, queryClient, addToast, openGuestAuthPrompt]);

  return (
    <DiscoverOpenHelpRequestCard
      row={row}
      className={className}
      saved={saved}
      saveBusy={saving}
      onToggleSave={() => void handleToggleSave()}
      accepted={accepted}
      accepting={accepting}
      onAccept={() => void handleAccept()}
    />
  );
}
