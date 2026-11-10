import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

const TYPING_IDLE_MS = 1400;
const TYPING_EXPIRE_MS = 2800;
const TYPING_THROTTLE_MS = 700;
const TYPING_RETRY_MIN_MS = 1000;
const TYPING_RETRY_MAX_MS = 15000;

type TypingPayload = {
  userId?: string;
  typing?: boolean;
};

function typingChannelName(conversationId: string) {
  return `chat-typing:${conversationId}`;
}

/**
 * Live typing signal shared with the iOS and Android apps.
 * Broadcast on `chat-typing:<conversationId>`, not a database row.
 */
export function useChatTyping({
  conversationId,
  userId,
  enabled = true,
}: {
  conversationId?: string | null;
  userId?: string | null;
  enabled?: boolean;
}) {
  const [peerTyping, setPeerTyping] = useState(false);
  const [selfTyping, setSelfTyping] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const readyRef = useRef(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const peerExpireRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selfExpireRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSentAtRef = useRef(0);
  const localTypingRef = useRef(false);

  const clearTimer = (ref: { current: ReturnType<typeof setTimeout> | null }) => {
    if (ref.current) {
      clearTimeout(ref.current);
      ref.current = null;
    }
  };

  const markTyping = useCallback(
    (kind: "peer" | "self", typing: boolean) => {
      const expireRef = kind === "peer" ? peerExpireRef : selfExpireRef;
      const setTypingState = kind === "peer" ? setPeerTyping : setSelfTyping;
      clearTimer(expireRef);
      if (!typing) {
        setTypingState(false);
        return;
      }
      setTypingState(true);
      expireRef.current = setTimeout(() => {
        setTypingState(false);
      }, TYPING_EXPIRE_MS);
    },
    [],
  );

  const sendTyping = useCallback(
    async (typing: boolean) => {
      const channel = channelRef.current;
      if (!channel || !readyRef.current || !userId) return;
      try {
        await channel.send({
          type: "broadcast",
          event: "typing",
          payload: { userId, typing } satisfies TypingPayload,
        });
      } catch (err) {
        console.warn("[useChatTyping] send failed", err);
      }
    },
    [userId],
  );

  const setTyping = useCallback(
    (typing: boolean) => {
      clearTimer(idleTimerRef);
      if (!typing) {
        if (localTypingRef.current) {
          localTypingRef.current = false;
          void sendTyping(false);
        }
        return;
      }
      const now = Date.now();
      const shouldPulse =
        !localTypingRef.current || now - lastSentAtRef.current >= TYPING_THROTTLE_MS;
      localTypingRef.current = true;
      if (shouldPulse) {
        lastSentAtRef.current = now;
        void sendTyping(true);
      }
      idleTimerRef.current = setTimeout(() => {
        localTypingRef.current = false;
        void sendTyping(false);
      }, TYPING_IDLE_MS);
    },
    [sendTyping],
  );

  useEffect(() => {
    if (!enabled || !userId || !conversationId) return;

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryDelay = TYPING_RETRY_MIN_MS;
    readyRef.current = false;
    setPeerTyping(false);
    setSelfTyping(false);

    const name = typingChannelName(conversationId);

    const open = async () => {
      // The topic is shared with the apps, so a leaving channel with the same name must be gone first.
      const leftovers = supabase
        .getChannels()
        .filter((c) => c.topic === `realtime:${name}`);
      await Promise.all(leftovers.map((c) => supabase.removeChannel(c)));
      if (cancelled) return;

      const channel = supabase.channel(name, {
        config: { broadcast: { self: false } },
      });
      channelRef.current = channel;

      channel.on("broadcast", { event: "typing" }, ({ payload }) => {
        const data = (payload ?? {}) as TypingPayload;
        if (!data.userId) return;
        markTyping(data.userId === userId ? "self" : "peer", Boolean(data.typing));
      });

      channel.subscribe((status) => {
        if (cancelled || channelRef.current !== channel) return;
        readyRef.current = status === "SUBSCRIBED";
        if (status === "SUBSCRIBED") {
          retryDelay = TYPING_RETRY_MIN_MS;
          return;
        }
        if (
          (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") &&
          !retryTimer
        ) {
          const delay = retryDelay;
          retryDelay = Math.min(delay * 2, TYPING_RETRY_MAX_MS);
          retryTimer = setTimeout(() => {
            retryTimer = null;
            if (cancelled) return;
            channelRef.current = null;
            void open();
          }, delay);
        }
      });
    };

    void open();

    return () => {
      cancelled = true;
      readyRef.current = false;
      if (retryTimer) clearTimeout(retryTimer);
      clearTimer(idleTimerRef);
      clearTimer(peerExpireRef);
      clearTimer(selfExpireRef);
      const channel = channelRef.current;
      channelRef.current = null;
      if (!channel) return;
      if (localTypingRef.current) {
        localTypingRef.current = false;
        void channel.send({
          type: "broadcast",
          event: "typing",
          payload: { userId, typing: false } satisfies TypingPayload,
        });
      }
      void supabase.removeChannel(channel);
    };
  }, [conversationId, enabled, markTyping, userId]);

  const clearPeerTyping = useCallback(() => markTyping("peer", false), [markTyping]);

  return { peerTyping, selfTyping, setTyping, clearPeerTyping };
}
