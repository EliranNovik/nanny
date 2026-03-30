import { ArrowLeftRight } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { JobsPerspective } from "./jobsPerspective";
import { defaultTabForPerspective, writeStoredPerspective } from "./jobsPerspective";

export function JobsPerspectiveSwitch({
  current,
  className,
}: {
  current: JobsPerspective;
  className?: string;
}) {
  const [, setSearchParams] = useSearchParams();
  const other: JobsPerspective = current === "client" ? "freelancer" : "client";
  const label =
    other === "freelancer"
      ? "Switch to Helping others"
      : "Switch to My Helpers";

  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-2 px-1 md:max-w-6xl",
        className
      )}
    >
      <p className="text-[13px] font-semibold text-muted-foreground">
        <span className="text-slate-600 dark:text-slate-300">
          {current === "freelancer" ? "Helping others" : "My Helpers"}
        </span>
        <span className="mx-1.5 text-slate-400">·</span>
        <span className="font-normal">
          {current === "freelancer"
            ? "Incoming requests, pending, live & past as a helper"
            : "Posted requests, live & past as a client"}
        </span>
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 shrink-0 gap-2 rounded-full border-orange-200/80 text-[13px] font-bold text-orange-800 hover:bg-orange-50 dark:border-orange-500/30 dark:text-orange-200 dark:hover:bg-orange-950/50"
        onClick={() => {
          writeStoredPerspective(other);
          setSearchParams({ mode: other, tab: defaultTabForPerspective(other) }, { replace: true });
        }}
      >
        <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden />
        {label}
      </Button>
    </div>
  );
}
