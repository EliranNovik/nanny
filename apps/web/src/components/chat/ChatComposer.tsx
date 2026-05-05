import React from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Paperclip, Send, Loader2, X, File, Image as ImageIcon, MessageSquarePlus } from "lucide-react";
import { cn } from "@/lib/utils";

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

  /** Chat input: readable grey surface, no stroke — stands out on chat background in light & dark */
  const messageFieldClass = cn(
    "min-h-[44px] max-h-[min(40vh,280px)] flex-1 resize-none overflow-y-auto",
    "rounded-2xl border-0 py-2.5 pl-3 pr-3",
    "bg-zinc-200 text-zinc-900 placeholder:text-zinc-600",
    "dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-400",
    "text-[16px] font-normal leading-snug",
    "shadow-none focus-visible:border-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
  );

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

  function getFileType(fileName: string): string {
    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) return "image";
    if (["mp4", "webm", "mov", "avi"].includes(ext)) return "video";
    return "file";
  }

  const filePreview = selectedFile && (
    <div className="mb-2 flex w-full max-w-none items-center gap-2 rounded-xl border-0 bg-muted/25 p-2 text-foreground dark:bg-muted/15">
      {getFileType(selectedFile.name) === "image" ? (
        <ImageIcon className="w-5 h-5 text-primary flex-shrink-0" />
      ) : (
        <File className="w-5 h-5 text-primary flex-shrink-0" />
      )}
      <span className="text-sm flex-1 truncate">{selectedFile.name}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 flex-shrink-0"
        onClick={removeSelectedFile}
      >
        <X className="w-4 h-4" />
      </Button>
    </div>
  );

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
          "border-none bg-background/85 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70",
          "px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]",
          !hideBackButton && mobileView === "steps" && "hidden"
        )}
      >
        {filePreview}
        
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

        <form onSubmit={handleSend} className="flex w-full max-w-none items-end gap-1">
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
            className="h-10 w-10 shrink-0 self-end rounded-full text-muted-foreground hover:bg-muted/60 hover:text-foreground active:scale-95"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending || uploading}
          >
            <Paperclip className="h-[22px] w-[22px]" strokeWidth={1.75} />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0 self-end rounded-full text-muted-foreground hover:bg-muted/60 hover:text-foreground active:scale-95"
            onClick={() => setShowPhrases(!showPhrases)}
            disabled={sending || uploading}
          >
            <MessageSquarePlus className="h-[22px] w-[22px]" strokeWidth={1.75} />
          </Button>

          <Textarea
            ref={mobileComposerRef}
            rows={1}
            placeholder={selectedFile ? "Add a message..." : "Type a message..."}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
              }
            }}
            className={messageFieldClass}
            disabled={sending || uploading}
          />
          <Button
            type="submit"
            size="icon"
            variant="ghost"
            className="h-10 w-10 shrink-0 self-end rounded-full text-primary transition-colors hover:!bg-primary hover:!text-primary-foreground active:scale-95 disabled:opacity-35 disabled:hover:!bg-transparent disabled:hover:!text-primary"
            disabled={(!newMessage.trim() && !selectedFile) || sending || uploading}
          >
            {sending || uploading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" strokeWidth={2} />
            )}
          </Button>
        </form>
      </div>

      {/* Desktop Composer */}
      <div
        className={cn(
          "fixed bottom-0 right-0 z-30 hidden lg:flex lg:flex-col",
          "border-none bg-background/85 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70",
          "px-5 pb-4 pt-2.5",
          hideBackButton ? "md:left-80 lg:left-96 left-0" : "left-[400px]"
        )}
      >
        {filePreview}

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

        <form onSubmit={handleSend} className="flex w-full max-w-none items-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0 self-end rounded-full text-muted-foreground hover:bg-muted/60 hover:text-foreground active:scale-95"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending || uploading}
          >
            <Paperclip className="h-[22px] w-[22px]" strokeWidth={1.75} />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0 self-end rounded-full text-muted-foreground hover:bg-muted/60 hover:text-foreground active:scale-95"
            onClick={() => setShowPhrases(!showPhrases)}
            disabled={sending || uploading}
          >
            <MessageSquarePlus className="h-[22px] w-[22px]" strokeWidth={1.75} />
          </Button>

          <Textarea
            ref={desktopComposerRef}
            rows={1}
            placeholder={selectedFile ? "Add a message..." : "Type a message..."}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
              }
            }}
            className={cn(messageFieldClass, "md:placeholder:text-sm")}
            disabled={sending || uploading}
          />
          <Button
            type="submit"
            size="icon"
            variant="ghost"
            className="h-10 w-10 shrink-0 self-end rounded-full text-primary transition-colors hover:!bg-primary hover:!text-primary-foreground active:scale-95 disabled:opacity-35 disabled:hover:!bg-transparent disabled:hover:!text-primary"
            disabled={(!newMessage.trim() && !selectedFile) || sending || uploading}
          >
            {sending || uploading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" strokeWidth={2} />
            )}
          </Button>
        </form>
      </div>
    </>
  );
}
