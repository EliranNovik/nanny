/**
 * Resolves custom Tebnu push sound + Android notification channel from queue row
 * `data` (populated by SQL 147_push_notification_sounds.sql), with type-based fallbacks.
 *
 * Bundled mobile assets: `tebnu_request.mp3`, `tebnu_notify.mp3`
 * Android channels: `tebnu_requests` | `tebnu_messages_v2` | `tebnu_general`
 */

export type PushAudio = {
  sound: string;
  androidChannelId: string;
};

function nonEmpty(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export function resolvePushAudio(
  data?: Record<string, string> | Record<string, unknown> | null,
): PushAudio {
  const soundFromData = nonEmpty(data?.sound);
  const channelFromData = nonEmpty(data?.android_channel_id);
  const type =
    nonEmpty(data?.notification_type) ?? nonEmpty(data?.type) ?? "";

  const isRequest = type === "new_request" || type === "new_match";
  const isMessage = type === "message";

  const sound =
    soundFromData ??
    (isRequest ? "tebnu_request.mp3" : "tebnu_notify.mp3");

  const androidChannelId =
    channelFromData ??
    (isRequest
      ? "tebnu_requests"
      : isMessage
        ? "tebnu_messages_v2"
        : "tebnu_general");

  return { sound, androidChannelId };
}
