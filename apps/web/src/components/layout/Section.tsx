import React from "react";
import { cn } from "@/lib/utils";

interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
  /** Vertical spacing size */
  spacing?: "none" | "sm" | "md" | "lg" | "xl";
  /** Optional background styling */
  background?: "transparent" | "muted" | "white";
}

export function Section({
  children,
  className,
  spacing = "lg",
  background = "transparent",
  ...props
}: SectionProps) {
  return (
    <section
      className={cn(
        "w-full",
        {
          "py-0": spacing === "none",
          "py-8 md:py-12": spacing === "sm",
          "py-12 md:py-16": spacing === "md",
          "py-16 md:py-24": spacing === "lg",
          "py-24 md:py-32": spacing === "xl",
        },
        {
          "bg-transparent": background === "transparent",
          "bg-muted/50": background === "muted",
          "bg-white": background === "white",
        },
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}

interface SectionHeaderProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "title"
> {
  title: string | React.ReactNode;
  subtitle?: string | React.ReactNode;
  align?: "left" | "center" | "right";
  actions?: React.ReactNode;
}

export function SectionHeader({
  title,
  subtitle,
  align = "center",
  actions,
  className,
  ...props
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 mb-10 md:mb-16",
        {
          "text-left items-start": align === "left",
          "text-center items-center": align === "center",
          "text-right items-end": align === "right",
        },
        className,
      )}
      {...props}
    >
      <div className="space-y-4 max-w-2xl">
        {typeof title === "string" ? (
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            {title}
          </h2>
        ) : (
          title
        )}
        {subtitle &&
          (typeof subtitle === "string" ? (
            <p className="text-lg md:text-xl text-slate-500 font-medium">
              {subtitle}
            </p>
          ) : (
            subtitle
          ))}
      </div>
      {actions && <div className="mt-2 md:mt-4">{actions}</div>}
    </div>
  );
}
