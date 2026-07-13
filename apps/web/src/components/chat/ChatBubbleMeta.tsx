import { Check, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export type ChatReadReceiptStatus = "sent" | "delivered" | "read";

export function getChatReadReceiptStatus(msg: {
  read_at: string | null;
  read_by?: string | null;
}): ChatReadReceiptStatus {
  if (!msg.read_at) return "sent";
  if (msg.read_by) return "read";
  return "delivered";
}

type ChatBubbleMetaProps = {
  timeLabel: string;
  isOwn: boolean;
  receiptStatus?: ChatReadReceiptStatus | null;
  /** Overlay on dark media (image/video). */
  variant?: "bubble" | "media";
  className?: string;
};

export function ChatBubbleMeta({
  timeLabel,
  isOwn,
  receiptStatus = null,
  variant = "bubble",
  className,
}: ChatBubbleMetaProps) {
  const isMedia = variant === "media";
  const onSentBubble = !isMedia && isOwn;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 select-none",
        "text-[11px] font-medium leading-none tabular-nums",
        isMedia
          ? "text-white/95 drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)]"
          : onSentBubble
            ? "text-white/80"
            : "text-muted-foreground/90",
        className,
      )}
    >
      <time dateTime={timeLabel}>{timeLabel}</time>
      {isOwn && receiptStatus ? (
        <ChatReadReceiptIcon status={receiptStatus} onSentBubble={onSentBubble || isMedia} />
      ) : null}
    </span>
  );
}

function ChatReadReceiptIcon({
  status,
  onSentBubble,
}: {
  status: ChatReadReceiptStatus;
  onSentBubble: boolean;
}) {
  const base = "h-4 w-4 shrink-0 -me-0.5";
  if (status === "sent") {
    return (
      <Check
        className={cn(
          base,
          onSentBubble ? "text-white/75" : "text-muted-foreground/70",
        )}
        strokeWidth={2.5}
        aria-label="Sent"
      />
    );
  }
  if (status === "delivered") {
    return (
      <CheckCheck
        className={cn(
          base,
          onSentBubble ? "text-white/75" : "text-muted-foreground/70",
        )}
        strokeWidth={2.5}
        aria-label="Delivered"
      />
    );
  }
  return (
    <CheckCheck
      className={cn(base, onSentBubble ? "text-sky-200" : "text-sky-500")}
      strokeWidth={2.5}
      aria-label="Read"
    />
  );
}

/** Floats meta to the bottom-right of bubble content like WhatsApp. */
export const chatBubbleMetaFloatCn =
  "float-end clear-none ms-2 mt-1 inline-flex items-end";
