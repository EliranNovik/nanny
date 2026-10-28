import React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Paperclip,
  Send,
  Loader2,
  MessageSquarePlus,
  Mic,
} from "lucide-react";
import { ChatAttachmentPreview } from "@/components/chat/ChatAttachmentPreview";
import { ChatLinkPreviewCards } from "@/components/chat/ChatLinkPreviewCards";
import { extractFirstChatUrl } from "@/lib/linkifyMessageBody";
import { cn } from "@/lib/utils";
import { bidirectionalInputProps } from "@/lib/textDirection";
import {
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
  replyPreview?: string | null;
  onCancelReply?: () => void;
  onVoiceRecorded?: (file: File, sendImmediately: boolean) => void;
  currentLocale?: string;
  recipientLocale?: string;
  onShareContact?: () => void;
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
  replyPreview,
  onCancelReply,
  onVoiceRecorded,
  currentLocale,
  recipientLocale,
  onShareContact,
}: ChatComposerProps) {
  const { t } = useTranslation();
  const [showPhrases, setShowPhrases] = React.useState(false);
  const [showAttachMenu, setShowAttachMenu] = React.useState(false);
  const [recording, setRecording] = React.useState(false);
  const [recordingSeconds, setRecordingSeconds] = React.useState(0);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const recorderStreamRef = React.useRef<MediaStream | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const recordingTimerRef = React.useRef<number | null>(null);
  const sendRecordingOnStopRef = React.useRef(false);

  React.useEffect(
    () => () => {
      if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current);
      recorderStreamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  const stopRecording = (sendImmediately = false) => {
    sendRecordingOnStopRef.current = sendImmediately;
    recorderRef.current?.stop();
  };

  const startRecording = async () => {
    if (!onVoiceRecorded || !navigator.mediaDevices?.getUserMedia) return;
    if (
      currentLocale &&
      recipientLocale &&
      currentLocale !== recipientLocale &&
      !window.confirm(
        "This member uses a different app language. Voice messages are not translated automatically. Record anyway?",
      )
    ) {
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredTypes = [
        "audio/mp4",
        "audio/webm;codecs=opus",
        "audio/webm",
      ];
      const mimeType = preferredTypes.find((type) =>
        MediaRecorder.isTypeSupported(type),
      );
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );
      chunksRef.current = [];
      recorderStreamRef.current = stream;
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const type = recorder.mimeType || mimeType || "audio/webm";
        const extension = type.includes("mp4") ? "m4a" : "webm";
        const blob = new Blob(chunksRef.current, { type });
        if (blob.size > 0) {
          onVoiceRecorded(
            new File([blob], `voice-${Date.now()}.${extension}`, { type }),
            sendRecordingOnStopRef.current,
          );
        }
        stream.getTracks().forEach((track) => track.stop());
        if (recordingTimerRef.current) {
          window.clearInterval(recordingTimerRef.current);
        }
        recorderRef.current = null;
        recorderStreamRef.current = null;
        setRecording(false);
        setRecordingSeconds(0);
        sendRecordingOnStopRef.current = false;
      };
      recorder.start(250);
      setRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = window.setInterval(
        () => setRecordingSeconds((seconds) => seconds + 1),
        1000,
      );
    } catch (error) {
      console.error("Microphone permission failed:", error);
    }
  };

  /** Chat input inside floating glass composer shell */
  const messageFieldClass = chatComposerFieldClass;

  const phrasesPanelBase =
    "absolute bottom-[calc(100%+10px)] z-40 overflow-y-auto rounded-2xl border border-border/50 bg-background/95 shadow-lg backdrop-blur-lg dark:bg-zinc-900/95 p-2";
  const phraseItemClass =
    "w-full rounded-xl px-4 py-3.5 text-left text-[19px] font-medium leading-snug text-foreground transition-colors hover:bg-muted/85 active:bg-muted dark:hover:bg-zinc-800/90 md:px-3.5 md:py-3 md:text-[15px]";

  const phrases = [
    t("messagesPage.phrases.onMyWay"),
    t("messagesPage.phrases.availableNow"),
    t("messagesPage.phrases.moreDetails"),
    t("messagesPage.phrases.coordinateTime"),
    t("messagesPage.phrases.exactLocation"),
    t("messagesPage.phrases.hourlyRate"),
    t("messagesPage.phrases.thatWorks"),
    t("messagesPage.phrases.mightBeLate"),
    t("messagesPage.phrases.tomorrowInstead"),
    t("messagesPage.phrases.seeYouSoon"),
  ];

  const attachmentPreview = selectedFile?.type.startsWith("audio/") ? (
    <div className="mb-2 flex items-center gap-3 rounded-2xl bg-white/95 px-3 py-2.5 shadow-sm dark:bg-zinc-900/95">
      <Mic className="h-5 w-5 shrink-0 text-orange-500" />
      <div className="flex h-7 min-w-0 flex-1 items-center gap-[3px] overflow-hidden">
        {Array.from({ length: 28 }, (_, index) => (
          <span
            key={index}
            className="w-1 rounded-full bg-orange-400/75"
            style={{ height: 7 + ((index * 5) % 16) }}
          />
        ))}
      </div>
      <span className="text-xs font-semibold text-muted-foreground">
        Voice ready
      </span>
      <button
        type="button"
        onClick={removeSelectedFile}
        className="flex h-7 w-7 items-center justify-center rounded-full text-lg text-muted-foreground hover:bg-muted"
        aria-label="Remove voice recording"
      >
        ×
      </button>
    </div>
  ) : selectedFile ? (
    <ChatAttachmentPreview
      file={selectedFile}
      onRemove={removeSelectedFile}
      uploading={uploading}
    />
  ) : null;

  const replyBanner = replyPreview ? (
    <div className="mb-2 flex items-center gap-3 rounded-xl border-l-4 border-orange-500 bg-white/95 px-3 py-2 text-sm shadow-sm dark:bg-zinc-900/95">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-orange-600 dark:text-orange-400">
          {t("messagesPage.reply", { defaultValue: "Reply" })}
        </p>
        <p className="truncate text-muted-foreground">{replyPreview}</p>
      </div>
      <button
        type="button"
        onClick={onCancelReply}
        className="rounded-full px-2 py-1 text-lg leading-none text-muted-foreground hover:bg-muted"
        aria-label={t("common.cancel", { defaultValue: "Cancel" })}
      >
        ×
      </button>
    </div>
  ) : null;

  const recordingBanner = recording ? (
    <div className="mb-2 flex items-center gap-3 rounded-2xl bg-white/95 px-3 py-2.5 shadow-sm dark:bg-zinc-900/95">
      <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-red-500" />
      <div className="flex h-8 min-w-0 flex-1 items-center justify-center gap-[3px] overflow-hidden">
        {Array.from({ length: 32 }, (_, index) => (
          <span
            key={index}
            className="chat-recording-wave-bar w-1 rounded-full bg-orange-500"
            style={{
              height: 8 + ((index * 7) % 19),
              animationDelay: `${(index % 8) * -90}ms`,
            }}
          />
        ))}
      </div>
      <span className="shrink-0 text-xs font-bold tabular-nums text-red-600">
        {Math.floor(recordingSeconds / 60)}:
        {String(recordingSeconds % 60).padStart(2, "0")}
      </span>
    </div>
  ) : null;
  const detectedComposerLink = newMessage.trimStart().startsWith("📍")
    ? null
    : extractFirstChatUrl(newMessage);
  const [composerLink, setComposerLink] = React.useState<string | null>(null);
  React.useEffect(() => {
    const timer = window.setTimeout(
      () => setComposerLink(detectedComposerLink),
      500,
    );
    return () => window.clearTimeout(timer);
  }, [detectedComposerLink]);
  const composerLinkPreview = composerLink ? (
    <div className="mb-2">
      <ChatLinkPreviewCards urls={[composerLink]} variant="received" />
    </div>
  ) : null;

  const captionPlaceholder = selectedFile
    ? t("messagesPage.addCaption")
    : t("messagesPage.typeMessage");

  const messageInputProps = bidirectionalInputProps(newMessage, messageFieldClass);

  const composerActionBtnClass = cn(
    "h-10 w-10 shrink-0 self-end rounded-full",
    "text-orange-500 hover:bg-orange-50 hover:text-orange-700 active:scale-95",
    "dark:text-orange-400 dark:hover:bg-orange-950/30 dark:hover:text-orange-300",
  );
  const composerIconClass = "h-6 w-6";
  const composerSendBtnClass = cn(
    "h-10 w-10 shrink-0 self-end rounded-full",
    "bg-orange-700 text-white shadow-md shadow-orange-900/20",
    "hover:bg-orange-600 active:scale-95",
    "disabled:bg-orange-500/40 disabled:text-white/70 disabled:shadow-none",
  );
  const composerSendIconClass = "h-5 w-5";
  const hasSendContent = Boolean(newMessage.trim() || selectedFile || recording);

  return (
    <>
      {showPhrases && (
        <div 
          className="fixed inset-0 z-30 bg-transparent" 
          onClick={() => setShowPhrases(false)} 
        />
      )}
      {showAttachMenu && (
        <div
          className="fixed inset-0 z-30 bg-transparent"
          onClick={() => setShowAttachMenu(false)}
        />
      )}

      {/* Mobile Composer */}
      <div
        className={cn(
          "lg:hidden fixed bottom-0 left-0 right-0 z-30",
          "bg-white/[0.04] backdrop-blur-[3px] dark:bg-black/[0.04]",
          "px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
          !hideBackButton && mobileView === "steps" && "hidden"
        )}
      >
        {replyBanner}
        {recordingBanner}
        {attachmentPreview}
        {composerLinkPreview}

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
        {showAttachMenu ? (
          <div className="absolute bottom-[calc(100%+8px)] left-4 z-40 w-48 rounded-2xl border bg-background p-2 shadow-xl">
            <button
              type="button"
              onClick={() => {
                setShowAttachMenu(false);
                fileInputRef.current?.click();
              }}
              className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold hover:bg-muted"
            >
              Attach file
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAttachMenu(false);
                onShareContact?.();
              }}
              className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold hover:bg-muted"
            >
              Share contact
            </button>
          </div>
        ) : null}

        <form
          onSubmit={(event) => {
            if (recording) {
              event.preventDefault();
              stopRecording(true);
              return;
            }
            handleSend(event);
          }}
          className="flex w-full max-w-none items-end gap-1.5 rounded-[22px] border border-transparent bg-white p-1.5 shadow-[0_8px_28px_rgba(124,45,18,0.08)] dark:bg-zinc-900"
        >
          <input
            ref={fileInputRef}
            type="file"
            tabIndex={-1}
            aria-hidden="true"
            onChange={handleFileSelect}
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
            className="absolute w-0 h-0 opacity-0 overflow-hidden pointer-events-none"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={composerActionBtnClass}
            onClick={() => setShowAttachMenu((open) => !open)}
            disabled={sending || uploading}
            aria-label={t("messagesPage.attachFile")}
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
            aria-label={t("messagesPage.quickReplies")}
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
              aria-label={
                selectedFile ? t("messagesPage.caption") : t("messagesPage.message")
              }
            />
          </div>
          <Button
            type={hasSendContent ? "submit" : "button"}
            size="icon"
            className={composerSendBtnClass}
            onClick={
              hasSendContent ? undefined : () => void startRecording()
            }
            disabled={sending || uploading}
            aria-label={
              !hasSendContent
                ? "Record voice message"
                : selectedFile
                ? t("messagesPage.sendAttachment")
                : t("messagesPage.sendMessage")
            }
          >
            {sending || uploading ? (
              <Loader2 className={cn(composerSendIconClass, "animate-spin")} />
            ) : hasSendContent ? (
              <Send className={composerSendIconClass} strokeWidth={2.25} />
            ) : (
              <Mic className={composerSendIconClass} strokeWidth={2} />
            )}
          </Button>
        </form>
      </div>

      {/* Desktop Composer */}
      <div
        className={cn(
          "z-30 hidden lg:flex lg:flex-col",
          "bg-white/[0.04] backdrop-blur-[3px] dark:bg-black/[0.04]",
          hideBackButton
            ? // Sit in the chat column so the bar is always the full thread width.
              "absolute inset-x-0 bottom-0 px-3 pb-3 pt-2"
            : "fixed bottom-0 right-0 left-[400px] px-5 pb-4 pt-3",
        )}
      >
        {replyBanner}
        {recordingBanner}
        {attachmentPreview}
        {composerLinkPreview}

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
        {showAttachMenu ? (
          <div className="absolute bottom-[calc(100%+8px)] left-5 z-40 w-48 rounded-2xl border bg-background p-2 shadow-xl">
            <button
              type="button"
              onClick={() => {
                setShowAttachMenu(false);
                fileInputRef.current?.click();
              }}
              className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold hover:bg-muted"
            >
              Attach file
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAttachMenu(false);
                onShareContact?.();
              }}
              className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold hover:bg-muted"
            >
              Share contact
            </button>
          </div>
        ) : null}

        <form
          onSubmit={(event) => {
            if (recording) {
              event.preventDefault();
              stopRecording(true);
              return;
            }
            handleSend(event);
          }}
          className="flex w-full max-w-none items-end gap-1.5 rounded-[22px] border border-transparent bg-white p-1.5 shadow-[0_8px_28px_rgba(124,45,18,0.08)] dark:bg-zinc-900"
        >
          <input
            ref={fileInputRef}
            type="file"
            tabIndex={-1}
            aria-hidden="true"
            onChange={handleFileSelect}
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
            className="absolute w-0 h-0 opacity-0 overflow-hidden pointer-events-none"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={composerActionBtnClass}
            onClick={() => setShowAttachMenu((open) => !open)}
            disabled={sending || uploading}
            aria-label={t("messagesPage.attachFile")}
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
            aria-label={t("messagesPage.quickReplies")}
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
              aria-label={
                selectedFile ? t("messagesPage.caption") : t("messagesPage.message")
              }
            />
          </div>
          <Button
            type={hasSendContent ? "submit" : "button"}
            size="icon"
            className={composerSendBtnClass}
            onClick={
              hasSendContent ? undefined : () => void startRecording()
            }
            disabled={sending || uploading}
            aria-label={
              !hasSendContent
                ? "Record voice message"
                : selectedFile
                ? t("messagesPage.sendAttachment")
                : t("messagesPage.sendMessage")
            }
          >
            {sending || uploading ? (
              <Loader2 className={cn(composerSendIconClass, "animate-spin")} />
            ) : hasSendContent ? (
              <Send className={composerSendIconClass} strokeWidth={2.25} />
            ) : (
              <Mic className={composerSendIconClass} strokeWidth={2} />
            )}
          </Button>
        </form>
      </div>
    </>
  );
}
