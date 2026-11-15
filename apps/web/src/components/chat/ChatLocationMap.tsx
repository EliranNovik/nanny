import { MapPin } from "lucide-react";
import {
  chatLocationEmbedUrl,
  type ChatLocationShare,
} from "@/lib/chatLocationMessage";

export function ChatLocationMap({ location }: { location: ChatLocationShare }) {
  return (
    <a
      href={location.href || chatLocationEmbedUrl(location)}
      target="_blank"
      rel="noopener noreferrer"
      className="block w-[min(100%,18rem)] overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-900"
    >
      <span className="relative block h-36 w-full bg-zinc-100 dark:bg-zinc-800">
        <iframe
          title={location.label || "Map"}
          src={chatLocationEmbedUrl(location)}
          className="pointer-events-none h-full w-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </span>
      {location.label ? (
        <span className="flex items-start gap-1.5 px-3 py-2">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-600" aria-hidden />
          <span className="line-clamp-2 text-[13px] font-semibold leading-snug text-zinc-800 dark:text-zinc-100">
            {location.label}
          </span>
        </span>
      ) : null}
    </a>
  );
}
