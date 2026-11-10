import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { MessageSquare, PenLine, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useReportIssue } from "@/context/ReportIssueContext";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { AiIcon } from "@/components/ai/AiIcon";
import { GLOBAL_POSTS_PATH } from "@/lib/profilePostShare";
import {
  AI_FEATURES_POPUP_ID,
  closeAnnouncement,
  isAnnouncementOpen,
} from "@/lib/featureAnnouncements";

const HIDDEN_ON = ["/onboarding", "/login", "/signup", "/register", "/auth", "/admin", "/reset-password"];
const SHOW_DELAY_MS = 1200;

export function AiFeaturesPopup() {
  const { user, profile } = useAuth();
  const { openReportModal } = useReportIssue();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [snoozed, setSnoozed] = useState(false);

  const eligible =
    !!user?.id &&
    !!profile?.role &&
    !snoozed &&
    !HIDDEN_ON.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (!eligible || !user?.id || !isAnnouncementOpen(user.id, AI_FEATURES_POPUP_ID)) {
      setOpen(false);
      return;
    }
    const id = window.setTimeout(() => setOpen(true), SHOW_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [eligible, user?.id]);

  const markRead = () => {
    if (user?.id) closeAnnouncement(user.id, AI_FEATURES_POPUP_ID);
    setOpen(false);
  };

  const snooze = () => {
    setSnoozed(true);
    setOpen(false);
  };

  const features = [
    {
      icon: PenLine,
      title: "Write with AI",
      body: "Tell it what you want to share. It writes the title and the post for you.",
      onClick: () => {
        markRead();
        navigate(`${GLOBAL_POSTS_PATH}?compose=1`);
      },
    },
    {
      icon: MessageSquare,
      title: "AI support chat",
      body: "Ask anything about Tebnu and get an answer in seconds, day or night.",
      onClick: () => {
        markRead();
        openReportModal();
      },
    },
  ];

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : snooze())}>
      <DialogContent
        overlayClassName="z-[160] bg-black/50 backdrop-blur-[2px]"
        className="z-[160] w-[calc(100vw-2rem)] max-w-[420px] gap-0 overflow-hidden rounded-3xl border-0 p-0 sm:rounded-3xl"
      >
        <div className="relative bg-gradient-to-br from-orange-50 via-white to-rose-50 px-6 pb-5 pt-8 text-center dark:from-orange-500/10 dark:via-zinc-900 dark:to-rose-500/10">
          <button
            type="button"
            onClick={snooze}
            aria-label="Close"
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
          <AiIcon className="mx-auto h-16 w-16 shadow-lg shadow-orange-500/25" />
          <span className="mt-4 inline-flex rounded-full bg-orange-500 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-white">
            Beta
          </span>
          <DialogTitle className="mt-2 text-[22px] font-bold leading-tight text-foreground">
            {profile?.full_name ? `${String(profile.full_name).split(" ")[0]}, meet` : "Meet"} your AI helpers
          </DialogTitle>
          <DialogDescription className="mt-1.5 text-[14px] leading-snug text-muted-foreground">
            Two new ways to get things done faster on Tebnu.
          </DialogDescription>
        </div>

        <div className="space-y-2.5 bg-background px-5 pb-5 pt-4">
          {features.map(({ icon: Icon, title, body, onClick }) => (
            <button
              key={title}
              type="button"
              onClick={onClick}
              className="flex w-full items-start gap-3.5 rounded-2xl bg-muted/40 p-3.5 text-left transition-colors hover:bg-muted/70 dark:bg-zinc-800/60 dark:hover:bg-zinc-800"
            >
              <Icon className="mt-0.5 h-7 w-7 shrink-0 text-orange-500 dark:text-orange-400" strokeWidth={1.9} />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold leading-snug text-foreground">{title}</span>
                <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{body}</span>
              </span>
            </button>
          ))}

          <button
            type="button"
            onClick={markRead}
            className="mt-2 h-12 w-full rounded-2xl bg-gradient-to-r from-orange-500 to-rose-500 text-[15px] font-bold text-white shadow-md shadow-orange-500/25 transition-transform active:scale-[0.99]"
          >
            Got it
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
