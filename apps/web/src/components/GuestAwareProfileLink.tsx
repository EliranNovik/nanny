import type { MouseEvent, ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useGuestAuthPrompt } from "@/context/GuestAuthPromptContext";
import { cn } from "@/lib/utils";

type GuestAwareProfileLinkProps = {
  userId: string;
  children: ReactNode;
  className?: string;
  onClick?: (e: MouseEvent) => void;
  title?: string;
  "aria-label"?: string;
};

/** Profile link for signed-in users; join-community modal for guests. */
export function GuestAwareProfileLink({
  userId,
  children,
  className,
  onClick,
  title,
  "aria-label": ariaLabel,
}: GuestAwareProfileLinkProps) {
  const { user } = useAuth();
  const { openGuestAuthPrompt } = useGuestAuthPrompt();

  if (user) {
    return (
      <Link
        to={`/profile/${userId}`}
        className={className}
        onClick={onClick}
        title={title}
        aria-label={ariaLabel}
      >
        {children}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={cn("cursor-pointer", className)}
      title={title}
      aria-label={ariaLabel ?? "View profile"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        openGuestAuthPrompt({ variant: "profile" });
      }}
    >
      {children}
    </button>
  );
}
