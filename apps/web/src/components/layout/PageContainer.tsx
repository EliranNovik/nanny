import React from "react";
import { cn } from "@/lib/utils";

interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /** Whether the container should constrain width (standard) or be full width */
  variant?: "default" | "full" | "narrow";
  /** Optional inner spacing padding */
  padded?: boolean;
}

export function PageContainer({
  children,
  className,
  variant = "default",
  padded = true,
  ...props
}: PageContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full",
        {
          "max-w-7xl": variant === "default",
          "max-w-none": variant === "full",
          "max-w-4xl": variant === "narrow",
          "px-4 md:px-6 lg:px-8": padded,
        },
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
