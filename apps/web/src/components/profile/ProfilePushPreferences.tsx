import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Switch } from "@/components/ui/switch";
import { apiGet, apiPatch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { profileMenuListClassName } from "@/components/profile/ProfileMenuRow";

type PushPreferences = {
  push_enabled: boolean;
  messages_enabled: boolean;
  new_match_enabled: boolean;
  request_accepted_enabled: boolean;
  match_selected_enabled: boolean;
  favorite_profile_post_enabled: boolean;
  comment_enabled: boolean;
  like_enabled: boolean;
  post_expiry_enabled: boolean;
  post_expiry_timing: "at_expiry" | "today" | "tomorrow";
  timezone: string;
};

const DEFAULT_PREFS: PushPreferences = {
  push_enabled: true,
  messages_enabled: true,
  new_match_enabled: true,
  request_accepted_enabled: true,
  match_selected_enabled: true,
  favorite_profile_post_enabled: true,
  comment_enabled: true,
  like_enabled: true,
  post_expiry_enabled: true,
  post_expiry_timing: "at_expiry",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
};

type PrefKey = Exclude<keyof PushPreferences, "post_expiry_timing" | "timezone">;

function PrefRow({
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  return (
    <div className="profile-menu-row flex items-stretch px-4 md:px-5">
      <div className="profile-menu-row-divider flex min-w-0 flex-1 items-center justify-between gap-3 border-slate-100 py-3.5 dark:border-white/5">
        <div className="min-w-0">
          <p className="text-[17px] font-medium tracking-tight text-foreground">{label}</p>
          {description ? (
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <Switch
          checked={checked}
          disabled={disabled}
          onCheckedChange={onCheckedChange}
          aria-label={label}
        />
      </div>
    </div>
  );
}

export function ProfilePushPreferences() {
  const { t } = useTranslation();
  const [prefs, setPrefs] = useState<PushPreferences>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiGet<{ preferences: PushPreferences }>("/api/push/preferences");
        if (!cancelled && res.preferences) {
          setPrefs({ ...DEFAULT_PREFS, ...res.preferences });
        }
      } catch {
        /* preferences row is created on first save */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function updatePref(patch: Partial<PushPreferences>, key: string) {
    setSavingKey(key);
    const next = { ...prefs, ...patch };
    setPrefs(next);
    try {
      const res = await apiPatch<{ preferences: PushPreferences }>("/api/push/preferences", patch);
      if (res.preferences) setPrefs({ ...DEFAULT_PREFS, ...res.preferences });
    } catch {
      setPrefs(prefs);
    } finally {
      setSavingKey(null);
    }
  }

  const masterOff = !prefs.push_enabled;
  const disabled = loading || !!savingKey;

  const rows: { key: PrefKey; label: string; description?: string }[] = [
    { key: "messages_enabled", label: t("profile.push.messages"), description: t("profile.push.messagesDesc") },
    { key: "new_match_enabled", label: t("profile.push.newMatch"), description: t("profile.push.newMatchDesc") },
    {
      key: "request_accepted_enabled",
      label: t("profile.push.requestAccepted"),
      description: t("profile.push.requestAcceptedDesc"),
    },
    {
      key: "match_selected_enabled",
      label: t("profile.push.matchSelected"),
      description: t("profile.push.matchSelectedDesc"),
    },
    {
      key: "favorite_profile_post_enabled",
      label: t("profile.push.favoritePosts"),
      description: t("profile.push.favoritePostsDesc"),
    },
    { key: "comment_enabled", label: t("profile.push.comments"), description: t("profile.push.commentsDesc") },
    { key: "like_enabled", label: t("profile.push.likes"), description: t("profile.push.likesDesc") },
    {
      key: "post_expiry_enabled",
      label: t("profile.push.postExpiry"),
      description: t("profile.push.postExpiryDesc"),
    },
  ];

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center gap-2">
        <Bell className="h-4 w-4 text-muted-foreground" aria-hidden />
        <h2 className="text-sm font-semibold text-foreground">{t("profile.push.title")}</h2>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">{t("profile.push.subtitle")}</p>

      <div className={profileMenuListClassName}>
        <PrefRow
          label={t("profile.push.master")}
          description={t("profile.push.masterDesc")}
          checked={prefs.push_enabled}
          disabled={disabled}
          onCheckedChange={(checked) => void updatePref({ push_enabled: checked }, "push_enabled")}
        />
        {rows.map((row, index) => (
          <div
            key={row.key}
            className={cn(index > 0 && "[&_.profile-menu-row-divider]:border-t")}
          >
            <PrefRow
              label={row.label}
              description={row.description}
              checked={prefs[row.key]}
              disabled={disabled || masterOff}
              onCheckedChange={(checked) => void updatePref({ [row.key]: checked }, row.key)}
            />
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-[24px] border border-slate-200/80 bg-white p-4 shadow-sm dark:border-0 dark:bg-zinc-900">
        <label htmlFor="post-expiry-timing" className="text-sm font-medium text-foreground">
          {t("profile.push.expiryTimingLabel")}
        </label>
        <p className="mt-1 text-sm text-muted-foreground">{t("profile.push.expiryTimingDesc")}</p>
        <select
          id="post-expiry-timing"
          className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
          value={prefs.post_expiry_timing}
          disabled={disabled || masterOff || !prefs.post_expiry_enabled}
          onChange={(e) =>
            void updatePref(
              { post_expiry_timing: e.target.value as PushPreferences["post_expiry_timing"] },
              "post_expiry_timing",
            )
          }
        >
          <option value="at_expiry">{t("profile.push.expiryAtExpiry")}</option>
          <option value="today">{t("profile.push.expiryToday")}</option>
          <option value="tomorrow">{t("profile.push.expiryTomorrow")}</option>
        </select>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">{t("profile.push.mobileNote")}</p>
    </section>
  );
}
