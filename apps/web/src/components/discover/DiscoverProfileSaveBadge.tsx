import { useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Bookmark, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { supabase } from "@/lib/supabase";
import { queryKeys } from "@/hooks/data/keys";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";

export type DiscoverProfileSaveAccent = "hire" | "work";

type Props = {
  targetUserId: string;
  accent: DiscoverProfileSaveAccent;
  viewerUserId: string | null | undefined;
  favoriteUserIds: ReadonlySet<string>;
  /** Analytics event name; default matches discover strip. */
  analyticsEvent?: string;
};

/** Save to Saved (`profile_favorites`); bottom-right on avatar. Hidden when already saved or self. */
export function DiscoverProfileSaveBadge({
  targetUserId,
  accent,
  viewerUserId,
  favoriteUserIds,
  analyticsEvent = "discover_strip_save_profile",
}: Props) {
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const trimmed = targetUserId.trim();
  if (!trimmed) return null;
  if (viewerUserId && trimmed === viewerUserId) return null;
  if (favoriteUserIds.has(trimmed)) return null;

  const accentIdle =
    accent === "hire"
      ? "text-violet-600 dark:text-violet-300"
      : "text-emerald-700 dark:text-emerald-300";

  async function onSave(e: ReactMouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (!viewerUserId) {
      addToast({ title: "Sign in to save profiles", variant: "warning" });
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("profile_favorites").insert({
        user_id: viewerUserId,
        favorite_user_id: trimmed,
      });
      if (error) {
        const code = (error as { code?: string }).code;
        if (code === "23505") {
          await queryClient.invalidateQueries({
            queryKey: queryKeys.profileFavorites(viewerUserId),
          });
          addToast({ title: "Already in Saved", variant: "success" });
          return;
        }
        throw error;
      }
      await queryClient.invalidateQueries({
        queryKey: queryKeys.profileFavorites(viewerUserId),
      });
      addToast({ title: "Saved — view under Saved", variant: "success" });
      trackEvent(analyticsEvent, { accent, target_user_id: trimmed });
    } catch (err) {
      console.error("[DiscoverProfileSaveBadge]", err);
      addToast({ title: "Could not save", variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={(e) => void onSave(e)}
      disabled={busy}
      className={cn(
        "absolute -bottom-0.5 -right-0.5 z-[6] flex h-8 w-8 items-center justify-center rounded-full",
        "border border-white/90 bg-white/95 shadow-[0_2px_10px_rgba(0,0,0,0.14)] backdrop-blur-md transition-all",
        "hover:-translate-y-px hover:shadow-[0_5px_16px_rgba(0,0,0,0.18)] active:scale-95",
        "dark:border-zinc-600 dark:bg-zinc-900/95 dark:shadow-black/40",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        accent === "hire"
          ? "focus-visible:ring-violet-500/55"
          : "focus-visible:ring-emerald-500/55",
        accentIdle,
        busy && "pointer-events-none opacity-75",
      )}
      title="Save to Saved"
      aria-label="Save profile to Saved"
    >
      {busy ? (
        <Loader2 className="h-[1.125rem] w-[1.125rem] shrink-0 animate-spin opacity-80" strokeWidth={2.25} aria-hidden />
      ) : (
        <Bookmark className="h-[1.125rem] w-[1.125rem] shrink-0" strokeWidth={2.4} aria-hidden />
      )}
    </button>
  );
}
