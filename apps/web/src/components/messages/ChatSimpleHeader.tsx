import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
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
  isAdmin?: boolean;
  onBack?: () => void;
  showBackButton?: boolean;
  /** Right side of the bar, e.g. the admin AI switch. */
  trailing?: ReactNode;
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
  isAdmin = false,
  onBack,
  showBackButton = false,
  trailing,
  className,
}: ChatSimpleHeaderProps) {
  const { t } = useTranslation();
  const statusLine = isAdmin ? "" : isLive24h ? "Online" : "Busy";

  return (
    <header
      className={cn(
        "z-40 flex shrink-0 items-center gap-2.5 px-3 py-1.5 sm:px-4",
        chatChromeBarClass,
        showBackButton &&
          "pt-[max(0.375rem,env(safe-area-inset-top,0px))]",
        className,
      )}
    >
      {showBackButton && onBack ? (
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="h-8 w-8 shrink-0 rounded-full text-foreground hover:bg-muted/60 dark:text-white dark:hover:bg-white/10"
        >
          <HeaderBackChevron />
        </Button>
      ) : null}

      <div className="flex min-w-0 flex-1 items-center justify-start gap-2.5">
        <div className="relative inline-flex shrink-0 rounded-full">
          {isAdmin ? (
            <Avatar className="h-9 w-9 bg-white shadow-sm ring-1 ring-slate-200">
              <AvatarImage
                src={photoUrl || undefined}
                className="scale-[1.65] object-contain"
              />
              <AvatarFallback>TB</AvatarFallback>
            </Avatar>
          ) : hasPostedRequest ? (
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
                  <Avatar className="h-8 w-8 shadow-lg shadow-violet-500/15">
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
              <Avatar className="h-9 w-9">
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
          {!isAdmin && isLive24h ? (
            <LiveAvatarDot />
          ) : !isAdmin ? (
            <span
              className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-orange-500 shadow-sm dark:border-[#14161d]"
              aria-label="Busy"
            />
          ) : null}
        </div>

        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1.5">
            <h2 className="truncate text-[15px] font-bold leading-tight text-foreground dark:text-white">
              {displayName}
            </h2>
            {isVerified ? (
              <BadgeCheck
                className="h-4 w-4 shrink-0 fill-sky-500 text-white dark:fill-sky-400"
                aria-label={t("messagesPage.verified")}
              />
            ) : null}
          </div>
          {statusLine ? (
            <p className="truncate text-[12px] leading-tight text-muted-foreground dark:text-slate-400">
              {statusLine}
            </p>
          ) : null}
        </div>
      </div>
      {trailing}
    </header>
  );
}
