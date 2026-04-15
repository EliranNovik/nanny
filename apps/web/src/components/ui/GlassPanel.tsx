import React from "react";
import { cn } from "@/lib/utils";

interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /** Intensity of the glass effect */
  variant?: "light" | "medium" | "heavy";
  /** Level of rounding */
  radius?: "card" | "card-lg" | "pill" | "none";
}

export function GlassPanel({
  children,
  className,
  variant = "light",
  radius = "card",
  ...props
}: GlassPanelProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden border backdrop-blur-md",
        {
          "bg-white/40 border-white/20 shadow-sm": variant === "light",
          "bg-white/70 border-white/50 shadow-soft": variant === "medium",
          "bg-white border-white shadow-float": variant === "heavy",
        },
        {
          "rounded-card": radius === "card",
          "rounded-card-lg": radius === "card-lg",
          "rounded-pill": radius === "pill",
          "rounded-none": radius === "none",
        },
        className,
      )}
      {...props}
    >
      {/* Optional reflection highlight for heavy premium feel */}
      {variant === "heavy" && (
        <div className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_1px_1px_rgba(255,255,255,0.8)]" />
      )}
      {children}
    </div>
  );
}
