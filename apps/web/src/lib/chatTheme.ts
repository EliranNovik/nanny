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
  "flex min-h-[56px] flex-1 items-center rounded-[1.5rem] border border-border/50 bg-muted/35 px-3.5 py-1.5 shadow-inner",
  "dark:border-white/10 dark:bg-white/10",
  "md:min-h-[48px] md:rounded-[1.375rem] md:px-3 md:py-1",
  "lg:min-h-[44px] lg:py-1",
);

export const chatComposerFieldClass = cn(
  "min-h-0 max-h-[min(40vh,280px)] flex-1 resize-none overflow-hidden border-0 bg-transparent px-2 py-0",
  "text-[19px] font-normal leading-snug text-foreground placeholder:text-muted-foreground",
  "dark:text-white dark:placeholder:text-slate-400",
  "shadow-none focus-visible:border-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
  "md:text-[19px]",
  "lg:text-[18px] lg:leading-snug",
);

export const chatReceivedBubbleCn = cn(
  "max-w-[84%] rounded-[20px] rounded-bl-md px-4 py-2.5 text-left shadow-none",
  "border-0 bg-zinc-100",
  "dark:bg-white/[0.08]",
  "md:max-w-[72%] md:rounded-[18px] md:px-4 md:py-2",
);

export const chatReceivedMessageTextCn = "text-zinc-600 dark:text-zinc-300";

export const chatSentBubbleCn = cn(
  "ml-auto max-w-[86%] rounded-[22px] rounded-br-md px-4 py-2.5 text-left",
  "bg-gradient-to-br from-orange-400 via-orange-500 to-orange-600 text-white",
  "shadow-lg shadow-orange-500/20 border-t border-white/15",
  "md:max-w-[74%] md:rounded-[20px] md:px-4 md:py-2",
);

export const chatBubbleBodyTextCn =
  "m-0 block min-w-0 max-w-full whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-[19px] font-semibold leading-[1.35] md:text-[18px] md:leading-snug";

export const chatMessageTimestampCn =
  "mt-0.5 text-[12px] font-medium leading-none tabular-nums text-slate-500/85 dark:text-slate-400/90 md:mt-px md:text-[11px]";

export const chatMessageColumnCn = (isOwn: boolean) =>
  cn(
    "flex w-full min-w-0 shrink flex-col space-y-0.5",
    isOwn
      ? "ml-auto max-w-[86%] items-end md:max-w-[74%]"
      : "max-w-[84%] items-start text-left md:max-w-[72%]",
  );

/** Image/video attachments — wider column so landscape media can use horizontal space. */
export const chatMediaMessageColumnCn = (isOwn: boolean) =>
  cn(
    "flex w-full min-w-0 shrink flex-col space-y-0.5",
    isOwn
      ? "ml-auto max-w-[94%] items-end md:max-w-[88%] lg:max-w-[min(40rem,80%)]"
      : "max-w-[94%] items-start text-left md:max-w-[88%] lg:max-w-[min(40rem,80%)]",
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
