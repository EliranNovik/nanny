import { useEffect, useState, type ReactNode } from "react";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { AppBootSplash } from "@/components/AppBootSplash";
import { Button } from "@/components/ui/button";

type ActiveBan = {
  reason: string;
  duration: string;
  created_at: string;
  expires_at: string | null;
};

function firstBan(data: unknown): ActiveBan | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return null;
  const ban = row as Partial<ActiveBan>;
  if (!ban.reason) return null;
  return {
    reason: ban.reason,
    duration: ban.duration || "forever",
    created_at: ban.created_at || new Date().toISOString(),
    expires_at: ban.expires_at ?? null,
  };
}

export function BanGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const [ban, setBan] = useState<ActiveBan | null>(null);
  const [checkedUserId, setCheckedUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setBan(null);
      setCheckedUserId(null);
      return;
    }

    let cancelled = false;
    const load = async () => {
      const { data, error } = await supabase.rpc("my_active_ban");
      if (cancelled) return;
      setBan(error ? null : firstBan(data));
      setCheckedUserId(user.id);
    };

    void load();
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    const timer = window.setInterval(() => void load(), 60_000);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      window.clearInterval(timer);
    };
  }, [user]);

  if (user && checkedUserId !== user.id) {
    return <AppBootSplash />;
  }

  if (!ban) return <>{children}</>;

  const until =
    ban.expires_at && ban.duration !== "forever"
      ? format(new Date(ban.expires_at), "d MMM yyyy, HH:mm")
      : null;

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div
        role="alertdialog"
        aria-labelledby="account-ban-title"
        aria-describedby="account-ban-body"
        className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-zinc-900 md:p-8"
      >
        <h1 id="account-ban-title" className="text-2xl font-black text-zinc-950 dark:text-white">
          {t("accountBan.title")}
        </h1>
        <div id="account-ban-body" className="mt-4 space-y-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
          <p>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">{t("accountBan.reason")}</span>
            <span className="mt-1 block">{ban.reason}</span>
          </p>
          <p>{until ? t("accountBan.until", { when: until }) : t("accountBan.forever")}</p>
        </div>
        <Button
          className="mt-7 h-12 w-full rounded-xl font-bold"
          onClick={() => void signOut()}
        >
          {t("accountBan.signOut")}
        </Button>
      </div>
    </div>
  );
}
