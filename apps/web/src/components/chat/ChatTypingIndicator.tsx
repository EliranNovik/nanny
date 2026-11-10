import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { chatReceivedBubbleCn, chatSentBubbleCn } from "@/lib/chatTheme";

const EXIT_MS = 180;

function TypingDots({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex h-4 items-center gap-1", className)} aria-hidden>
      {[0, 160, 320].map((delay) => (
        <span
          key={delay}
          className="h-2 w-2 rounded-full bg-current motion-safe:animate-typing-dot-wave"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  );
}

export function ChatTypingIndicator({
  own,
  label,
  visible = true,
  className,
  children,
}: {
  own: boolean;
  label: string;
  /** When it turns false the bubble shrinks out before unmounting. */
  visible?: boolean;
  className?: string;
  /** Rendered beside the bubble, e.g. an avatar. */
  children?: ReactNode;
}) {
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      return;
    }
    const timer = setTimeout(() => setMounted(false), EXIT_MS);
    return () => clearTimeout(timer);
  }, [visible]);

  if (!mounted) return null;

  return (
    <div
      className={cn(
        own ? "origin-bottom-right" : "origin-bottom-left",
        visible
          ? "motion-safe:animate-typing-bubble-in"
          : "motion-safe:animate-typing-bubble-out",
        className,
      )}
      role="status"
      aria-label={label}
    >
      <div
        className={cn(
          own ? chatSentBubbleCn : chatReceivedBubbleCn,
          own ? "origin-bottom-right" : "origin-bottom-left",
          "flex min-w-[3.6rem] items-center justify-center px-4 py-3",
          visible && "motion-safe:animate-typing-bubble-breathe",
        )}
      >
        <TypingDots className={own ? "text-white" : "text-zinc-500 dark:text-zinc-300"} />
      </div>
      {children}
    </div>
  );
}
