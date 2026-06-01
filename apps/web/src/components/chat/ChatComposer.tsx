import React from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Paperclip, Send, Loader2, MessageSquarePlus } from "lucide-react";
import { ChatAttachmentPreview } from "@/components/chat/ChatAttachmentPreview";
import { cn } from "@/lib/utils";
import { bidirectionalInputProps } from "@/lib/textDirection";
import {
  chatComposerBarClass,
  chatComposerFieldClass,
  chatComposerFieldWrapClass,
} from "@/lib/chatTheme";

interface ChatComposerProps {
  newMessage: string;
  setNewMessage: (val: string) => void;
  selectedFile: File | null;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  removeSelectedFile: () => void;
  handleSend: (e: React.FormEvent) => void;
  sending: boolean;
  uploading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  mobileComposerRef: React.RefObject<HTMLTextAreaElement>;
  desktopComposerRef: React.RefObject<HTMLTextAreaElement>;
  hideBackButton?: boolean;
  mobileView?: "steps" | "chat";
}

export function ChatComposer({
  newMessage,
  setNewMessage,
  selectedFile,
  handleFileSelect,
  removeSelectedFile,
  handleSend,
  sending,
  uploading,
  fileInputRef,
  mobileComposerRef,
  desktopComposerRef,
  hideBackButton,
  mobileView,
}: ChatComposerProps) {
  const [showPhrases, setShowPhrases] = React.useState(false);

  /** Chat input inside floating glass composer shell */
  const messageFieldClass = chatComposerFieldClass;

  const phrasesPanelBase =
    "absolute bottom-[calc(100%+10px)] z-40 overflow-y-auto rounded-2xl border border-border/50 bg-background/95 shadow-lg backdrop-blur-lg dark:bg-zinc-900/95 p-2";
  const phraseItemClass =
    "w-full rounded-xl px-4 py-3.5 text-left text-[17px] font-medium leading-snug text-foreground transition-colors hover:bg-muted/85 active:bg-muted dark:hover:bg-zinc-800/90 md:px-3.5 md:py-3 md:text-[15px]";

  const phrases = [
    "I'm on my way",
    "Available now",
    "Can you share a few more details?",
    "Let's coordinate a time",
    "What's the exact location?",
    "How much is the hourly rate?",
    "Thank you, that works for me",
    "I might be a bit late",
    "Can we do this tomorrow instead?",
    "Sounds good! See you soon",
  ];

  const attachmentPreview = selectedFile ? (
    <ChatAttachmentPreview
      file={selectedFile}
      onRemove={removeSelectedFile}
      uploading={uploading}
    />
  ) : null;

  const captionPlaceholder = selectedFile ? "Add a caption…" : "Type a message…";

  const messageInputProps = bidirectionalInputProps(newMessage, messageFieldClass);

  const composerActionBtnClass = cn(
    "h-10 w-10 shrink-0 self-end rounded-full",
    "text-muted-foreground hover:bg-muted/60 hover:text-foreground active:scale-95",
    "dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white",
  );
  const composerIconClass = "h-6 w-6";
  const composerSendBtnClass = cn(
    "h-10 w-10 shrink-0 self-end rounded-full",
    "bg-orange-500 text-white shadow-lg shadow-orange-500/25",
    "hover:bg-orange-400 active:scale-95",
    "disabled:bg-orange-500/40 disabled:text-white/70 disabled:shadow-none",
  );
  const composerSendIconClass = "h-5 w-5";

  return (
    <>
      {showPhrases && (
        <div 
          className="fixed inset-0 z-30 bg-transparent" 
          onClick={() => setShowPhrases(false)} 
        />
      )}

      {/* Mobile Composer */}
      <div
        className={cn(
          "lg:hidden fixed bottom-0 left-0 right-0 z-30",
          chatComposerBarClass,
          "px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
          !hideBackButton && mobileView === "steps" && "hidden"
        )}
      >
        {attachmentPreview}

        {showPhrases && (
          <div
            className={cn(
              phrasesPanelBase,
              "left-3 right-3 max-h-[min(52vh,24rem)]",
            )}
          >
            {phrases.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setNewMessage(p);
                  setShowPhrases(false);
                }}
                className={phraseItemClass}
              >
                {p}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSend} className="flex w-full max-w-none items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            tabIndex={-1}
            aria-hidden="true"
            onChange={handleFileSelect}
            accept="image/*,video/*,.pdf,.doc,.docx,.txt"
            className="absolute w-0 h-0 opacity-0 overflow-hidden pointer-events-none"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={composerActionBtnClass}
            onClick={() => fileInputRef.current?.click()}
            disabled={sending || uploading}
            aria-label="Attach file"
          >
            <Paperclip className={composerIconClass} strokeWidth={1.75} />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={composerActionBtnClass}
            onClick={() => setShowPhrases(!showPhrases)}
            disabled={sending || uploading}
            aria-label="Quick replies"
          >
            <MessageSquarePlus className={composerIconClass} strokeWidth={1.75} />
          </Button>

          <div className={chatComposerFieldWrapClass}>
            <Textarea
              ref={mobileComposerRef}
              rows={1}
              placeholder={captionPlaceholder}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
                }
              }}
              {...messageInputProps}
              disabled={sending || uploading}
              aria-label={selectedFile ? "Caption" : "Message"}
            />
          </div>
          <Button
            type="submit"
            size="icon"
            className={composerSendBtnClass}
            disabled={(!newMessage.trim() && !selectedFile) || sending || uploading}
            aria-label={selectedFile ? "Send attachment" : "Send message"}
          >
            {sending || uploading ? (
              <Loader2 className={cn(composerSendIconClass, "animate-spin")} />
            ) : (
              <Send className={composerSendIconClass} strokeWidth={2.25} />
            )}
          </Button>
        </form>
      </div>

      {/* Desktop Composer */}
      <div
        className={cn(
          "fixed bottom-0 right-0 z-30 hidden lg:flex lg:flex-col",
          chatComposerBarClass,
          "px-5 pb-4 pt-3",
          hideBackButton
            ? // Embedded in `MessagesPage` which also has the DesktopSidePanel (220px) on md+.
              // Keep the composer width aligned with the chat column only.
              "left-0 md:left-[540px] lg:left-[604px]"
            : "left-[400px]",
        )}
      >
        {attachmentPreview}

        {showPhrases && (
          <div
            className={cn(
              phrasesPanelBase,
              "left-5 w-[min(26rem,calc(100%-2.5rem))] max-h-[min(60vh,28rem)]",
            )}
          >
            {phrases.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setNewMessage(p);
                  setShowPhrases(false);
                }}
                className={phraseItemClass}
              >
                {p}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSend} className="flex w-full max-w-none items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            tabIndex={-1}
            aria-hidden="true"
            onChange={handleFileSelect}
            accept="image/*,video/*,.pdf,.doc,.docx,.txt"
            className="absolute w-0 h-0 opacity-0 overflow-hidden pointer-events-none"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={composerActionBtnClass}
            onClick={() => fileInputRef.current?.click()}
            disabled={sending || uploading}
            aria-label="Attach file"
          >
            <Paperclip className={composerIconClass} strokeWidth={1.75} />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={composerActionBtnClass}
            onClick={() => setShowPhrases(!showPhrases)}
            disabled={sending || uploading}
            aria-label="Quick replies"
          >
            <MessageSquarePlus className={composerIconClass} strokeWidth={1.75} />
          </Button>

          <div className={chatComposerFieldWrapClass}>
            <Textarea
              ref={desktopComposerRef}
              rows={1}
              placeholder={captionPlaceholder}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
                }
              }}
              {...messageInputProps}
              disabled={sending || uploading}
              aria-label={selectedFile ? "Caption" : "Message"}
            />
          </div>
          <Button
            type="submit"
            size="icon"
            className={composerSendBtnClass}
            disabled={(!newMessage.trim() && !selectedFile) || sending || uploading}
            aria-label={selectedFile ? "Send attachment" : "Send message"}
          >
            {sending || uploading ? (
              <Loader2 className={cn(composerSendIconClass, "animate-spin")} />
            ) : (
              <Send className={composerSendIconClass} strokeWidth={2.25} />
            )}
          </Button>
        </form>
      </div>
    </>
  );
}
