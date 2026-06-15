import { cn } from "@/lib/utils";
import { signedInAppHeaderBgClass } from "@/lib/discoverHomeHeaderChrome";

/** Rich dark gradient + light neutral background for the chat thread. */
export const chatAreaBgClass = "chat-screen bg-zinc-50 text-foreground dark:text-white";

export const chatChromeBarClass = signedInAppHeaderBgClass;

export const chatComposerBarClass = cn(
  "bg-white/95 backdrop-blur-xl supports-[backdrop-filter]:bg-white/90",
  "dark:bg-[#14161d]/90 dark:supports-[backdrop-filter]:bg-[#14161d]/85",
);

export const chatComposerFieldWrapClass = cn(
  "flex min-h-[38px] flex-1 items-center rounded-[1.375rem] border border-border/50 bg-muted/35 px-3 py-0.5 shadow-inner",
  "dark:border-white/10 dark:bg-white/10",
);

export const chatComposerFieldClass = cn(
  "min-h-[32px] max-h-[min(40vh,280px)] flex-1 resize-none overflow-y-auto border-0 bg-transparent px-2 py-1",
  "text-[17px] font-normal leading-snug text-foreground placeholder:text-muted-foreground",
  "dark:text-white dark:placeholder:text-slate-400",
  "shadow-none focus-visible:border-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
  "md:text-[18px]",
);

export const chatReceivedBubbleCn = cn(
  "max-w-[70%] rounded-[18px] rounded-bl-md px-3 py-1.5 text-left shadow-md",
  "border border-slate-200/80 bg-white text-slate-900",
  "dark:border-white/10 dark:bg-white/10 dark:text-white dark:shadow-black/25",
);

export const chatSentBubbleCn = cn(
  "ml-auto max-w-[72%] rounded-[18px] rounded-br-md px-3 py-1.5 text-left",
  "bg-gradient-to-br from-orange-400 via-orange-500 to-orange-600 text-white",
  "shadow-lg shadow-orange-500/20 border-t border-white/15",
);

export const chatBubbleBodyTextCn =
  "m-0 block min-w-0 max-w-full whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-[17px] font-semibold leading-tight md:text-[17px]";

export const chatMessageTimestampCn =
  "text-sm font-medium tabular-nums text-slate-500 dark:text-slate-400";

export const chatMessageColumnCn = (isOwn: boolean) =>
  cn(
    "flex w-full min-w-0 shrink flex-col space-y-1",
    isOwn ? "ml-auto max-w-[72%] items-end" : "max-w-[70%] items-start text-left",
    "md:max-w-[70%]",
  );

/** Vivid glossy blue links in chat bubbles — light + dark. */
export const chatBubbleLinkCn =
  "inline-block max-w-full align-text-top break-all font-semibold underline underline-offset-[3px] transition-colors duration-150 [overflow-wrap:anywhere] " +
  "text-[#0284c7] decoration-[#0ea5e9]/65 " +
  "drop-shadow-[0_0_6px_rgba(14,165,233,0.55)] " +
  "hover:text-[#0369a1] hover:decoration-[#38bdf8] " +
  "dark:text-[#7dd3fc] dark:decoration-[#38bdf8]/70 " +
  "dark:drop-shadow-[0_0_10px_rgba(56,189,248,0.55)] " +
  "dark:hover:text-[#bae6fd] dark:hover:decoration-[#7dd3fc]";

export const chatSystemLinkCn =
  "inline-block max-w-full align-text-top break-all font-medium text-[#0284c7] underline underline-offset-[3px] transition-colors duration-150 [overflow-wrap:anywhere] decoration-[#0ea5e9]/65 " +
  "drop-shadow-[0_0_6px_rgba(14,165,233,0.45)] hover:text-[#0369a1] hover:decoration-[#38bdf8] " +
  "dark:text-[#7dd3fc] dark:decoration-[#38bdf8]/70 dark:drop-shadow-[0_0_10px_rgba(56,189,248,0.45)] " +
  "dark:hover:text-[#bae6fd]";
