import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow, isPast, parseISO } from "date-fns";
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  MapPin,
  Settings2,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useKycGate } from "@/context/KycGateContext";
import { supabase } from "@/lib/supabase";
import { ProfileSubpageLayout } from "@/components/profile/ProfileSubpageLayout";
import { ComposeModal, type ProfileSnippet } from "@/components/profile/ProfilePostsFeed";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  normalizeJoinInterestProfile,
  parseEventHelpersNeeded,
  updateEventJoinInterestStatus,
  updateEventPostHelpersNeeded,
  type EventJoinInterestRow,
  type EventJoinInterestStatus,
} from "@/lib/profilePostEventJoin";
import { publicProfileMediaUrl } from "@/lib/publicProfileMedia";
import { cn, noFieldSpinnerClass } from "@/lib/utils";

type EventPostMetadata = {
  event_name?: string | null;
  date_time?: string | null;
  event_date?: string | null;
  event_time?: string | null;
  location?: string | null;
  helpers_needed?: number | null;
};

type EventPostRow = {
  id: string;
  caption: string | null;
  media_type: "image" | "video" | null;
  storage_path: string | null;
  post_metadata: EventPostMetadata | null;
  created_at: string;
};

type EventWithInterests = EventPostRow & {
  interests: EventJoinInterestRow[];
};

type EventSortFilter = "newest" | "oldest" | "event_soonest" | "most_interested";
type EventInterestFilter = "all" | "with_interest" | "no_interest";
type EventTimingFilter = "all" | "upcoming" | "past";

function getEventDateTime(metadata: EventPostMetadata | null): Date | null {
  if (!metadata?.event_date?.trim()) return null;
  try {
    const base = parseISO(metadata.event_date);
    if (Number.isNaN(base.getTime())) return null;
    if (metadata.event_time?.trim()) {
      const [hours, minutes] = metadata.event_time.split(":").map((part) => parseInt(part, 10));
      base.setHours(
        Number.isFinite(hours) ? hours : 0,
        Number.isFinite(minutes) ? minutes : 0,
        0,
        0,
      );
    }
    return base;
  } catch {
    return null;
  }
}

function eventMatchesSearch(event: EventWithInterests, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const meta = event.post_metadata ?? {};
  const haystack = [
    meta.event_name,
    meta.location,
    meta.date_time,
    event.caption,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

function FilterChip({
  selected,
  onClick,
  children,
  className,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-9 shrink-0 rounded-full border px-3.5 text-xs font-semibold transition-all active:scale-95",
        selected
          ? "border-violet-600 bg-violet-600 text-white"
          : "border-border bg-background text-foreground hover:bg-muted/50",
        className,
      )}
    >
      {children}
    </button>
  );
}

function interestStatusLabel(status: EventJoinInterestStatus | null | undefined) {
  if (status === "accepted") return "Accepted";
  if (status === "declined") return "Declined";
  return "Pending";
}

function EventInterestManageRow({
  interest,
  onStatusChange,
  busyId,
}: {
  interest: EventJoinInterestRow;
  onStatusChange: (interestId: string, status: EventJoinInterestStatus) => void;
  busyId: string | null;
}) {
  const profile = normalizeJoinInterestProfile(interest.profiles);
  const name = profile?.full_name?.trim() || "Member";
  const status = (interest.status ?? "pending") as EventJoinInterestStatus;
  const isBusy = busyId === interest.id;

  return (
    <div className="flex flex-col gap-2 rounded-xl px-3 py-2.5 sm:flex-row sm:items-center">
      <Link
        to={`/profile/${interest.user_id}`}
        className="flex min-w-0 flex-1 items-center gap-3 transition-colors hover:opacity-90"
      >
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarImage src={profile?.photo_url ?? undefined} alt="" />
          <AvatarFallback className="text-xs font-bold">
            {name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{name}</p>
          <p className="text-xs font-medium text-muted-foreground">
            {interestStatusLabel(status)} ·{" "}
            {formatDistanceToNow(new Date(interest.created_at), { addSuffix: true })}
          </p>
        </div>
        <ExternalLink className="hidden h-4 w-4 shrink-0 text-muted-foreground/70 sm:block" />
      </Link>
      <div className="flex shrink-0 items-center gap-1.5 ps-[3.25rem] sm:ps-0">
        {status !== "accepted" ? (
          <Button
            type="button"
            size="sm"
            className="h-8 rounded-full px-3 text-xs"
            disabled={isBusy}
            onClick={() => onStatusChange(interest.id, "accepted")}
          >
            {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Accept
          </Button>
        ) : null}
        {status !== "declined" ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 rounded-full px-3 text-xs"
            disabled={isBusy}
            onClick={() => onStatusChange(interest.id, "declined")}
          >
            {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
            Decline
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function EventCard({
  event,
  onInterestStatusChange,
  onHelpersNeededSave,
}: {
  event: EventWithInterests;
  onInterestStatusChange: (
    postId: string,
    interestId: string,
    status: EventJoinInterestStatus,
  ) => Promise<void>;
  onHelpersNeededSave: (postId: string, helpersNeeded: number | null) => Promise<void>;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [busyInterestId, setBusyInterestId] = useState<string | null>(null);
  const [helpersDraft, setHelpersDraft] = useState("");
  const [savingHelpers, setSavingHelpers] = useState(false);
  const meta = event.post_metadata ?? {};
  const interestCount = event.interests.length;
  const acceptedCount = event.interests.filter((i) => i.status === "accepted").length;
  const pendingCount = event.interests.filter(
    (i) => (i.status ?? "pending") === "pending",
  ).length;
  const helpersNeeded = parseEventHelpersNeeded(meta as Record<string, unknown>);
  const mediaUrl =
    event.media_type === "image" && event.storage_path
      ? publicProfileMediaUrl(event.storage_path, { width: 720, quality: 85 })
      : null;
  const eventWhen = getEventDateTime(meta);
  const isUpcoming = eventWhen ? !isPast(eventWhen) : null;

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-[22px] border border-slate-200/80 bg-white shadow-sm dark:border-white/5 dark:bg-zinc-900">
      {mediaUrl ? (
        <div className="flex w-full items-center justify-center bg-slate-100 dark:bg-zinc-950/80">
          <div className="aspect-[3/4] w-full max-h-[420px]">
            <img
              src={mediaUrl}
              alt=""
              className="h-full w-full object-contain"
            />
          </div>
        </div>
      ) : null}

      <div className="flex flex-1 flex-col space-y-4 p-5">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-violet-100 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
              <Sparkles className="h-3.5 w-3.5" />
              Event
            </div>
            {isUpcoming != null ? (
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
                  isUpcoming
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {isUpcoming ? "Upcoming" : "Past"}
              </span>
            ) : null}
            {helpersNeeded != null ? (
              <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-violet-600 px-3 py-1.5 text-xs font-bold text-white">
                <Users className="h-3.5 w-3.5" />
                {acceptedCount}/{helpersNeeded} helpers
              </span>
            ) : (
              <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-violet-600 px-3 py-1.5 text-xs font-bold text-white">
                <Users className="h-3.5 w-3.5" />
                {interestCount} interested
              </span>
            )}
          </div>
          <h2 className="text-lg font-bold tracking-tight text-foreground">
            {meta.event_name?.trim() || "Untitled event"}
          </h2>
          {event.caption?.trim() ? (
            <p className="line-clamp-3 text-sm text-muted-foreground">
              {event.caption.trim()}
            </p>
          ) : null}
        </div>

        <div className="space-y-2 text-sm">
          {meta.date_time ? (
            <div className="flex items-start gap-2 font-semibold text-foreground">
              <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span>{meta.date_time}</span>
            </div>
          ) : null}
          {meta.location ? (
            <div className="flex items-start gap-2 font-semibold text-foreground">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="line-clamp-2">{meta.location}</span>
            </div>
          ) : null}
        </div>

        <div className="mt-auto flex flex-wrap gap-2 pt-1">
          <Button variant="outline" size="sm" className="rounded-full" asChild>
            <Link to={`/posts?post=${event.id}`}>View on feed</Link>
          </Button>
          <Button
            type="button"
            variant={settingsOpen ? "default" : "ghost"}
            size="sm"
            className={cn(
              "gap-1.5 rounded-full",
              settingsOpen
                ? "bg-violet-600 text-white hover:bg-violet-700"
                : "text-violet-700 hover:text-violet-800 dark:text-violet-300",
            )}
            onClick={() => {
              setSettingsOpen((prev) => {
                const next = !prev;
                if (next) {
                  setHelpersDraft(
                    helpersNeeded != null ? String(helpersNeeded) : "",
                  );
                }
                return next;
              });
            }}
          >
            <Settings2 className="h-4 w-4" />
            Settings
          </Button>
          {interestCount > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 rounded-full text-violet-700 hover:text-violet-800 dark:text-violet-300"
              onClick={() => setExpanded((prev) => !prev)}
            >
              {expanded ? (
                <>
                  Hide
                  <ChevronUp className="h-4 w-4" />
                </>
              ) : (
                <>
                  Interested ({pendingCount})
                  <ChevronDown className="h-4 w-4" />
                </>
              )}
            </Button>
          ) : null}
        </div>

        {settingsOpen ? (
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 dark:border-white/10 dark:bg-zinc-900/60">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Event settings
            </p>
            <div className="mt-3 space-y-2">
              <label className="text-sm font-semibold text-foreground">
                Helpers needed
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  placeholder="Optional"
                  value={helpersDraft}
                  onChange={(e) => setHelpersDraft(e.target.value)}
                  className={cn("h-10 max-w-[8rem] rounded-xl", noFieldSpinnerClass)}
                />
                <Button
                  type="button"
                  size="sm"
                  className="rounded-full"
                  disabled={savingHelpers}
                  onClick={() => {
                    void (async () => {
                      setSavingHelpers(true);
                      try {
                        const trimmed = helpersDraft.trim();
                        const parsed = trimmed ? parseInt(trimmed, 10) : null;
                        const value =
                          parsed != null && Number.isFinite(parsed) && parsed > 0
                            ? parsed
                            : null;
                        await onHelpersNeededSave(event.id, value);
                      } finally {
                        setSavingHelpers(false);
                      }
                    })();
                  }}
                >
                  {savingHelpers ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Save"
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {acceptedCount} accepted
                {helpersNeeded != null ? ` of ${helpersNeeded} needed` : ""}
                {pendingCount > 0 ? ` · ${pendingCount} pending review` : ""}
              </p>
            </div>

            {interestCount > 0 ? (
              <div className="mt-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                  Choose helpers
                </p>
                <div className="divide-y divide-violet-200/60 rounded-xl border border-violet-200/70 bg-white dark:divide-violet-900/40 dark:border-violet-900/40 dark:bg-zinc-950/40">
                  {event.interests.map((interest) => (
                    <EventInterestManageRow
                      key={interest.id}
                      interest={interest}
                      busyId={busyInterestId}
                      onStatusChange={(interestId, status) => {
                        void (async () => {
                          setBusyInterestId(interestId);
                          try {
                            await onInterestStatusChange(event.id, interestId, status);
                          } finally {
                            setBusyInterestId(null);
                          }
                        })();
                      }}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                No one has requested to join yet.
              </p>
            )}
          </div>
        ) : null}

        {expanded && interestCount > 0 ? (
          <div className="rounded-2xl border border-violet-200/70 bg-violet-50/50 p-2 dark:border-violet-900/40 dark:bg-violet-950/20">
            <p className="px-3 pb-1 pt-2 text-xs font-bold uppercase tracking-wide text-violet-700 dark:text-violet-300">
              Interested users
            </p>
            <div className="divide-y divide-violet-200/60 dark:divide-violet-900/40">
              {event.interests.map((interest) => (
                <EventInterestManageRow
                  key={interest.id}
                  interest={interest}
                  busyId={busyInterestId}
                  onStatusChange={(interestId, status) => {
                    void (async () => {
                      setBusyInterestId(interestId);
                      try {
                        await onInterestStatusChange(event.id, interestId, status);
                      } finally {
                        setBusyInterestId(null);
                      }
                    })();
                  }}
                />
              ))}
            </div>
          </div>
        ) : null}

        {interestCount === 0 ? (
          <p className="rounded-xl bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            No join requests yet. Share your event on the community feed.
          </p>
        ) : null}
      </div>
    </article>
  );
}

export default function FreelancerProfileEventsPage() {
  const { user, profile } = useAuth();
  const { guardKycAction } = useKycGate();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<EventWithInterests[]>([]);
  const [composeOpen, setComposeOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<EventSortFilter>("newest");
  const [interestFilter, setInterestFilter] = useState<EventInterestFilter>("all");
  const [timingFilter, setTimingFilter] = useState<EventTimingFilter>("all");

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      setLoading(true);
      try {
        const { data: eventRows, error: eventsError } = await supabase
          .from("profile_posts")
          .select(
            "id, caption, media_type, storage_path, post_metadata, created_at",
          )
          .eq("author_id", user.id)
          .eq("post_type_id", "event")
          .order("created_at", { ascending: false });

        if (eventsError) throw eventsError;

        const rows = (eventRows ?? []) as EventPostRow[];
        const postIds = rows.map((row) => row.id);

        if (postIds.length === 0) {
          if (!cancelled) setEvents([]);
          return;
        }

        const { data: interestRows, error: interestsError } = await supabase
          .from("profile_post_event_join_interests")
          .select(
            "id, post_id, user_id, created_at, status, profiles:user_id(id, full_name, photo_url)",
          )
          .in("post_id", postIds)
          .order("created_at", { ascending: false });

        if (interestsError) throw interestsError;

        const interestsByPost = new Map<string, EventJoinInterestRow[]>();
        for (const interest of (interestRows ?? []) as EventJoinInterestRow[]) {
          const list = interestsByPost.get(interest.post_id) ?? [];
          list.push(interest);
          interestsByPost.set(interest.post_id, list);
        }

        if (!cancelled) {
          setEvents(
            rows.map((row) => ({
              ...row,
              interests: interestsByPost.get(row.id) ?? [],
            })),
          );
        }
      } catch (error) {
        console.error("[ProfileEventsPage] load", error);
        if (!cancelled) setEvents([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const filteredEvents = useMemo(() => {
    let next = events.filter((event) => eventMatchesSearch(event, searchQuery));

    if (interestFilter === "with_interest") {
      next = next.filter((event) => event.interests.length > 0);
    } else if (interestFilter === "no_interest") {
      next = next.filter((event) => event.interests.length === 0);
    }

    if (timingFilter === "upcoming") {
      next = next.filter((event) => {
        const when = getEventDateTime(event.post_metadata);
        return when ? !isPast(when) : false;
      });
    } else if (timingFilter === "past") {
      next = next.filter((event) => {
        const when = getEventDateTime(event.post_metadata);
        return when ? isPast(when) : false;
      });
    }

    next = [...next].sort((a, b) => {
      if (sortBy === "most_interested") {
        return b.interests.length - a.interests.length;
      }
      if (sortBy === "oldest") {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (sortBy === "event_soonest") {
        const aWhen = getEventDateTime(a.post_metadata)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const bWhen = getEventDateTime(b.post_metadata)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return aWhen - bWhen;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return next;
  }, [events, interestFilter, searchQuery, sortBy, timingFilter]);

  const totalInterested = useMemo(
    () => events.reduce((sum, event) => sum + event.interests.length, 0),
    [events],
  );

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    sortBy !== "newest" ||
    interestFilter !== "all" ||
    timingFilter !== "all";

  const authorProfile: ProfileSnippet | null = user
    ? {
        id: user.id,
        full_name: profile?.full_name ?? null,
        photo_url: profile?.photo_url ?? null,
      }
    : null;

  function openEventCompose() {
    guardKycAction("share_post", () => setComposeOpen(true));
  }

  async function handleInterestStatusChange(
    postId: string,
    interestId: string,
    status: EventJoinInterestStatus,
  ) {
    await updateEventJoinInterestStatus(supabase, interestId, status);
    setEvents((prev) =>
      prev.map((event) =>
        event.id !== postId
          ? event
          : {
              ...event,
              interests: event.interests.map((interest) =>
                interest.id === interestId ? { ...interest, status } : interest,
              ),
            },
      ),
    );
  }

  async function handleHelpersNeededSave(postId: string, helpersNeeded: number | null) {
    if (!user?.id) return;
    const event = events.find((row) => row.id === postId);
    if (!event) return;
    const metadata = (event.post_metadata ?? {}) as Record<string, unknown>;
    await updateEventPostHelpersNeeded(
      supabase,
      postId,
      user.id,
      metadata,
      helpersNeeded,
    );
    setEvents((prev) =>
      prev.map((row) =>
        row.id !== postId
          ? row
          : {
              ...row,
              post_metadata: {
                ...row.post_metadata,
                helpers_needed: helpersNeeded ?? undefined,
              },
            },
      ),
    );
  }

  return (
    <>
    <ProfileSubpageLayout
      title="My events"
      description="Events you created and people who want to join."
      className="bg-white dark:bg-background"
    >
      {loading ? (
        <div className="flex min-h-[240px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-[22px] border border-dashed border-border/80 bg-muted/20 px-6 py-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
            <CalendarDays className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-bold text-foreground">No events yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Create an event post on the community feed to start collecting interest from other members.
          </p>
          <Button className="mt-6 rounded-full" type="button" onClick={openEventCompose}>
            Create an event
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:max-w-md">
            <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 dark:border-white/5 dark:bg-zinc-900">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Events
              </p>
              <p className="mt-1 text-2xl font-black tabular-nums text-foreground">
                {events.length}
              </p>
            </div>
            <div className="rounded-2xl border border-violet-200/70 bg-violet-50/70 px-4 py-3 dark:border-violet-900/40 dark:bg-violet-950/20">
              <p className="text-xs font-bold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                Interested
              </p>
              <p className="mt-1 text-2xl font-black tabular-nums text-violet-700 dark:text-violet-200">
                {totalInterested}
              </p>
            </div>
          </div>

          <div className="space-y-3 rounded-[22px] border border-slate-200/80 bg-white p-4 dark:border-white/5 dark:bg-zinc-900">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search events, locations…"
              className="h-11 rounded-xl border-input bg-background"
            />

            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                Sort
              </p>
              <div className="flex flex-wrap gap-2">
                <FilterChip selected={sortBy === "newest"} onClick={() => setSortBy("newest")}>
                  Newest
                </FilterChip>
                <FilterChip selected={sortBy === "oldest"} onClick={() => setSortBy("oldest")}>
                  Oldest
                </FilterChip>
                <FilterChip
                  selected={sortBy === "event_soonest"}
                  onClick={() => setSortBy("event_soonest")}
                >
                  Event date
                </FilterChip>
                <FilterChip
                  selected={sortBy === "most_interested"}
                  onClick={() => setSortBy("most_interested")}
                >
                  Most interested
                </FilterChip>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                Interest
              </p>
              <div className="flex flex-wrap gap-2">
                <FilterChip
                  selected={interestFilter === "all"}
                  onClick={() => setInterestFilter("all")}
                >
                  All
                </FilterChip>
                <FilterChip
                  selected={interestFilter === "with_interest"}
                  onClick={() => setInterestFilter("with_interest")}
                >
                  Has interest
                </FilterChip>
                <FilterChip
                  selected={interestFilter === "no_interest"}
                  onClick={() => setInterestFilter("no_interest")}
                >
                  No interest yet
                </FilterChip>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                Timing
              </p>
              <div className="flex flex-wrap gap-2">
                <FilterChip
                  selected={timingFilter === "all"}
                  onClick={() => setTimingFilter("all")}
                >
                  All
                </FilterChip>
                <FilterChip
                  selected={timingFilter === "upcoming"}
                  onClick={() => setTimingFilter("upcoming")}
                >
                  Upcoming
                </FilterChip>
                <FilterChip
                  selected={timingFilter === "past"}
                  onClick={() => setTimingFilter("past")}
                >
                  Past
                </FilterChip>
              </div>
            </div>

            {hasActiveFilters ? (
              <div className="flex items-center justify-between gap-3 pt-1">
                <p className="text-sm font-medium text-muted-foreground">
                  Showing {filteredEvents.length} of {events.length}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="rounded-full"
                  onClick={() => {
                    setSearchQuery("");
                    setSortBy("newest");
                    setInterestFilter("all");
                    setTimingFilter("all");
                  }}
                >
                  Clear filters
                </Button>
              </div>
            ) : null}
          </div>

          {filteredEvents.length === 0 ? (
            <div className="rounded-[22px] border border-dashed border-border/80 bg-muted/20 px-6 py-10 text-center">
              <p className="text-sm font-semibold text-foreground">No events match your filters</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try changing search or filter options.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
              {filteredEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onInterestStatusChange={handleInterestStatusChange}
                  onHelpersNeededSave={handleHelpersNeededSave}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </ProfileSubpageLayout>

    {authorProfile ? (
      <ComposeModal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        onPosted={() => setComposeOpen(false)}
        authorProfile={authorProfile}
        initialPostTypeId="event"
      />
    ) : null}
    </>
  );
}
