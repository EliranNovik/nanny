import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export function AdminMemberLink({
  userId,
  children,
  className,
}: {
  userId?: string | null;
  children: ReactNode;
  className?: string;
}) {
  if (!userId) return <>{children}</>;
  return (
    <Link
      to={`/admin/members/${userId}`}
      onClick={(event) => event.stopPropagation()}
      className={cn(
        "underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-900 dark:hover:decoration-zinc-100",
        className,
      )}
    >
      {children}
    </Link>
  );
}
