import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Loader2, MessageSquarePlus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { apiPost } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/toast";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

/** Invisible mark the support bot puts at the start of its own messages. */
const AI_SENT_MARK = "\u200b\u200b\u200b";
const AI_PAUSE_IDLE_MS = 24 * 60 * 60 * 1000;
const REFRESH_MS = 60_000;

type SupportAiToggleProps = {
  conversationId: string;
  className?: string;
};

/** Admin-only switch in a support chat header: turn the support bot off to answer by hand. */
export function SupportAiToggle({ conversationId, className }: SupportAiToggleProps) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [aiOn, setAiOn] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [followingUp, setFollowingUp] = useState(false);
  const ignorePauseUntil = useRef(0);

  const load = useCallback(async () => {
    const [thread, last] = await Promise.all([
      supabase
        .from("support_bot_threads")
        .select("ai_paused_at")
        .eq("conversation_id", conversationId)
        .maybeSingle(),
      supabase
        .from("messages")
        .select("created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (thread.error) {
      setAiOn(true);
      return;
    }
    const pausedAt = thread.data?.ai_paused_at as string | null | undefined;
    if (!pausedAt) {
      setAiOn(true);
      return;
    }
    const lastActivity = Math.max(
      Date.parse(pausedAt),
      last.data?.created_at ? Date.parse(last.data.created_at as string) : 0,
    );
    setAiOn(Date.now() - lastActivity >= AI_PAUSE_IDLE_MS);
  }, [conversationId]);

  useEffect(() => {
    setAiOn(null);
    void load();
    const timer = window.setInterval(() => void load(), REFRESH_MS);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);

    // An admin typing by hand switches the bot off straight away. The bot's own
    // replies carry an invisible mark, so those leave the switch alone.
    const channel = supabase
      .channel(`support-ai-pause-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new as { sender_id?: string; body?: string | null };
          if (!user?.id || row.sender_id !== user.id) return;
          if (Date.now() < ignorePauseUntil.current) return;
          // No body in the event, or the invisible bot mark, is not a message typed by hand.
          if (typeof row.body !== "string") return;
          if (row.body.includes(AI_SENT_MARK) || row.body.includes("\u2060")) return;
          setAiOn(false);
          void supabase.rpc("set_support_bot_ai_paused", {
            p_conversation_id: conversationId,
            p_paused: true,
          });
        },
      )
      .subscribe();

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      void supabase.removeChannel(channel);
    };
  }, [load, conversationId, user?.id]);

  const change = async (next: boolean) => {
    if (saving) return;
    const previous = aiOn;
    setAiOn(next);
    setSaving(true);
    const { error } = await supabase.rpc("set_support_bot_ai_paused", {
      p_conversation_id: conversationId,
      p_paused: !next,
    });
    setSaving(false);
    if (error) {
      setAiOn(previous);
      addToast({
        title: "Could not change the AI",
        description:
          error.code === "42703" ||
          error.code === "PGRST204" ||
          error.code === "PGRST202"
            ? "Run db/sql/158_support_bot_ai_pause.sql in Supabase first."
            : error.message,
        variant: "error",
      });
      return;
    }
    addToast({
      title: next ? "AI is on in this chat" : "AI is off in this chat",
      description: next
        ? "The support bot answers new messages again."
        : "You can answer by hand. The AI turns back on after 1 day without messages.",
      variant: "success",
    });
  };

  const followUp = async () => {
    if (followingUp) return;
    setFollowingUp(true);
    ignorePauseUntil.current = Date.now() + 15_000;
    try {
      await apiPost("/api/admin/support/follow-up", { conversationId });
      setAiOn(true);
      addToast({
        title: "The bot is following up",
        description: "It will continue from the person's latest message.",
        variant: "success",
      });
    } catch (err) {
      addToast({
        title: "Could not follow up",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "error",
      });
    } finally {
      setFollowingUp(false);
    }
  };

  const on = aiOn !== false;
  return (
    <div className={cn("flex shrink-0 items-center gap-1", className)}>
      <label
        className={cn(
          "flex cursor-pointer items-center gap-1 rounded-full py-1 pe-1 ps-2 transition-colors",
          on ? "text-orange-500" : "text-zinc-500 dark:text-zinc-400",
          (aiOn === null || saving) && "opacity-60",
        )}
        title={
          on
            ? "AI is on. Switch off to answer by hand."
            : "AI is off. It turns back on after 1 day without messages."
        }
      >
        <Bot className="h-7 w-7" strokeWidth={2.25} aria-hidden />
        <Switch
          checked={on}
          disabled={aiOn === null || saving}
          onCheckedChange={(value) => void change(value)}
          aria-label={on ? "Turn AI off in this chat" : "Turn AI on in this chat"}
        />
      </label>
      <button
        type="button"
        onClick={() => void followUp()}
        disabled={followingUp}
        title="Have the bot follow up on their latest message"
        aria-label="Have the bot follow up on their latest message"
        className="flex h-9 items-center gap-1 rounded-full px-2 text-xs font-semibold text-orange-500 transition-colors hover:bg-orange-500/10 disabled:opacity-60"
      >
        {followingUp ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <MessageSquarePlus className="h-4 w-4" strokeWidth={2.25} aria-hidden />
        )}
        Follow up
      </button>
    </div>
  );
}
