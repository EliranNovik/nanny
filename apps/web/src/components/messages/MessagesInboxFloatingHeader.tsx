import { Bell, MessageCircle, PenLine, X } from "lucide-react";
import { cn } from "@/lib/utils";

const SEGMENT_PILL_WIDTH = 122;

type MessagesInboxFloatingHeaderProps = {
  section: "messages" | "news";
  onSectionChange: (section: "messages" | "news") => void;
  messagesUnread: number;
  notificationsCount: number;
  composeOpen: boolean;
  onToggleCompose: () => void;
};

function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute right-1 top-[3px] flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-[1.5px] border-slate-900/10 bg-orange-600 px-1 text-[9px] font-extrabold leading-none text-white dark:border-black/50">
      {count > 9 ? "9+" : count}
    </span>
  );
}

export function MessagesInboxFloatingHeader({
  section,
  onSectionChange,
  messagesUnread,
  notificationsCount,
  composeOpen,
  onToggleCompose,
}: MessagesInboxFloatingHeaderProps) {
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-20 md:hidden">
      <div
        className="pointer-events-auto flex items-center gap-3 px-4 pb-5 pt-[max(0.5rem,env(safe-area-inset-top,0px))]"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 8px)" }}
      >
        <div
          className={cn(
            "flex h-[52px] shrink-0 items-center rounded-[26px] border border-white/20",
            "bg-white/72 shadow-sm backdrop-blur-[20px] dark:border-white/10 dark:bg-zinc-900/72",
          )}
          style={{ width: SEGMENT_PILL_WIDTH }}
          role="tablist"
          aria-label="Inbox sections"
        >
          <button
            type="button"
            role="tab"
            aria-selected={section === "messages"}
            aria-label={
              messagesUnread > 0
                ? `Messages, ${messagesUnread} unread`
                : "Messages"
            }
            onClick={() => onSectionChange("messages")}
            className={cn(
              "relative flex h-[42px] w-[52px] items-center justify-center rounded-[21px] border-0 bg-transparent transition-colors",
              section === "messages" &&
                "bg-slate-900/[0.08] dark:bg-white/[0.14]",
            )}
          >
            <MessageCircle
              className={cn(
                "h-5 w-5",
                section === "messages"
                  ? "fill-current text-slate-900 dark:text-white"
                  : "text-slate-900/55 dark:text-white/55",
              )}
              strokeWidth={section === "messages" ? 0 : 2}
              aria-hidden
            />
            <CountBadge count={messagesUnread} />
          </button>
          <div
            className="h-[26px] w-px shrink-0 bg-slate-900/[0.08] dark:bg-white/[0.14]"
            aria-hidden
          />
          <button
            type="button"
            role="tab"
            aria-selected={section === "news"}
            aria-label={
              notificationsCount > 0
                ? `Notifications, ${notificationsCount} items`
                : "Notifications"
            }
            onClick={() => onSectionChange("news")}
            className={cn(
              "relative flex h-[42px] w-[52px] items-center justify-center rounded-[21px] border-0 bg-transparent transition-colors",
              section === "news" && "bg-slate-900/[0.08] dark:bg-white/[0.14]",
            )}
          >
            <Bell
              className={cn(
                "h-5 w-5",
                section === "news"
                  ? "fill-current text-slate-900 dark:text-white"
                  : "text-slate-900/55 dark:text-white/55",
              )}
              strokeWidth={section === "news" ? 0 : 2}
              aria-hidden
            />
            <CountBadge count={notificationsCount} />
          </button>
        </div>

        <div className="min-w-0 flex-1" aria-hidden />

        {section === "messages" ? (
          <div
            className={cn(
              "flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[26px] border border-white/20",
              "bg-white/72 shadow-sm backdrop-blur-[20px] dark:border-white/10 dark:bg-zinc-900/72",
            )}
          >
            <button
              type="button"
              onClick={onToggleCompose}
              className="flex h-full w-full items-center justify-center rounded-[26px] text-slate-900 transition-opacity active:opacity-70 dark:text-white"
              aria-label={composeOpen ? "Close new message" : "New message"}
            >
              {composeOpen ? (
                <X className="h-5 w-5" strokeWidth={2.25} aria-hidden />
              ) : (
                <PenLine className="h-5 w-5" strokeWidth={2.25} aria-hidden />
              )}
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}

export const MESSAGES_INBOX_TITLE_INSET_PX = SEGMENT_PILL_WIDTH + 12;
