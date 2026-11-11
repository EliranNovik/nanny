import { AlertCircle } from "lucide-react";

/** Calm note shown when the quality manager asks for a change before sharing. */
export function QualityBlockNotice({ note }: { note: string }) {
  return (
    <div className="rounded-2xl bg-amber-50 px-4 py-3.5 dark:bg-amber-400/10">
      <div className="flex items-start gap-3.5">
        <AlertCircle
          className="h-11 w-11 shrink-0 text-amber-600 dark:text-amber-300"
          strokeWidth={2.15}
          aria-hidden
        />
        <div className="min-w-0">
          <p className="text-base font-semibold text-amber-950 dark:text-amber-50">
            This one needs a change before it can be shared
          </p>
          <p className="mt-0.5 text-sm leading-snug text-amber-900/80 dark:text-amber-100/80">
            {note.trim() || "Please adjust the wording or the photo, then try again."}
          </p>
        </div>
      </div>
    </div>
  );
}
