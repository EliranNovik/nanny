import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabaseAdmin } from "../../supabase";

/**
 * Same channel the iOS and Android apps already listen to
 * (`chat-typing:<conversationId>`, event `typing`).
 * Those apps hide the animation after ~2.8s unless a fresh pulse arrives.
 *
 * Delivered with the realtime HTTP broadcast so every pulse reaches the phone.
 * A websocket push on a reused channel was only arriving the first time.
 */
const PULSE_MS = 1000;

const channels = new Map<string, RealtimeChannel>();
const pulses = new Map<string, ReturnType<typeof setInterval>>();
const session = new Map<string, number>();

function channelName(conversationId: string) {
  return `chat-typing:${conversationId}`;
}

function channelFor(conversationId: string): RealtimeChannel {
  const existing = channels.get(conversationId);
  if (existing) return existing;
  const channel = supabaseAdmin.channel(channelName(conversationId), {
    config: { broadcast: { self: false } },
  });
  channels.set(conversationId, channel);
  return channel;
}

async function publish(conversationId: string, adminId: string, typing: boolean) {
  const channel = channelFor(conversationId);
  try {
    const result = await channel.httpSend("typing", { userId: adminId, typing });
    if (!result.success) {
      throw new Error("typing broadcast rejected");
    }
  } catch (err) {
    channels.delete(conversationId);
    void supabaseAdmin.removeChannel(channel);
    throw err;
  }
}

function sendTyping(conversationId: string, adminId: string, typing: boolean) {
  void publish(conversationId, adminId, typing).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : "typing pulse failed";
    console.warn("[SupportBot] Typing signal failed:", message);
  });
}

/** Keep the other person's typing animation on until the reply is sent. */
export function beginSupportTyping(conversationId: string, adminId: string): boolean {
  const started = !pulses.has(conversationId);
  if (started) {
    const token = (session.get(conversationId) ?? 0) + 1;
    session.set(conversationId, token);
    const pulse = () => {
      if ((session.get(conversationId) ?? 0) !== token) return;
      sendTyping(conversationId, adminId, true);
    };
    pulses.set(conversationId, setInterval(pulse, PULSE_MS));
  }
  sendTyping(conversationId, adminId, true);
  return started;
}

/** Stop this server's pulse without telling the chat typing ended; another server owns the reply. */
export function dropSupportTyping(conversationId: string): void {
  const timer = pulses.get(conversationId);
  if (!timer) return;
  clearInterval(timer);
  pulses.delete(conversationId);
}

export async function endSupportTyping(
  conversationId: string,
  adminId: string,
): Promise<void> {
  const ending = session.get(conversationId) ?? 0;
  const timer = pulses.get(conversationId);
  if (timer) {
    clearInterval(timer);
    pulses.delete(conversationId);
  }
  try {
    await publish(conversationId, adminId, false);
  } catch (err) {
    const message = err instanceof Error ? err.message : "typing stop failed";
    console.warn("[SupportBot] Typing stop failed:", message);
  }
  if ((session.get(conversationId) ?? 0) !== ending) {
    try {
      await publish(conversationId, adminId, true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "typing pulse failed";
      console.warn("[SupportBot] Typing signal failed:", message);
    }
  }
}
