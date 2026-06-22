import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  fetchInboxActivityAlerts,
  type NotificationAlert,
} from "@/lib/inboxActivityAlerts";
import {
  loadDismissedActivityIds,
  rememberDismissedActivity,
} from "@/lib/inboxDismissedActivity";
import { BRAND_LOGO_SRC } from "@/lib/brandLogo";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MobileSnapBottomSheet } from "@/components/ui/MobileSnapBottomSheet";
import { useIsMobileViewport } from "@/lib/discoverSheetDialog";
import { mobileSheetSafePaddingBottom } from "@/lib/mobileModalLayout";
import {
  Bell,
  Briefcase,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

export type { NotificationAlert } from "@/lib/inboxActivityAlerts";

const MOBILE_SHEET_MAX_HEIGHT = "min(78dvh, 680px)";
const MOBILE_SHEET_ANIM_MS = 380;

/** Desktop: anchored under the header bell, slides in from the right. */
const desktopNotificationsPanelClass = cn(
  "flex h-[min(85dvh,720px)] max-h-[min(85dvh,720px)] w-[min(26rem,calc(100vw-2rem))] max-w-[26rem] flex-col gap-0 overflow-hidden p-0",
  "border-0 bg-background shadow-2xl outline-none ring-0 focus:outline-none focus-visible:ring-0",
  "dark:border-0 dark:ring-0 dark:outline-none",
  "fixed left-auto right-4 top-16 translate-x-0 translate-y-0 rounded-2xl",
  "!left-auto !right-4 !top-16 !translate-x-0 !translate-y-0",
  "duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out",
  "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
  "!data-[state=open]:slide-in-from-left-0 !data-[state=open]:slide-in-from-top-0",
  "!data-[state=closed]:slide-out-to-left-0 !data-[state=closed]:slide-out-to-top-0",
  "data-[state=open]:slide-in-from-right-8 data-[state=closed]:slide-out-to-right-8",
  "data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100",
);

interface NotificationsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatAlertTime(dateStr: string | undefined): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return "Now";
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(date.getFullYear() !== now.getFullYear()
      ? { year: "2-digit" as const }
      : {}),
  });
}

function alertIcon(type: NotificationAlert["type"]) {
  switch (type) {
    case "welcome":
      return Sparkles;
    case "message":
    case "job_comment":
      return MessageSquare;
    case "job_request":
      return Briefcase;
    case "hire_interest":
      return Sparkles;
    default:
      return Briefcase;
  }
}

function alertIconTone(type: NotificationAlert["type"]): string {
  switch (type) {
    case "welcome":
      return "bg-primary/10 text-primary";
    case "message":
      return "bg-blue-500/10 text-blue-600 dark:text-blue-400";
    case "job_request":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
    case "job_comment":
      return "bg-rose-500/10 text-rose-600 dark:text-rose-400";
    case "hire_interest":
      return "bg-orange-500/10 text-orange-600 dark:text-orange-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function welcomeAlertForUser(params: {
  userId: string;
  role?: string | null;
  createdAt?: string | null;
}): NotificationAlert {
  const link =
    params.role === "freelancer"
      ? "/freelancer/home"
      : params.role === "client"
        ? "/client/home"
        : "/";

  return {
    id: `welcome-tebnu-${params.userId}`,
    type: "welcome",
    title: "Welcome to Tebnu",
    description: "We’re happy you’re here. Start by exploring posts or sharing your first one.",
    link,
    created_at: params.createdAt ?? new Date().toISOString(),
    sender_name: "Tebnu",
    sender_photo: BRAND_LOGO_SRC,
  };
}

function NotificationListRow({
  alert,
  index,
  onOpen,
}: {
  alert: NotificationAlert;
  index: number;
  onOpen: (alert: NotificationAlert) => void;
}) {
  const Icon = alertIcon(alert.type);
  const timeLabel = formatAlertTime(alert.created_at);

  return (
    <button
      type="button"
      onClick={() => onOpen(alert)}
      className={cn(
        "relative w-full text-left transition-colors",
        "px-4 py-4 pr-[max(1rem,env(safe-area-inset-right,0px))]",
        "hover:bg-muted/30 active:bg-muted/40 dark:hover:bg-zinc-900/50 dark:active:bg-zinc-900/70",
      )}
    >
      {index > 0 ? (
        <span
          aria-hidden
          className="pointer-events-none absolute left-[5.5rem] right-4 top-0 h-px bg-border/70 dark:bg-white/[0.08]"
        />
      ) : null}
      <div className="flex min-w-0 items-start gap-3.5">
        <div className="relative shrink-0 pt-0.5">
          {alert.sender_photo ? (
            <Avatar className="h-[3.625rem] w-[3.625rem]">
              <AvatarImage src={alert.sender_photo} className="object-cover" />
              <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                {alert.title.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ) : (
            <div
              className={cn(
                "flex h-[3.625rem] w-[3.625rem] items-center justify-center rounded-full",
                alertIconTone(alert.type),
              )}
            >
              <Icon className="h-6 w-6 shrink-0" aria-hidden />
            </div>
          )}
        </div>
        <div className="relative min-w-0 flex-1">
          {timeLabel ? (
            <span className="pointer-events-none absolute right-0 top-0 z-[1] max-w-[4rem] whitespace-nowrap text-right text-sm font-medium tabular-nums text-muted-foreground">
              {timeLabel}
            </span>
          ) : null}
          <div className="min-w-0 max-w-full pr-[3.25rem]">
            <p className="truncate text-[17px] font-semibold leading-snug text-foreground">
              {alert.title}
            </p>
            {alert.description ? (
              <p className="mt-1 line-clamp-2 text-[16px] leading-snug text-muted-foreground">
                {alert.description}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </button>
  );
}

function NotificationSkeletonRow({ index }: { index: number }) {
  return (
    <div
      className={cn(
        "relative px-4 py-4",
        index > 0 &&
          "before:pointer-events-none before:absolute before:left-[5.5rem] before:right-4 before:top-0 before:h-px before:bg-border/50",
      )}
    >
      <div className="flex animate-pulse items-start gap-3.5">
        <div className="h-[3.625rem] w-[3.625rem] shrink-0 rounded-full bg-muted/60" />
        <div className="min-w-0 flex-1 space-y-2 pt-1">
          <div className="h-4 w-2/5 rounded bg-muted/60" />
          <div className="h-3.5 w-full rounded bg-muted/40" />
        </div>
      </div>
    </div>
  );
}

function NotificationsPanel({
  alerts,
  loading,
  onOpen,
  onClearAll,
  headerClassName,
  listClassName,
  footerClassName,
}: {
  alerts: NotificationAlert[];
  loading: boolean;
  onOpen: (alert: NotificationAlert) => void;
  onClearAll: () => void;
  headerClassName?: string;
  listClassName?: string;
  footerClassName?: string;
}) {
  return (
    <>
      <div
        className={cn(
          "flex shrink-0 items-center justify-between gap-3 px-4 py-3.5",
          headerClassName,
        )}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <Bell className="h-5 w-5 shrink-0 text-orange-500" strokeWidth={2.25} />
          <h2 className="text-base font-bold tracking-tight text-foreground">
            Notifications
          </h2>
          {alerts.length > 0 ? (
            <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold tabular-nums text-primary-foreground">
              {alerts.length > 99 ? "99+" : alerts.length}
            </span>
          ) : null}
        </div>
      </div>

      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]",
          listClassName,
        )}
      >
        {loading ? (
          <div className="py-1">
            {Array.from({ length: 5 }, (_, i) => (
              <NotificationSkeletonRow key={i} index={i} />
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted/50">
              <Sparkles className="h-7 w-7 text-muted-foreground/70" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">All caught up</h3>
            <p className="mt-1.5 max-w-[240px] text-sm leading-relaxed text-muted-foreground">
              New messages and job updates will show up here.
            </p>
          </div>
        ) : (
          <div className="w-full min-w-0 max-w-full overflow-x-hidden py-0.5">
            {alerts.map((alert, index) => (
              <NotificationListRow
                key={alert.id}
                alert={alert}
                index={index}
                onOpen={onOpen}
              />
            ))}
          </div>
        )}
      </div>

      <div
        className={cn(
          "flex shrink-0 items-center justify-between gap-3 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
          mobileSheetSafePaddingBottom,
          footerClassName,
        )}
      >
        <span>{alerts.length > 0 ? `${alerts.length} updates` : "Up to date"}</span>
        {alerts.length > 0 ? (
          <button
            type="button"
            onClick={onClearAll}
            className="text-orange-600 transition-opacity hover:opacity-80 active:opacity-60 dark:text-orange-400"
          >
            Clear all
          </button>
        ) : null}
      </div>
    </>
  );
}

export function NotificationsModal({
  open,
  onOpenChange,
}: NotificationsModalProps) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobileViewport();
  const [alerts, setAlerts] = useState<NotificationAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [sheetExpanded, setSheetExpanded] = useState(true);
  const [presented, setPresented] = useState(false);
  const alertsRef = useRef<NotificationAlert[]>([]);
  alertsRef.current = alerts;

  const fetchAlerts = useCallback(
    async (silent = false) => {
      if (!user || !profile) return;
      if (!silent) setLoading(true);

      try {
        const allAlerts = await fetchInboxActivityAlerts(user, profile, {
          includeUnreadMessageAlerts: true,
        });
        const welcome = welcomeAlertForUser({
          userId: user.id,
          role: profile.role,
          createdAt: user.created_at,
        });
        const dismissed = loadDismissedActivityIds(user.id);
        setAlerts(dismissed.has(welcome.id) ? allAlerts : [welcome, ...allAlerts]);
      } catch (err) {
        console.error("Error fetching news:", err);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [user, profile],
  );

  useEffect(() => {
    if (open) void fetchAlerts();
  }, [open, fetchAlerts]);

  useEffect(() => {
    if (!user || !profile) return;

    const channel = supabase
      .channel(`notifications-live:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "job_candidate_notifications",
          filter: `freelancer_id=eq.${user.id}`,
        },
        () => void fetchAlerts(true),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "job_requests",
          filter:
            profile.role === "client"
              ? `client_id=eq.${user.id}`
              : `selected_freelancer_id=eq.${user.id}`,
        },
        () => void fetchAlerts(true),
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        () => void fetchAlerts(true),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, profile?.role, fetchAlerts]);

  useEffect(() => {
    if (open && isMobile) {
      setSheetExpanded(true);
      const id = window.requestAnimationFrame(() => setPresented(true));
      return () => window.cancelAnimationFrame(id);
    }
    setPresented(false);
    return undefined;
  }, [open, isMobile]);

  const dismissMobile = useCallback(() => {
    if (user?.id) {
      for (const a of alertsRef.current) {
        rememberDismissedActivity(user.id, a.id);
      }
    }
    setPresented(false);
    setSheetExpanded(false);
    window.setTimeout(() => onOpenChange(false), MOBILE_SHEET_ANIM_MS);
  }, [onOpenChange, user?.id]);

  const handleDialogOpenChange = (next: boolean) => {
    if (!next && user?.id) {
      for (const a of alertsRef.current) {
        rememberDismissedActivity(user.id, a.id);
      }
    }
    onOpenChange(next);
  };

  const handleOpen = (alert: NotificationAlert) => {
    if (user?.id) rememberDismissedActivity(user.id, alert.id);
    onOpenChange(false);
    navigate(alert.link);
  };

  const handleClearAll = () => {
    if (!user?.id) return;
    for (const a of alerts) rememberDismissedActivity(user.id, a.id);
    setAlerts([]);
  };

  const panel = (
    <NotificationsPanel
      alerts={alerts}
      loading={loading}
      onOpen={handleOpen}
      onClearAll={handleClearAll}
    />
  );

  if (isMobile) {
    if (!open) return null;

    const sheet = (
      <div className="fixed inset-0 z-[140] md:hidden">
        <button
          type="button"
          aria-label="Close notifications"
          className={cn(
            "absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity ease-out",
            presented ? "opacity-100 duration-300" : "opacity-0 duration-[380ms]",
          )}
          onClick={dismissMobile}
        />
        <MobileSnapBottomSheet
          expanded={sheetExpanded}
          onExpandedChange={setSheetExpanded}
          onDismiss={dismissMobile}
          hidePeek
          hideBackdrop
          hideBorder
          presented={presented}
          titleId="notifications-sheet-title"
          maxHeight={MOBILE_SHEET_MAX_HEIGHT}
          ariaLabel="Drag down to close notifications"
        >
          <div className="flex h-full min-h-0 flex-col bg-background text-foreground">
            <p id="notifications-sheet-title" className="sr-only">
              Notifications
            </p>
            {panel}
          </div>
        </MobileSnapBottomSheet>
      </div>
    );

    return createPortal(sheet, document.body);
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent
        overlayClassName="md:bg-black/25"
        className={desktopNotificationsPanelClass}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Notifications</DialogTitle>
        </DialogHeader>
        {panel}
      </DialogContent>
    </Dialog>
  );
}
