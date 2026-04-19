import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

type Variant = "default" | "fullBleed";

export type PageFrameProps = HTMLAttributes<HTMLDivElement> & {
  variant?: Variant;
  /** e.g. data-unified-jobs-page for shell :has() rules */
  frameName?: string;
};

/**
 * Root wrapper for authenticated pages. Pair with `app-desktop-shell` for horizontal padding.
 * Max **two** fixed layers below BottomNav: (1) mode/context (2) tabs/filters — see README.
 */
export function PageFrame({
  className,
  variant = "default",
  frameName,
  children,
  ...rest
}: PageFrameProps) {
  return (
    <div
      data-page-frame={frameName}
      className={cn(
        variant === "default" &&
          "min-h-screen bg-slate-50/50 pb-6 dark:bg-background md:pb-8",
        variant === "fullBleed" && "min-h-screen bg-background",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
