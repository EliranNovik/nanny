import { cn } from "@/lib/utils";

/** Rich dark gradient + light neutral background for the chat thread. */
export const chatAreaBgClass =
  "chat-screen bg-[#fbfaf8] text-foreground dark:text-white";

/** Frosted overlay for the chat header and composer so messages can show through. */
export const chatComposerBarClass = cn(
  "border-0 bg-white/92 shadow-none backdrop-blur-xl backdrop-saturate-150",
  "supports-[backdrop-filter]:bg-white/82",
  "dark:bg-[#14161d]/90 dark:supports-[backdrop-filter]:bg-[#14161d]/82",
);

export const chatChromeBarClass = chatComposerBarClass;

export const chatComposerFieldWrapClass = cn(
  "flex min-h-11 flex-1 items-center rounded-[1.25rem] border border-orange-100 bg-orange-50/70 px-3 py-0 shadow-none outline-none ring-0",
  "dark:border-transparent dark:bg-orange-950/20",
  "md:min-h-[48px] md:rounded-[1.375rem] md:px-3 md:py-1",
  "lg:min-h-[44px] lg:py-1",
  "focus-within:outline-none focus-within:ring-0",
);

export const chatComposerFieldClass = cn(
  "min-h-0 max-h-[min(40vh,280px)] flex-1 resize-none overflow-hidden border-0 bg-transparent px-2 py-0",
  "text-[16px] font-normal leading-5 text-foreground placeholder:text-muted-foreground",
  "dark:text-white dark:placeholder:text-slate-400",
  "shadow-none focus-visible:border-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
  "md:text-[19px] md:leading-snug",
  "lg:text-[18px] lg:leading-snug",
);

export const chatReceivedBubbleCn = cn(
  "max-w-[90%] rounded-[18px] rounded-bl-[5px] px-3.5 py-2.5 text-left shadow-sm",
  "border border-orange-100/70 bg-[#fff3e8]",
  "dark:border-orange-900/25 dark:bg-orange-950/25",
  "md:max-w-[80%] md:px-3.5 md:py-2",
);

export const chatReceivedMessageTextCn =
  "text-zinc-800 dark:text-orange-50/90";

export const chatSentBubbleCn = cn(
  "chat-sent-bubble ml-auto max-w-[90%] rounded-[18px] rounded-br-[5px] px-3.5 py-2.5 text-left",
  "bg-gradient-to-br from-orange-700 via-orange-600 to-orange-500 text-white",
  "shadow-md shadow-orange-900/15 border-t border-white/10",
  "dark:border-0 dark:shadow-none",
  "md:max-w-[80%] md:rounded-[20px] md:px-4 md:py-2",
);

export const chatBubbleBodyTextCn =
  "m-0 block min-w-0 max-w-full whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-[17px] font-medium leading-6";

export const chatMessageTimestampCn =
  "mt-0.5 text-[12px] font-medium leading-none tabular-nums text-slate-500/85 dark:text-slate-400/90 md:mt-px md:text-[11px]";

/** WhatsApp-style meta row inside the bubble (time + ticks), bottom-right. */
export const chatBubbleInnerMetaWrapCn =
  "float-end ms-2 mt-1 inline-flex items-end";

export const chatMessageColumnCn = (isOwn: boolean) =>
  cn(
    "flex w-max min-w-0 shrink flex-col space-y-0.5",
    isOwn
      ? "max-w-[90%] items-end md:max-w-[80%]"
      : "max-w-[90%] items-start text-left md:max-w-[80%]",
  );

/** Image/video attachments — wider column so landscape media can use horizontal space. */
export const chatMediaMessageColumnCn = (isOwn: boolean) =>
  cn(
    "flex w-max min-w-0 shrink flex-col space-y-0.5",
    isOwn
      ? "max-w-[94%] items-end md:max-w-[88%] lg:max-w-[min(40rem,80%)]"
      : "max-w-[94%] items-start text-left md:max-w-[88%] lg:max-w-[min(40rem,80%)]",
  );

export const chatBubbleLinkCn =
  "inline max-w-full break-all text-[14px] font-bold leading-5 text-[#1D9BF0] underline [overflow-wrap:anywhere]";

export const chatSentBubbleLinkCn =
  "inline max-w-full break-all text-[14px] font-bold leading-5 text-white/90 underline [overflow-wrap:anywhere]";

export const chatSystemLinkCn =
  "inline-block max-w-full align-text-top break-all font-medium text-[#0284c7] underline underline-offset-[3px] transition-colors duration-150 [overflow-wrap:anywhere] decoration-[#0ea5e9]/65 " +
  "drop-shadow-[0_0_6px_rgba(14,165,233,0.45)] hover:text-[#0369a1] hover:decoration-[#38bdf8] " +
  "dark:text-[#7dd3fc] dark:decoration-[#38bdf8]/70 dark:drop-shadow-[0_0_10px_rgba(56,189,248,0.45)] " +
  "dark:hover:text-[#bae6fd]";
