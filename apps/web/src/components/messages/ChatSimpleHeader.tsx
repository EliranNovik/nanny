import { BadgeCheck } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { HeaderBackChevron } from "@/components/HeaderBackChevron";
import { LiveAvatarDot } from "@/components/discover/LiveAvatarDot";
import { cn } from "@/lib/utils";
import { chatChromeBarClass } from "@/lib/chatTheme";
import {
  ChatParticipantProfilePeek,
  type ChatParticipantProfile,
} from "@/components/messages/ChatParticipantProfilePeek";

export { chatChromeBarClass };

type ChatSimpleHeaderProps = {
  userId: string | null | undefined;
  displayName: string;
  initials: string;
  photoUrl?: string | null;
  preview?: {
    full_name: string | null;
    photo_url: string | null;
    city?: string | null;
  } | null;
  profile?: ChatParticipantProfile | null;
  isVerified?: boolean;
  isLive24h?: boolean;
  hasPostedRequest?: boolean;
  onBack?: () => void;
  showBackButton?: boolean;
  className?: string;
};

export function ChatSimpleHeader({
  userId,
  displayName,
  initials,
  photoUrl,
  preview,
  profile,
  isVerified = false,
  isLive24h = false,
  hasPostedRequest = false,
  onBack,
  showBackButton = false,
  className,
}: ChatSimpleHeaderProps) {
  const statusLine = isLive24h
    ? "Live now"
    : preview?.city?.trim() || "Active recently";

  return (
    <header
      className={cn(
        "z-40 flex shrink-0 items-center gap-3 px-4 py-3 sm:px-5",
        chatChromeBarClass,
        showBackButton &&
          "pt-[max(0.75rem,env(safe-area-inset-top,0px))] md:pt-3",
        !showBackButton && "pt-3",
        className,
      )}
    >
      {showBackButton && onBack ? (
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="h-10 w-10 shrink-0 rounded-full text-foreground hover:bg-muted/60 md:hidden dark:text-white dark:hover:bg-white/10"
        >
          <HeaderBackChevron />
        </Button>
      ) : null}

      <div className="flex min-w-0 flex-1 items-center justify-start gap-3">
        <div className="relative inline-flex shrink-0 rounded-full">
          {hasPostedRequest ? (
            <span
              className="inline-flex shrink-0 rounded-full bg-gradient-to-br from-violet-400 via-violet-600 to-violet-900 p-[2px] dark:from-violet-300 dark:via-violet-500 dark:to-violet-800"
              aria-hidden
            >
              <span className="inline-flex rounded-full bg-white p-[1.5px] dark:bg-[#14161d]">
                <ChatParticipantProfilePeek
                  userId={userId}
                  preview={preview ?? undefined}
                  profile={profile ?? undefined}
                  className="inline-flex shrink-0 rounded-full"
                >
                  <Avatar className="h-11 w-11 shadow-lg shadow-violet-500/15">
                    <AvatarImage
                      src={photoUrl || undefined}
                      className="object-cover"
                    />
                    <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </ChatParticipantProfilePeek>
              </span>
            </span>
          ) : (
            <ChatParticipantProfilePeek
              userId={userId}
              preview={preview ?? undefined}
              profile={profile ?? undefined}
              className="inline-flex shrink-0 rounded-full"
            >
              <Avatar className="h-11 w-11 ring-1 ring-white/10">
                <AvatarImage
                  src={photoUrl || undefined}
                  className="object-cover"
                />
                <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </ChatParticipantProfilePeek>
          )}
          {isLive24h ? <LiveAvatarDot /> : null}
        </div>

        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1.5">
            <h2 className="truncate text-lg font-bold leading-tight text-foreground dark:text-white sm:text-xl">
              {displayName}
            </h2>
            {isVerified ? (
              <BadgeCheck
                className="h-5 w-5 shrink-0 text-sky-400"
                aria-label="Verified"
              />
            ) : null}
          </div>
          <p className="truncate text-sm text-muted-foreground dark:text-slate-400">
            {statusLine}
          </p>
        </div>
      </div>
    </header>
  );
}
