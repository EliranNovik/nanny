import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";
import { Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { apiPost } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type FlagReason = {
  category?: string;
  confidence?: number;
  detail?: string;
};

type FlagRow = {
  id: string;
  profile_post_id: string | null;
  community_post_id: string | null;
  author_id: string;
  title: string | null;
  excerpt: string | null;
  reasons: FlagReason[];
  outcome: "flag" | "block";
  created_at: string;
  authorName: string;
};

type BlockPerson = {
  id: string;
  full_name: string | null;
  photo_url: string | null;
};

const BLOCK_REASON_LABELS: Record<string, string> = {
  spam: "Spam",
  harassment: "Harassment or bullying",
  hate_speech: "Hate speech",
  nudity: "Nudity or sexual content",
  violence: "Violence or threats",
  scam: "Scam or fake account",
  unwanted: "Don't want to see them",
  other: "Other",
};

function blockReasonLabel(code: string | null) {
  if (!code) return "Not recorded";
  return BLOCK_REASON_LABELS[code] || code.replace(/_/g, " ");
}

type UserBlockRow = {
  created_at: string;
  blocker_id: string;
  blocked_id: string;
  reason: string | null;
  reason_note: string | null;
  blocker: BlockPerson;
  blocked: BlockPerson;
};

type AdminTab = "flag" | "block" | "users";
type FlagView = "posts" | "chat" | "profiles";

type ProfileFlag = {
  id: string;
  user_id: string;
  about_user_id: string | null;
  kind: "bio" | "review";
  summary: string;
  excerpt: string | null;
  reasons: FlagReason[];
  outcome: "flag" | "block";
  created_at: string;
  authorName: string;
  aboutName: string;
};

type ChatFlag = {
  id: string;
  conversation_id: string;
  user_id: string;
  summary: string;
  excerpt: string | null;
  reasons: FlagReason[];
  outcome: "flag" | "block";
  created_at: string;
  authorName: string;
};

function asPerson(
  value: BlockPerson | BlockPerson[] | null | undefined,
  fallbackId: string,
): BlockPerson {
  const row = Array.isArray(value) ? value[0] : value;
  return {
    id: row?.id || fallbackId,
    full_name: row?.full_name?.trim() || null,
    photo_url: row?.photo_url ?? null,
  };
}

function personName(person: BlockPerson) {
  return person.full_name || "Member";
}

type BanLength = "2d" | "1w" | "1m" | "forever";

const BAN_LENGTHS: Array<[BanLength, string]> = [
  ["2d", "2 days"],
  ["1w", "1 week"],
  ["1m", "1 month"],
  ["forever", "Forever"],
];

type ActiveBan = {
  user_id: string;
  reason: string;
  duration: string;
  expires_at: string | null;
  created_at: string;
};

type BanPerson = { id: string; name: string };

type BanDialogState = {
  people: BanPerson[];
  selectedId: string;
};

function banIsLive(expiresAt: string | null) {
  return !expiresAt || new Date(expiresAt).getTime() > Date.now();
}

function banUntilLabel(ban: ActiveBan) {
  if (!ban.expires_at || ban.duration === "forever") return "Forever";
  return format(new Date(ban.expires_at), "d MMM yyyy, HH:mm");
}

const USER_REASON_OPTIONS = [
  ...Object.entries(BLOCK_REASON_LABELS),
  ["__none", "Not recorded"],
] as const;

type ListFilter = {
  reason: string;
  from: string;
  to: string;
};

const EMPTY_FILTER: ListFilter = { reason: "all", from: "", to: "" };

function localDay(iso: string) {
  const date = new Date(iso);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function inDateRange(iso: string, from: string, to: string) {
  const day = localDay(iso);
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

function flagCategories(row: FlagRow) {
  return (Array.isArray(row.reasons) ? row.reasons : [])
    .map((reason) => reason.category?.trim() || "Other")
    .filter(Boolean);
}

function ListFilters({
  reason,
  reasons,
  from,
  to,
  onChange,
}: {
  reason: string;
  reasons: ReadonlyArray<readonly [string, string]>;
  from: string;
  to: string;
  onChange: (next: ListFilter) => void;
}) {
  const active = reason !== "all" || Boolean(from) || Boolean(to);
  const fieldClass =
    "h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-900 focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-600 dark:[color-scheme:dark]";
  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <label className="flex min-w-[12rem] flex-1 flex-col gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-500">
        Why
        <select
          value={reason}
          onChange={(event) => onChange({ reason: event.target.value, from, to })}
          className={fieldClass}
        >
          <option value="all">All reasons</option>
          {reasons.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex w-40 flex-col gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-500">
        From
        <input
          type="date"
          value={from}
          max={to || undefined}
          onChange={(event) => onChange({ reason, from: event.target.value, to })}
          className={fieldClass}
        />
      </label>
      <label className="flex w-40 flex-col gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-500">
        To
        <input
          type="date"
          value={to}
          min={from || undefined}
          onChange={(event) => onChange({ reason, from, to: event.target.value })}
          className={fieldClass}
        />
      </label>
      {active ? (
        <button
          type="button"
          onClick={() => onChange(EMPTY_FILTER)}
          className="h-10 rounded-xl px-3 text-sm font-semibold text-zinc-500 hover:bg-white hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
        >
          Clear
        </button>
      ) : null}
    </div>
  );
}

function PersonCell({ person, banned }: { person: BlockPerson; banned?: boolean }) {
  const name = personName(person);
  return (
    <Link
      to={`/profile/${person.id}`}
      onClick={(event) => event.stopPropagation()}
      className="inline-flex min-w-0 items-center gap-2.5 hover:underline"
    >
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarImage src={person.photo_url || undefined} alt="" />
        <AvatarFallback className="text-[11px] font-bold">{name.slice(0, 1).toUpperCase()}</AvatarFallback>
      </Avatar>
      <span className="truncate font-semibold text-zinc-900 dark:text-zinc-100">{name}</span>
      {banned ? (
        <span className="shrink-0 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-600 dark:text-red-400">
          Banned
        </span>
      ) : null}
    </Link>
  );
}

export default function AdminFlaggedPostsPage() {
  const { addToast } = useToast();
  const [rows, setRows] = useState<FlagRow[]>([]);
  const [blocks, setBlocks] = useState<UserBlockRow[]>([]);
  const [tab, setTab] = useState<AdminTab>("flag");
  const [flagView, setFlagView] = useState<FlagView>("posts");
  const [chatFlags, setChatFlags] = useState<ChatFlag[]>([]);
  const [chatMissing, setChatMissing] = useState(false);
  const [profileFlags, setProfileFlags] = useState<ProfileFlag[]>([]);
  const [profileMissing, setProfileMissing] = useState(false);
  const [dismissingChatId, setDismissingChatId] = useState<string | null>(null);
  const [dismissingProfileId, setDismissingProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);
  const [blocksMissing, setBlocksMissing] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [blockFilter, setBlockFilter] = useState<ListFilter>(EMPTY_FILTER);
  const [userFilter, setUserFilter] = useState<ListFilter>(EMPTY_FILTER);
  const [bans, setBans] = useState<Record<string, ActiveBan>>({});
  const [banDialog, setBanDialog] = useState<BanDialogState | null>(null);
  const [banLength, setBanLength] = useState<BanLength>("2d");
  const [banReason, setBanReason] = useState("");
  const [banSaving, setBanSaving] = useState(false);

  const load = useCallback(async () => {
    const [flagsResult, blocksResult, bansResult, chatResult, profileResult] = await Promise.all([
      supabase
        .from("quality_post_flags")
        .select("id, profile_post_id, community_post_id, author_id, title, excerpt, reasons, outcome, created_at")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("user_blocks")
        .select(
          `
          created_at,
          blocker_id,
          blocked_id,
          reason,
          reason_note,
          blocker:profiles!user_blocks_blocker_id_fkey ( id, full_name, photo_url ),
          blocked:profiles!user_blocks_blocked_id_fkey ( id, full_name, photo_url )
        `,
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("user_bans")
        .select("user_id, reason, duration, expires_at, created_at, lifted_at")
        .is("lifted_at", null),
      supabase
        .from("quality_chat_flags")
        .select("id, conversation_id, user_id, summary, excerpt, reasons, outcome, created_at")
        .is("dismissed_at", null)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("quality_profile_flags")
        .select("id, user_id, about_user_id, kind, summary, excerpt, reasons, outcome, created_at")
        .is("dismissed_at", null)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    if (flagsResult.error) {
      setTableMissing(/quality_post_flags|schema cache|does not exist/i.test(flagsResult.error.message));
      setRows([]);
    } else {
      const flags = (
        (flagsResult.data ?? []) as Array<Omit<FlagRow, "authorName" | "outcome"> & { outcome?: string }>
      ).map((row) => ({
        ...row,
        outcome: row.outcome === "block" ? ("block" as const) : ("flag" as const),
      }));
      const authorIds = [...new Set(flags.map((row) => row.author_id))];
      const names = new Map<string, string>();
      if (authorIds.length > 0) {
        const { data: people } = await supabase.from("profiles").select("id, full_name").in("id", authorIds);
        for (const person of people ?? []) {
          names.set(person.id, person.full_name || "Member");
        }
      }
      setRows(flags.map((row) => ({ ...row, authorName: names.get(row.author_id) || "Member" })));
      setTableMissing(false);
    }

    if (blocksResult.error) {
      setBlocksMissing(/user_blocks|schema cache|does not exist|permission|policy/i.test(blocksResult.error.message));
      setBlocks([]);
    } else {
      setBlocks(
        (
          (blocksResult.data ?? []) as Array<{
            created_at: string;
            blocker_id: string;
            blocked_id: string;
            reason: string | null;
            reason_note: string | null;
            blocker: BlockPerson | BlockPerson[] | null;
            blocked: BlockPerson | BlockPerson[] | null;
          }>
        ).map((row) => ({
          created_at: row.created_at,
          blocker_id: row.blocker_id,
          blocked_id: row.blocked_id,
          reason: row.reason?.trim() || null,
          reason_note: row.reason_note?.trim() || null,
          blocker: asPerson(row.blocker, row.blocker_id),
          blocked: asPerson(row.blocked, row.blocked_id),
        })),
      );
      setBlocksMissing(false);
    }

    if (bansResult.error) {
      setBans({});
    } else {
      const next: Record<string, ActiveBan> = {};
      for (const row of (bansResult.data ?? []) as Array<ActiveBan & { lifted_at?: string | null }>) {
        if (!banIsLive(row.expires_at)) continue;
        next[row.user_id] = {
          user_id: row.user_id,
          reason: row.reason,
          duration: row.duration,
          expires_at: row.expires_at,
          created_at: row.created_at,
        };
      }
      setBans(next);
    }

    if (chatResult.error) {
      setChatMissing(/quality_chat_flags|schema cache|does not exist/i.test(chatResult.error.message));
      setChatFlags([]);
    } else {
      const chatRows = (chatResult.data ?? []) as Array<Omit<ChatFlag, "authorName">>;
      const ids = [...new Set(chatRows.map((row) => row.user_id))];
      const names = new Map<string, string>();
      if (ids.length > 0) {
        const { data: people } = await supabase.from("profiles").select("id, full_name").in("id", ids);
        for (const person of people ?? []) names.set(person.id, person.full_name || "Member");
      }
      setChatFlags(
        chatRows.map((row) => ({
          ...row,
          reasons: Array.isArray(row.reasons) ? row.reasons : [],
          authorName: names.get(row.user_id) || "Member",
        })),
      );
      setChatMissing(false);
    }

    if (profileResult.error) {
      setProfileMissing(/quality_profile_flags|schema cache|does not exist/i.test(profileResult.error.message));
      setProfileFlags([]);
    } else {
      const profileRows = (profileResult.data ?? []) as Array<Omit<ProfileFlag, "authorName" | "aboutName">>;
      const ids = [
        ...new Set(
          profileRows.flatMap((row) => [row.user_id, row.about_user_id].filter((id): id is string => Boolean(id))),
        ),
      ];
      const names = new Map<string, string>();
      if (ids.length > 0) {
        const { data: people } = await supabase.from("profiles").select("id, full_name").in("id", ids);
        for (const person of people ?? []) names.set(person.id, person.full_name || "Member");
      }
      setProfileFlags(
        profileRows.map((row) => ({
          ...row,
          reasons: Array.isArray(row.reasons) ? row.reasons : [],
          authorName: names.get(row.user_id) || "Member",
          aboutName: row.about_user_id ? names.get(row.about_user_id) || "Member" : "",
        })),
      );
      setProfileMissing(false);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleRows = rows.filter((row) => row.outcome === tab);

  const blockReasonOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const row of rows) {
      if (row.outcome !== "block") continue;
      for (const category of flagCategories(row)) {
        const key = category.toLowerCase();
        if (!seen.has(key)) seen.set(key, category);
      }
    }
    return [...seen.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([value, label]) => [value, label] as const);
  }, [rows]);

  const filteredBlocks = blocks.filter(
    (row) =>
      inDateRange(row.created_at, userFilter.from, userFilter.to) &&
      (userFilter.reason === "all" ||
        (userFilter.reason === "__none" ? !row.reason : row.reason === userFilter.reason)),
  );

  const filteredRows =
    tab === "block"
      ? visibleRows.filter(
          (row) =>
            inDateRange(row.created_at, blockFilter.from, blockFilter.to) &&
            (blockFilter.reason === "all" ||
              flagCategories(row).some((category) => category.toLowerCase() === blockFilter.reason)),
        )
      : visibleRows;

  const openBan = (people: BanPerson[], selectedId: string, suggestedReason: string) => {
    setBanLength("2d");
    setBanReason(suggestedReason.trim().slice(0, 500));
    setBanDialog({ people, selectedId });
  };

  const applyBan = async () => {
    if (!banDialog || banSaving) return;
    const reason = banReason.trim();
    if (reason.length < 3) {
      addToast({ title: "Add a reason", variant: "error" });
      return;
    }
    setBanSaving(true);
    const { error } = await supabase.rpc("admin_ban_user", {
      p_user_id: banDialog.selectedId,
      p_duration: banLength,
      p_reason: reason,
    });
    setBanSaving(false);
    if (error) {
      addToast({
        title: "Could not ban this member",
        description: /admin_ban_user|schema cache|does not exist/i.test(error.message)
          ? "Run db/sql/165_user_bans.sql in the Supabase SQL editor, then try again."
          : error.message,
        variant: "error",
      });
      return;
    }
    const expiresAt =
      banLength === "forever"
        ? null
        : new Date(Date.now() + (banLength === "2d" ? 2 : banLength === "1w" ? 7 : 30) * 86400000).toISOString();
    setBans((prev) => ({
      ...prev,
      [banDialog.selectedId]: {
        user_id: banDialog.selectedId,
        reason,
        duration: banLength,
        expires_at: expiresAt,
        created_at: new Date().toISOString(),
      },
    }));
    addToast({
      title: banLength === "forever" ? "Banned" : "Banned for a limited time",
      variant: "success",
    });
    setBanDialog(null);
  };

  const liftBan = async () => {
    if (!banDialog || banSaving) return;
    setBanSaving(true);
    const { error } = await supabase.rpc("admin_lift_ban", { p_user_id: banDialog.selectedId });
    setBanSaving(false);
    if (error) {
      addToast({ title: "Could not lift the ban", description: error.message, variant: "error" });
      return;
    }
    setBans((prev) => {
      const next = { ...prev };
      delete next[banDialog.selectedId];
      return next;
    });
    addToast({ title: "Ban lifted", variant: "success" });
    setBanDialog(null);
  };

  const dismissProfile = async (row: ProfileFlag) => {
    if (dismissingProfileId) return;
    setDismissingProfileId(row.id);
    try {
      await apiPost(`/api/admin/profile-flags/${row.id}/dismiss`, {});
      setProfileFlags((prev) => prev.filter((item) => item.id !== row.id));
      addToast({ title: "Cleared", variant: "success" });
    } catch (err) {
      addToast({
        title: "Could not clear it",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "error",
      });
    } finally {
      setDismissingProfileId(null);
    }
  };

  const dismissChat = async (row: ChatFlag) => {
    if (dismissingChatId) return;
    setDismissingChatId(row.id);
    try {
      await apiPost(`/api/admin/chat-flags/${row.id}/dismiss`, {});
      setChatFlags((prev) => prev.filter((item) => item.id !== row.id));
      addToast({ title: "Cleared", variant: "success" });
    } catch (err) {
      addToast({
        title: "Could not clear it",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "error",
      });
    } finally {
      setDismissingChatId(null);
    }
  };

  const remove = async (row: FlagRow) => {
    if (removingId) return;
    const blocked = row.outcome === "block";
    if (!window.confirm(blocked ? "Clear this blocked attempt?" : "Remove this post from Tebnu?")) return;
    setRemovingId(row.id);
    try {
      await apiPost(`/api/admin/quality-flags/${row.id}/remove`, {});
      setRows((prev) => prev.filter((item) => item.id !== row.id));
      addToast({
        title: row.outcome === "block" ? "Cleared" : "Post removed",
        variant: "success",
      });
    } catch (err) {
      addToast({
        title: "Could not remove it",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "error",
      });
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="admin-page min-h-screen bg-zinc-100 pb-10 dark:bg-zinc-950 md:h-[calc(100dvh-4rem)] md:min-h-0 md:overflow-y-auto">
      <div className="w-full px-2 py-6 md:px-4 lg:px-6 xl:px-8">
        <nav className="mb-5 flex flex-wrap items-center gap-1" aria-label="Flagged posts">
          {(
            [
              ["flag", "Flagged"],
              ["block", "Blocked"],
              ["users", "Blocked users"],
            ] as const
          ).map(([id, label]) => {
            const selected = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                aria-current={selected ? "page" : undefined}
                className={cn(
                  "rounded-xl px-3 py-2 text-xl font-extrabold tracking-tight transition-colors sm:text-3xl",
                  selected
                    ? "text-zinc-900 underline decoration-2 underline-offset-8 dark:text-zinc-50"
                    : "text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300",
                  selected && id === "flag" && "decoration-orange-500",
                  selected && id === "block" && "decoration-sky-600",
                  selected && id === "users" && "decoration-rose-500",
                )}
              >
                {label}
              </button>
            );
          })}
        </nav>
        <p className="mb-4 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          {tab === "users"
            ? "Who blocked whom, and the reason they picked. Newest first."
            : tab === "block"
              ? "Stopped before they were shared."
              : flagView === "chat"
                ? "Chats the quality manager flagged. The summary is why."
                : flagView === "profiles"
                  ? "Bios and reviews the quality manager flagged."
                  : "Already visible. Remove one if it should not stay up."}
        </p>
        {tab === "flag" ? (
          <div className="mb-6 flex flex-wrap gap-2">
            {(
              [
                ["posts", "Flagged posts"],
                ["chat", "Flagged in chat"],
                ["profiles", "Flagged profiles"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFlagView(id)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm font-semibold",
                  flagView === id
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "bg-white text-zinc-600 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-700",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        ) : (
          <div className="mb-2" />
        )}

        {tab === "users" ? (
          blocksMissing ? (
            <div className="rounded-2xl bg-white p-6 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
              Run{" "}
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">
                db/sql/163_user_blocks_admin_select.sql
              </code>{" "}
              and{" "}
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">
                db/sql/164_user_blocks_reason.sql
              </code>{" "}
              in the Supabase SQL editor, then reload.
            </div>
          ) : loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
            </div>
          ) : blocks.length === 0 ? (
            <div className="rounded-2xl bg-white px-6 py-12 text-center text-sm text-zinc-500 dark:bg-zinc-900">
              No one has blocked another member yet.
            </div>
          ) : (
            <>
            <ListFilters
              reason={userFilter.reason}
              reasons={USER_REASON_OPTIONS}
              from={userFilter.from}
              to={userFilter.to}
              onChange={setUserFilter}
            />
            {filteredBlocks.length === 0 ? (
              <div className="rounded-2xl bg-white px-6 py-12 text-center text-sm text-zinc-500 dark:bg-zinc-900">
                Nothing matches these filters.
              </div>
            ) : (
            <div className="overflow-x-auto rounded-2xl bg-white dark:bg-zinc-900">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="px-4 py-3 font-bold">When</th>
                    <th className="px-4 py-3 font-bold">Blocked by</th>
                    <th className="px-4 py-3 font-bold">Blocked</th>
                    <th className="px-4 py-3 font-bold">Why</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBlocks.map((row) => (
                    <tr
                      key={`${row.blocker_id}-${row.blocked_id}`}
                      onClick={() =>
                        openBan(
                          [
                            { id: row.blocker.id, name: personName(row.blocker) },
                            { id: row.blocked.id, name: personName(row.blocked) },
                          ],
                          row.blocked.id,
                          [row.reason ? blockReasonLabel(row.reason) : "", row.reason_note || ""]
                            .filter((part) => part && part !== "Not recorded")
                            .join(". "),
                        )
                      }
                      className="cursor-pointer border-t border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-zinc-500">
                        {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}
                      </td>
                      <td className="px-4 py-3">
                        <PersonCell person={row.blocker} banned={Boolean(bans[row.blocker.id])} />
                      </td>
                      <td className="px-4 py-3">
                        <PersonCell person={row.blocked} banned={Boolean(bans[row.blocked.id])} />
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {blockReasonLabel(row.reason)}
                        </p>
                        {row.reason_note ? (
                          <p className="mt-1 max-w-xs text-zinc-500">{row.reason_note}</p>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
            </>
          )
        ) : tab === "flag" && flagView === "profiles" ? (
          profileMissing ? (
            <div className="rounded-2xl bg-white p-6 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
              Run{" "}
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">
                db/sql/167_quality_profile_flags.sql
              </code>{" "}
              in the Supabase SQL editor, then reload.
            </div>
          ) : loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
            </div>
          ) : profileFlags.length === 0 ? (
            <div className="rounded-2xl bg-white px-6 py-12 text-center text-sm text-zinc-500 dark:bg-zinc-900">
              No bios or reviews are waiting for a look.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl bg-white dark:bg-zinc-900">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-zinc-100 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                  <tr>
                    <th className="px-4 py-3 font-bold">When</th>
                    <th className="px-4 py-3 font-bold">Where</th>
                    <th className="px-4 py-3 font-bold">Member</th>
                    <th className="px-4 py-3 font-bold">Summary</th>
                    <th className="px-4 py-3 font-bold">Why</th>
                    <th className="px-4 py-3 font-bold" />
                  </tr>
                </thead>
                <tbody>
                  {profileFlags.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() =>
                        openBan(
                          [{ id: row.user_id, name: row.authorName }],
                          row.user_id,
                          row.reasons.map((reason) => reason.category).filter(Boolean).join(", "),
                        )
                      }
                      className="cursor-pointer border-t border-zinc-100 align-top hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-zinc-500">
                        {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}
                      </td>
                      <td className="px-4 py-3 font-semibold text-zinc-800 dark:text-zinc-200">
                        {row.kind === "bio" ? "Bio" : "Review"}
                        {row.kind === "review" && row.aboutName ? (
                          <p className="mt-1 font-normal text-zinc-500">About {row.aboutName}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-100">
                        <Link
                          to={`/admin/members/${row.user_id}`}
                          onClick={(event) => event.stopPropagation()}
                          className="underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-900 dark:hover:decoration-zinc-100"
                        >
                          {row.authorName}
                        </Link>
                      </td>
                      <td className="max-w-xs px-4 py-3">
                        <p className="font-semibold text-zinc-900 dark:text-zinc-100">{row.summary}</p>
                        {row.excerpt ? (
                          <p className="mt-1 line-clamp-3 whitespace-pre-line text-zinc-500">{row.excerpt}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <ul className="space-y-2">
                          {row.reasons.map((reason, index) => (
                            <li key={`${row.id}-${index}`}>
                              <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                                {reason.category || "Other"} · {Math.round(reason.confidence ?? 0)}%
                              </span>
                              {reason.detail ? <p className="text-zinc-500">{reason.detail}</p> : null}
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void dismissProfile(row);
                          }}
                          disabled={dismissingProfileId === row.id}
                          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-500/10"
                        >
                          {dismissingProfileId === row.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                          Dismiss
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : tab === "flag" && flagView === "chat" ? (
          chatMissing ? (
            <div className="rounded-2xl bg-white p-6 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
              Run{" "}
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">
                db/sql/166_quality_chat_flags.sql
              </code>{" "}
              in the Supabase SQL editor, then reload.
            </div>
          ) : loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
            </div>
          ) : chatFlags.length === 0 ? (
            <div className="rounded-2xl bg-white px-6 py-12 text-center text-sm text-zinc-500 dark:bg-zinc-900">
              No chats are waiting for a look.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl bg-white dark:bg-zinc-900">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-zinc-100 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                  <tr>
                    <th className="px-4 py-3 font-bold">When</th>
                    <th className="px-4 py-3 font-bold">Member</th>
                    <th className="px-4 py-3 font-bold">Summary</th>
                    <th className="px-4 py-3 font-bold">Why</th>
                    <th className="px-4 py-3 font-bold" />
                  </tr>
                </thead>
                <tbody>
                  {chatFlags.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() =>
                        openBan(
                          [{ id: row.user_id, name: row.authorName }],
                          row.user_id,
                          row.reasons.map((reason) => reason.category).filter(Boolean).join(", "),
                        )
                      }
                      className="cursor-pointer border-t border-zinc-100 align-top hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-zinc-500">
                        {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}
                        <div className="mt-1 text-[11px] uppercase tracking-wider">
                          {row.outcome === "block" ? "Blocked" : "Flagged"}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-100">
                        <span className="inline-flex items-center gap-2">
                          <Link
                            to={`/admin/members/${row.user_id}`}
                            onClick={(event) => event.stopPropagation()}
                            className="underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-900 dark:hover:decoration-zinc-100"
                          >
                            {row.authorName}
                          </Link>
                          {bans[row.user_id] ? (
                            <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-600 dark:text-red-400">
                              Banned
                            </span>
                          ) : null}
                        </span>
                      </td>
                      <td className="max-w-xs px-4 py-3">
                        <p className="font-semibold text-zinc-900 dark:text-zinc-100">{row.summary}</p>
                        {row.excerpt ? (
                          <p className="mt-1 line-clamp-3 whitespace-pre-line text-zinc-500">{row.excerpt}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <ul className="space-y-2">
                          {row.reasons.map((reason, index) => (
                            <li key={`${row.id}-${index}`}>
                              <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                                {reason.category || "Other"} · {Math.round(reason.confidence ?? 0)}%
                              </span>
                              {reason.detail ? <p className="text-zinc-500">{reason.detail}</p> : null}
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void dismissChat(row);
                          }}
                          disabled={dismissingChatId === row.id}
                          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-500/10"
                        >
                          {dismissingChatId === row.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                          Dismiss
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : tableMissing ? (
          <div className="rounded-2xl bg-white p-6 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
            Run <code className="rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">db/sql/159_quality_manager.sql</code> and{" "}
            <code className="rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">db/sql/162_quality_blocked_posts.sql</code>{" "}
            in the Supabase SQL editor, then reload.
          </div>
        ) : loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          </div>
        ) : visibleRows.length === 0 ? (
          <div className="rounded-2xl bg-white px-6 py-12 text-center text-sm text-zinc-500 dark:bg-zinc-900">
            {tab === "block" ? "No blocked posts yet." : "Nothing is waiting for a look."}
          </div>
        ) : (
          <>
          {tab === "block" ? (
            <ListFilters
              reason={blockFilter.reason}
              reasons={blockReasonOptions}
              from={blockFilter.from}
              to={blockFilter.to}
              onChange={setBlockFilter}
            />
          ) : null}
          {filteredRows.length === 0 ? (
            <div className="rounded-2xl bg-white px-6 py-12 text-center text-sm text-zinc-500 dark:bg-zinc-900">
              Nothing matches these filters.
            </div>
          ) : (
          <div className="overflow-x-auto rounded-2xl bg-white dark:bg-zinc-900">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-bold">When</th>
                  <th className="px-4 py-3 font-bold">Author</th>
                  <th className="px-4 py-3 font-bold">Post</th>
                  <th className="px-4 py-3 font-bold">Why</th>
                  <th className="px-4 py-3 font-bold" />
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() =>
                      openBan(
                        [{ id: row.author_id, name: row.authorName }],
                        row.author_id,
                        flagCategories(row).join(", "),
                      )
                    }
                    className="cursor-pointer border-t border-zinc-100 align-top hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-zinc-500">
                      {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}
                      {row.outcome === "block" ? null : (
                        <div className="mt-1 text-[11px] uppercase tracking-wider">
                          {row.community_post_id ? "Availability" : "Post"}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-100">
                      <span className="inline-flex items-center gap-2">
                        {tab === "block" ? (
                          <Link
                            to={`/admin/members/${row.author_id}`}
                            onClick={(event) => event.stopPropagation()}
                            className="underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-900 dark:hover:decoration-zinc-100"
                          >
                            {row.authorName}
                          </Link>
                        ) : (
                          row.authorName
                        )}
                        {bans[row.author_id] ? (
                          <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-600 dark:text-red-400">
                            Banned
                          </span>
                        ) : null}
                      </span>
                    </td>
                    <td className="max-w-xs px-4 py-3">
                      <p className="font-semibold text-zinc-900 dark:text-zinc-100">{row.title || "Untitled"}</p>
                      {row.excerpt ? <p className="mt-1 line-clamp-3 text-zinc-500">{row.excerpt}</p> : null}
                    </td>
                    <td className="px-4 py-3">
                      <ul className="space-y-2">
                        {(Array.isArray(row.reasons) ? row.reasons : []).map((reason, index) => (
                          <li key={`${row.id}-${index}`}>
                            <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                              {reason.category || "Other"} · {Math.round(reason.confidence ?? 0)}%
                            </span>
                            {reason.detail ? <p className="text-zinc-500">{reason.detail}</p> : null}
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void remove(row);
                        }}
                        disabled={removingId === row.id}
                        className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-500/10"
                      >
                        {removingId === row.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        {row.outcome === "block" ? "Dismiss" : "Remove"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
          </>
        )}
      </div>
      <Dialog
        open={banDialog !== null}
        onOpenChange={(open) => {
          if (!open && !banSaving) setBanDialog(null);
        }}
      >
        <DialogContent className="max-w-md rounded-3xl">
          {banDialog ? (
            <>
              <DialogHeader>
                <DialogTitle>Ban a member</DialogTitle>
                <DialogDescription>
                  The account stays. They cannot sign in, and other members cannot see, find, or message them.
                </DialogDescription>
              </DialogHeader>
              {banDialog.people.length > 1 ? (
                <div className="flex flex-wrap gap-2">
                  {banDialog.people.map((person) => {
                    const selected = person.id === banDialog.selectedId;
                    return (
                      <button
                        key={person.id}
                        type="button"
                        onClick={() => setBanDialog({ ...banDialog, selectedId: person.id })}
                        className={cn(
                          "rounded-xl px-3 py-2 text-sm font-semibold",
                          selected
                            ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                            : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
                        )}
                      >
                        {person.name}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {banDialog.people[0]?.name}
                </p>
              )}
              {bans[banDialog.selectedId] ? (
                <p className="rounded-2xl bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                  Already banned ({banUntilLabel(bans[banDialog.selectedId])}). {bans[banDialog.selectedId].reason}
                </p>
              ) : null}
              <div className="grid grid-cols-2 gap-2">
                {BAN_LENGTHS.map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setBanLength(id)}
                    className={cn(
                      "rounded-xl px-3 py-2.5 text-sm font-bold",
                      banLength === id
                        ? id === "forever"
                          ? "bg-red-600 text-white"
                          : "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                        : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500">
                Why
                <textarea
                  value={banReason}
                  onChange={(event) => setBanReason(event.target.value.slice(0, 500))}
                  rows={3}
                  placeholder="What should they see when they try to sign in?"
                  className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium normal-case tracking-normal text-zinc-900 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </label>
              <div className="flex flex-wrap justify-end gap-2">
                {bans[banDialog.selectedId] ? (
                  <button
                    type="button"
                    onClick={() => void liftBan()}
                    disabled={banSaving}
                    className="rounded-xl px-3 py-2.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Lift ban
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void applyBan()}
                  disabled={banSaving || banReason.trim().length < 3}
                  className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                >
                  {banSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {banLength === "forever" ? "Ban forever" : `Ban for ${BAN_LENGTHS.find(([id]) => id === banLength)?.[1]}`}
                </button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
