import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BellRing, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/toast";
import { sendKnockMessage } from "@/lib/knockMessage";
import {
  isServiceCategoryId,
  serviceCategoryLabel,
  type ServiceCategoryId,
} from "@/lib/serviceCategories";
import { cn } from "@/lib/utils";

function labelForCategoryId(id: string): string {
  if (isServiceCategoryId(id))
    return serviceCategoryLabel(id as ServiceCategoryId);
  return id.replace(/_/g, " ");
}

type ProfileKnockMenuProps = {
  targetUserId: string;
  targetRole: string | null;
  categories: string[];
  viewerId: string | null;
  viewerRole: string | null;
  viewerName: string | null;
  disabled?: boolean;
  className?: string;
  /** hero = cover image; inline = compact; contact = same size as public profile chat/WA/TG row; glass = frosted black pill (e.g. Find helpers cards) */
  variant?: "hero" | "inline" | "contact" | "glass";
  /** When `up`, menu opens above the button (avoids overflow clip at bottom of cards). */
  dropdownOpens?: "up" | "down";
  /** Merged onto the toggle button — use for tinted glass helpers cards, etc. */
  buttonClassName?: string;
};

export function ProfileKnockMenu({
  targetUserId,
  targetRole,
  categories,
  viewerId,
  viewerRole,
  viewerName,
  disabled = false,
  className,
  variant = "inline",
  dropdownOpens = "down",
  buttonClassName,
}: ProfileKnockMenuProps) {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (!viewerId || !categories.length || disabled) return null;

  async function onPickCategory(categoryId: string) {
    if (!viewerId || sending) return;
    setSending(true);
    try {
      const result = await sendKnockMessage({
        supabase,
        currentUserId: viewerId,
        currentProfileRole: viewerRole,
        currentProfileName: viewerName,
        targetUserId,
        targetRole,
        categoryId,
      });

      if (!result.ok) {
        if (result.code === "no_role") {
          addToast({
            title: "Please wait",
            description:
              "Your profile is still loading. Try again in a moment.",
            variant: "default",
          });
        } else {
          addToast({
            title: "Could not send",
            description: result.message ?? "Try again.",
            variant: "error",
          });
        }
        return;
      }

      setOpen(false);
      addToast({
        title: "Message sent",
        description: "They’ll see your knock in your chat.",
        variant: "success",
      });
      navigate(`/messages?conversation=${result.conversationId}`);
    } finally {
      setSending(false);
    }
  }

  const btnHero =
    variant === "hero"
      ? "h-14 w-14 rounded-full border-2 border-white/90 bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg dark:border-zinc-900"
      : variant === "contact"
        ? "h-12 w-12 shrink-0 rounded-full border border-amber-500/40 bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/25 transition-all hover:scale-105 active:scale-95 md:h-11 md:w-11"
        : variant === "glass"
          ? "h-12 w-12 shrink-0 rounded-full bg-black/30 text-white shadow-lg backdrop-blur-2xl transition-colors hover:bg-black/40"
          : "h-12 w-12 rounded-full border border-amber-500/40 bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md";

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        title="Knock — send a quick request"
        aria-label="Knock — choose a category"
        aria-expanded={open}
        disabled={sending}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center justify-center transition hover:opacity-95 active:scale-[0.98] disabled:opacity-60",
          btnHero,
          buttonClassName,
        )}
      >
        {sending ? (
          <Loader2
            className={
              variant === "hero"
                ? "h-6 w-6 animate-spin"
                : "h-6 w-6 animate-spin"
            }
            aria-hidden
          />
        ) : (
          <BellRing
            className={
              variant === "hero"
                ? "h-7 w-7"
                : variant === "contact" || variant === "glass"
                  ? "h-6 w-6"
                  : "h-6 w-6"
            }
            strokeWidth={2}
            aria-hidden
          />
        )}
      </button>

      {open && !sending && (
        <div
          className={cn(
            "absolute right-0 z-[80] min-w-[12rem] overflow-hidden rounded-2xl border border-border/80 bg-card py-1.5 text-left shadow-xl",
            dropdownOpens === "up"
              ? "bottom-[calc(100%+0.35rem)] top-auto"
              : "top-[calc(100%+0.35rem)]",
          )}
          role="menu"
        >
          <p className="text-center px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Knock
          </p>
          <div className="max-h-64 overflow-y-auto px-1">
            {categories.map((id) => (
              <button
                key={id}
                type="button"
                role="menuitem"
                className="flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-foreground transition hover:bg-muted"
                onClick={() => void onPickCategory(id)}
              >
                {labelForCategoryId(id)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
