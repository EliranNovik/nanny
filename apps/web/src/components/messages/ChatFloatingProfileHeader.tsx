import { BadgeCheck } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LiveAvatarDot } from "@/components/discover/LiveAvatarDot";
import { cn } from "@/lib/utils";
import { glassBadgeClass } from "@/lib/glassBadge";
import {
  ChatParticipantProfilePeek,
  type ChatParticipantProfile,
} from "@/components/messages/ChatParticipantProfilePeek";

type ChatFloatingProfileHeaderProps = {
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
  className?: string;
  nameClassName?: string;
  isVerified?: boolean;
  isLive24h?: boolean;
  hasPostedRequest?: boolean;
  onNameClick?: () => void;
};

export function ChatFloatingProfileHeader({
  userId,
  displayName,
  initials,
  photoUrl,
  preview,
  profile,
  className,
  nameClassName,
  isVerified = false,
  isLive24h = false,
  hasPostedRequest = false,
  onNameClick,
}: ChatFloatingProfileHeaderProps) {
  return (
    <div
      className={cn(
        "pointer-events-auto relative flex w-fit max-w-[min(100%,16rem)] flex-col items-center",
        className,
      )}
    >
      <div className="relative z-10 -mb-[1.625rem]">
        <div className="relative inline-flex shrink-0 rounded-full">
          {hasPostedRequest ? (
            <span className="inline-flex shrink-0 rounded-full bg-gradient-to-br from-violet-400 via-violet-600 to-violet-900 p-[2.5px] shadow-[0_0_12px_rgba(124,58,237,0.35)] dark:from-violet-300 dark:via-violet-500 dark:to-violet-800">
              <span className="inline-flex rounded-full bg-background p-[2px]">
                <ChatParticipantProfilePeek
                  userId={userId}
                  preview={preview ?? undefined}
                  profile={profile ?? undefined}
                  className="inline-flex shrink-0 rounded-full"
                >
                  <Avatar className="h-14 w-14 shadow-md">
                    <AvatarImage
                      src={photoUrl || undefined}
                      className="object-cover"
                    />
                    <AvatarFallback className="bg-primary/10 text-base font-semibold text-primary">
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
              <Avatar className="h-14 w-14 shadow-md">
                <AvatarImage
                  src={photoUrl || undefined}
                  className="object-cover"
                />
                <AvatarFallback className="bg-primary/10 text-base font-semibold text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </ChatParticipantProfilePeek>
          )}
          {isLive24h ? <LiveAvatarDot /> : null}
        </div>
      </div>
      <div
        className={cn(
          "w-fit min-w-[8.5rem] max-w-full rounded-full px-7 pb-1 pt-[1.625rem] text-center",
          glassBadgeClass,
        )}
      >
        <div className="flex items-center justify-center gap-1">
          <h2
            className={cn(
              "truncate text-lg font-semibold leading-none text-foreground md:text-xl",
              onNameClick && "cursor-pointer",
              nameClassName,
            )}
            onClick={onNameClick}
            onKeyDown={
              onNameClick
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onNameClick();
                    }
                  }
                : undefined
            }
            role={onNameClick ? "button" : undefined}
            tabIndex={onNameClick ? 0 : undefined}
          >
            {displayName}
          </h2>
          {isVerified ? (
            <BadgeCheck
              className="h-[1.125rem] w-[1.125rem] shrink-0 text-sky-500"
              aria-label="Verified"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
