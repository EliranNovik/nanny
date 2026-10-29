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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const REPORT_REASONS = [
  ["spam", "Spam or misleading"],
  ["harassment", "Harassment or bullying"],
  ["hate_speech", "Hate speech"],
  ["nudity", "Nudity or sexual content"],
  ["violence", "Violence or threats"],
  ["misinformation", "False information"],
  ["scam", "Scam or fraud"],
  ["copyright", "Copyright violation"],
  ["other", "Other"],
] as const;

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
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);

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

  const handleReport = async () => {
    if (!user?.id || !reportReason || reportSubmitting) return;
    setReportSubmitting(true);
    const { error } = await supabase.from("profile_post_reports").insert({
      job_request_id: row.id,
      reporter_id: user.id,
      reason: reportReason,
      details: reportDetails.trim() || null,
    });
    setReportSubmitting(false);
    if (error) {
      addToast({
        title: error.code === "23505" ? "Already reported" : "Report failed",
        description: error.code === "23505"
          ? "You have already reported this request."
          : error.message,
        variant: "error",
      });
      if (error.code === "23505") setReportOpen(false);
      return;
    }
    addToast({ title: "Report sent", description: "Thanks for helping keep Tebnu safe." });
    setReportOpen(false);
    setReportReason("");
    setReportDetails("");
  };

  return (
    <>
      <DiscoverOpenHelpRequestCard
        row={row}
        className={className}
        saved={saved}
        saveBusy={saving}
        onToggleSave={() => void handleToggleSave()}
        onReport={
          user?.id && user.id !== row.client_id
            ? () => setReportOpen(true)
            : undefined
        }
        accepted={accepted}
        accepting={accepting}
        onAccept={() => void handleAccept()}
      />
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Report request</DialogTitle>
            <DialogDescription>
              Tell us why this help request should be reviewed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              {REPORT_REASONS.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setReportReason(value)}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-left text-sm transition-colors",
                    reportReason === value
                      ? "border-orange-500 bg-orange-500/10 font-semibold text-orange-600 dark:text-orange-400"
                      : "border-border hover:bg-muted",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <Textarea
              value={reportDetails}
              onChange={(event) => setReportDetails(event.target.value)}
              placeholder="Additional details (optional)"
              className="min-h-20 resize-none"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setReportOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleReport()}
              disabled={!reportReason || reportSubmitting}
            >
              {reportSubmitting ? "Sending…" : "Submit report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
